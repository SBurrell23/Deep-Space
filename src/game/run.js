/**
 * Run orchestration.
 *
 * Owns the run's phase machine and everything that happens between fights:
 * travel, rewards, levelling, loot, anomaly resolution and the Master Fleet
 * finale. The action simulation is created here but stepped by the caller, so
 * this module stays free of any frame loop.
 *
 * Phases:
 *   map -> brief -> action -> debrief -> map
 *              \-> anomaly -/
 *              \-> shop ----/
 *   ... -> levelup (interrupts, whenever points are unspent)
 *   ... -> dead | victory
 */

import { RNG } from '../core/rng.js';
import * as U from './universe.js';
import * as S from './ship.js';
import { createWorld, update as stepWorld, retreat as retreatWorld, WORLD_W, WORLD_H } from './sim.js';
import { getEncounter, ENCOUNTER_TYPES } from './encounters/index.js';
import { nodeXpValue } from './attributes.js';
import { generateItem, sellValue, SLOT_IDS } from './items.js';
import { checkAchievements } from './achievements.js';

export const PHASES = ['map', 'brief', 'action', 'debrief', 'anomaly', 'shop', 'levelup', 'dead', 'victory'];

export const MASTER_FLEET_STAGES = ['masterfleet_1', 'masterfleet_2', 'masterfleet_3'];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startRun({ shipId = 'kestrel', seed = null, profile = null } = {}) {
  const seedValue = seed || RNG.friendlySeed();
  const rng = new RNG(seedValue);

  const ship = S.createShip(shipId, rng.fork('ship'));
  const map = U.generateUniverse(rng.fork('universe'));

  const run = {
    seed: seedValue,
    rng,
    map,
    ship,
    profile,

    phase: 'map',
    world: null,
    node: null,
    encounter: null,
    pending: null,          // rewards awaiting the debrief screen
    anomalyResult: null,
    shopStock: null,

    elapsed: 0,
    startedAt: Date.now(),
    masterFleetStage: 0,

    log: [],
    newAchievements: [],

    stats: {
      nodesCleared: 0, kills: 0, deaths: 0, damageTaken: 0, damageDealt: 0,
      creditsEarned: 0, creditsSpent: 0, itemsFound: 0, itemsSold: 0,
      encountersWon: 0, encountersFled: 0, bossesKilled: 0, shotsFired: 0,
      shotsHit: 0, dashes: 0, abilitiesUsed: 0, deepestRing: 0, anomaliesResolved: 0,
      hullRepaired: 0, terrainHits: 0, perfectClears: 0,
      rammed: 0, derelictsCleared: 0, everCritical: false, tradesMade: 0,
      shopsVisited: 0, tunnelsCleared: 0, bossesMet: 0,
    },
  };

  U.revealFrom(map, 0, U.scanRadius(ship));
  logLine(run, `${ship.name} clears the yard. Seed ${seedValue}.`);
  return run;
}

export function logLine(run, text) {
  run.log.unshift({ text, t: run.elapsed });
  if (run.log.length > 60) run.log.pop();
}

/** Called once per frame by the host, whatever the phase. */
export function tick(run, dt) {
  run.elapsed += dt;
  if (run.phase === 'action' && run.world) {
    stepWorld(run.world, dt);
    if (run.world.state !== 'playing') concludeEncounter(run);
  }
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

export function jump(run, nodeId) {
  if (run.phase !== 'map') return { ok: false, reason: 'not on the map' };
  if (!U.canJumpTo(run.map, nodeId)) return { ok: false, reason: 'no route there' };

  U.jumpTo(run.map, nodeId, run.ship);
  const node = U.currentNode(run.map);
  run.node = node;
  run.stats.deepestRing = Math.max(run.stats.deepestRing, node.ring);

  if (U.isCleared(run.map, nodeId)) {
    // A cleared node is a waypoint, nothing more. This is what pushes the run
    // outward instead of letting you farm the safe ring you started in.
    logLine(run, `${node.encounterName || 'Empty space'} — already picked clean.`);
    run.phase = 'map';
    return { ok: true, revisit: true };
  }

  return openNode(run, node);
}

/**
 * Travel a multi-hop route through already-cleared space in one move.
 *
 * Every node before the last is cleared and so resolves as a plain revisit;
 * only the final node opens. Guards against a route that stops being legal
 * mid-walk rather than trusting the caller's cached path.
 */
export function travelPath(run, path) {
  if (run.phase !== 'map' || !Array.isArray(path) || path.length === 0) {
    return { ok: false, reason: 'no route' };
  }
  let last = null;
  for (const id of path) {
    if (!U.canJumpTo(run.map, id)) return { ok: false, reason: 'route is no longer clear' };
    last = jump(run, id);
    // The last hop is the only one that can open an encounter; if an earlier
    // one somehow does, stop there rather than skipping past it.
    if (run.phase !== 'map') break;
  }
  return last || { ok: false, reason: 'no route' };
}

function openNode(run, node) {
  const enc = getEncounter(node.encounterId);
  run.encounter = enc;

  if (!enc) {
    U.markCleared(run.map, node.id);
    run.phase = 'map';
    return { ok: true, empty: true };
  }

  switch (enc.type) {
    case 'anomaly':
      run.phase = 'anomaly';
      run.anomalyResult = null;
      return { ok: true, phase: 'anomaly' };
    case 'shop':
      run.shopStock = rollShopStock(run, node);
      run.phase = 'shop';
      return { ok: true, phase: 'shop' };
    case 'empty': {
      const xp = Math.round(nodeXpValue(node.threat) * 0.25);
      S.addXp(run.ship, xp);
      U.markCleared(run.map, node.id);
      logLine(run, `${enc.name}. ${enc.blurb}`);
      run.phase = maybeLevelUp(run, 'map');
      return { ok: true, phase: 'empty', xp };
    }
    default:
      run.phase = 'brief';
      return { ok: true, phase: 'brief' };
  }
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

/** Commit to the fight described by the brief screen. */
export function beginEncounter(run, encounterId = null) {
  const enc = encounterId ? getEncounter(encounterId) : run.encounter;
  if (!enc) return false;
  run.encounter = enc;
  run.world = createWorld({
    encounter: enc,
    threat: run.node?.threat ?? 1,
    ship: run.ship,
    rng: run.rng.fork(`enc${run.map.jumps}-${enc.id}`),
    // The field spans the player's window; height is fixed, so the vertical
    // dodging space everyone gets is identical.
    width: run.fieldWidth,
  });
  run.phase = 'action';
  return true;
}

/**
 * Back out of the brief without engaging.
 *
 * You have arrived at the node and looked at what is waiting; you have not
 * committed to it. The node stays uncleared and you are free to jump on.
 * Once the fight starts there is no such door.
 */
export function declineEncounter(run) {
  if (run.phase !== 'brief') return false;
  run.encounter = null;
  run.phase = maybeLevelUp(run, 'map');
  return true;
}

/** Disengage. You keep nothing, and the node stays uncleared. */
export function flee(run) {
  if (run.phase !== 'action' || !run.world) return false;
  retreatWorld(run.world);
  return true;
}

function concludeEncounter(run) {
  const world = run.world;
  const won = world.state === 'won';
  const fled = world.outcome === 'fled';

  S.applyEncounterResult(run.ship, world);

  run.stats.kills += world.stats.kills;
  run.stats.damageDealt += world.stats.damageDealt;
  run.stats.damageTaken += world.stats.damageTaken;
  run.stats.shotsFired += world.stats.shotsFired;
  run.stats.shotsHit += world.stats.shotsHit;
  run.stats.dashes += world.stats.dashes;
  run.stats.abilitiesUsed += world.stats.abilitiesUsed;
  run.stats.terrainHits += world.stats.terrainHits;
  run.stats.bossesKilled += world.stats.bossKills || 0;
  run.stats.rammed = (run.stats.rammed || 0) + (world.stats.rammed || 0);
  // "Never dropped below a quarter" has to be observed while it is happening;
  // by the debrief the hull has already been patched.
  if (run.ship.hull / run.ship.stats.maxHull <= 0.25) run.stats.everCritical = true;

  if (S.isDestroyed(run.ship)) {
    run.phase = 'dead';
    run.stats.deaths++;
    logLine(run, `${run.ship.name} is lost with all hands.`);
    fireAchievements(run, 'death');
    return;
  }

  if (!won) {
    run.stats.encountersFled++;
    run.pending = { fled: true, encounter: run.encounter, world };
    run.phase = 'debrief';
    logLine(run, fled ? 'You break off and jump clear.' : 'The encounter goes badly.');
    return;
  }

  run.stats.encountersWon++;
  run.pending = buildRewards(run, world);
  run.phase = 'debrief';
  return run.pending;
}

/**
 * Turn a won encounter into payouts. XP is the node's value scaled by the
 * encounter's multiplier — not a per-kill tally — so a tunnel run pays like a
 * fight of the same threat rather than nothing.
 */
function buildRewards(run, world) {
  const node = run.node;
  const enc = run.encounter;
  const mult = enc.rewards || {};
  const threat = node?.threat ?? 1;

  // On objectives where killing IS the point, pay for what you actually
  // destroyed. Enemies that fly off the far edge end the encounter but are not
  // kills, and a fight that resolved with nothing dead was paying in full.
  const killObjective = ['clear', 'boss', 'destroy'].includes(enc.objective?.kind ?? 'clear');
  const spawned = world.stats.spawned || 0;
  const destroyedFrac = !killObjective || spawned === 0
    ? 1
    : Math.max(0, Math.min(1, world.stats.kills / spawned));
  // Never zero: surviving the encounter is worth something on its own.
  const completion = 0.35 + 0.65 * destroyedFrac;

  const baseXp = nodeXpValue(threat) * (mult.xpMult ?? 1) * completion;
  const killXp = world.stats.xpEarned * 0.10;
  const xp = Math.round(baseXp + killXp);

  const credits = Math.round(
    (world.stats.creditsEarned + (12 + threat * 6) * completion) * (mult.creditsMult ?? 1)
      * (1 + (run.ship.stats.creditsPct || 0)));

  const crateCount = (mult.crates ?? 0) + (world.stats.crates || 0)
    + (run.rng.chance(0.32 * (run.ship.stats.crateChance || 1)) ? 1 : 0);

  const items = S.rollLoot(run.ship, run.rng, {
    threat,
    crates: Math.min(4, crateCount),
    rarityFloor: threat >= 12 ? 2 : 1,
  });

  const perfect = world.stats.damageTaken === 0;
  if (perfect) run.stats.perfectClears++;

  return {
    fled: false,
    encounter: enc,
    world,
    xp, credits, items,
    perfect,
    destroyed: world.stats.kills,
    escaped: world.stats.escaped || 0,
    completion,
    accuracy: world.stats.shotsFired ? world.stats.shotsHit / world.stats.shotsFired : 0,
    time: world.stats.timeElapsed,
  };
}

/** Accept the debrief: bank the rewards and go back to the map. */
export function collectRewards(run, { take = null } = {}) {
  const p = run.pending;
  if (!p) { run.phase = 'map'; return null; }

  if (p.fled) {
    run.pending = null;
    run.phase = 'map';
    return null;
  }

  const levels = S.addXp(run.ship, p.xp);
  run.ship.credits += p.credits;
  run.stats.creditsEarned += p.credits;

  const keep = take || p.items;
  let kept = 0, sold = 0;
  for (const item of p.items) {
    if (keep.includes(item) && S.addItem(run.ship, item)) kept++;
    else { run.ship.credits += sellValue(item); sold += sellValue(item); }
  }
  run.stats.itemsFound += kept;

  U.markCleared(run.map, run.node.id);
  run.stats.nodesCleared++;
  // Node-type tallies, for the achievements that care what you cleared and not
  // just how many.
  const kind = run.encounter?.type || run.node?.type;
  if (kind === 'derelict') run.stats.derelictsCleared++;
  if (kind === 'tunnel') run.stats.tunnelsCleared++;
  if (kind === 'boss') run.stats.bossesMet++;

  // The Master Fleet is three encounters played back to back.
  if (run.encounter?.type === 'masterfleet') {
    run.masterFleetStage++;
    if (run.masterFleetStage < MASTER_FLEET_STAGES.length) {
      run.pending = null;
      run.encounter = getEncounter(MASTER_FLEET_STAGES[run.masterFleetStage]);
      run.phase = 'brief';
      logLine(run, `The next line of the fleet closes in.`);
      return { levels, kept, sold, nextStage: run.masterFleetStage };
    }
    return winRun(run, { levels, kept, sold });
  }

  logLine(run, `${p.encounter.name} cleared. +${p.xp} XP, +${p.credits} credits.`);
  run.pending = null;
  run.phase = maybeLevelUp(run, 'map');
  fireAchievements(run, 'encounterWon', { levels });
  return { levels, kept, sold };
}

function winRun(run, extra) {
  run.map.masterFleetDefeated = true;
  run.phase = 'victory';
  logLine(run, 'The Master Fleet burns. The sky is quiet for the first time.');
  fireAchievements(run, 'victory');
  return { ...extra, victory: true };
}

/**
 * After a victory the run continues — the map stays open so you can keep
 * exploring what you never reached. This is what "your run is saved" means.
 */
export function continueAfterVictory(run) {
  if (run.phase !== 'victory') return false;
  run.phase = maybeLevelUp(run, 'map');
  return true;
}

function maybeLevelUp(run, next) {
  return S.hasUnspentPoints(run.ship) ? 'levelup' : next;
}

export function spendPoint(run, attrId) {
  const ok = S.spendAttributePoint(run.ship, attrId);
  if (ok && !S.hasUnspentPoints(run.ship)) run.phase = 'map';
  if (ok) fireAchievements(run, 'levelup');
  return ok;
}

export function closeLevelUp(run) {
  run.phase = 'map';
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

export function anomalyChoices(run) {
  const enc = run.encounter;
  if (!enc?.choices) return [];
  return enc.choices.map((c, index) => {
    const gate = checkRequires(run, c.requires);
    return { index, text: c.text, ok: gate.ok, reason: gate.reason };
  });
}

function checkRequires(run, req) {
  if (!req) return { ok: true };
  const ship = run.ship;
  if (req.credits != null && ship.credits < req.credits) {
    return { ok: false, reason: `Needs ${req.credits} credits` };
  }
  if (req.level != null && ship.progress.level < req.level) {
    return { ok: false, reason: `Needs level ${req.level}` };
  }
  if (req.attr) {
    for (const [k, v] of Object.entries(req.attr)) {
      if ((ship.progress.attributes[k] || 0) < v) {
        return { ok: false, reason: `Needs ${k} ${v}` };
      }
    }
  }
  if (req.slotItem && !ship.equipped[req.slotItem]) {
    return { ok: false, reason: `Needs something in ${req.slotItem}` };
  }
  return { ok: true };
}

export function chooseAnomaly(run, index) {
  const enc = run.encounter;
  const choice = enc?.choices?.[index];
  if (!choice) return null;
  if (!checkRequires(run, choice.requires).ok) return null;

  const outcome = run.rng.weighted(
    choice.outcomes.map(o => ({ o, weight: o.weight ?? 1 })), 'weight').o;

  const applied = applyEffects(run, outcome.effects || {});
  run.stats.anomaliesResolved++;
  run.anomalyResult = { text: outcome.text, effects: applied };

  if (applied.combat) {
    // The choice turned into a fight; the node clears only if you win it.
    run.encounter = getEncounter(applied.combat);
    run.phase = 'brief';
    return run.anomalyResult;
  }

  U.markCleared(run.map, run.node.id);
  run.stats.nodesCleared++;
  logLine(run, `${enc.name}: ${outcome.text}`);
  fireAchievements(run, 'anomaly');
  return run.anomalyResult;
}

/** Close the anomaly result card. */
export function closeAnomaly(run) {
  run.anomalyResult = null;
  run.phase = maybeLevelUp(run, 'map');
}

function applyEffects(run, fx) {
  const ship = run.ship;
  const threat = run.node?.threat ?? 1;
  const out = {};

  if (fx.credits) {
    const delta = Math.round(fx.credits > 0
      ? fx.credits * (1 + (ship.stats.creditsPct || 0))
      : fx.credits);
    ship.credits = Math.max(0, ship.credits + delta);
    out.credits = delta;
  }
  if (fx.xp) { out.levels = S.addXp(ship, fx.xp); out.xp = fx.xp; }
  if (fx.hull) {
    if (fx.hull < 0) { ship.hull = Math.max(0, ship.hull + fx.hull); out.hull = fx.hull; }
    else out.hull = S.repair(ship, fx.hull);
  }
  if (fx.hullPct) {
    const amount = ship.stats.maxHull * fx.hullPct;
    if (amount < 0) { ship.hull = Math.max(0, ship.hull + amount); out.hull = Math.round(amount); }
    else out.hull = Math.round(S.repair(ship, amount));
  }
  if (fx.heal) out.hull = Math.round(S.repairFraction(ship, fx.heal));
  if (fx.crates) {
    out.items = S.rollLoot(ship, run.rng, { threat, crates: fx.crates });
    for (const it of out.items) if (!S.addItem(ship, it)) ship.credits += sellValue(it);
    run.stats.itemsFound += out.items.length;
  }
  if (fx.item) {
    const it = generateItem(run.rng, {
      slot: fx.item.slot || run.rng.pick(SLOT_IDS),
      level: threat,
      rarity: fx.item.rarity || null,
      luck: ship.stats.luck || 0,
    });
    out.items = (out.items || []).concat(it);
    if (!S.addItem(ship, it)) ship.credits += sellValue(it);
    run.stats.itemsFound++;
  }
  if (fx.attributePoint) {
    ship.progress.unspentPoints += fx.attributePoint;
    out.attributePoint = fx.attributePoint;
  }
  if (fx.reveal) {
    // A charted bonus buys nodes, not hops: `reveal: 4` used to blow the fog
    // off half the universe from a ring-two anomaly.
    out.reveal = U.revealFrom(run.map, run.map.currentId,
      U.scanRadius(ship) + Math.min(3, fx.reveal),
      { limit: 3 + fx.reveal * 4 });
  }
  if (fx.combat) out.combat = fx.combat;

  // An anomaly can kill you outright. It should be rare, and it should count.
  if (ship.hull <= 0) {
    run.phase = 'dead';
    run.stats.deaths++;
    fireAchievements(run, 'death');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

function rollShopStock(run, node) {
  const rng = run.rng.fork(`shop${node.id}`);
  const count = rng.int(4, 6);
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(generateItem(rng, {
      slot: rng.pick(SLOT_IDS),
      level: node.threat,
      luck: run.ship.stats.luck || 0,
      rarityFloor: node.threat >= 10 ? 2 : 1,
    }));
  }
  const repairCost = Math.max(1, Math.round(
    (run.ship.stats.maxHull - run.ship.hull) * 1.6 * (1 - (run.ship.stats.repairDiscount || 0))));
  return { items, repairCost, repaired: false };
}

export function buyItem(run, uid) {
  const stock = run.shopStock;
  const item = stock?.items.find(i => i.uid === uid);
  if (!item) return { ok: false, reason: 'not for sale' };
  if (run.ship.credits < item.value) return { ok: false, reason: 'not enough credits' };
  if (!S.addItem(run.ship, item)) return { ok: false, reason: 'inventory full' };
  run.ship.credits -= item.value;
  run.stats.creditsSpent += item.value;
  run.stats.tradesMade++;
  stock.items = stock.items.filter(i => i.uid !== uid);
  return { ok: true, item };
}

export function sellItem(run, uid) {
  const item = S.removeItem(run.ship, uid);
  if (!item) return { ok: false, reason: 'not in inventory' };
  const price = sellValue(item);
  run.ship.credits += price;
  run.stats.itemsSold++;
  return { ok: true, price };
}

export function buyRepair(run) {
  const stock = run.shopStock;
  if (!stock || stock.repaired) return { ok: false, reason: 'nothing to repair' };
  if (run.ship.credits < stock.repairCost) return { ok: false, reason: 'not enough credits' };
  run.ship.credits -= stock.repairCost;
  run.stats.creditsSpent += stock.repairCost;
  const healed = S.repair(run.ship, run.ship.stats.maxHull);
  run.stats.hullRepaired += healed;
  stock.repaired = true;
  return { ok: true, healed };
}

export function leaveShop(run) {
  U.markCleared(run.map, run.node.id);
  run.shopStock = null;
  run.phase = maybeLevelUp(run, 'map');
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function fireAchievements(run, event, extra = {}) {
  if (!run.profile) return;
  const earned = checkAchievements(run, event, extra);
  if (earned.length) run.newAchievements.push(...earned);
}

export function drainAchievements(run) {
  const out = run.newAchievements;
  run.newAchievements = [];
  return out;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export function serialize(run) {
  return {
    seed: run.seed,
    rngState: run.rng.serialize(),
    map: U.serialize(run.map),
    ship: {
      shipId: run.ship.shipId,
      progress: run.ship.progress,
      equipped: run.ship.equipped,
      inventory: run.ship.inventory,
      hull: run.ship.hull,
      credits: run.ship.credits,
    },
    elapsed: run.elapsed,
    masterFleetStage: run.masterFleetStage,
    stats: run.stats,
    log: run.log.slice(0, 20),
  };
}

export function deserialize(data, profile = null) {
  const rng = RNG.deserialize(data.rngState);
  const run = startRun({ shipId: data.ship.shipId, seed: data.seed, profile });

  run.rng = rng;
  run.map = U.deserialize(data.map, new RNG(data.seed).fork('universe'));
  run.ship.progress = data.ship.progress;
  run.ship.equipped = data.ship.equipped;
  run.ship.inventory = data.ship.inventory || [];
  run.ship.credits = data.ship.credits;
  S.recompute(run.ship);
  run.ship.hull = Math.min(data.ship.hull, run.ship.stats.maxHull);
  run.elapsed = data.elapsed || 0;
  run.masterFleetStage = data.masterFleetStage || 0;
  run.stats = { ...run.stats, ...data.stats };
  run.log = data.log || [];
  run.node = U.currentNode(run.map);
  run.phase = 'map';
  return run;
}

export { WORLD_W, WORLD_H };
