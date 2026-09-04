/**
 * A run: the state machine that moves the player from the hangar to the
 * flagship, and the single place where game state is mutated.
 *
 * Everything here is pure logic over serialisable data. The UI reads the run
 * and calls these functions; it never reaches into ships or maps directly.
 */

import { RNG } from '../core/rng.js';
import { saveRun, clearRun, recordRunResult, unlockShip } from '../core/save.js';
import { createShip, addWeapon, addDrone, installSystem, repairHull, autoAssignPower, livingCrew, activeFires, updateShip } from './ship.js';
import { getShip, getLayout, SHIP_IDS } from './ships.js';
import { generateSectorTree, generateSectorMap, jumpTo, beaconById, atExit, revealMap, advanceFleet, SECTOR_TYPES, TOTAL_SECTORS } from './sector.js';
import { rollEvent, rollOutcome, checkRequirement, EVENTS_BY_ID } from './events.js';
import { generateEnemy, generateBoss } from './enemy.js';
import { Combat } from './combat.js';
import { generateStore, sellValue, reactorUpgradeCost } from './store.js';
import { makeCrew, rollRace, RACES } from './crew.js';
import { WEAPONS, DRONES, AUGMENTS, getWeapon, getDrone, getAugment, rarityWeight, augmentValue, hasAugment } from './weapons.js';
import { SYSTEMS, upgradeCost, installCost, getSystem } from './systems.js';
import { evaluate, evaluateShip, SHIP_ACHIEVEMENTS, achievementById } from './achievements.js';

export const PHASES = {
  MAP: 'map', EVENT: 'event', COMBAT: 'combat', STORE: 'store',
  SECTOR_CHOICE: 'sectorChoice', GAME_OVER: 'gameover', VICTORY: 'victory',
};

export const STARTING_FUEL_WARNING = 3;

// ---------------------------------------------------------------------------
// Starting a run
// ---------------------------------------------------------------------------

export function startRun(profile, shipId, variant = 'A', seed = null) {
  const actualSeed = seed || RNG.friendlySeed();
  const rng = new RNG(actualSeed);
  const layout = getLayout(shipId, variant);
  const ship = createShip(shipId, variant, { rng });

  const tree = generateSectorTree(rng);
  const startSector = tree.sectors[tree.startId];
  const map = generateSectorMap(rng, startSector);

  const run = {
    seed: actualSeed,
    rngState: rng.serialize(),
    shipId, variant,
    shipName: layout.name,
    ship,
    scrap: layout.resources.scrap,
    fuel: layout.resources.fuel,
    missiles: layout.resources.missiles,
    droneParts: layout.resources.droneParts,

    sectorTree: tree,
    currentSectorId: tree.startId,
    sectorIndex: 0,
    map,

    phase: PHASES.MAP,
    pendingEvent: null,
    pendingOutcome: null,
    store: null,
    combat: null,
    sectorChoices: null,

    elapsed: 0,
    startedAt: Date.now(),
    log: [],
    newAchievements: [],
    stats: {
      beacons: 1, jumps: 0, shipsDestroyed: 0, crewLost: 0, crewHired: 0,
      scrapEarned: 0, missilesFired: 0, boardingKills: 0, captures: 0,
      mindControls: 0, lockdowns: 0, ventKills: 0, nanoforgeRepairs: 0,
      recoveredFromCritical: false, lowestHull: ship.hull,
    },
  };

  if (hasAugment(ship.augments, 'fleet_sensor')) revealMap(map);
  pushLog(run, `Departed in the ${layout.name}. Seed ${actualSeed}.`);
  autosave(run);
  return run;
}

/** Rehydrate the RNG for a loaded run so the stream continues where it left off. */
export function rngFor(run) {
  const rng = RNG.deserialize(run.rngState);
  // Callers mutate the RNG; write the state back after each use.
  return rng;
}

function withRng(run, fn) {
  const rng = rngFor(run);
  const result = fn(rng);
  run.rngState = rng.serialize();
  return result;
}

export function autosave(run) {
  if (run.phase === PHASES.GAME_OVER || run.phase === PHASES.VICTORY) return false;
  return saveRun(run);
}

function pushLog(run, text) {
  run.log.unshift({ at: run.elapsed, text });
  if (run.log.length > 60) run.log.length = 60;
}

// ---------------------------------------------------------------------------
// Jumping
// ---------------------------------------------------------------------------

export function canJump(run) {
  return run.phase === PHASES.MAP && run.fuel > 0 && run.ship.ftlCharge >= 1;
}

/**
 * Jump to a beacon. Consumes fuel, advances the fleet, and rolls whatever is
 * waiting there. Returns { ok, reason } or { ok: true, phase }.
 */
export function jump(run, beaconId) {
  if (run.phase !== PHASES.MAP) return { ok: false, reason: 'Not on the map' };
  if (run.fuel <= 0) return { ok: false, reason: 'Out of fuel' };
  if (run.ship.ftlCharge < 1) return { ok: false, reason: 'FTL drive still charging' };

  const beacon = jumpTo(run.map, beaconId);
  if (!beacon) return { ok: false, reason: 'That beacon is not adjacent' };

  run.fuel -= 1;
  run.ship.ftlCharge = 0;
  run.stats.jumps++;
  run.stats.beacons++;
  checkAchievements(run, 'jump');

  // Between jumps the crew patch things up and the air comes back.
  postJumpRecovery(run);

  return { ok: true, ...arriveAt(run, beacon) };
}

/** Fires, breaches and vacuum don't survive an FTL jump; damage does. */
function postJumpRecovery(run) {
  const ship = run.ship;
  for (const room of ship.rooms) {
    room.fire = 0;
    room.breaches = 0;
    room.oxygen = 1;
  }
  for (const d of ship.doors) d.open = false;
  ship.superShield = 0;
  ship.echoUsed = false;
  ship.cloakTimer = 0;
  ship.cloakCooldown = 0;
  ship.batteryTimer = 0;
  ship.batteryCooldown = 0;
  for (const sys of Object.values(ship.systems)) {
    sys.ionCharges = 0; sys.ionTimer = 0;
    sys.hacked = false; sys.hackActive = false; sys.hackTimer = 0; sys.hackTargetId = null;
    sys.cooldown = 0;
  }
  autoAssignPower(ship);
}

/** Work out what's at a beacon and move the run into the right phase. */
function arriveAt(run, beacon) {
  const sectorType = run.map.sectorType;

  if (beacon.isExit) {
    pushLog(run, 'Arrived at the sector exit.');
  }

  if (beacon.type === 'store') {
    if (!beacon.store) {
      beacon.store = withRng(run, rng => generateStore(rng, run.sectorIndex + 1, run.ship));
    }
    run.store = beacon.store;
    run.store.visited = true;
    run.phase = PHASES.STORE;
    checkAchievements(run, 'store');
    autosave(run);
    return { phase: PHASES.STORE };
  }

  // A beacon the pursuing fleet has reached is always a fight.
  if (beacon.fleet) {
    pushLog(run, 'The Swarm fleet is here.');
    startCombat(run, { classId: run.sectorIndex >= 5 ? 'elite' : 'fighter', faction: 'swarm' });
    return { phase: PHASES.COMBAT };
  }

  const event = withRng(run, rng => rollEvent(rng, beacon.type, sectorType));
  run.pendingEvent = { id: event.id, beaconId: beacon.id, resolved: false };
  run.phase = PHASES.EVENT;
  autosave(run);
  return { phase: PHASES.EVENT, event: event.id };
}

export function currentEvent(run) {
  return run.pendingEvent ? EVENTS_BY_ID[run.pendingEvent.id] : null;
}

/** Choices with their availability resolved, for rendering. */
export function eventChoices(run) {
  const event = currentEvent(run);
  if (!event) return [];
  return event.choices.map((c, i) => ({
    index: i, text: c.text,
    ...checkRequirement(c.req, { ship: run.ship, run }),
  }));
}

// ---------------------------------------------------------------------------
// Event resolution
// ---------------------------------------------------------------------------

export function chooseEventOption(run, index) {
  const event = currentEvent(run);
  if (!event) return { ok: false, reason: 'No event active' };
  const choice = event.choices[index];
  if (!choice) return { ok: false, reason: 'No such choice' };

  const gate = checkRequirement(choice.req, { ship: run.ship, run });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const outcome = withRng(run, rng => rollOutcome(rng, choice));
  run.pendingOutcome = { text: outcome.text || '', effects: [] };
  applyOutcome(run, outcome);

  if (outcome.combat) {
    startCombat(run, outcome.combat);
    return { ok: true, phase: PHASES.COMBAT, outcome: run.pendingOutcome };
  }

  run.pendingEvent = null;
  run.phase = PHASES.MAP;
  autosave(run);
  return { ok: true, phase: PHASES.MAP, outcome: run.pendingOutcome };
}

/** Turn an outcome record into actual state changes, logging each one. */
export function applyOutcome(run, outcome) {
  const ship = run.ship;
  const effects = run.pendingOutcome ? run.pendingOutcome.effects : [];
  const range = v => (Array.isArray(v) ? withRng(run, rng => rng.int(v[0], v[1])) : v);
  const note = (text, kind = 'neutral') => effects.push({ text, kind });

  if (outcome.scrap != null) {
    const n = range(outcome.scrap);
    run.scrap = Math.max(0, run.scrap + n);
    if (n > 0) run.stats.scrapEarned += n;
    note(`${n >= 0 ? '+' : ''}${n} scrap`, n >= 0 ? 'good' : 'bad');
  }
  if (outcome.fuel != null) {
    const n = range(outcome.fuel);
    run.fuel = Math.max(0, run.fuel + n);
    note(`${n >= 0 ? '+' : ''}${n} fuel`, n >= 0 ? 'good' : 'bad');
  }
  if (outcome.missiles != null) {
    const n = range(outcome.missiles);
    run.missiles = Math.max(0, run.missiles + n);
    note(`${n >= 0 ? '+' : ''}${n} missiles`, n >= 0 ? 'good' : 'bad');
  }
  if (outcome.droneParts != null) {
    const n = range(outcome.droneParts);
    run.droneParts = Math.max(0, run.droneParts + n);
    note(`${n >= 0 ? '+' : ''}${n} drone parts`, n >= 0 ? 'good' : 'bad');
  }
  if (outcome.hull != null) {
    const n = range(outcome.hull);
    if (n >= 0) repairHull(ship, n);
    else ship.hull = Math.max(0, ship.hull + n);
    note(`${n >= 0 ? '+' : ''}${n} hull`, n >= 0 ? 'good' : 'bad');
    if (ship.hull <= 0) return endRun(run, false, 'Your ship broke apart.');
  }
  if (outcome.hullRepairFull) {
    const gained = ship.maxHull - ship.hull;
    repairHull(ship, gained);
    note(`Hull fully repaired (+${gained})`, 'good');
  }
  if (outcome.fire) {
    withRng(run, rng => {
      for (let i = 0; i < outcome.fire; i++) ship.rooms[rng.int(0, ship.rooms.length - 1)].fire = 0.4;
    });
    note('Fire aboard!', 'bad');
  }
  if (outcome.breach) {
    withRng(run, rng => {
      for (let i = 0; i < outcome.breach; i++) ship.rooms[rng.int(0, ship.rooms.length - 1)].breaches += 1;
    });
    note('Hull breach!', 'bad');
  }
  if (outcome.ionAll) {
    for (const sys of Object.values(ship.systems)) {
      sys.ionCharges = Math.min(sys.level, sys.ionCharges + outcome.ionAll);
      sys.ionTimer = Math.max(sys.ionTimer, 8);
    }
    note(`Systems ionised (${outcome.ionAll})`, 'bad');
  }
  if (outcome.crewHurt) {
    const dmg = range(outcome.crewHurt);
    const alive = livingCrew(ship);
    if (alive.length) {
      const victim = withRng(run, rng => rng.pick(alive));
      victim.hp = Math.max(1, victim.hp - dmg);
      note(`${victim.name} injured (-${dmg} health)`, 'bad');
    }
  }
  if (outcome.crew === 'lose') {
    const alive = livingCrew(ship);
    if (alive.length > 1) {
      const victim = withRng(run, rng => rng.pick(alive));
      victim.dead = true;
      run.stats.crewLost++;
      note(`${victim.name} was lost`, 'bad');
    }
  } else if (outcome.crew && typeof outcome.crew === 'object') {
    if (livingCrew(ship).length >= ship.crewSlots) {
      note('No room aboard for another crew member', 'neutral');
    } else {
      const race = outcome.crew.race
        || withRng(run, rng => rollRace(rng, run.sectorIndex + 1));
      const c = withRng(run, rng => makeCrew(race, { rng, room: 0 }));
      ship.crew.push(c);
      run.stats.crewHired++;
      note(`${c.name} (${RACES[race].name}) joined the crew`, 'good');
    }
  }
  if (outcome.weapon) {
    const id = outcome.weapon === true ? rollItem(run, WEAPONS) : outcome.weapon;
    if (id) {
      if (addWeapon(ship, id)) note(`Acquired ${getWeapon(id).name}`, 'good');
      else { run.scrap += Math.round(getWeapon(id).cost * 0.5); note(`No free hardpoint — sold ${getWeapon(id).name}`, 'neutral'); }
    }
  }
  if (outcome.drone) {
    const id = outcome.drone === true ? rollItem(run, DRONES) : outcome.drone;
    if (id) {
      if (addDrone(ship, id)) note(`Acquired ${getDrone(id).name}`, 'good');
      else { run.scrap += Math.round(getDrone(id).cost * 0.5); note(`No free drone bay — sold ${getDrone(id).name}`, 'neutral'); }
    }
  }
  if (outcome.augment) {
    const id = outcome.augment === true ? rollItem(run, AUGMENTS) : outcome.augment;
    if (id && !ship.augments.includes(id)) {
      ship.augments.push(id);
      note(`Installed ${getAugment(id).name}`, 'good');
      if (getAugment(id).effect.revealMap) revealMap(run.map);
    }
  }
  if (outcome.revealMap) {
    revealMap(run.map);
    note('Sector charts updated', 'good');
  }
  if (outcome.fleetAdvance) {
    advanceFleet(run.map, outcome.fleetAdvance);
    note('The pursuing fleet gains ground', 'bad');
  }
  if (outcome.unlockShip) {
    const id = nextLockedShip(run);
    if (id) {
      run.pendingShipUnlock = id;
      note(`Recovered a derelict hull: the ${getShip(id).name}`, 'good');
    } else {
      run.scrap += 40;
      note('The hull is a duplicate of one you already own. Stripped for +40 scrap.', 'neutral');
    }
  }

  run.stats.lowestHull = Math.min(run.stats.lowestHull, ship.hull);
  if (run.stats.lowestHull <= 3 && ship.hull === ship.maxHull) run.stats.recoveredFromCritical = true;
  checkAchievements(run, 'outcome');
  return { ok: true };
}

function rollItem(run, table) {
  return withRng(run, rng => {
    const sector = run.sectorIndex + 1;
    const pool = Object.values(table)
      .filter(i => !i.friendly)
      .map(item => ({ item, weight: rarityWeight(item.rarity || 1, sector) }))
      .filter(p => p.weight > 0);
    return pool.length ? rng.weighted(pool).item.id : null;
  });
}

function nextLockedShip(run) {
  const owned = run.unlockedDuringRun || [];
  return SHIP_IDS.find(id => id !== run.shipId && !owned.includes(id)) || null;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export function startCombat(run, spec = {}) {
  const sector = run.sectorIndex + 1;
  const enemy = withRng(run, rng => (spec.boss
    ? generateBoss(rng, spec.phase || 1)
    : generateEnemy(rng, sector, spec)));

  if (spec.weakened) {
    enemy.hull = Math.max(3, Math.round(enemy.hull * 0.6));
    for (const sys of Object.values(enemy.systems)) sys.damage = Math.min(sys.level, sys.damage + 1);
  }
  if (spec.extraScrap) enemy.rewardScrap += spec.extraScrap;

  const beacon = beaconById(run.map, run.map.currentId);
  const environment = pickEnvironment(run, beacon);

  const rng = rngFor(run);
  const combat = new Combat(run.ship, enemy, rng, {
    environment,
    runState: run,
    canFlee: !spec.mustKill,
    onEvent: (type, payload) => handleCombatEvent(run, type, payload),
  });
  // Combat owns the RNG for its duration; the state is written back on end.
  run._combatRng = rng;
  run.combat = combat;
  run.combatMeta = {
    startHull: run.ship.hull, weaponDamage: 0, firesExtinguished: 0,
    mustKill: !!spec.mustKill, boss: !!spec.boss, phase: spec.phase || 0,
  };
  run.phase = PHASES.COMBAT;

  if (spec.surprise) {
    // An ambush lands the first blow before you can react.
    for (const w of enemy.weapons) if (w.powered) w.charge = getWeapon(w.weaponId).charge;
  }
  if (spec.playerAdvantage) {
    for (const w of run.ship.weapons) if (w.powered) w.charge = getWeapon(w.weaponId).charge;
  }

  pushLog(run, `Engaging ${enemy.name} (${enemy.className}).`);
  return combat;
}

function pickEnvironment(run, beacon) {
  if (!beacon) return null;
  const sectorType = SECTOR_TYPES[run.map.sectorType];
  if (sectorType?.nebula) return 'nebula';
  if (beacon.type !== 'hazard') return null;
  return withRng(run, rng => rng.pick(['asteroids', 'solar', 'pulsar']));
}

function handleCombatEvent(run, type, payload) {
  const meta = run.combatMeta;
  switch (type) {
    case 'fireOut':
      if (payload.side === 'player') meta.firesExtinguished++;
      break;
    case 'crewDied':
      if (payload.side === 'player') run.stats.crewLost++;
      else if (payload.cause === 'boarders') run.stats.boardingKills++;
      break;
    case 'hullHit':
      if (payload.side === 'enemy') meta.weaponDamage += payload.damage;
      break;
    case 'hullRepaired':
      if (payload.side === 'player' && payload.source === 'nanoforge') run.stats.nanoforgeRepairs++;
      break;
    case 'mindcontrol':
      if (payload.side === 'enemy') run.stats.mindControls++;
      break;
    case 'combatEnd':
      finishCombat(run, payload);
      break;
    default:
      break;
  }
  if (run.onCombatEvent) run.onCombatEvent(type, payload);
}

/** Called when the Combat object reports an outcome. */
function finishCombat(run, payload) {
  const combat = run.combat;
  if (!combat) return;
  run.rngState = (run._combatRng || rngFor(run)).serialize();
  run._combatRng = null;

  const meta = run.combatMeta || {};
  const hullLost = (meta.startHull ?? run.ship.hull) - run.ship.hull;

  if (payload.outcome === 'victory') {
    run.stats.shipsDestroyed++;
    if (payload.captured) run.stats.captures++;
    const r = combat.rewards || {};
    run.scrap += r.scrap || 0;
    run.fuel += r.fuel || 0;
    run.missiles += r.missiles || 0;
    run.droneParts += r.droneParts || 0;
    run.stats.scrapEarned += r.scrap || 0;
    run.combatRewards = r;

    if (r.weapon) applyOutcomeSilently(run, { weapon: r.weapon });
    if (r.drone) applyOutcomeSilently(run, { drone: r.drone });
    if (r.augment) applyOutcomeSilently(run, { augment: r.augment });

    pushLog(run, `Destroyed ${combat.enemy.name}. +${r.scrap || 0} scrap.`);
    checkAchievements(run, 'combatVictory', {
      captured: !!payload.captured, hullLost,
      enemyFires: activeFires(combat.enemy),
      playerWeaponDamage: meta.weaponDamage,
      combatFiresExtinguished: meta.firesExtinguished,
    });
    checkAchievements(run, 'shipDestroyed');

    if (meta.boss) {
      handleBossPhaseEnd(run, meta.phase);
      return;
    }
  } else if (payload.outcome === 'defeat') {
    endRun(run, false, 'Your ship was destroyed.');
    return;
  } else if (payload.outcome === 'fled') {
    pushLog(run, 'You jumped out mid-fight.');
  } else if (payload.outcome === 'enemyFled') {
    pushLog(run, `${combat.enemy.name} escaped.`);
  }

  run.combat = null;
  run.pendingEvent = null;
  run.phase = PHASES.MAP;
  autosave(run);
}

function applyOutcomeSilently(run, outcome) {
  const prev = run.pendingOutcome;
  run.pendingOutcome = { text: '', effects: [] };
  applyOutcome(run, outcome);
  const gained = run.pendingOutcome.effects;
  run.pendingOutcome = prev;
  if (prev) prev.effects.push(...gained);
}

function handleBossPhaseEnd(run, phase) {
  if (phase < 3) {
    pushLog(run, `Flagship phase ${phase} disabled. It is bringing more systems online.`);
    run.combat = null;
    run.bossPhase = phase + 1;
    run.phase = PHASES.MAP;
    // The flagship repairs itself between phases; so should you.
    run.pendingOutcome = {
      text: `The flagship's hull buckles and its next weapon array comes online. Phase ${phase + 1} incoming.`,
      effects: [{ text: 'Between phases, your crew make emergency repairs', kind: 'good' }],
    };
    repairHull(run.ship, Math.ceil(run.ship.maxHull * 0.2));
    autosave(run);
    return;
  }
  checkAchievements(run, 'bossKilled');
  endRun(run, true, 'The Swarm Flagship is destroyed.');
}

/** Start the next boss phase — called from the map screen in the final sector. */
export function engageBoss(run) {
  const phase = run.bossPhase || 1;
  startCombat(run, { boss: true, phase, mustKill: true });
  return run.combat;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export function buyItem(run, itemIndex) {
  const store = run.store;
  if (!store) return { ok: false, reason: 'Not at a store' };
  const item = store.items[itemIndex];
  if (!item || item.sold) return { ok: false, reason: 'Item unavailable' };
  if (run.scrap < item.cost) return { ok: false, reason: 'Not enough scrap' };

  const ship = run.ship;
  switch (item.kind) {
    case 'weapon':
      if (ship.weapons.length >= ship.weaponSlots) return { ok: false, reason: 'No free weapon slot' };
      addWeapon(ship, item.id);
      break;
    case 'drone':
      if (ship.drones.length >= ship.droneSlots) return { ok: false, reason: 'No free drone slot' };
      addDrone(ship, item.id);
      break;
    case 'augment':
      if (ship.augments.includes(item.id)) return { ok: false, reason: 'Already installed' };
      ship.augments.push(item.id);
      if (getAugment(item.id).effect.revealMap) revealMap(run.map);
      break;
    case 'crew': {
      if (livingCrew(ship).length >= ship.crewSlots) return { ok: false, reason: 'No room for more crew' };
      const c = withRng(run, rng => makeCrew(item.id, { rng, room: 0 }));
      ship.crew.push(c);
      run.stats.crewHired++;
      break;
    }
    case 'system':
      if (!installSystem(ship, item.id)) return { ok: false, reason: 'Cannot install that system' };
      break;
    default:
      return { ok: false, reason: 'Unknown item' };
  }

  run.scrap -= item.cost;
  item.sold = true;
  checkAchievements(run, 'purchase');
  autosave(run);
  return { ok: true, item };
}

export function sellEquipment(run, kind, slot) {
  const ship = run.ship;
  let id = null;
  if (kind === 'weapon') {
    if (ship.weapons.length <= 1) return { ok: false, reason: 'You must keep at least one weapon' };
    id = ship.weapons[slot]?.weaponId;
    if (id) ship.weapons.splice(slot, 1), ship.weapons.forEach((w, i) => { w.slot = i; });
  } else if (kind === 'drone') {
    id = ship.drones[slot]?.droneId;
    if (id) ship.drones.splice(slot, 1), ship.drones.forEach((d, i) => { d.slot = i; });
  } else if (kind === 'augment') {
    id = ship.augments[slot];
    if (id) ship.augments.splice(slot, 1);
  }
  if (!id) return { ok: false, reason: 'Nothing to sell' };
  const value = sellValue(kind, id);
  run.scrap += value;
  autoAssignPower(ship);
  autosave(run);
  return { ok: true, value, id };
}

export function buyResource(run, kind, amount = 1) {
  const store = run.store;
  if (!store) return { ok: false, reason: 'Not at a store' };
  const price = { fuel: store.fuelPrice, missiles: store.missilePrice, droneParts: store.dronePartPrice }[kind];
  if (price == null) return { ok: false, reason: 'Not sold here' };
  const total = price * amount;
  if (run.scrap < total) return { ok: false, reason: 'Not enough scrap' };
  run.scrap -= total;
  run[kind] += amount;
  autosave(run);
  return { ok: true, spent: total };
}

export function repairAtStore(run, hullPoints = 1) {
  const store = run.store;
  if (!store) return { ok: false, reason: 'Not at a store' };
  const ship = run.ship;
  const needed = ship.maxHull - ship.hull;
  const points = Math.min(hullPoints, needed);
  if (points <= 0) return { ok: false, reason: 'Hull is already full' };

  const discount = 1 - augmentValue(ship.augments, 'repairDiscount', 0);
  const cost = Math.ceil(store.repairPrice * points * discount);
  if (run.scrap < cost) return { ok: false, reason: 'Not enough scrap' };

  run.scrap -= cost;
  repairHull(ship, points);
  autosave(run);
  return { ok: true, repaired: points, cost };
}

export function upgradeSystem(run, sysId) {
  const ship = run.ship;
  const sys = ship.systems[sysId];
  if (!sys) return { ok: false, reason: 'System not installed' };
  const cost = upgradeCost(sysId, sys.level);
  if (cost === null) return { ok: false, reason: 'Already at maximum level' };
  if (run.scrap < cost) return { ok: false, reason: 'Not enough scrap' };

  run.scrap -= cost;
  sys.level += 1;
  autoAssignPower(ship);
  checkAchievements(run, 'upgrade', {
    systemMax: Object.fromEntries(Object.keys(ship.systems).map(id => [id, getSystem(id).maxLevel])),
  });
  autosave(run);
  return { ok: true, level: sys.level, cost };
}

export function upgradeReactor(run) {
  const cost = reactorUpgradeCost(run.ship.reactor);
  if (cost === null) return { ok: false, reason: 'Reactor is at maximum' };
  if (run.scrap < cost) return { ok: false, reason: 'Not enough scrap' };
  run.scrap -= cost;
  run.ship.reactor += 1;
  autoAssignPower(run.ship);
  autosave(run);
  return { ok: true, reactor: run.ship.reactor, cost };
}

export function leaveStore(run) {
  run.store = null;
  run.phase = PHASES.MAP;
  autosave(run);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sector transitions
// ---------------------------------------------------------------------------

export function canLeaveSector(run) {
  return run.phase === PHASES.MAP && atExit(run.map);
}

export function openSectorChoice(run) {
  if (!canLeaveSector(run)) return { ok: false, reason: 'You must be at the sector exit' };
  const current = run.sectorTree.sectors[run.currentSectorId];
  const links = current.links || [];
  if (links.length === 0) return { ok: false, reason: 'No further sectors' };
  run.sectorChoices = links.map(id => {
    const s = run.sectorTree.sectors[id];
    return { id, type: s.type, name: SECTOR_TYPES[s.type].name, blurb: SECTOR_TYPES[s.type].blurb, isFinal: !!s.isFinal };
  });
  run.phase = PHASES.SECTOR_CHOICE;
  return { ok: true, choices: run.sectorChoices };
}

export function enterSector(run, sectorId) {
  const target = run.sectorTree.sectors[sectorId];
  if (!target) return { ok: false, reason: 'Unknown sector' };
  const current = run.sectorTree.sectors[run.currentSectorId];
  if (!(current.links || []).includes(sectorId)) return { ok: false, reason: 'Not reachable from here' };
  if (run.fuel <= 0) return { ok: false, reason: 'Out of fuel' };

  run.fuel -= 1;
  run.currentSectorId = sectorId;
  run.sectorIndex = target.depth;
  target.visited = true;
  run.map = withRng(run, rng => generateSectorMap(rng, target));
  if (hasAugment(run.ship.augments, 'fleet_sensor')) revealMap(run.map);
  run.sectorChoices = null;
  run.phase = PHASES.MAP;
  run.ship.ftlCharge = 0;
  postJumpRecovery(run);

  // Arriving in a new sector is worth a small resupply from the locals.
  pushLog(run, `Entered sector ${run.sectorIndex + 1}: ${SECTOR_TYPES[target.type].name}.`);
  checkAchievements(run, 'sector');

  if (target.isFinal) {
    run.bossPhase = run.bossPhase || 1;
    pushLog(run, 'The Swarm Flagship is here. There is nowhere left to run.');
  }
  autosave(run);
  return { ok: true, sector: run.sectorIndex + 1 };
}

// ---------------------------------------------------------------------------
// Achievements, scoring, ending
// ---------------------------------------------------------------------------

/**
 * Evaluate achievements against the current state. `profile` is attached to the
 * run by the app layer so this stays synchronous.
 */
export function checkAchievements(run, event, extra = {}) {
  const profile = run.profile;
  if (!profile) return [];

  const ctx = {
    run, ship: run.ship, profile, event,
    systemMax: Object.fromEntries(Object.keys(run.ship.systems).map(id => [id, getSystem(id).maxLevel])),
    ...extra,
  };

  const earned = [...evaluate(ctx)];
  for (const id of earned) {
    profile.achievements[id] = { at: Date.now(), ship: run.shipId };
  }

  const shipEarned = evaluateShip(ctx);
  if (shipEarned.length) {
    if (!profile.shipAchievements[run.shipId]) profile.shipAchievements[run.shipId] = {};
    for (const id of shipEarned) profile.shipAchievements[run.shipId][id] = true;
    // Any ship achievement unlocks that hull's second layout.
    if (unlockShip(profile, run.shipId, 'B')) {
      run.newAchievements.push({ id: `${run.shipId}_layoutB`, name: `${getShip(run.shipId).name}: Layout B unlocked`, unlock: true });
    }
  }

  const all = [...earned, ...shipEarned];
  for (const id of all) {
    const def = achievementById(id);
    if (def) run.newAchievements.push({ id, name: def.name, desc: def.desc });
  }
  return all;
}

/**
 * Run score. Rewards depth, kills and efficiency, so a deep loss can still beat
 * a sloppy win on the leaderboard.
 */
export function computeScore(run, won) {
  const s = run.stats;
  let score = 0;
  score += (run.sectorIndex + 1) * 120;
  score += s.shipsDestroyed * 45;
  score += s.scrapEarned;
  score += s.beacons * 8;
  score += livingCrew(run.ship).length * 25;
  score += Math.round(run.ship.hull * 4);
  if (won) score = Math.round(score * 2.2 + 800);
  // A brisk run scores better than a grind.
  if (won && run.elapsed > 0) score += Math.max(0, Math.round((3600 - run.elapsed) / 4));
  return Math.max(0, Math.round(score));
}

export function endRun(run, won, cause) {
  if (run.phase === PHASES.GAME_OVER || run.phase === PHASES.VICTORY) return run;
  run.phase = won ? PHASES.VICTORY : PHASES.GAME_OVER;
  run.won = won;
  run.cause = cause;
  run.score = computeScore(run, won);
  run.combat = null;
  clearRun();

  const profile = run.profile;
  if (profile) {
    checkAchievements(run, 'runEnd', { score: run.score });

    if (won) {
      // Winning with a hull unlocks the next hull in the progression.
      const next = SHIP_IDS.find(id => getShip(id).unlockedBy === run.shipId);
      if (next && unlockShip(profile, next, 'A')) {
        run.newAchievements.push({ id: `unlock_${next}`, name: `${getShip(next).name} unlocked`, unlock: true });
      }
      unlockShip(profile, run.shipId, 'B');
    }
    if (run.pendingShipUnlock && unlockShip(profile, run.pendingShipUnlock, 'A')) {
      run.newAchievements.push({ id: `unlock_${run.pendingShipUnlock}`, name: `${getShip(run.pendingShipUnlock).name} unlocked`, unlock: true });
    }

    recordRunResult(profile, {
      won, shipId: run.shipId, variant: run.variant, shipName: run.shipName,
      sector: run.sectorIndex + 1, score: run.score, seconds: run.elapsed,
      beacons: run.stats.beacons, shipsDestroyed: run.stats.shipsDestroyed,
      crewLost: run.stats.crewLost, scrapEarned: run.stats.scrapEarned,
      jumps: run.stats.jumps, cause, seed: run.seed,
    });
    checkAchievements(run, 'runEnd', { score: run.score });
  }

  pushLog(run, won ? 'Victory.' : `Run over: ${cause}`);
  return run;
}

/**
 * Advance the clock and the out-of-combat ship simulation.
 *
 * This matters as much as the combat loop: between fights the crew are
 * repairing damaged systems, fighting residual fires, sealing breaches and
 * spinning up the FTL drive. Without it, damage taken in sector 1 would still
 * be there at the flagship.
 */
export function tick(run, dt) {
  if (run.phase === PHASES.GAME_OVER || run.phase === PHASES.VICTORY) return;
  run.elapsed += dt;
  if (run.phase === PHASES.COMBAT) return; // Combat drives the ship itself.

  // Step in slices so a large dt (a slow frame, or the bot's 6s steps) still
  // produces the same behaviour as many small ones.
  let remaining = Math.min(dt, 30);
  withRng(run, rng => {
    while (remaining > 0) {
      const step = Math.min(0.25, remaining);
      updateShip(run.ship, step, {
        rng, inCombat: false,
        onEvent: (type, payload) => {
          if (type === 'crewDied') run.stats.crewLost++;
          if (type === 'hullRepaired' && payload.source === 'nanoforge') run.stats.nanoforgeRepairs++;
        },
      });
      remaining -= step;
    }
  });

  if (run.ship.hull <= 0) endRun(run, false, 'Your ship broke apart.');
  else if (livingCrew(run.ship).length === 0) endRun(run, false, 'Your crew are all dead.');
}

// ---------------------------------------------------------------------------
// Distress signal
// ---------------------------------------------------------------------------

/**
 * Stranded without fuel, you can broadcast for help. Someone always answers;
 * whether that is good news depends on the neighbourhood. This is the valve
 * that stops a run from dead-ending at zero fuel, so it can always be used.
 */
export function canSendDistress(run) {
  return run.phase === PHASES.MAP && run.fuel <= 0;
}

export function sendDistressSignal(run) {
  if (!canSendDistress(run)) return { ok: false, reason: 'You still have fuel' };

  run.stats.distressCalls = (run.stats.distressCalls || 0) + 1;
  // Each repeated call is likelier to attract the wrong kind of attention.
  const trouble = Math.min(0.6, 0.2 + run.stats.distressCalls * 0.08);
  const dangerous = SECTOR_TYPES[run.map.sectorType]?.danger ?? 1;

  const result = withRng(run, rng => {
    if (rng.chance(trouble * dangerous)) {
      return { kind: 'ambush', fuel: rng.int(1, 2) };
    }
    if (rng.chance(0.25)) {
      return { kind: 'trade', fuel: rng.int(1, 3), scrapCost: Math.min(run.scrap, rng.int(8, 20)) };
    }
    return { kind: 'help', fuel: rng.int(1, 3) };
  });

  run.pendingOutcome = { text: '', effects: [] };

  switch (result.kind) {
    case 'help':
      run.fuel += result.fuel;
      run.pendingOutcome.text = 'A passing freighter answers and transfers fuel across without asking for anything.';
      run.pendingOutcome.effects.push({ text: `+${result.fuel} fuel`, kind: 'good' });
      pushLog(run, `Distress signal answered: +${result.fuel} fuel.`);
      break;
    case 'trade':
      run.fuel += result.fuel;
      run.scrap = Math.max(0, run.scrap - result.scrapCost);
      run.pendingOutcome.text = 'A trader answers. They will help — at their price.';
      run.pendingOutcome.effects.push({ text: `+${result.fuel} fuel`, kind: 'good' });
      run.pendingOutcome.effects.push({ text: `-${result.scrapCost} scrap`, kind: 'bad' });
      pushLog(run, `Bought ${result.fuel} fuel from a passing trader.`);
      break;
    case 'ambush':
      run.fuel += result.fuel;
      run.pendingOutcome.text = 'Something answers your signal. It is not here to help.';
      run.pendingOutcome.effects.push({ text: `+${result.fuel} fuel salvaged`, kind: 'good' });
      pushLog(run, 'The distress signal was answered by raiders.');
      startCombat(run, { classId: 'pirate', surprise: true });
      return { ok: true, kind: 'ambush', phase: PHASES.COMBAT, outcome: run.pendingOutcome };
    default:
      break;
  }

  autosave(run);
  return { ok: true, kind: result.kind, phase: PHASES.MAP, outcome: run.pendingOutcome };
}

export function resourceWarnings(run) {
  const out = [];
  if (run.fuel <= 0) out.push({ kind: 'fuel', severity: 'critical', text: 'No fuel — you cannot jump.' });
  else if (run.fuel <= STARTING_FUEL_WARNING) out.push({ kind: 'fuel', severity: 'warning', text: `Only ${run.fuel} fuel left.` });
  if (run.ship.hull <= run.ship.maxHull * 0.25) out.push({ kind: 'hull', severity: 'critical', text: 'Hull critical.' });
  if (livingCrew(run.ship).length === 0) out.push({ kind: 'crew', severity: 'critical', text: 'No crew left aboard.' });
  return out;
}
