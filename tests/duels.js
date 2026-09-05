/**
 * Fight all hundred duelists.
 *
 * A Hostiles node is one named ship, so a single bad ship is now a whole node
 * type that does not work — there is no crowd around it to hide a mistake in.
 * This plays every duelist at the depths it is legal for and reports the three
 * numbers that decide whether it is a fight: how long it lasts, what it costs,
 * and whether it can be finished at all.
 *
 *   node tests/duels.js                 the full roster
 *   node tests/duels.js --band high     one band
 *   node tests/duels.js --id ash_vicar  one ship, verbosely
 *   node tests/duels.js --samples 3     more seeds per ship
 *
 * Targets: median fight 35-75s, hull cost 8-30%, deaths under 15%, and NO
 * stalls at all. A stall is the only unforgivable result — it means the node
 * cannot be completed, and the run ends there.
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const { createWorld, update } = await import('../src/game/sim.js');
const { DUELISTS } = await import('../src/game/duelists/index.js');
const { DUEL_ENCOUNTERS } = await import('../src/game/encounters/duels.js');
const { createPilot, pilotInput } = await import('./pilot.js');
const { referenceShip } = await import('./refship.js');

const DT = 1 / 60;
const CAP_SECONDS = 180;

const BY_DUELIST = Object.fromEntries(DUEL_ENCOUNTERS.map(e => [e.duelist, e]));

/** Play one duel to a conclusion. */
export function fightDuel(duelist, threat, { skill = 0.7, seed = 'D' } = {}) {
  const encounter = BY_DUELIST[duelist.id];
  const rng = new RNG(`${seed}-${duelist.id}-${threat}`);
  const ship = referenceShip(threat, rng.fork('ship'));
  const startHull = ship.hull;
  const world = createWorld({ encounter, threat, ship, rng: rng.fork('world') });
  const bot = createPilot(skill, rng.fork('pilot'));

  let abilityCasts = 0;
  let peakBullets = 0;
  while (world.state === 'playing' && world.time < CAP_SECONDS) {
    pilotInput(world, bot, DT);
    update(world, DT);
    peakBullets = Math.max(peakBullets, world.eBullets.length);
    for (const ev of world.events) if (ev.type === 'abilityCast') abilityCasts++;
    world.events.length = 0;
  }

  return {
    id: duelist.id,
    name: duelist.name,
    band: duelist.duel.band,
    squadron: duelist.duel.squadron,
    role: duelist.duel.role,
    threat,
    seconds: world.time,
    outcome: world.state === 'won' ? 'won' : world.state === 'lost' ? 'lost' : 'stalled',
    hullCost: (startHull - world.player.hull) / startHull,
    abilityCasts,
    peakBullets,
    // What actually took the hull off. Collisions being high means the ship is
    // winning by being in the way, which is the failure this whole redesign
    // was about.
    bySource: world.stats.bySource,
  };
}

/** The depths a ship should be measured at: its floor, middle and ceiling. */
export function threatsFor(d) {
  const lo = d.duel.minThreat;
  const hi = d.duel.maxThreat;
  const mid = Math.round((lo + hi) / 2);
  return [...new Set([lo, mid, hi])];
}

// ---------------------------------------------------------------------------

// Run as a script, not when imported for its `fightDuel`.
if ((process.argv[1] || '').endsWith('duels.js')) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const bandFilter = arg('band', null);
  const idFilter = arg('id', null);
  const samples = Number(arg('samples', 1));
  const skill = Number(arg('skill', 0.7));

  const roster = DUELISTS.filter(d =>
    (!bandFilter || d.duel.band === bandFilter) && (!idFilter || d.id === idFilter));

  const rows = [];
  for (const d of roster) {
    for (const threat of threatsFor(d)) {
      for (let s = 0; s < samples; s++) {
        rows.push(fightDuel(d, threat, { skill, seed: `S${s}` }));
      }
    }
  }

  const median = a => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)] ?? 0; };
  const pct = v => `${(v * 100).toFixed(0)}%`;

  const stalls = rows.filter(r => r.outcome === 'stalled');
  const losses = rows.filter(r => r.outcome === 'lost');

  console.log(`\n${rows.length} duels across ${roster.length} ships\n`);
  console.log('  median length  ', `${median(rows.map(r => r.seconds)).toFixed(0)}s`);
  console.log('  median cost    ', pct(median(rows.map(r => r.hullCost))));
  console.log('  death rate     ', pct(losses.length / rows.length));
  console.log('  stalls         ', stalls.length);
  console.log('  ability casts  ', median(rows.map(r => r.abilityCasts)).toFixed(0), 'per fight');
  console.log('  peak bullets   ', median(rows.map(r => r.peakBullets)).toFixed(0));

  const contact = rows.reduce((n, r) => n + (r.bySource.contact || 0), 0);
  const all = rows.reduce((n, r) => n + Object.values(r.bySource).reduce((a, b) => a + b, 0), 0);
  console.log('  from ramming   ', pct(all ? contact / all : 0));

  console.log('\nby band');
  for (const band of ['low', 'mid', 'high', 'any']) {
    const g = rows.filter(r => r.band === band);
    if (!g.length) continue;
    console.log(`  ${band.padEnd(5)} n=${String(g.length).padStart(3)}`,
      `${median(g.map(r => r.seconds)).toFixed(0)}s`.padStart(5),
      pct(median(g.map(r => r.hullCost))).padStart(5),
      `deaths ${pct(g.filter(r => r.outcome === 'lost').length / g.length)}`);
  }

  console.log('\nby squadron size');
  for (const n of [1, 2, 3, 4, 5]) {
    const g = rows.filter(r => r.squadron === n);
    if (!g.length) continue;
    console.log(`  ${n} body  n=${String(g.length).padStart(3)}`,
      `${median(g.map(r => r.seconds)).toFixed(0)}s`.padStart(5),
      pct(median(g.map(r => r.hullCost))).padStart(5),
      `deaths ${pct(g.filter(r => r.outcome === 'lost').length / g.length)}`);
  }

  const worst = [...rows].sort((a, b) => b.seconds - a.seconds).slice(0, 8);
  console.log('\nlongest fights');
  for (const r of worst) {
    console.log(`  ${r.id.padEnd(26)} t${String(r.threat).padStart(2)} ${r.seconds.toFixed(0)}s`,
      pct(r.hullCost).padStart(5), r.outcome);
  }

  const free = [...rows].filter(r => r.outcome === 'won').sort((a, b) => a.hullCost - b.hullCost).slice(0, 8);
  console.log('\ncheapest wins');
  for (const r of free) {
    console.log(`  ${r.id.padEnd(26)} t${String(r.threat).padStart(2)} ${r.seconds.toFixed(0)}s`, pct(r.hullCost).padStart(5));
  }

  if (stalls.length) {
    console.log('\nSTALLED — these nodes cannot be finished');
    for (const r of stalls.slice(0, 20)) console.log(`  ${r.id} at threat ${r.threat}`);
  }
}
