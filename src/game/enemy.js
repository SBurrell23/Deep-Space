/**
 * Procedural enemy ships.
 *
 * Enemies reuse the player hulls' compiled deck plans — that geometry is
 * already validated, and it means boarding an enemy behaves identically to
 * defending your own ship. Everything else (systems, weapons, crew, rewards)
 * is rolled fresh against the sector's difficulty curve.
 */

import { createShip, makeSystemState, autoAssignPower, addWeapon, addDrone, placeInRoom, refreshShields } from './ship.js';
import { compiledLayout } from './ships.js';
import { makeCrew, rollRace } from './crew.js';
import { WEAPONS, DRONES, AUGMENTS, rarityWeight } from './weapons.js';

/**
 * Enemy archetypes. `hull` names which player deck plan to borrow; `sprite` is
 * the exterior art. `tier` biases how much of the sector budget they spend.
 */
export const ENEMY_CLASSES = {
  scout: {
    id: 'scout', name: 'Scout', sprite: 'enemy_scout', hull: 'mantis', variant: 'A',
    hullMul: 0.6, tier: 0.6, crew: [1, 2], weapons: [1, 1], flees: true,
    weight: s => Math.max(0.5, 4 - s * 0.4),
  },
  fighter: {
    id: 'fighter', name: 'Fighter', sprite: 'enemy_fighter', hull: 'kestrel', variant: 'A',
    hullMul: 0.85, tier: 1, crew: [2, 3], weapons: [1, 2], flees: true,
    weight: () => 5,
  },
  pirate: {
    id: 'pirate', name: 'Pirate Raider', sprite: 'enemy_pirate', hull: 'nomad', variant: 'A',
    hullMul: 0.9, tier: 1.1, crew: [2, 4], weapons: [2, 2], flees: true, boards: true,
    weight: s => 2 + s * 0.2,
  },
  bomber: {
    id: 'bomber', name: 'Bomber', sprite: 'enemy_bomber', hull: 'rock', variant: 'A',
    hullMul: 1.05, tier: 1.15, crew: [2, 3], weapons: [2, 2], missileHeavy: true, flees: true,
    weight: s => 1.5 + s * 0.25,
  },
  cruiser: {
    id: 'cruiser', name: 'Cruiser', sprite: 'enemy_cruiser', hull: 'torus', variant: 'A',
    hullMul: 1.3, tier: 1.35, crew: [3, 5], weapons: [2, 3], flees: true,
    weight: s => Math.max(0, s - 1) * 0.9,
  },
  carrier: {
    id: 'carrier', name: 'Carrier', sprite: 'enemy_carrier', hull: 'engi', variant: 'A',
    hullMul: 1.15, tier: 1.3, crew: [2, 4], weapons: [1, 2], droneHeavy: true, flees: true,
    weight: s => Math.max(0, s - 2) * 0.9,
  },
  auto: {
    id: 'auto', name: 'Automated Hull', sprite: 'enemy_auto', hull: 'stealth', variant: 'A',
    hullMul: 0.95, tier: 1.1, crew: [0, 0], weapons: [1, 2], autoShip: true, noFlee: true,
    weight: s => 1 + s * 0.3,
  },
  drone: {
    id: 'drone', name: 'Sentry Drone', sprite: 'enemy_drone', hull: 'zoltan', variant: 'A',
    hullMul: 0.7, tier: 0.9, crew: [0, 0], weapons: [1, 1], autoShip: true, noFlee: true,
    weight: s => 1 + s * 0.2,
  },
  elite: {
    id: 'elite', name: 'Elite Escort', sprite: 'enemy_elite', hull: 'crystal', variant: 'A',
    hullMul: 1.4, tier: 1.6, crew: [3, 5], weapons: [3, 3], flees: false, boards: true,
    weight: s => Math.max(0, s - 3) * 1.1,
  },
};

export const ENEMY_CLASS_IDS = Object.keys(ENEMY_CLASSES);

/** Factions colour the flavour text and bias which crew races show up. */
export const FACTIONS = {
  pirate: { id: 'pirate', name: 'Pirate', races: ['human', 'mantis', 'rockman', 'vex'] },
  mantis: { id: 'mantis', name: 'Mantis', races: ['mantis'] },
  engi: { id: 'engi', name: 'Engi', races: ['engi', 'synth'] },
  rock: { id: 'rock', name: 'Rock', races: ['rockman'] },
  zoltan: { id: 'zoltan', name: 'Zoltan', races: ['zoltan'] },
  slug: { id: 'slug', name: 'Slug', races: ['slug'] },
  crystal: { id: 'crystal', name: 'Crystal', races: ['crystal'] },
  swarm: { id: 'swarm', name: 'Swarm', races: ['human', 'mantis', 'engi', 'rockman'] },
  civilian: { id: 'civilian', name: 'Civilian', races: ['human', 'engi', 'slug'] },
};

/** Pick an archetype appropriate to the sector. */
export function rollClass(rng, sector) {
  const pool = ENEMY_CLASS_IDS
    .map(id => ({ id, weight: ENEMY_CLASSES[id].weight(sector) }))
    .filter(p => p.weight > 0);
  return rng.weighted(pool).id;
}

function pickItem(rng, table, sector, filter = () => true) {
  const pool = Object.values(table)
    .filter(filter)
    .map(item => ({ item, weight: rarityWeight(item.rarity || 1, sector) }))
    .filter(p => p.weight > 0);
  if (pool.length === 0) return null;
  return rng.weighted(pool).item;
}

/**
 * Generate an enemy scaled to `sector` (1-based).
 * `opts` may force { classId, faction, elite, hullMul, extraScrap }.
 */
export function generateEnemy(rng, sector, opts = {}) {
  const classId = opts.classId || rollClass(rng, sector);
  const cls = ENEMY_CLASSES[classId] || ENEMY_CLASSES.fighter;
  const faction = opts.faction || rng.pick(['pirate', 'swarm', 'civilian', 'mantis', 'engi', 'rock', 'slug', 'zoltan']);

  const ship = createShip(cls.hull, cls.variant, { rng, isEnemy: true, bare: true });
  const layout = compiledLayout(cls.hull, cls.variant);

  ship.className = cls.name;
  ship.classId = classId;
  ship.faction = faction;
  ship.name = enemyName(rng, cls, faction);
  ship.sprite = cls.sprite;
  ship.autoShip = !!cls.autoShip;
  ship.noFlee = !!cls.noFlee || !cls.flees;
  ship.crewedShip = !cls.autoShip;

  // --- hull ---------------------------------------------------------------
  const baseHull = 10 + sector * 3.2;
  const mul = opts.hullMul ?? cls.hullMul;
  ship.maxHull = Math.max(6, Math.round(baseHull * mul * rng.float(0.9, 1.15)));
  ship.hull = ship.maxHull;

  // --- systems ------------------------------------------------------------
  const budget = Math.round((3 + sector * 1.7) * cls.tier);
  ship.reactor = Math.max(4, Math.round(budget * 0.9));

  const shieldLvl = Math.min(8, Math.max(0, Math.round(rng.gaussian(sector * 0.85, 1.1, 0, 8))));
  const engineLvl = Math.min(8, Math.max(1, Math.round(rng.gaussian(1 + sector * 0.45, 1, 1, 8))));
  const weaponLvl = Math.min(8, Math.max(1, Math.round(rng.gaussian(2 + sector * 0.5, 1, 1, 8))));

  const wanted = { weapons: weaponLvl, engines: engineLvl, oxygen: 1, piloting: 1, doors: 1, sensors: 1 };
  if (shieldLvl >= 2) wanted.shields = shieldLvl;
  if (!cls.autoShip) wanted.medbay = 1;
  if (cls.droneHeavy) wanted.drones = Math.min(8, 2 + Math.floor(sector / 2));
  if (cls.boards && sector >= 2) wanted.teleporter = rng.chance(0.6) ? 1 : 2;
  if (sector >= 4 && rng.chance(0.22)) wanted.cloaking = 1;
  if (sector >= 5 && rng.chance(0.2)) wanted.hacking = 1;

  for (const [sysId, level] of Object.entries(wanted)) {
    const room = layout.rooms.find(r => r.system === sysId);
    if (!room) continue; // this hull has no compartment for it
    ship.systems[sysId] = makeSystemState(sysId, level, layout);
  }

  // --- weapons ------------------------------------------------------------
  const nWeapons = rng.int(cls.weapons[0], cls.weapons[1]);
  const allowed = w => {
    if (cls.missileHeavy) return true;
    // Keep early sectors from fielding ordnance the player can't answer.
    if (w.type === 'missile' && sector < 2 && rng.chance(0.6)) return false;
    return true;
  };
  for (let i = 0; i < nWeapons; i++) {
    const w = pickItem(rng, WEAPONS, sector, x => !x.friendly && allowed(x));
    if (w) addWeapon(ship, w.id);
  }
  if (ship.weapons.length === 0) addWeapon(ship, 'laser_basic');
  ship.missiles = cls.missileHeavy ? rng.int(8, 20) : rng.int(2, 9);

  // --- drones -------------------------------------------------------------
  if (ship.systems.drones) {
    const n = cls.droneHeavy ? rng.int(1, 2) : 1;
    for (let i = 0; i < n; i++) {
      const d = pickItem(rng, DRONES, sector);
      if (d) addDrone(ship, d.id);
    }
  }

  // --- augments -----------------------------------------------------------
  if (sector >= 3 && rng.chance(0.3)) {
    const a = pickItem(rng, AUGMENTS, sector, x => !x.effect.revealMap);
    if (a) ship.augments.push(a.id);
  }

  // --- crew ---------------------------------------------------------------
  const races = FACTIONS[faction]?.races || ['human'];
  const nCrew = rng.int(cls.crew[0], cls.crew[1]);
  const stations = layout.rooms.filter(r => r.system && ship.systems[r.system]).map(r => r.id);
  for (let i = 0; i < nCrew; i++) {
    const race = rng.chance(0.75) ? rng.pick(races) : rollRace(rng, sector);
    const room = stations.length ? stations[i % stations.length] : 0;
    ship.crew.push(makeCrew(race, { rng, room }));
  }
  for (const c of ship.crew) placeInRoom(ship, c, c.room);

  autoAssignPower(ship);
  refreshShields(ship, true);

  // --- rewards ------------------------------------------------------------
  ship.rewardScrap = Math.round((8 + sector * 4.5) * cls.tier * rng.float(0.85, 1.2)) + (opts.extraScrap || 0);
  if (rng.chance(0.35) && ship.weapons.length) ship.dropWeapon = rng.pick(ship.weapons).weaponId;
  if (rng.chance(0.25) && ship.drones.length) ship.dropDrone = rng.pick(ship.drones).droneId;
  if (rng.chance(0.15) && ship.augments.length) ship.dropAugment = rng.pick(ship.augments);

  return ship;
}

const SHIP_PREFIXES = ['ISC', 'MV', 'SS', 'KV', 'RN', 'TSV', 'DSV', 'FSS'];
const SHIP_NAMES = [
  'Vagrant', 'Cinder', 'Hollow Star', 'Long Odds', 'Brine', 'Kestrel Reach',
  'Iron Verdict', 'Salt Lantern', 'Gallows Wind', 'Pale Horse', 'Ninefold',
  'Cold Arithmetic', 'Redshift', 'Muzzle', 'Threnody', 'Grave Tide', 'Sundog',
  'Ambit', 'Torn Ledger', 'Last Call', 'Quiet Ruin', 'Hexadecimal', 'Bone Chapel',
  'Vermilion', 'Slack Water', 'Bitter Compass', 'Null Vector', 'Ash Wake',
];

function enemyName(rng, cls, faction) {
  if (cls.autoShip) return `${rng.pick(['AUTO', 'SENTRY', 'UNIT', 'HULL'])}-${rng.int(100, 999)}`;
  const base = rng.pick(SHIP_NAMES);
  return rng.chance(0.5) ? `${rng.pick(SHIP_PREFIXES)} ${base}` : base;
}

/**
 * The Swarm flagship. Fought in three escalating phases, each restoring some
 * hull and bringing another weapon system online.
 */
export function generateBoss(rng, phase = 1) {
  const ship = createShip('kestrel', 'A', { rng, isEnemy: true, bare: true });
  const layout = compiledLayout('kestrel', 'A');

  ship.className = 'Swarm Flagship';
  ship.classId = 'boss';
  ship.faction = 'swarm';
  ship.name = `SWARM PRIME — Phase ${phase}`;
  ship.sprite = 'enemy_boss';
  ship.isBoss = true;
  ship.bossPhase = phase;
  ship.noFlee = true;
  ship.crewedShip = true;

  ship.maxHull = [0, 40, 45, 50][phase] || 40;
  ship.hull = ship.maxHull;
  ship.reactor = 18 + phase * 3;

  const levels = {
    shields: [0, 4, 6, 8][phase],
    engines: [0, 3, 4, 5][phase],
    weapons: [0, 5, 6, 8][phase],
    oxygen: 2, piloting: 2, doors: 2, sensors: 2, medbay: 2,
  };
  for (const [sysId, level] of Object.entries(levels)) {
    const room = layout.rooms.find(r => r.system === sysId);
    if (room && level > 0) ship.systems[sysId] = makeSystemState(sysId, level, layout);
  }

  const loadouts = [
    [],
    ['laser_burst2', 'missile_artemis', 'beam_pike'],
    ['laser_burst3', 'missile_swarm', 'ion_heavy', 'beam_halberd'],
    ['plasma_storm', 'missile_pegasus', 'laser_vulcan', 'beam_glaive'],
  ];
  for (const w of loadouts[phase] || loadouts[1]) addWeapon(ship, w);
  ship.missiles = 40;

  const crewCount = [0, 4, 5, 6][phase] || 4;
  const stations = layout.rooms.filter(r => r.system && ship.systems[r.system]).map(r => r.id);
  for (let i = 0; i < crewCount; i++) {
    ship.crew.push(makeCrew(rng.pick(['mantis', 'human', 'rockman']), { rng, room: stations[i % stations.length] }));
  }
  for (const c of ship.crew) placeInRoom(ship, c, c.room);

  ship.augments = phase >= 2 ? ['titanium'] : [];
  if (phase >= 3) ship.augments.push('rock_plating');

  autoAssignPower(ship);
  refreshShields(ship, true);

  ship.rewardScrap = 60 + phase * 25;
  return ship;
}
