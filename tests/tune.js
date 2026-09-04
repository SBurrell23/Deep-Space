/**
 * Difficulty tuner.
 *
 * Plays the same set of encounters under several candidate values of
 * `balance.js` BALANCE and prints what each does to the three numbers that
 * decide whether a fight is worth playing: how long it lasts, what it costs,
 * and how often it kills you.
 *
 * This exists because those three move together — lengthening a fight raises
 * its cost and its death rate at the same time — so tuning them one at a time
 * by hand converges slowly and lies to you on the way.
 *
 *   node tests/tune.js                 the shortlist
 *   node tests/tune.js --samples 3     more samples per encounter, slower
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const S = await import('../src/game/ship.js');
const { createWorld, update, drainEvents } = await import('../src/game/sim.js');
const { candidatesFor, ENCOUNTER_TYPES } = await import('../src/game/encounters/index.js');
const { ATTRIBUTE_IDS } = await import('../src/game/attributes.js');
const { generateItem } = await import('../src/game/items.js');
const { BALANCE } = await import('../src/game/balance.js');
const E = BALANCE.enemies;
const D = BALANCE.defence;
const N = BALANCE.encounters;
const { createPilot, pilotInput } = await import('./pilot.js');

const DT = 1 / 60;
const CAP_SECONDS = 200;
const THREATS = [1, 4, 8, 12, 16, 20];

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const SAMPLES = Number(arg('samples', 2));
const SKILL = Number(arg('skill', 0.7));

function referenceShip(threat, rng, shipId = 'kestrel') {
  const ship = S.createShip(shipId, rng);
  const target = Math.max(1, Math.min(20, threat));
  for (let l = 1; l < target; l++) {
    ship.progress.unspentPoints += 2;
    for (let i = 0; i < 2; i++) {
      const a = ship.progress.attributes;
      const lowest = ATTRIBUTE_IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), ATTRIBUTE_IDS[0]);
      S.spendAttributePoint(ship, lowest);
    }
  }
  if (threat > 2) {
    for (const slot of ['primary', 'secondary', 'engine', 'shield', 'reactor', 'plating',
      'computer', 'utility1', 'utility2', 'utility3']) {
      const item = generateItem(rng, { slot, level: Math.max(1, threat - 1) });
      ship.inventory.push(item);
      if (S.isUpgrade(ship, item)) S.equip(ship, item.uid);
    }
  }
  S.recompute(ship);
  ship.hull = ship.stats.maxHull;
  ship.shield = ship.stats.maxShield;
  return ship;
}

/** One threat band under the current balance numbers. */
function measure(threat) {
  // Only encounters you actually fly against: an anomaly resolves instantly
  // and would drag every median to zero.
  const pool = candidatesFor(threat)
    .filter(e => ENCOUNTER_TYPES[e.type]?.action && e.type !== 'masterfleet');
  const times = [], costs = [];
  let deaths = 0, fights = 0;

  for (const enc of pool) {
    for (let i = 0; i < SAMPLES; i++) {
      const rng = new RNG(`TUNE-${threat}-${enc.id}-${i}`);
      const ship = referenceShip(threat, rng.fork('ship'));
      const maxHull = ship.stats.maxHull;
      const world = createWorld({ encounter: enc, threat, ship, rng: rng.fork('world') });
      const pilot = createPilot(SKILL, rng.fork('pilot'));

      let t = 0;
      while (world.state === 'playing' && t < CAP_SECONDS) {
        pilotInput(world, pilot, DT);
        update(world, DT);
        drainEvents(world);
        t += DT;
      }
      fights++;
      if (world.state === 'lost') { deaths++; continue; }
      if (world.state !== 'won') continue;      // ran out of clock; not a datum
      times.push(t);
      costs.push((maxHull - world.player.hull) / maxHull);
    }
  }
  // The mean, not the median. The synthetic pilot's competence is binary — it
  // either evades a fight almost entirely or dies in it — so its median cost
  // sits at zero however lethal the game is, and tuning against that number
  // chases it forever. What the mean and the free-fight share together answer
  // is the real question: does a fight cost anything?
  const mean = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  return {
    threat,
    seconds: median(times),
    cost: mean,
    free: costs.length ? costs.filter(c => c < 0.05).length / costs.length : 0,
    deathRate: fights ? deaths / fights : 0,
    fights,
  };
}

function median(a) {
  const v = [...a].sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}

/**
 * Candidate tunings.
 *
 * The knobs interact, which is the whole reason this file exists. Raising the
 * shield leak mostly bites in fights the shield SURVIVES — the shallow ones —
 * because a fight that strips the shield is already sending everything to the
 * hull. So leak flattens the cost curve, while damageScale moves the whole
 * thing up or down.
 */
const CANDIDATES = [
  { name: 'dmg .22 (committed)', apply: () => {} },
  { name: 'dmg .28', apply: () => { E.damageScale = 0.28; } },
  { name: 'dmg .34', apply: () => { E.damageScale = 0.34; } },
  { name: 'dmg .34, leak .50', apply: () => { E.damageScale = 0.34; D.shieldLeakBase = 0.50; D.shieldLeakPerShields = 0.011; D.shieldLeakFloor = 0.26; } },
  { name: 'dmg .40, leak .50', apply: () => { E.damageScale = 0.40; D.shieldLeakBase = 0.50; D.shieldLeakPerShields = 0.011; D.shieldLeakFloor = 0.26; } },
];

const ORIGINAL = JSON.parse(JSON.stringify({ e: E, d: D, n: N }));

function restore() {
  Object.assign(E, JSON.parse(JSON.stringify(ORIGINAL.e)));
  Object.assign(D, JSON.parse(JSON.stringify(ORIGINAL.d)));
  Object.assign(N, JSON.parse(JSON.stringify(ORIGINAL.n)));
}

console.log(`Difficulty tuner — skill ${SKILL}, ${SAMPLES} sample(s) per encounter`);
console.log('Targets: 55-95s, hull cost 12-35%, deaths under 10%\n');

for (const cand of CANDIDATES) {
  restore();
  cand.apply();
  console.log(`  ${cand.name}`);
  console.log('    threat    n   median s   mean cost   free fights   deaths');
  let flags = 0;
  for (const threat of THREATS) {
    const r = measure(threat);
    const bad = [];
    if (r.seconds < 45 || r.seconds > 105) bad.push('LEN');
    if (r.cost < 0.10 || r.cost > 0.40) bad.push('COST');
    if (r.free > 0.45) bad.push('FREE');
    if (r.deathRate > 0.12) bad.push('DEATH');
    flags += bad.length;
    console.log(`    ${String(threat).padStart(6)}  ${String(r.fights).padStart(3)}   `
      + `${r.seconds.toFixed(0).padStart(8)}   ${(r.cost * 100).toFixed(0).padStart(9)}%   `
      + `${(r.free * 100).toFixed(0).padStart(11)}%   `
      + `${(r.deathRate * 100).toFixed(0).padStart(5)}%   ${bad.join(' ')}`);
  }
  console.log(`    -> ${flags} target misses\n`);
}
restore();
