/**
 * Economy and progression probe.
 *
 * The balance sweep in `balance.js` answers "is this fight fair". This answers
 * the three questions that sweep cannot see, because they only exist across a
 * whole run:
 *
 *   XP      — how many nodes buy a level, and does levelling keep pace with the
 *             threat gradient the map pushes you into?
 *   Gold    — is the player ever actually choosing? An economy where you can
 *             afford everything you want is not an economy.
 *   Attrition — what does a fight cost, and does that cost accumulate?
 *
 * It reuses autoplay's pilot and bot logic, but records every transaction
 * rather than a summary.
 *
 *   node tests/economy.js --runs 8 --skill 0.75
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const R = await import('../src/game/run.js');
const U = await import('../src/game/universe.js');
const S = await import('../src/game/ship.js');
const { xpToNext, xpTotalFor, MAX_LEVEL } = await import('../src/game/attributes.js');
const { powerScore } = await import('../src/game/items.js');
const { loadProfile } = await import('../src/core/save.js');
const { createPilot, pilotInput } = await import('./pilot.js');

const DT = 1 / 60;
const MAX_ENCOUNTER_SECONDS = 300;

// ---------------------------------------------------------------------------
// A run, instrumented
// ---------------------------------------------------------------------------

function playInstrumented({ seed, skill, shipId = 'kestrel' }) {
  const rng = new RNG(`${seed}-pilot`);
  const pilot = createPilot(skill, rng);
  const run = R.startRun({ shipId, seed, profile: loadProfile() });

  const nodes = [];     // one row per cleared node
  const shops = [];     // one row per trading post
  const levels = [];    // node index at which each level was reached
  let lastLevel = 1;
  let guard = 0;

  while (run.phase !== 'dead' && run.phase !== 'victory' && guard++ < 4000) {
    switch (run.phase) {
      case 'map': {
        const node = chooseNode(run, pilot);
        if (!node) { run.stuck = true; guard = Infinity; break; }
        R.jump(run, node.id);
        break;
      }
      case 'brief': R.beginEncounter(run); break;
      case 'action': {
        const hullBefore = run.ship.hull;
        while (run.phase === 'action' && run.world.time < MAX_ENCOUNTER_SECONDS) {
          pilotInput(run.world, pilot, DT);
          R.tick(run, DT);
        }
        if (run.phase === 'action') { R.flee(run); R.tick(run, DT); }
        run._hullBefore = hullBefore;
        break;
      }
      case 'debrief': {
        const p = run.pending;
        const threat = run.node?.threat ?? 1;
        const type = run.encounter?.type || 'unknown';
        const hullBefore = run._hullBefore ?? run.ship.hull;
        // Net hull change hides how much healing undid: lifesteal, pickups and
        // repair abilities all put hull back mid-fight.
        const w = p?.world;
        const raw = w ? w.stats.damageTaken : 0;
        const hullAfter = w ? w.player.hull : run.ship.hull;
        R.collectRewards(run);
        if (p && !p.fled) {
          nodes.push({
            threat, type,
            xp: p.xp,
            credits: p.credits,
            seconds: p.time,
            hullCost: Math.max(0, hullBefore - hullAfter),
            damageTaken: raw,
            healed: w ? w.stats.healed : 0,
            healPickup: w ? w.stats.healedPickup : 0,
            healLifesteal: w ? w.stats.healedLifesteal : 0,
            healAbility: w ? w.stats.healedAbility : 0,
            maxHull: run.ship.stats.maxHull,
            level: run.ship.progress.level,
            items: p.items.length,
          });
        }
        manageLoadout(run);
        break;
      }
      case 'levelup': spendPoints(run, pilot); break;
      case 'shop': {
        const ship = run.ship;
        const stock = run.shopStock;
        const before = ship.credits;
        const repairCost = stock?.repairCost ?? 0;
        const hurt = S.hullFraction(ship);
        // What did the shop have that this ship actually wanted?
        const wanted = (stock?.items || []).filter(i => S.isUpgrade(ship, i));
        const wantedCost = wanted.reduce((a, i) => a + i.value, 0);
        const needRepair = hurt < 0.8;
        const totalWanted = wantedCost + (needRepair ? repairCost : 0);

        handleShop(run);

        shops.push({
          before,
          after: ship.credits,
          spent: before - ship.credits,
          offered: (stock?.items || []).length,
          wanted: wanted.length,
          wantedCost,
          repairCost: needRepair ? repairCost : 0,
          totalWanted,
          // The number that matters: could you have had everything you wanted?
          couldAffordAll: before >= totalWanted,
          hullFrac: hurt,
        });
        break;
      }
      case 'anomaly': handleAnomaly(run, pilot); break;
      default: guard = Infinity;
    }

    if (run.ship.progress.level !== lastLevel) {
      for (let l = lastLevel + 1; l <= run.ship.progress.level; l++) {
        levels.push({ level: l, node: nodes.length, threat: run.node?.threat ?? 1 });
      }
      lastLevel = run.ship.progress.level;
    }
  }

  return {
    outcome: run.phase === 'victory' ? 'victory' : run.stuck ? 'stuck' : 'death',
    nodes, shops, levels,
    endLevel: run.ship.progress.level,
    endCredits: run.ship.credits,
    endRing: run.stats.deepestRing,
    elapsed: run.elapsed,
    creditsEarned: run.stats.creditsEarned,
    creditsSpent: run.stats.creditsSpent,
    itemsFound: run.stats.itemsFound,
    itemsSold: run.stats.itemsSold,
    hullRepaired: run.stats.hullRepaired,
  };
}

// --- bot logic, lifted from autoplay so both probes play the same game ------

function chooseNode(run, pilot) {
  const map = run.map;
  const level = run.ship.progress.level;
  const hullFrac = S.hullFraction(run.ship);
  const options = U.reachable(map);
  if (options.length === 0) return null;
  const goingForIt = level >= 18 && map.masterFleetVisible && hullFrac > 0.6;

  let best = null, bestScore = -Infinity;
  for (const n of options) {
    let score = 0;
    const fresh = !n.cleared;
    if (!fresh) score -= 40;
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
    const here = U.currentNode(map);
    const outward = n.ring - here.ring;
    score += hullFrac < 0.35 ? -outward * 22 : outward * 6;
    score += pilot.rng.float(0, 8);
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

function manageLoadout(run) {
  const ship = run.ship;
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
  const IDS = ['hull', 'shields', 'weapons', 'reactor', 'thrusters', 'systems'];
  while (S.hasUnspentPoints(ship)) {
    const a = ship.progress.attributes;
    let pick;
    if (a.hull <= a.weapons - 2) pick = 'hull';
    else if (a.shields <= a.weapons - 2) pick = 'shields';
    else if (a.reactor < 4) pick = 'reactor';
    else if (pilot.rng.chance(0.42)) pick = 'weapons';
    else pick = IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), IDS[0]);
    if (!R.spendPoint(run, pick)) break;
  }
  if (run.phase === 'levelup') R.closeLevelUp(run);
}

function handleShop(run) {
  const ship = run.ship;
  if (S.hullFraction(ship) < 0.8) R.buyRepair(run);
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
  const idx = pilot.rng.chance(0.35 + pilot.skill * 0.3)
    ? choices[choices.length - 1].index
    : pilot.rng.pick(choices).index;
  R.chooseAnomaly(run, idx);
  if (run.phase === 'anomaly') R.closeAnomaly(run);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const RUNS = Number(arg('runs', 8));
const SKILL = Number(arg('skill', 0.75));

const results = [];
for (let i = 0; i < RUNS; i++) {
  process.stdout.write('.');
  results.push(playInstrumented({ seed: `EC-${i}`, skill: SKILL }));
}
console.log('\n');

const allNodes = results.flatMap(r => r.nodes);
const allShops = results.flatMap(r => r.shops);

// --- the XP curve as actually played --------------------------------------
console.log('XP — what a node pays, against what a level costs');
console.log('  lvl   nodes to next   node xp (median)   level cost   nodes needed');
const byLevel = {};
for (const n of allNodes) (byLevel[n.level] = byLevel[n.level] || []).push(n.xp);
for (let l = 1; l < MAX_LEVEL; l++) {
  const xps = (byLevel[l] || []).sort((a, b) => a - b);
  if (!xps.length) continue;
  const medXp = xps[Math.floor(xps.length / 2)];
  const cost = xpToNext(l);
  const needed = cost / Math.max(1, medXp);
  console.log(`  ${String(l).padStart(3)}   ${String(xps.length).padStart(11)}   `
    + `${String(medXp).padStart(15)}   ${String(cost).padStart(10)}   ${needed.toFixed(1).padStart(12)}`);
}

const reached20 = results.filter(r => r.levels.some(l => l.level === 20));
console.log(`\n  reached level 20: ${reached20.length}/${results.length}`
  + (reached20.length
    ? `  after a median of ${median(reached20.map(r => r.levels.find(l => l.level === 20).node))} nodes`
    : ''));
console.log(`  total XP to 20: ${xpTotalFor(20)}`);

// --- level vs threat: is the player keeping up? ----------------------------
console.log('\nLevel against the threat it is meeting');
console.log('  level   median threat of nodes taken   gap');
const threatByLevel = {};
for (const n of allNodes) (threatByLevel[n.level] = threatByLevel[n.level] || []).push(n.threat);
for (let l = 1; l <= MAX_LEVEL; l++) {
  const ts = (threatByLevel[l] || []).sort((a, b) => a - b);
  if (ts.length < 3) continue;
  const m = ts[Math.floor(ts.length / 2)];
  console.log(`  ${String(l).padStart(5)}   ${String(m).padStart(27)}   ${(m - l >= 0 ? '+' : '') + (m - l)}`);
}

// --- attrition -------------------------------------------------------------
console.log('\nWhat a fight costs and how long it takes');
console.log('  threat    n   median s   hull cost   0-cost fights   dmg taken   healed back   (pickup/steal/abil)');
const bands = [[1, 3], [4, 6], [7, 9], [10, 12], [13, 15], [16, 18], [19, 24]];
for (const [lo, hi] of bands) {
  const rows = allNodes.filter(n => n.threat >= lo && n.threat <= hi && n.seconds != null);
  if (!rows.length) continue;
  const secs = rows.map(r => r.seconds).sort((a, b) => a - b);
  const costs = rows.map(r => r.hullCost / r.maxHull).sort((a, b) => a - b);
  const free = rows.filter(r => r.hullCost <= 0.5).length;
  const dmg = rows.map(r => (r.damageTaken || 0) / r.maxHull).sort((a, b) => a - b);
  const heal = rows.reduce((a, r) => a + (r.healed || 0), 0);
  const took = rows.reduce((a, r) => a + (r.damageTaken || 0), 0);
  console.log(`  ${String(lo + '-' + hi).padStart(6)}  ${String(rows.length).padStart(3)}   `
    + `${secs[Math.floor(secs.length / 2)].toFixed(0).padStart(8)}   `
    + `${(costs[Math.floor(costs.length / 2)] * 100).toFixed(0).padStart(9)}%   `
    + `${(100 * free / rows.length).toFixed(0).padStart(12)}%   `
    + `${(dmg[Math.floor(dmg.length / 2)] * 100).toFixed(0).padStart(8)}%   `
    + `${(took ? 100 * heal / took : 0).toFixed(0).padStart(10)}%   `
    + `${share(rows, 'healPickup')}/${share(rows, 'healLifesteal')}/${share(rows, 'healAbility')}`);
}

// --- the economy -----------------------------------------------------------
console.log('\nGold');
const perNode = allNodes.map(n => n.credits).sort((a, b) => a - b);
console.log(`  credits per cleared node (median): ${perNode[Math.floor(perNode.length / 2)]}`);
console.log(`  earned per run (median):           ${median(results.map(r => r.creditsEarned))}`);
console.log(`  spent per run (median):            ${median(results.map(r => r.creditsSpent))}`);
console.log(`  left over at the end (median):     ${median(results.map(r => r.endCredits))}`);
console.log(`  hull repaired per run (median):    ${median(results.map(r => Math.round(r.hullRepaired)))}`);

if (allShops.length) {
  const couldAffordAll = allShops.filter(s => s.couldAffordAll).length;
  const spentAll = allShops.filter(s => s.after < 40).length;
  const wantedNothing = allShops.filter(s => s.totalWanted === 0).length;
  console.log(`\n  trading posts visited: ${allShops.length}`);
  console.log(`  had nothing you wanted:        ${pct(wantedNothing, allShops.length)}`);
  console.log(`  could afford EVERYTHING wanted: ${pct(couldAffordAll, allShops.length)}   <- an economy wants this low`);
  console.log(`  left nearly broke:             ${pct(spentAll, allShops.length)}`);
  const w = allShops.filter(s => s.totalWanted > 0);
  if (w.length) {
    console.log(`  median wanted / median held:   ${median(w.map(s => s.totalWanted))} / ${median(w.map(s => s.before))}`);
  }
}

function share(rows, key) {
  const tot = rows.reduce((a, r) => a + (r.healPickup || 0) + (r.healLifesteal || 0) + (r.healAbility || 0), 0);
  const part = rows.reduce((a, r) => a + (r[key] || 0), 0);
  return `${(tot ? 100 * part / tot : 0).toFixed(0)}%`;
}

function median(arr) {
  const v = [...arr].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}
function pct(n, d) { return `${(100 * n / d).toFixed(0)}%`.padStart(4); }
