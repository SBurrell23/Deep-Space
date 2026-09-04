/**
 * The ship simulation.
 *
 * A ship is a plain serialisable object; every behaviour is a function here.
 * That split keeps saves trivial (JSON.stringify the run) and keeps the whole
 * simulation testable without a DOM.
 *
 * `updateShip` advances one ship by dt seconds. Cross-ship effects (weapons
 * firing, boarders arriving) are driven by combat.js, which owns both ships.
 */

import { SYSTEMS, getSystem, ENGINE_EVASION, PILOT_EVASION, effectiveLevel, damagedBars } from './systems.js';
import { compiledLayout, getLayout } from './ships.js';
import { getWeapon, getDrone, augmentValue } from './weapons.js';
import {
  makeCrew, getRace, skillBonus, repairSpeed, grantXP, damageCrew, healCrew,
  isAlive, suffocationRate, moveSpeed,
} from './crew.js';

// --- tuning constants ------------------------------------------------------

export const TUNING = {
  O2_REFILL_PER_LEVEL: 0.42,   // room-fractions of air per second, per system level
  O2_DIFFUSE: 1.1,             // equalisation rate through an open door
  O2_BREACH_VENT: 0.34,        // air lost per second per breach
  O2_AIRLOCK_VENT: 0.85,       // air lost per second through an open airlock
  O2_DANGER: 0.05,             // below this, crew start suffocating

  FIRE_SPREAD_CHANCE: 0.16,    // per second, per open connection
  FIRE_GROWTH: 0.16,
  FIRE_O2_BURN: 0.2,
  FIRE_SYSTEM_DPS: 0.28,
  FIRE_CREW_DPS: 9,
  FIRE_SUPPRESS: 0.42,         // crew fire-fighting rate

  BREACH_REPAIR_TIME: 6.5,
  SYSTEM_REPAIR_PER_SECOND: 0.42,

  SHIELD_RECHARGE_BASE: 2.0,   // seconds per layer at shields level 2
  MEDBAY_BLOCK_RADIUS: 0,

  CREW_MELEE_DPS: 7.5,
  CREW_TILE_SPEED: 2.6,        // tiles per second at moveSpeed 1

  FTL_CHARGE_BASE: 38,         // seconds at engines level 1
};

let nextShipId = 1;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Build a ship from a loadout in ships.js.
 * `bare: true` gives back the hull, rooms and doors with no systems, weapons or
 * crew — the starting point the enemy generator fills in with its own spec.
 */
export function createShip(shipId, variant = 'A', { rng = null, isEnemy = false, bare = false } = {}) {
  const def = getLayout(shipId, variant);
  const layout = compiledLayout(shipId, variant);

  const ship = {
    uid: `s${nextShipId++}`,
    shipId, variant, layoutId: def.id,
    name: def.name,
    isEnemy,
    hull: def.hull, maxHull: def.hull,
    reactor: def.reactor,
    weaponSlots: def.weaponSlots, droneSlots: def.droneSlots,
    crewSlots: def.crewSlots,

    systems: {},
    rooms: layout.rooms.map(r => ({
      id: r.id, system: r.system,
      oxygen: 1, fire: 0, breaches: 0,
      stunField: 0, temporalFactor: 1, temporalTimer: 0,
    })),
    doors: layout.doors.map(d => ({ ...d })),
    crew: [],
    weapons: [],
    drones: [],
    augments: [...(def.augments || [])],

    shields: { layers: 0, max: 0, charge: 0 },
    superShield: 0,
    evasionBonus: 0,

    cloakTimer: 0, cloakCooldown: 0,
    batteryTimer: 0, batteryCooldown: 0,
    ftlCharge: 0,
    echoUsed: false,

    destroyed: false,
    fleeing: false, fleeProgress: 0,
    stats: { damageDealt: 0, damageTaken: 0, crewLost: 0, roomsBoarded: 0 },
  };

  if (bare) return ship;

  for (const [sysId, level] of Object.entries(def.systems || {})) {
    ship.systems[sysId] = makeSystemState(sysId, level, layout);
  }

  // Distribute starting reactor power the way a sensible captain would.
  autoAssignPower(ship);

  for (const wid of def.weapons || []) addWeapon(ship, wid);
  for (const did of def.drones || []) addDrone(ship, did);

  // Start the crew at the stations that actually matter, in that order — an
  // unmanned helm means zero evasion, so nobody should begin idling in a
  // corridor.
  const stationOrder = ['piloting', 'engines', 'shields', 'weapons', 'medbay', 'drones'];
  const stations = [];
  for (const sysId of stationOrder) {
    const room = layout.rooms.find(r => r.system === sysId);
    if (room && ship.systems[sysId]) stations.push(room.id);
  }
  for (const r of layout.rooms) if (r.system && !stations.includes(r.id)) stations.push(r.id);
  if (stations.length === 0) stations.push(0);

  (def.crew || []).forEach((race, i) => {
    ship.crew.push(makeCrew(race, { rng, room: stations[i % stations.length] }));
  });
  for (const c of ship.crew) placeInRoom(ship, c, c.room);

  refreshShields(ship, true);
  return ship;
}

export function makeSystemState(sysId, level, layout) {
  const def = getSystem(sysId);
  const room = layout ? layout.rooms.find(r => r.system === sysId) : null;
  return {
    id: sysId,
    level: Math.max(1, Math.min(level, def.maxLevel)),
    power: 0,
    damage: 0,
    repairProgress: 0,
    ionCharges: 0, ionTimer: 0,
    hacked: false, hackActive: false, hackTimer: 0,
    overcharge: 0, overchargeTimer: 0,
    room: room ? room.id : null,
    cooldown: 0,
  };
}

/** Install a system that wasn't in the starting loadout (store purchase). */
export function installSystem(ship, sysId) {
  if (ship.systems[sysId]) return false;
  const layout = compiledLayout(ship.shipId, ship.variant);
  const room = layout.rooms.find(r => r.system === sysId);
  if (!room) return false; // this hull has no compartment for it
  ship.systems[sysId] = makeSystemState(sysId, 1, layout);
  autoAssignPower(ship);
  refreshShields(ship);
  return true;
}

export function addWeapon(ship, weaponId) {
  if (ship.weapons.length >= ship.weaponSlots) return false;
  const w = getWeapon(weaponId);
  ship.weapons.push({
    slot: ship.weapons.length, weaponId, charge: 0, powered: false,
    autofire: true, targetRoom: null, charges: 0,
    rampHeat: 0, chainBonus: 0,
  });
  autoAssignPower(ship);
  return true;
}

export function removeWeapon(ship, slot) {
  const w = ship.weapons[slot];
  if (!w) return null;
  ship.weapons.splice(slot, 1);
  ship.weapons.forEach((x, i) => { x.slot = i; });
  autoAssignPower(ship);
  return w.weaponId;
}

export function addDrone(ship, droneId) {
  if (ship.drones.length >= ship.droneSlots) return false;
  getDrone(droneId);
  ship.drones.push({
    slot: ship.drones.length, droneId, powered: false, deployed: false,
    hp: 30, maxHp: 30, cooldown: 0, targetRoom: null, room: null,
  });
  return true;
}

export function removeDrone(ship, slot) {
  const d = ship.drones[slot];
  if (!d) return null;
  ship.drones.splice(slot, 1);
  ship.drones.forEach((x, i) => { x.slot = i; });
  return d.droneId;
}

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

/** Free power a Zoltan standing in a system room contributes to that system. */
export function zoltanPower(ship, sysId) {
  const sys = ship.systems[sysId];
  if (!sys || sys.room == null) return 0;
  let n = 0;
  for (const c of ship.crew) {
    if (!isAlive(c) || c.onEnemyShip || c.room !== sys.room) continue;
    n += getRace(c.race).traits.powerBonus || 0;
  }
  return n;
}

/** Total reactor bars available right now, including the backup battery. */
export function totalReactor(ship) {
  let total = ship.reactor;
  const bat = ship.systems.battery;
  if (bat && ship.batteryTimer > 0) total += SYSTEMS.battery.bars(effectiveLevel(bat));
  return total;
}

/** Reactor bars currently spent (Zoltan power is free and doesn't count). */
export function usedReactor(ship) {
  let used = 0;
  for (const [id, sys] of Object.entries(ship.systems)) {
    if (getSystem(id).kind !== 'reactor') continue;
    used += Math.max(0, sys.power - zoltanPower(ship, id));
  }
  return used;
}

export function availableReactor(ship) {
  return Math.max(0, totalReactor(ship) - usedReactor(ship));
}

/**
 * Highest power a system can hold given its level, damage and ion charges.
 * Always a whole number — partial damage still costs the whole bar.
 */
export function powerCap(ship, sysId) {
  const sys = ship.systems[sysId];
  if (!sys) return 0;
  const def = getSystem(sysId);
  if (def.kind !== 'reactor') return 0;
  if (sys.hacked && sys.hackActive) return 0;
  return Math.max(0, sys.level + sys.overcharge - damagedBars(sys) - sys.ionCharges);
}

/**
 * Change a system's power by `delta`. Returns the number of bars actually
 * moved, so callers can play a "denied" sound when it's zero.
 */
export function setPower(ship, sysId, delta, opts = {}) {
  const sys = ship.systems[sysId];
  if (!sys) return 0;
  const def = getSystem(sysId);
  if (def.kind !== 'reactor') return 0;

  const cap = powerCap(ship, sysId);
  const free = zoltanPower(ship, sysId);
  let target = Math.max(0, Math.min(cap, sys.power + delta));

  if (target > sys.power) {
    // Zoltan bars are free, so only power above `free` draws on the reactor.
    const reactorFor = p => Math.max(0, p - free);
    const extraNeeded = reactorFor(target) - reactorFor(sys.power);
    const spare = availableReactor(ship);
    if (extraNeeded > spare) target = Math.min(cap, Math.max(sys.power, free + reactorFor(sys.power) + spare));
  }

  // Weapons and drones can't hold more power than their equipped items need.
  if (sysId === 'weapons') target = Math.min(target, Math.max(requiredWeaponPower(ship), 0));
  if (sysId === 'drones') target = Math.min(target, Math.max(requiredDronePower(ship), 0));

  target = Math.max(0, Math.round(target));
  const moved = target - sys.power;
  sys.power = target;
  // Remember what the captain asked for, so a repaired system comes back
  // online at the level it was at instead of staying quietly dead.
  if (!opts.transient) sys.desiredPower = target;
  if (sysId === 'shields') refreshShields(ship);
  if (sysId === 'weapons') reconcileWeaponPower(ship);
  if (sysId === 'drones') reconcileDronePower(ship);
  return moved;
}

/**
 * Top systems back up to the power level they were set to, as damage is
 * repaired and ion charges expire. Never spends more reactor than is free.
 */
export function restorePower(ship) {
  for (const [id, sys] of Object.entries(ship.systems)) {
    if (getSystem(id).kind !== 'reactor') continue;
    const want = Math.min(sys.desiredPower ?? sys.power, powerCap(ship, id));
    if (sys.power >= want) continue;
    setPower(ship, id, want - sys.power, { transient: true });
  }
}

function requiredWeaponPower(ship) {
  return ship.weapons.reduce((n, w) => n + getWeapon(w.weaponId).power, 0);
}
function requiredDronePower(ship) {
  return ship.drones.reduce((n, d) => n + getDrone(d.droneId).power, 0);
}

/** Powered weapons must fit inside the weapons system's power; drop the tail. */
export function reconcileWeaponPower(ship) {
  const sys = ship.systems.weapons;
  const budget = sys ? effectiveLevel(sys) : 0;
  let spent = 0;
  for (const w of ship.weapons) {
    const cost = getWeapon(w.weaponId).power;
    if (w.powered && spent + cost <= budget) { spent += cost; continue; }
    if (w.powered) { w.powered = false; w.charge = 0; }
  }
  return budget - spent;
}

export function reconcileDronePower(ship) {
  const sys = ship.systems.drones;
  const budget = sys ? effectiveLevel(sys) : 0;
  let spent = 0;
  for (const d of ship.drones) {
    const cost = getDrone(d.droneId).power;
    if (d.powered && spent + cost <= budget) { spent += cost; continue; }
    if (d.powered) { d.powered = false; d.deployed = false; }
  }
  return budget - spent;
}

/** Try to power a weapon; returns false if there isn't room in the budget. */
export function toggleWeapon(ship, slot) {
  const w = ship.weapons[slot];
  if (!w) return false;
  if (w.powered) { w.powered = false; w.charge = 0; reconcileWeaponPower(ship); return true; }
  const sys = ship.systems.weapons;
  if (!sys) return false;
  const budget = effectiveLevel(sys);
  const spent = ship.weapons.reduce((n, x) => n + (x.powered ? getWeapon(x.weaponId).power : 0), 0);
  if (spent + getWeapon(w.weaponId).power > budget) return false;
  w.powered = true;
  return true;
}

export function toggleDrone(ship, slot) {
  const d = ship.drones[slot];
  if (!d) return false;
  if (d.powered) { d.powered = false; d.deployed = false; return true; }
  const sys = ship.systems.drones;
  if (!sys) return false;
  const budget = effectiveLevel(sys);
  const spent = ship.drones.reduce((n, x) => n + (x.powered ? getDrone(x.droneId).power : 0), 0);
  if (spent + getDrone(d.droneId).power > budget) return false;
  d.powered = true;
  return true;
}

/**
 * Spread available reactor power over the systems that matter, in priority
 * order. Used at ship creation and after a system is installed.
 */
export function autoAssignPower(ship) {
  for (const sys of Object.values(ship.systems)) {
    if (getSystem(sys.id).kind === 'reactor') sys.power = 0;
  }

  // Allocate in rounds rather than straight down a priority list. A single
  // greedy pass maxes shields and engines and leaves the guns unpowered, which
  // is never what a captain (or the enemy AI) actually wants.
  const rounds = [
    // Keep everyone breathing, get one shield layer up, then arm the ship.
    { oxygen: 1, shields: 2 },
    { weapons: requiredWeaponPower(ship) },
    { engines: 2, drones: requiredDronePower(ship) },
    { medbay: 1, clonebay: 1 },
    // Only once the essentials are covered do the rest get a look in.
    { shields: Infinity, engines: Infinity },
    {
      cloaking: Infinity, teleporter: Infinity, hacking: Infinity,
      mindcontrol: Infinity, nanoforge: Infinity, siphon: Infinity,
      temporal: Infinity, overdrive: Infinity,
    },
  ];
  for (const round of rounds) {
    for (const [id, want] of Object.entries(round)) {
      if (!ship.systems[id]) continue;
      const target = want === Infinity ? powerCap(ship, id) : want;
      setPower(ship, id, target - ship.systems[id].power);
    }
  }
  // Power the weapons we can actually afford, best first.
  for (const w of ship.weapons) w.powered = false;
  let budget = ship.systems.weapons ? effectiveLevel(ship.systems.weapons) : 0;
  for (const w of ship.weapons) {
    const cost = getWeapon(w.weaponId).power;
    if (cost <= budget) { w.powered = true; budget -= cost; }
  }
  for (const d of ship.drones) d.powered = false;
  let dbudget = ship.systems.drones ? effectiveLevel(ship.systems.drones) : 0;
  for (const d of ship.drones) {
    const cost = getDrone(d.droneId).power;
    if (cost <= dbudget) { d.powered = true; dbudget -= cost; }
  }
  refreshShields(ship, true);
}

// ---------------------------------------------------------------------------
// Shields, evasion
// ---------------------------------------------------------------------------

export function refreshShields(ship, fill = false) {
  const sys = ship.systems.shields;
  const lvl = sys ? effectiveLevel(sys) : 0;
  let max = SYSTEMS.shields.layersAt(lvl);
  for (const d of ship.drones) {
    if (d.powered && d.deployed && getDrone(d.droneId).shieldBoost) max += getDrone(d.droneId).shieldBoost;
  }
  ship.shields.max = max;
  if (fill) ship.shields.layers = max;
  if (ship.shields.layers > max) ship.shields.layers = max;
  return max;
}

/** Percent chance an incoming shot misses. */
export function evasion(ship) {
  if (ship.cloakTimer > 0) return 100;
  const eng = ship.systems.engines;
  const pilot = ship.systems.piloting;
  const engLvl = eng ? effectiveLevel(eng) : 0;
  const pilotLvl = pilot ? Math.max(0, pilot.level - pilot.damage) : 0;

  // An unmanned helm means no evasion at all, exactly as in FTL.
  const pilotCrew = mannedBy(ship, 'piloting');
  if (!pilotCrew && !hasAutopilot(ship)) return 0;

  let ev = ENGINE_EVASION[Math.min(engLvl, ENGINE_EVASION.length - 1)] || 0;
  ev += PILOT_EVASION[Math.min(pilotLvl, PILOT_EVASION.length - 1)] || 0;
  if (pilotCrew) ev *= skillBonus(pilotCrew, 'piloting');
  const engCrew = mannedBy(ship, 'engines');
  if (engCrew) ev *= skillBonus(engCrew, 'engines');
  ev += ship.evasionBonus;
  return Math.max(0, Math.min(95, Math.round(ev)));
}

/** Auto-ships fly themselves; crewed ships need someone at the helm. */
function hasAutopilot(ship) { return ship.isEnemy && ship.autoShip === true; }

export function mannedBy(ship, sysId) {
  const sys = ship.systems[sysId];
  if (!sys || sys.room == null) return null;
  return ship.crew.find(c => isAlive(c) && !c.onEnemyShip && c.room === sys.room
    && c.stunned <= 0 && c.mindControlled <= 0) || null;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/**
 * Apply one incoming hit. `opts` carries the weapon's rider effects.
 * Returns a report the combat layer turns into sounds and floating numbers.
 */
export function applyHit(ship, roomId, damage, opts = {}, rng = null) {
  const report = { hull: 0, system: null, systemDamage: 0, fire: false, breach: false, killed: [], blocked: false };
  const room = ship.rooms[roomId];
  if (!room) return report;
  const roll = rng ? () => rng.next() : Math.random;

  const sysId = room.system;
  const sys = sysId ? ship.systems[sysId] : null;

  // "Hull bonus" weapons hit harder where there is no system to absorb it.
  let dmg = damage;
  if (opts.hullBonus && !sys) dmg += opts.hullBonus;

  if (opts.ion) {
    if (sys) {
      sys.ionCharges = Math.min(sys.level + 2, sys.ionCharges + opts.ion);
      sys.ionTimer = Math.max(sys.ionTimer, 4 + opts.ion * 1.5);
      sys.power = Math.min(sys.power, powerCap(ship, sysId));
      if (sysId === 'shields') refreshShields(ship);
      report.system = sysId;
      report.systemDamage = opts.ion;
    }
    // Ion weapons never touch the hull.
    dmg = 0;
  }

  if (dmg > 0 && sys) {
    const armor = augmentValue(ship.augments, 'systemArmor', 0);
    if (!(armor && roll() < armor)) {
      const before = sys.damage;
      sys.damage = Math.min(sys.level, sys.damage + dmg);
      report.system = sysId;
      report.systemDamage = sys.damage - before;
      sys.power = Math.min(sys.power, powerCap(ship, sysId));
      if (sysId === 'shields') refreshShields(ship);
      if (sysId === 'weapons') reconcileWeaponPower(ship);
      if (sysId === 'drones') reconcileDronePower(ship);
    } else {
      report.blocked = true;
    }
  }

  if (dmg > 0 && !opts.sysOnly) {
    const hullArmor = augmentValue(ship.augments, 'hullArmor', 0);
    if (hullArmor && roll() < hullArmor) {
      report.blocked = true;
    } else if (!ship.echoUsed && augmentValue(ship.augments, 'echo', 0) > 0) {
      // Echo Core undoes the first hull damage of the fight.
      ship.echoUsed = true;
      report.blocked = true;
    } else {
      ship.hull = Math.max(0, ship.hull - dmg);
      ship.stats.damageTaken += dmg;
      report.hull = dmg;
      if (ship.hull <= 0) ship.destroyed = true;
    }
  }

  if (opts.fire && roll() < opts.fire) { room.fire = Math.max(room.fire, 0.32); report.fire = true; }
  if (opts.breach && roll() < opts.breach) { room.breaches += 1; report.breach = true; }
  if (opts.stun) {
    for (const c of crewInRoom(ship, roomId)) c.stunned = Math.max(c.stunned, opts.stun);
  }

  const crewDamage = (opts.crewDamage || 0) + dmg * 15;
  if (crewDamage > 0) {
    for (const c of crewInRoom(ship, roomId)) {
      if (damageCrew(c, crewDamage)) { report.killed.push(c); ship.stats.crewLost++; }
    }
  }

  if (opts.repair && sys) {
    sys.damage = Math.max(0, sys.damage - opts.repair);
    if (sysId === 'shields') refreshShields(ship);
  }

  return report;
}

/**
 * Route an incoming volley through shields first. Returns how much damage got
 * through, and whether a shield layer absorbed it.
 */
export function absorbWithShields(ship, damage, pierce = 0) {
  if (ship.superShield > 0) {
    ship.superShield -= 1;
    return { through: 0, shielded: true, superShield: true };
  }
  const effective = Math.max(0, ship.shields.layers - pierce);
  if (effective > 0) {
    ship.shields.layers -= 1;
    ship.shields.charge = 0;
    return { through: 0, shielded: true };
  }
  return { through: damage, shielded: false };
}

export function repairHull(ship, amount) {
  ship.hull = Math.min(ship.maxHull, ship.hull + amount);
  return ship.hull;
}

export function crewInRoom(ship, roomId, includeEnemy = false) {
  return ship.crew.filter(c => isAlive(c) && c.room === roomId
    && (includeEnemy || !c.onEnemyShip));
}

/** Everyone standing in a room, including boarders from the other ship. */
export function occupants(ship, roomId, boarders = []) {
  return [...crewInRoom(ship, roomId), ...boarders.filter(b => isAlive(b) && b.room === roomId)];
}

// ---------------------------------------------------------------------------
// Crew placement and movement
// ---------------------------------------------------------------------------

export function placeInRoom(ship, crew, roomId) {
  const layout = compiledLayout(ship.shipId, ship.variant);
  const room = layout.rooms[roomId] || layout.rooms[0];
  crew.room = room.id;
  crew.x = room.x + room.w / 2;
  crew.y = room.y + room.h / 2;
  crew.path = null;
  crew.targetRoom = null;
}

/** Room-graph BFS. Returns a list of room ids from `from` to `to`, or null. */
export function findPath(ship, from, to) {
  if (from === to) return [];
  const adj = roomAdjacency(ship);
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj.get(cur) || []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === to) {
        const path = [to];
        let n = cur;
        while (n !== null && n !== from) { path.unshift(n); n = prev.get(n); }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

const adjacencyCache = new WeakMap();

function roomAdjacency(ship) {
  let cached = adjacencyCache.get(ship);
  if (cached) return cached;
  const adj = new Map(ship.rooms.map(r => [r.id, []]));
  for (const d of ship.doors) {
    if (d.b === null) continue;
    adj.get(d.a).push(d.b);
    adj.get(d.b).push(d.a);
  }
  adjacencyCache.set(ship, adj);
  return adj;
}

export function orderCrewTo(ship, crewId, roomId) {
  const c = ship.crew.find(x => x.id === crewId);
  if (!c || !isAlive(c) || c.onEnemyShip) return false;
  if (c.room === roomId) { c.path = null; c.targetRoom = null; return true; }
  const path = findPath(ship, c.room, roomId);
  if (!path) return false;
  c.path = path;
  c.targetRoom = roomId;
  c.manning = null;
  return true;
}

function advanceCrew(ship, c, dt) {
  if (!c.path || c.path.length === 0) { c.path = null; return; }
  const layout = compiledLayout(ship.shipId, ship.variant);
  const nextRoom = layout.rooms[c.path[0]];
  const tx = nextRoom.x + nextRoom.w / 2;
  const ty = nextRoom.y + nextRoom.h / 2;
  const dx = tx - c.x, dy = ty - c.y;
  const dist = Math.hypot(dx, dy);
  const speed = TUNING.CREW_TILE_SPEED * moveSpeed(c, augmentValue(ship.augments, 'crewSpeed', 0));
  const step = speed * dt;

  if (dist <= step || dist < 0.001) {
    c.x = tx; c.y = ty;
    c.room = nextRoom.id;
    c.path.shift();
    if (c.path.length === 0) { c.path = null; c.targetRoom = null; }
  } else {
    c.x += (dx / dist) * step;
    c.y += (dy / dist) * step;
  }
}

// ---------------------------------------------------------------------------
// Per-frame simulation
// ---------------------------------------------------------------------------

/**
 * Advance one ship by dt seconds.
 * `ctx` may carry { rng, boarders, inCombat, onEvent } — onEvent receives
 * ('fire' | 'breach' | 'crewDied' | 'systemRepaired' | 'suffocating', payload)
 * so the presentation layer can react without polling.
 */
export function updateShip(ship, dt, ctx = {}) {
  if (ship.destroyed) return;
  const rng = ctx.rng;
  const emit = ctx.onEvent || (() => {});
  const roll = rng ? () => rng.next() : Math.random;

  updateTimers(ship, dt);
  updateOxygen(ship, dt, emit);
  updateFires(ship, dt, roll, emit);
  updateCrew(ship, dt, ctx, emit);
  updateSystems(ship, dt, ctx, emit);
  restorePower(ship);
  updateShieldCharge(ship, dt);
  if (ctx.inCombat) updateWeaponCharge(ship, dt, ctx);
  updateFtl(ship, dt, ctx);
}

function updateTimers(ship, dt) {
  ship.cloakTimer = Math.max(0, ship.cloakTimer - dt);
  ship.cloakCooldown = Math.max(0, ship.cloakCooldown - dt);
  ship.batteryTimer = Math.max(0, ship.batteryTimer - dt);
  const batRate = 1 + augmentValue(ship.augments, 'batteryRecharge', 0);
  ship.batteryCooldown = Math.max(0, ship.batteryCooldown - dt * batRate);

  for (const sys of Object.values(ship.systems)) {
    if (sys.ionCharges > 0) {
      sys.ionTimer -= dt;
      if (sys.ionTimer <= 0) {
        sys.ionCharges = Math.max(0, sys.ionCharges - 1);
        sys.ionTimer = sys.ionCharges > 0 ? 5 : 0;
        if (sys.id === 'shields') refreshShields(ship);
      }
    }
    if (sys.hackActive) {
      sys.hackTimer -= dt;
      if (sys.hackTimer <= 0) {
        sys.hackActive = false;
        if (sys.id === 'shields') refreshShields(ship);
      }
    }
    if (sys.overchargeTimer > 0) {
      sys.overchargeTimer -= dt;
      if (sys.overchargeTimer <= 0) {
        sys.overcharge = 0;
        // The strain of an overcharge can leave the system damaged.
        if (sys.pendingBurnout) {
          sys.pendingBurnout = false;
          sys.damage = Math.min(sys.level, sys.damage + 1);
          if (sys.id === 'shields') refreshShields(ship);
          if (sys.id === 'weapons') reconcileWeaponPower(ship);
        }
        sys.power = Math.min(sys.power, powerCap(ship, sys.id));
      }
    }
    sys.cooldown = Math.max(0, sys.cooldown - dt);
  }

  for (const room of ship.rooms) {
    if (room.temporalTimer > 0) {
      room.temporalTimer -= dt;
      if (room.temporalTimer <= 0) room.temporalFactor = 1;
    }
    room.stunField = Math.max(0, room.stunField - dt);
  }
}

function updateOxygen(ship, dt, emit) {
  const sys = ship.systems.oxygen;

  // Vent: breaches and open airlocks bleed air to space.
  for (const room of ship.rooms) {
    if (room.breaches > 0) {
      room.oxygen = Math.max(0, room.oxygen - TUNING.O2_BREACH_VENT * room.breaches * dt);
    }
  }
  for (const d of ship.doors) {
    if (d.isAirlock && d.open) {
      const room = ship.rooms[d.a];
      room.oxygen = Math.max(0, room.oxygen - TUNING.O2_AIRLOCK_VENT * dt);
    }
  }

  // Equalise through open doors.
  for (const d of ship.doors) {
    if (d.b === null || !d.open) continue;
    const a = ship.rooms[d.a], b = ship.rooms[d.b];
    const flow = (a.oxygen - b.oxygen) * TUNING.O2_DIFFUSE * dt * 0.5;
    a.oxygen = Math.max(0, Math.min(1, a.oxygen - flow));
    b.oxygen = Math.max(0, Math.min(1, b.oxygen + flow));
  }

  // Refill from the oxygen system, favouring the emptiest rooms.
  const lvl = sys ? effectiveLevel(sys) : 0;
  if (lvl > 0) {
    let budget = TUNING.O2_REFILL_PER_LEVEL * lvl * dt;
    const needy = ship.rooms.filter(r => r.oxygen < 1).sort((a, b) => a.oxygen - b.oxygen);
    for (const room of needy) {
      if (budget <= 0) break;
      const take = Math.min(budget, 1 - room.oxygen);
      room.oxygen += take;
      budget -= take;
    }
  }

  const lowRooms = ship.rooms.filter(r => r.oxygen < TUNING.O2_DANGER).length;
  if (lowRooms > 0 && !ship.isEnemy) emit('suffocating', { rooms: lowRooms });
}

function updateFires(ship, dt, roll, emit) {
  const suppression = augmentValue(ship.augments, 'fireSuppression', 0);
  const adj = roomAdjacency(ship);

  for (const room of ship.rooms) {
    if (room.fire <= 0) continue;
    const timeScale = room.temporalFactor;

    // Fire needs air. Starve it and it dies.
    if (room.oxygen < 0.06) {
      room.fire = Math.max(0, room.fire - 0.9 * dt);
      if (room.fire <= 0) continue;
    } else {
      room.fire = Math.min(1, room.fire + TUNING.FIRE_GROWTH * dt * timeScale);
      room.oxygen = Math.max(0, room.oxygen - TUNING.FIRE_O2_BURN * room.fire * dt);
    }
    if (suppression) room.fire = Math.max(0, room.fire - suppression * dt);

    // Burn the system in this room.
    if (room.system && ship.systems[room.system]) {
      const sys = ship.systems[room.system];
      const before = Math.floor(sys.damage);
      sys.damage = Math.min(sys.level, sys.damage + TUNING.FIRE_SYSTEM_DPS * room.fire * dt);
      if (Math.floor(sys.damage) > before) {
        sys.power = Math.min(sys.power, powerCap(ship, sys.id));
        if (sys.id === 'shields') refreshShields(ship);
        if (sys.id === 'weapons') reconcileWeaponPower(ship);
      }
    }

    // Burn the crew standing in it.
    for (const c of crewInRoom(ship, room.id)) {
      if (getRace(c.race).traits.fireproof) continue;
      if (damageCrew(c, TUNING.FIRE_CREW_DPS * room.fire * dt)) {
        ship.stats.crewLost++;
        emit('crewDied', { crew: c, cause: 'fire' });
      }
    }

    // Spread through open doors.
    if (room.fire > 0.5) {
      for (const nid of adj.get(room.id) || []) {
        const door = ship.doors.find(d => (d.a === room.id && d.b === nid) || (d.b === room.id && d.a === nid));
        if (!door || !door.open) continue;
        const next = ship.rooms[nid];
        if (next.fire > 0 || next.oxygen < 0.1) continue;
        if (roll() < TUNING.FIRE_SPREAD_CHANCE * dt) {
          next.fire = 0.2;
          emit('fire', { room: nid, spread: true });
        }
      }
    }
  }
}

function updateCrew(ship, dt, ctx, emit) {
  const o2Aug = augmentValue(ship.augments, 'o2Resist', 0);
  const medbay = ship.systems.medbay;
  const medLvl = medbay ? effectiveLevel(medbay) : 0;
  const clone = ship.systems.clonebay;

  for (const c of ship.crew) {
    if (c.dead) {
      // Clone Bay revival.
      if (clone && effectiveLevel(clone) > 0) {
        c.cloneProgress += dt;
        if (c.cloneProgress >= SYSTEMS.clonebay.cloneTime(effectiveLevel(clone))) {
          c.dead = false;
          c.hp = c.maxHp * 0.5;
          c.cloneProgress = 0;
          if (!augmentValue(ship.augments, 'perfectClone', false)) {
            for (const k of Object.keys(c.xp)) c.xp[k] *= 0.85;
          }
          placeInRoom(ship, c, clone.room ?? 0);
          emit('cloned', { crew: c });
        }
      }
      continue;
    }

    c.stunned = Math.max(0, c.stunned - dt);
    c.mindControlled = Math.max(0, c.mindControlled - dt);
    if (c.onEnemyShip) continue;
    if (c.stunned > 0) continue;

    advanceCrew(ship, c, dt);

    const room = ship.rooms[c.room];
    if (!room) continue;
    const timeScale = room.temporalFactor;

    // Suffocation.
    if (room.oxygen < TUNING.O2_DANGER) {
      const rate = suffocationRate(c, o2Aug);
      if (rate > 0 && damageCrew(c, rate * dt)) {
        ship.stats.crewLost++;
        emit('crewDied', { crew: c, cause: 'oxygen' });
        continue;
      }
    }

    // Medbay healing.
    if (medLvl > 0 && medbay.room === c.room && !getRace(c.race).traits.noMedbay) {
      healCrew(c, SYSTEMS.medbay.healRate(medLvl) * dt);
    }
    // Synths mend themselves instead.
    const selfRepair = getRace(c.race).traits.selfRepair;
    if (selfRepair && c.hp < c.maxHp && !c.path) healCrew(c, selfRepair * dt * 0.35);

    if (c.path) continue; // busy walking

    // Fire fighting takes priority over everything else in the room.
    if (room.fire > 0) {
      room.fire = Math.max(0, room.fire - TUNING.FIRE_SUPPRESS * repairSpeed(c) * dt * timeScale);
      grantXP(c, 'repair', 1.2 * dt);
      if (room.fire === 0) emit('fireOut', { room: room.id });
      continue;
    }

    // Breach sealing.
    if (room.breaches > 0) {
      c.repairTimer = (c.repairTimer || 0) + dt * repairSpeed(c) * timeScale;
      grantXP(c, 'repair', 1.2 * dt);
      if (c.repairTimer >= TUNING.BREACH_REPAIR_TIME) {
        c.repairTimer = 0;
        room.breaches -= 1;
        emit('breachSealed', { room: room.id });
      }
      continue;
    }

    // System repair.
    if (room.system && ship.systems[room.system]) {
      const sys = ship.systems[room.system];
      if (sys.damage > 0) {
        const before = Math.ceil(sys.damage);
        sys.damage = Math.max(0, sys.damage - TUNING.SYSTEM_REPAIR_PER_SECOND * repairSpeed(c) * dt * timeScale);
        grantXP(c, 'repair', 1.5 * dt);
        if (Math.ceil(sys.damage) < before) {
          if (sys.id === 'shields') refreshShields(ship);
          if (sys.id === 'weapons') reconcileWeaponPower(ship);
          if (sys.id === 'drones') reconcileDronePower(ship);
          emit('systemRepaired', { system: sys.id });
        }
        continue;
      }
      // Otherwise man the station and earn XP for it.
      c.manning = room.system;
      const skill = { piloting: 'piloting', engines: 'engines', shields: 'shields', weapons: 'weapons' }[room.system];
      if (skill && ctx.inCombat) grantXP(c, skill, 0.85 * dt);
    } else {
      c.manning = null;
    }
  }
}

function updateSystems(ship, dt, ctx, emit) {
  // Nanoforge slowly welds the hull back together.
  const forge = ship.systems.nanoforge;
  if (forge) {
    const lvl = effectiveLevel(forge);
    if (lvl > 0 && ship.hull < ship.maxHull) {
      ship.hullFraction = (ship.hullFraction || 0) + SYSTEMS.nanoforge.hullPerSecond(lvl) * dt;
      while (ship.hullFraction >= 1) {
        ship.hullFraction -= 1;
        repairHull(ship, 1);
        emit('hullRepaired', { source: 'nanoforge' });
      }
    }
  }

  // Slug Repair Gel seals breaches without a crew member present.
  if (augmentValue(ship.augments, 'autoSealBreach', false)) {
    ship.autoSeal = (ship.autoSeal || 0) + dt;
    if (ship.autoSeal >= 14) {
      ship.autoSeal = 0;
      const room = ship.rooms.find(r => r.breaches > 0);
      if (room) { room.breaches -= 1; emit('breachSealed', { room: room.id, auto: true }); }
    }
  }

  // Hull repair drones.
  for (const d of ship.drones) {
    if (!d.powered || !d.deployed) continue;
    const def = getDrone(d.droneId);
    if (def.hullRate && ship.hull < ship.maxHull) {
      ship.droneHullFraction = (ship.droneHullFraction || 0) + def.hullRate * dt;
      while (ship.droneHullFraction >= 1) { ship.droneHullFraction -= 1; repairHull(ship, 1); }
    }
    if (def.repairRate) {
      const broken = Object.values(ship.systems).find(s => s.damage > 0);
      if (broken) {
        broken.damage = Math.max(0, broken.damage - def.repairRate * dt * 0.35);
        if (broken.id === 'shields') refreshShields(ship);
      }
    }
  }
  void ctx;
}

function updateShieldCharge(ship, dt) {
  const sys = ship.systems.shields;
  refreshShields(ship);
  if (!sys || ship.shields.layers >= ship.shields.max) { ship.shields.charge = 0; return; }
  const crew = mannedBy(ship, 'shields');
  const speed = (crew ? skillBonus(crew, 'shields') : 1) * (crew ? 1.15 : 1);
  ship.shields.charge += dt / TUNING.SHIELD_RECHARGE_BASE * speed;
  while (ship.shields.charge >= 1 && ship.shields.layers < ship.shields.max) {
    ship.shields.charge -= 1;
    ship.shields.layers += 1;
  }
}

function updateWeaponCharge(ship, dt, ctx) {
  const sys = ship.systems.weapons;
  if (!sys) return;
  const crew = mannedBy(ship, 'weapons');
  const manned = crew ? skillBonus(crew, 'weapons') : 1;
  const augSpeed = 1 + augmentValue(ship.augments, 'chargeSpeed', 0);

  for (const w of ship.weapons) {
    const def = getWeapon(w.weaponId);
    if (!w.powered) { w.charge = 0; w.charges = 0; continue; }
    const room = sys.room != null ? ship.rooms[sys.room] : null;
    const timeScale = room ? room.temporalFactor : 1;
    // Vulcan-style weapons speed up the longer they keep firing.
    const ramp = def.rampUp ? 1 + Math.min(2.2, w.rampHeat) : 1;
    const chain = def.chain ? 1 + w.chainBonus : 1;
    // A temporal field on the weapons room scales charge speed directly:
    // factor < 1 slows the guns, factor > 1 rushes them.
    w.charge += dt * manned * augSpeed * ramp * chain * timeScale;

    const full = def.charge;
    if (w.charge >= full) {
      if (def.maxCharges && w.charges < def.maxCharges) {
        w.charges += 1;
        w.charge = 0;
      } else {
        w.charge = full;
      }
    }
    if (def.rampUp) w.rampHeat = Math.max(0, w.rampHeat - dt * 0.25);
  }
  void ctx;
}

function updateFtl(ship, dt, ctx) {
  if (ship.isEnemy) return;
  const eng = ship.systems.engines;
  const lvl = eng ? effectiveLevel(eng) : 0;
  if (lvl <= 0) return;
  const crew = mannedBy(ship, 'engines');
  const speed = (1 + lvl * 0.25) * (crew ? skillBonus(crew, 'engines') : 1);
  // Out of combat the drive spins up much faster.
  const rate = ctx.inCombat ? 1 : 3.2;
  ship.ftlCharge = Math.min(1, ship.ftlCharge + (dt * speed * rate) / TUNING.FTL_CHARGE_BASE);
}

// ---------------------------------------------------------------------------
// Queries used by the UI and the AI
// ---------------------------------------------------------------------------

export function isWeaponReady(ship, slot) {
  const w = ship.weapons[slot];
  if (!w || !w.powered) return false;
  const def = getWeapon(w.weaponId);
  if (def.maxCharges) return w.charges > 0;
  return w.charge >= def.charge;
}

export function weaponProgress(ship, slot) {
  const w = ship.weapons[slot];
  if (!w) return 0;
  const def = getWeapon(w.weaponId);
  if (def.maxCharges) return w.charges > 0 ? 1 : w.charge / def.charge;
  return Math.min(1, w.charge / def.charge);
}

export function livingCrew(ship) { return ship.crew.filter(isAlive); }
export function crewAboard(ship) { return ship.crew.filter(c => isAlive(c) && !c.onEnemyShip); }

export function systemList(ship) {
  return Object.values(ship.systems).sort((a, b) => getSystem(a.id).order - getSystem(b.id).order);
}

export function hullPercent(ship) { return ship.maxHull > 0 ? ship.hull / ship.maxHull : 0; }

/** Open or close a door; returns the new state, or null if it can't move. */
export function toggleDoor(ship, doorId) {
  const d = ship.doors.find(x => x.id === doorId);
  if (!d || d.breached) return null;
  d.open = !d.open;
  return d.open;
}

export function setAllDoors(ship, open) {
  for (const d of ship.doors) if (!d.breached) d.open = open;
}

/** Vent a room: open its airlock and the doors leading to it. */
export function ventRoom(ship, roomId, on = true) {
  let touched = false;
  for (const d of ship.doors) {
    if (d.isAirlock && d.a === roomId) { d.open = on; touched = true; }
  }
  return touched;
}

export function totalOxygen(ship) {
  if (ship.rooms.length === 0) return 0;
  return ship.rooms.reduce((n, r) => n + r.oxygen, 0) / ship.rooms.length;
}

export function activeFires(ship) { return ship.rooms.filter(r => r.fire > 0).length; }
export function activeBreaches(ship) { return ship.rooms.reduce((n, r) => n + r.breaches, 0); }

/** A compact snapshot for the save file. Ships are already plain data. */
export function serializeShip(ship) { return JSON.parse(JSON.stringify(ship)); }

export function deserializeShip(data) {
  // Nothing to rehydrate: the ship is pure data and the layout is looked up
  // from shipId/variant on demand.
  return data;
}
