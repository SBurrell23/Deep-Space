/**
 * Headless playtester.
 *
 * Drives complete runs through the real simulation with no renderer, which is
 * how the game's pacing, difficulty curve and two-hour target are tuned. The
 * bot is deliberately imperfect and its competence is a parameter, so a build
 * can be checked against a range of player skill rather than one ideal pilot.
 *
 *   node tests/autoplay.js --runs 20 --skill 0.7
 *   node tests/autoplay.js --runs 5 --verbose
 *   node tests/autoplay.js --matrix          skill sweep, for balance passes
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const R = await import('../src/game/run.js');
const U = await import('../src/game/universe.js');
const S = await import('../src/game/ship.js');
const { SHIP_IDS } = await import('../src/game/ships.js');
const { ATTRIBUTE_IDS } = await import('../src/game/attributes.js');
const { powerScore } = await import('../src/game/items.js');
const { loadProfile } = await import('../src/core/save.js');
const { createPilot, pilotInput } = await import('./pilot.js');

const DT = 1 / 60;
/** Wall-clock guard so a broken encounter can't hang the whole sweep. */
const MAX_ENCOUNTER_SECONDS = 300;
const MAX_RUN_SECONDS = 4 * 60 * 60;

// ---------------------------------------------------------------------------
// Strategic layer: map navigation and between-fight decisions
// ---------------------------------------------------------------------------

function chooseNode(run, pilot) {
  const map = run.map;
  const level = run.ship.progress.level;
  const hullFrac = S.hullFraction(run.ship);
  const options = U.reachable(map);
  if (options.length === 0) return null;

  // Push for the Master Fleet once strong enough and it is on the board.
  const goingForIt = level >= 18 && map.masterFleetVisible && hullFrac > 0.6;

  let best = null, bestScore = -Infinity;
  for (const n of options) {
    let score = 0;
    const fresh = !n.cleared;
    if (!fresh) score -= 40;

    // Threat appetite scales with skill, but only slightly: taking a node three
    // levels above you is meant to be a real risk, and a bot that always did it
    // died on its second jump every run and made the game look unwinnable.
    // Prefer nodes near your own level. The old bias toward the highest
    // affordable threat was suicidal once enemy scaling became geometric —
    // and it is not how anyone actually plays.
    const appetite = level + 0.5 + pilot.skill * 1.5;
    const over = n.threat - appetite;
    if (over > 0) score -= over * over * 18;
    else score -= Math.abs(n.threat - level) * 12;

    if (fresh) {
      if (n.type === 'shop') score += hullFrac < 0.75 ? 70 : 12;
      if (n.type === 'anomaly') score += 16;
      if (n.type === 'empty') score -= 12;
      if (n.type === 'boss') score += level > n.threat + 2 ? 20 : -25;
      if (n.type === 'masterfleet') score += goingForIt ? 500 : -500;
    }

    // Bias outward — depth is progress. Retreat inward when badly hurt.
    const here = U.currentNode(map);
    const outward = n.ring - here.ring;
    // Depth is progress, but not at the cost of out-levelling yourself: the
    // map's threat gradient rises faster than a straight run outward levels you.
    score += hullFrac < 0.35 ? -outward * 22 : outward * 6;

    // Break ties randomly so repeat runs don't follow identical paths.
    score += pilot.rng.float(0, 8);

    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

function manageLoadout(run) {
  const ship = run.ship;
  // Equip anything better than what is in the slot, sell the rest.
  for (const item of [...ship.inventory]) {
    if (S.isUpgrade(ship, item)) S.equip(ship, item.uid);
  }
  while (ship.inventory.length > 18) {
    const worst = [...ship.inventory].sort((a, b) => powerScore(a) - powerScore(b))[0];
    R.sellItem(run, worst.uid);
  }
}

function spendPoints(run, pilot) {
  const ship = run.ship;
  // A simple but sane build: keep survivability ahead of damage, then top up
  // whatever is lowest. Mirrors how most players actually spend.
  while (S.hasUnspentPoints(ship)) {
    const a = ship.progress.attributes;
    let pick;
    if (a.hull <= a.weapons - 2) pick = 'hull';
    else if (a.shields <= a.weapons - 2) pick = 'shields';
    else if (a.reactor < 4) pick = 'reactor';
    else if (pilot.rng.chance(0.42)) pick = 'weapons';
    else pick = ATTRIBUTE_IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), ATTRIBUTE_IDS[0]);
    if (!R.spendPoint(run, pick)) break;
  }
  if (run.phase === 'levelup') R.closeLevelUp(run);
}

function handleShop(run) {
  const ship = run.ship;
  if (S.hullFraction(ship) < 0.8) R.buyRepair(run);
  // Buy any affordable clear upgrade.
  for (const item of [...(run.shopStock?.items || [])]) {
    if (ship.credits < item.value) continue;
    if (S.isUpgrade(ship, item)) {
      const res = R.buyItem(run, item.uid);
      if (res.ok) S.equip(ship, item.uid);
    }
  }
  R.leaveShop(run);
}

function handleAnomaly(run, pilot) {
  const choices = R.anomalyChoices(run).filter(c => c.ok);
  if (choices.length === 0) { run.phase = 'map'; return; }
  // Bolder pilots take the gated/risky option more often.
  const idx = pilot.rng.chance(0.35 + pilot.skill * 0.3)
    ? choices[choices.length - 1].index
    : pilot.rng.pick(choices).index;
  R.chooseAnomaly(run, idx);
  if (run.phase === 'anomaly') R.closeAnomaly(run);
}

// ---------------------------------------------------------------------------
// Run driver
// ---------------------------------------------------------------------------

export function playRun({ shipId = 'kestrel', seed = null, skill = 0.7, verbose = false, profile = null } = {}) {
  const rng = new RNG(seed ? `${seed}-pilot` : Date.now());
  const pilot = createPilot(skill, rng);
  const run = R.startRun({ shipId, seed, profile: profile || loadProfile() });

  const trace = [];
  let guard = 0;
  const encounterTimes = [];

  while (run.phase !== 'dead' && run.phase !== 'victory' && guard++ < 4000) {
    if (run.elapsed > MAX_RUN_SECONDS) { run.timedOut = true; break; }

    switch (run.phase) {
      case 'map': {
        const node = chooseNode(run, pilot);
        if (!node) { run.stuck = true; guard = Infinity; break; }
        R.jump(run, node.id);
        break;
      }
      case 'brief':
        R.beginEncounter(run);
        break;
      case 'action': {
        const t0 = run.world.time;
        while (run.phase === 'action' && run.world.time < MAX_ENCOUNTER_SECONDS) {
          pilotInput(run.world, pilot, DT);
          R.tick(run, DT);
        }
        if (run.phase === 'action') {
          // Ran out of patience — treat as a disengage so the run continues.
          R.flee(run);
          R.tick(run, DT);
        }
        encounterTimes.push(run.world ? run.world.time - t0 : 0);
        break;
      }
      case 'debrief': {
        const enc = run.encounter;
        const p = run.pending;
        R.collectRewards(run);
        if (verbose && p && !p.fled) {
          trace.push(`  ${pad(enc.type, 12)} t${pad(run.node?.threat, 2)} `
            + `${p.time.toFixed(0)}s  +${p.xp}xp +${p.credits}cr  `
            + `hull ${Math.round(run.ship.hull)}/${run.ship.stats.maxHull}  L${run.ship.progress.level}`);
        }
        manageLoadout(run);
        break;
      }
      case 'levelup': spendPoints(run, pilot); break;
      case 'shop': handleShop(run); break;
      case 'anomaly': handleAnomaly(run, pilot); break;
      default:
        guard = Infinity;
    }
  }

  return {
    outcome: run.phase === 'victory' ? 'victory' : run.stuck ? 'stuck' : run.timedOut ? 'timeout' : 'death',
    elapsed: run.elapsed,
    // ~22s per node of map reading, debrief and loadout fiddling.
    wallClock: run.elapsed + run.stats.nodesCleared * 22,
    level: run.ship.progress.level,
    ring: run.stats.deepestRing,
    nodes: run.stats.nodesCleared,
    kills: run.stats.kills,
    bosses: run.stats.bossesKilled,
    credits: run.ship.credits,
    hull: Math.round(run.ship.hull),
    maxHull: run.ship.stats.maxHull,
    accuracy: run.stats.shotsFired ? run.stats.shotsHit / run.stats.shotsFired : 0,
    fled: run.stats.encountersFled,
    perfect: run.stats.perfectClears,
    avgEncounter: encounterTimes.length
      ? encounterTimes.reduce((a, b) => a + b, 0) / encounterTimes.length : 0,
    encounters: encounterTimes.length,
    attributes: { ...run.ship.progress.attributes },
    seed: run.seed,
    shipId,
    trace,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function pad(v, n) { return String(v).padEnd(n); }
function mins(s) { return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`; }

function summarise(label, results) {
  const wins = results.filter(r => r.outcome === 'victory');
  const avg = (f) => results.reduce((a, r) => a + f(r), 0) / Math.max(1, results.length);
  const med = (f) => {
    const v = results.map(f).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  };

  console.log(`\n  ${label}`);
  console.log(`    runs:          ${results.length}`);
  console.log(`    win rate:      ${(wins.length / results.length * 100).toFixed(0)}%`);
  console.log(`    combat time:   ${mins(med(r => r.elapsed))}   (wins: ${wins.length ? mins(median(wins.map(r => r.elapsed))) : '-'})`);
  console.log(`    est wall clock:${mins(med(r => r.wallClock))}   (wins: ${wins.length ? mins(median(wins.map(r => r.wallClock))) : '-'})`);
  console.log(`    avg level:     ${avg(r => r.level).toFixed(1)}   max ${Math.max(...results.map(r => r.level))}`);
  console.log(`    avg ring:      ${avg(r => r.ring).toFixed(1)}   max ${Math.max(...results.map(r => r.ring))}`);
  console.log(`    avg nodes:     ${avg(r => r.nodes).toFixed(0)}`);
  console.log(`    avg encounter: ${avg(r => r.avgEncounter).toFixed(0)}s over ${avg(r => r.encounters).toFixed(0)} fights`);
  console.log(`    accuracy:      ${(avg(r => r.accuracy) * 100).toFixed(0)}%`);
  console.log(`    disengages:    ${avg(r => r.fled).toFixed(1)} per run`);
  const bad = results.filter(r => r.outcome === 'stuck' || r.outcome === 'timeout');
  if (bad.length) console.log(`    PROBLEMS:      ${bad.length} (${bad.map(r => r.outcome).join(', ')})`);
  return { wins: wins.length, total: results.length, medianLength: med(r => r.elapsed) };
}

function median(arr) {
  const v = [...arr].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
}

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

if (args.includes('--matrix')) {
  console.log('Skill sweep — is the game beatable, and does skill matter?');
  for (const skill of [0.35, 0.55, 0.75, 0.95]) {
    const results = [];
    for (let i = 0; i < Number(arg('runs', 8)); i++) {
      results.push(playRun({ seed: `MX-${skill}-${i}`, skill }));
    }
    summarise(`skill ${skill}`, results);
  }
} else if (args.includes('--ships')) {
  console.log('Per-hull sweep');
  for (const shipId of SHIP_IDS) {
    const results = [];
    for (let i = 0; i < Number(arg('runs', 4)); i++) {
      results.push(playRun({ shipId, seed: `SH-${shipId}-${i}`, skill: 0.75 }));
    }
    summarise(shipId, results);
  }
} else {
  const n = Number(arg('runs', 10));
  const skill = Number(arg('skill', 0.7));
  const verbose = args.includes('--verbose');
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = playRun({ seed: `AP-${i}`, skill, verbose });
    results.push(r);
    if (verbose) {
      console.log(`\nrun ${i + 1}: ${r.outcome} — L${r.level} ring ${r.ring}, ${r.nodes} nodes, ${mins(r.elapsed)}`);
      r.trace.slice(0, 40).forEach(t => console.log(t));
    } else {
      process.stdout.write(r.outcome === 'victory' ? 'W' : r.outcome === 'death' ? '.' : '?');
    }
  }
  if (!verbose) console.log('');
  const sum = summarise(`skill ${skill}`, results);
  // Non-zero exit if the game is structurally broken, so CI catches it.
  const broken = results.filter(r => r.outcome === 'stuck').length;
  process.exit(broken > 0 ? 1 : 0);
}
