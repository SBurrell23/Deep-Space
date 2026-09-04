/**
 * Ship systems.
 *
 * Two kinds exist:
 *  - reactor systems draw bars from the reactor and can be damaged, ionised,
 *    hacked and depowered;
 *  - subsystems (piloting, doors, sensors, battery) cost no reactor power but
 *    are still damageable.
 *
 * `upgradeCost[n]` is the scrap price to go from level n to level n+1, so the
 * array is indexed by CURRENT level - 1.
 */

export const SYSTEM_KIND = { REACTOR: 'reactor', SUBSYSTEM: 'subsystem' };

/**
 * Evasion granted by engines at each level (index = level). Piloting adds its
 * own bonus on top, and both need a manned station to apply fully.
 */
export const ENGINE_EVASION = [0, 5, 10, 15, 20, 25, 28, 31, 35];
export const PILOT_EVASION = [0, 0, 5, 10, 15];

export const SYSTEMS = {
  shields: {
    id: 'shields', name: 'Shields', kind: SYSTEM_KIND.REACTOR, maxLevel: 8,
    icon: 'icon_sys_shields', roomSize: 4, order: 1,
    upgradeCost: [30, 50, 70, 90, 110, 130, 150],
    desc: 'Each two levels of power raises one shield layer. Layers absorb one damage each and recharge over time.',
    // Two power bars per layer, the FTL cadence players already know.
    layersAt: lvl => Math.floor(lvl / 2),
    mannedBonus: 'Recharges shield layers 15% faster.',
  },
  engines: {
    id: 'engines', name: 'Engines', kind: SYSTEM_KIND.REACTOR, maxLevel: 8,
    icon: 'icon_sys_engines', roomSize: 4, order: 2,
    upgradeCost: [30, 40, 60, 80, 100, 120, 140],
    desc: 'Raises evasion and shortens FTL charge time.',
    mannedBonus: 'Adds up to +10% evasion as the pilot gains skill.',
  },
  oxygen: {
    id: 'oxygen', name: 'Oxygen', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_oxygen', roomSize: 2, order: 3,
    upgradeCost: [30, 50],
    desc: 'Replenishes breathable air. Without it, crew suffocate.',
  },
  weapons: {
    id: 'weapons', name: 'Weapons', kind: SYSTEM_KIND.REACTOR, maxLevel: 8,
    icon: 'icon_sys_weapons', roomSize: 4, order: 4,
    upgradeCost: [30, 45, 60, 80, 100, 125, 150],
    desc: 'Powers your weapon hardpoints. Each weapon needs its own power.',
    mannedBonus: 'Charges weapons up to 15% faster.',
  },
  medbay: {
    id: 'medbay', name: 'Medbay', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_medbay', roomSize: 2, order: 5,
    upgradeCost: [40, 60],
    desc: 'Heals crew standing inside and blocks enemy mind control.',
    healRate: lvl => [0, 5.5, 8, 12][lvl] || 0,
  },
  clonebay: {
    id: 'clonebay', name: 'Clone Bay', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_clonebay', roomSize: 2, order: 5, replaces: 'medbay',
    upgradeCost: [40, 60],
    desc: 'Revives dead crew after a delay, at the cost of some of their skill. Does not heal.',
    cloneTime: lvl => [0, 13, 10, 7][lvl] || 13,
  },
  piloting: {
    id: 'piloting', name: 'Piloting', kind: SYSTEM_KIND.SUBSYSTEM, maxLevel: 3,
    icon: 'icon_sys_piloting', roomSize: 2, order: 6,
    upgradeCost: [30, 60],
    desc: 'An unmanned helm means zero evasion. Higher levels add evasion.',
  },
  doors: {
    id: 'doors', name: 'Door Control', kind: SYSTEM_KIND.SUBSYSTEM, maxLevel: 4,
    icon: 'icon_sys_doors', roomSize: 2, order: 7,
    upgradeCost: [20, 40, 60],
    desc: 'Stronger blast doors slow boarders and hold back fires.',
    doorHp: lvl => [4, 8, 14, 22, 40][lvl] || 4,
  },
  sensors: {
    id: 'sensors', name: 'Sensors', kind: SYSTEM_KIND.SUBSYSTEM, maxLevel: 4,
    icon: 'icon_sys_sensors', roomSize: 2, order: 8,
    upgradeCost: [25, 45, 70],
    desc: 'L1 shows your own ship, L2 the enemy interior, L3 enemy power levels, L4 sees through cloaks.',
  },
  drones: {
    id: 'drones', name: 'Drone Control', kind: SYSTEM_KIND.REACTOR, maxLevel: 8,
    icon: 'icon_sys_drones', roomSize: 4, order: 9,
    upgradeCost: [30, 45, 60, 80, 100, 125, 150],
    desc: 'Powers deployed drones. Each drone needs its own power and a drone part.',
  },
  teleporter: {
    id: 'teleporter', name: 'Teleporter', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_teleporter', roomSize: 4, order: 10,
    upgradeCost: [50, 70],
    desc: 'Sends boarding parties to the enemy ship and pulls them back.',
    cooldown: lvl => [0, 16, 12, 8][lvl] || 16,
  },
  cloaking: {
    id: 'cloaking', name: 'Cloaking', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_cloaking', roomSize: 4, order: 11,
    upgradeCost: [60, 80],
    desc: 'Total evasion while cloaked, and enemy weapons stop charging.',
    duration: lvl => [0, 5, 10, 15][lvl] || 5,
  },
  battery: {
    id: 'battery', name: 'Backup Battery', kind: SYSTEM_KIND.SUBSYSTEM, maxLevel: 2,
    icon: 'icon_sys_battery', roomSize: 2, order: 12,
    upgradeCost: [50],
    desc: 'Adds temporary reactor bars for a short burst, then recharges.',
    bars: lvl => lvl * 2,
    duration: 30, rechargeTime: 40,
  },
  mindcontrol: {
    id: 'mindcontrol', name: 'Mind Control', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_mindcontrol', roomSize: 2, order: 13,
    upgradeCost: [60, 80],
    desc: 'Turns one enemy crew member against their own ship for a while.',
    duration: lvl => [0, 10, 14, 18][lvl] || 10,
  },
  hacking: {
    id: 'hacking', name: 'Hacking', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_hacking', roomSize: 4, order: 14,
    upgradeCost: [60, 80],
    desc: 'Fires a hacking drone at one enemy system, then disrupts it on demand.',
    duration: lvl => [0, 4, 7, 10][lvl] || 4,
  },

  // --- Deep Space originals ------------------------------------------------
  nanoforge: {
    id: 'nanoforge', name: 'Nanoforge', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_nanoforge', roomSize: 2, order: 15, original: true,
    upgradeCost: [55, 75],
    desc: 'Swarms of repair nanites slowly knit the hull back together during combat.',
    hullPerSecond: lvl => [0, 0.035, 0.07, 0.12][lvl] || 0,
  },
  overdrive: {
    id: 'overdrive', name: 'Overdrive Core', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_overdrive', roomSize: 2, order: 16, original: true,
    upgradeCost: [65, 85],
    desc: 'Overcharges one system past its rated level for a burst — but the strain can damage it.',
    boost: lvl => lvl, duration: 12, cooldown: 28,
    burnoutChance: lvl => [0, 0.35, 0.22, 0.1][lvl] ?? 0.35,
  },
  siphon: {
    id: 'siphon', name: 'Shield Siphon', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_siphon', roomSize: 2, order: 17, original: true,
    upgradeCost: [70, 90],
    desc: 'Strips a shield layer off the enemy and grafts it onto your own.',
    cooldown: lvl => [0, 26, 20, 15][lvl] || 26,
  },
  temporal: {
    id: 'temporal', name: 'Temporal Field', kind: SYSTEM_KIND.REACTOR, maxLevel: 3,
    icon: 'icon_sys_temporal', roomSize: 2, order: 18, original: true,
    upgradeCost: [70, 90],
    desc: 'Warps time in one room: slow it to stall an enemy system, or speed it to rush repairs.',
    factor: lvl => [1, 0.6, 0.45, 0.3][lvl] || 1,
    duration: lvl => [0, 12, 16, 20][lvl] || 12, cooldown: 30,
  },
  salvage: {
    id: 'salvage', name: 'Salvage Arm', kind: SYSTEM_KIND.SUBSYSTEM, maxLevel: 3,
    icon: 'icon_sys_salvage', roomSize: 2, order: 19, original: true,
    upgradeCost: [50, 70],
    desc: 'Tears usable material out of every wreck you leave behind.',
    bonus: lvl => [0, 0.15, 0.3, 0.5][lvl] || 0,
  },
};

/** Systems that draw from the reactor, in display order. */
export const REACTOR_SYSTEMS = Object.values(SYSTEMS)
  .filter(s => s.kind === SYSTEM_KIND.REACTOR)
  .sort((a, b) => a.order - b.order)
  .map(s => s.id);

export const SUBSYSTEMS = Object.values(SYSTEMS)
  .filter(s => s.kind === SYSTEM_KIND.SUBSYSTEM)
  .sort((a, b) => a.order - b.order)
  .map(s => s.id);

export const ALL_SYSTEM_IDS = Object.keys(SYSTEMS);

export function getSystem(id) {
  const s = SYSTEMS[id];
  if (!s) throw new Error(`unknown system "${id}"`);
  return s;
}

/** Scrap cost to take a system from `level` to `level + 1`, or null at max. */
export function upgradeCost(id, level) {
  const s = getSystem(id);
  if (level >= s.maxLevel) return null;
  return s.upgradeCost[level - 1] ?? s.upgradeCost[s.upgradeCost.length - 1];
}

/** Scrap cost to install a system that isn't on the ship yet. */
export function installCost(id) {
  const s = getSystem(id);
  const base = { 2: 40, 4: 60 }[s.roomSize] ?? 50;
  return s.original ? base + 30 : base;
}

/** Total scrap sunk into a system at a given level — used for score and resale. */
export function investedScrap(id, level) {
  const s = getSystem(id);
  let total = installCost(id);
  for (let l = 1; l < level; l++) total += s.upgradeCost[l - 1] ?? 0;
  return total;
}

/**
 * Damage accumulates fractionally (fires burn a system down gradually, crew
 * repair it gradually), but capability is always whole bars: a half-damaged
 * bar is a dead bar until it is fully repaired.
 */
export function damagedBars(sys) {
  return sys ? Math.ceil(sys.damage - 1e-9) : 0;
}

/**
 * Effective level after damage, ion charges and hacking. Damage removes
 * capability from the top down; ion locks bars entirely.
 */
export function effectiveLevel(sys) {
  if (!sys) return 0;
  if (sys.hacked && sys.hackActive) return 0;
  const usable = Math.max(0, sys.level - damagedBars(sys));
  return Math.max(0, Math.min(usable, Math.floor(sys.power)));
}
