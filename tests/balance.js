/**
 * Balance probe.
 *
 * Plays isolated encounters at a range of threat levels with a ship built to
 * the level a player would plausibly have there, and reports the two numbers
 * that decide whether the game feels right: how long a fight lasts, and how
 * much it costs you.
 *
 *   node tests/balance.js              the standard sweep
 *   node tests/balance.js --type boss  restrict to one encounter type
 *   node tests/balance.js --detail 8   per-encounter breakdown at threat 8
 *
 * Targets: median fight 55-95s, hull cost 12-35%, death rate under 12% at a
 * matched level. Anything outside that is a balance bug.
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const S = await import('../src/game/ship.js');
const { createWorld, update } = await import('../src/game/sim.js');
const { candidatesFor, ENCOUNTER_TYPES } = await import('../src/game/encounters/index.js');
const { ATTRIBUTE_IDS } = await import('../src/game/attributes.js');
const { generateItem } = await import('../src/game/items.js');
const { createPilot, pilotInput } = await import('./pilot.js');

const DT = 1 / 60;
const CAP_SECONDS = 240;

/**
 * A ship as it would plausibly be at this threat: levelled to roughly the node
 * level, points spread evenly, and gear rolled at that depth. Balancing against
 * a starting ship at threat 15 would tell us nothing.
 */
function referenceShip(threat, rng, shipId = 'kestrel') {
  const ship = S.createShip(shipId, rng);
  const targetLevel = Math.max(1, Math.min(20, threat));
  for (let l = 1; l < targetLevel; l++) {
    ship.progress.unspentPoints += 2;
    for (let i = 0; i < 2; i++) {
      const a = ship.progress.attributes;
      const lowest = ATTRIBUTE_IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), ATTRIBUTE_IDS[0]);
      S.spendAttributePoint(ship, lowest);
    }
  }
  // Gear roughly matching the depth: most slots filled, mid rarity.
  if (threat > 2) {
    // Utility slots included: without them the reference ship fights with no
    // abilities at all, which is not a build any real run arrives at.
    for (const slot of ['primary', 'secondary', 'engine', 'shield', 'reactor', 'plating', 'computer', 'utility1', 'utility2', 'utility3']) {
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

/** Play one encounter to completion. Returns duration, hull cost and outcome. */
export function probe(encounter, threat, { skill = 0.7, seed = 'B', shipId = 'kestrel' } = {}) {
  const rng = new RNG(`${seed}-${encounter.id}-${threat}`);
  const ship = referenceShip(threat, rng.fork('ship'), shipId);
  const startHull = ship.hull;
  const world = createWorld({ encounter, threat, ship, rng: rng.fork('world') });
  const bot = createPilot(skill, rng.fork('pilot'));

  while (world.state === 'playing' && world.time < CAP_SECONDS) {
    pilotInput(world, bot, DT);
    update(world, DT);
  }

  return {
    id: encounter.id,
    type: encounter.type,
    threat,
    seconds: world.time,
    outcome: world.state === 'won' ? 'won' : world.state === 'lost' ? 'lost' : 'stalled',
    hullCost: (startHull - world.player.hull) / startHull,
    kills: world.stats.kills,
    accuracy: world.stats.shotsFired ? world.stats.shotsHit / world.stats.shotsFired : 0,
    maxHull: ship.stats.maxHull,
    dps: world.stats.damageDealt / Math.max(1, world.time),
  };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const typeFilter = arg('type', null);
const skill = Number(arg('skill', 0.7));
const samples = Number(arg('samples', 2));

const median = a => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)] ?? 0; };
const pct = v => `${(v * 100).toFixed(0)}%`;

if (args.includes('--detail')) {
  const threat = Number(arg('detail', 8));
  const pool = candidatesFor(threat, typeFilter).filter(e => ENCOUNTER_TYPES[e.type]?.action);
  console.log(`\nThreat ${threat} — ${pool.length} encounters, skill ${skill}\n`);
  console.log(`  ${'encounter'.padEnd(26)}${'type'.padEnd(11)}${'time'.padStart(7)}${'hull'.padStart(8)}${'kills'.padStart(7)}  outcome`);
  const rows = pool.map(e => probe(e, threat, { skill }));
  rows.sort((a, b) => b.seconds - a.seconds);
  for (const r of rows) {
    const flag = r.outcome !== 'won' ? '  <-- ' + r.outcome
      : r.seconds < 35 ? '  <-- too short' : r.seconds > 130 ? '  <-- too long' : '';
    console.log(`  ${r.id.padEnd(26)}${r.type.padEnd(11)}${r.seconds.toFixed(0).padStart(6)}s${pct(r.hullCost).padStart(8)}${String(r.kills).padStart(7)}  ${r.outcome}${flag}`);
  }
} else {
  console.log(`\nBalance sweep — skill ${skill}, ${samples} samples per encounter`);
  console.log(`Targets: fight 55-95s, hull cost 12-35%, deaths under 12%\n`);
  console.log(`  ${'threat'.padStart(6)}${'n'.padStart(5)}${'median'.padStart(9)}${'p10'.padStart(7)}${'p90'.padStart(7)}${'hull'.padStart(8)}${'deaths'.padStart(8)}${'stalls'.padStart(8)}${'dps'.padStart(8)}`);

  for (const threat of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) {
    const pool = candidatesFor(threat, typeFilter).filter(e => ENCOUNTER_TYPES[e.type]?.action);
    const rows = [];
    for (const e of pool) {
      for (let s = 0; s < samples; s++) rows.push(probe(e, threat, { skill, seed: `S${s}` }));
    }
    if (rows.length === 0) continue;
    const times = rows.map(r => r.seconds).sort((a, b) => a - b);
    const deaths = rows.filter(r => r.outcome === 'lost').length;
    const stalls = rows.filter(r => r.outcome === 'stalled').length;
    const hull = median(rows.map(r => r.hullCost));
    const p = q => times[Math.floor(times.length * q)] ?? 0;

    const t = median(times);
    const flag = t < 45 ? ' SHORT' : t > 110 ? ' LONG' : '';
    const dflag = deaths / rows.length > 0.15 ? ' LETHAL' : '';
    console.log(`  ${String(threat).padStart(6)}${String(rows.length).padStart(5)}`
      + `${(t.toFixed(0) + 's').padStart(9)}${(p(0.1).toFixed(0) + 's').padStart(7)}${(p(0.9).toFixed(0) + 's').padStart(7)}`
      + `${pct(hull).padStart(8)}${pct(deaths / rows.length).padStart(8)}${pct(stalls / rows.length).padStart(8)}`
      + `${median(rows.map(r => r.dps)).toFixed(0).padStart(8)}${flag}${dflag}`);
  }
}
