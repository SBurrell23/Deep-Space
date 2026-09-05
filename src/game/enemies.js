/**
 * Enemy archetypes.
 *
 * An archetype is pure data pointing at a movement behaviour and a fire pattern
 * from patterns.js. `cost` is the wave budget an encounter spends to field one,
 * and is the main balancing lever: encounters are written in budget terms, so
 * changing an enemy's cost reweights it everywhere at once.
 *
 * Stats here are the values at threat 1. `scaleEnemy` applies the node's threat.
 */

import { ENEMY_TUNING, DUEL_TUNING } from './balance.js';
import { DUELISTS } from './duelists/index.js';

export const ENEMY_CLASSES = ['swarm', 'mid', 'heavy', 'elite', 'duelist'];

export const ENEMIES = {
  // -------------------------------------------------------------------------
  // SWARM — small ships, drawn at 2x so they are actually visible, and armed.
  //
  // These used to be 16x16 specks at up to 205px/sec against a player who moves
  // at 239-325, and four of the ten could not shoot at all: seeker, zealot,
  // drifting_mine and aegis_pod interacted with you only by flying into you.
  // What hit you was therefore never the guns you could read and dodge, it was
  // a small fast object touching you. Bigger, slower, fewer, and armed.
  // -------------------------------------------------------------------------
  picket: {
    id: 'picket', name: 'Picket Drone', cls: 'swarm', sprite: 'sw_drone', w: 30, h: 30, scale: 2,
    hull: 11, shield: 0, speed: 96, move: 'sine', fire: 'forward', fireRate: 1.1,
    bulletDamage: 7, bulletSpeed: 260, contact: 6, xp: 5, credits: 3, cost: 1.7,
  },
  wasp: {
    id: 'wasp', name: 'Wasp', cls: 'swarm', sprite: 'sw_wasp', w: 28, h: 28, scale: 2,
    hull: 9, shield: 0, speed: 140, move: 'zigzag', fire: 'single', fireRate: 0.9,
    bulletDamage: 7, bulletSpeed: 330, contact: 6, xp: 5, credits: 3, cost: 1.7,
  },
  seeker: {
    id: 'seeker', name: 'Seeker Pod', cls: 'swarm', sprite: 'sw_seeker', w: 30, h: 30, scale: 2,
    hull: 14, shield: 0, speed: 104, move: 'hover', fire: 'single', fireRate: 0.75,
    bulletDamage: 10, bulletSpeed: 300, contact: 8, xp: 6, credits: 3, cost: 1.9,
  },
  zealot: {
    id: 'zealot', name: 'Zealot', cls: 'swarm', sprite: 'sw_kamikaze', w: 34, h: 34, scale: 2,
    hull: 22, shield: 0, speed: 128, move: 'kamikaze', fire: 'none', fireRate: 0,
    contact: 26, xp: 9, credits: 5, cost: 3.4, explodes: { radius: 74, damage: 18 },
  },
  drifting_mine: {
    id: 'drifting_mine', name: 'Drifting Mine', cls: 'swarm', sprite: 'sw_mine', w: 34, h: 34, scale: 2,
    hull: 10, shield: 0, speed: 34, move: 'drift', fire: 'none', fireRate: 0,
    contact: 30, xp: 4, credits: 3, cost: 1.6, explodes: { radius: 90, damage: 22 },
  },
  interceptor: {
    id: 'interceptor', name: 'Interceptor', cls: 'swarm', sprite: 'sw_interceptor', w: 28, h: 28, scale: 2,
    hull: 13, shield: 0, speed: 158, move: 'swoop', fire: 'single', fireRate: 1.4,
    bulletDamage: 9, bulletSpeed: 350, contact: 7, xp: 7, credits: 4, cost: 2.1,
  },
  aegis_pod: {
    id: 'aegis_pod', name: 'Aegis Pod', cls: 'swarm', sprite: 'sw_shielder', w: 30, h: 30, scale: 2,
    hull: 20, shield: 12, speed: 78, move: 'skittish', fire: 'none', fireRate: 0,
    contact: 4, xp: 9, credits: 6, cost: 2.6,
    // Shelters everything nearby — kill it first or the fight drags.
    aura: { kind: 'shield', radius: 190, amount: 0.55 },
  },
  bomblet: {
    id: 'bomblet', name: 'Bomblet Carrier', cls: 'swarm', sprite: 'sw_bomber', w: 30, h: 30, scale: 2,
    hull: 17, shield: 0, speed: 74, move: 'hover', fire: 'mine_drop', fireRate: 0.5,
    bulletDamage: 12, contact: 6, xp: 7, credits: 4, cost: 2.1,
  },
  splitter: {
    id: 'splitter', name: 'Splitter', cls: 'swarm', sprite: 'sw_splitter', w: 32, h: 32, scale: 2,
    hull: 19, shield: 0, speed: 86, move: 'sine', fire: 'forward', fireRate: 0.8,
    bulletDamage: 9, bulletSpeed: 250, contact: 6, xp: 6, credits: 4, cost: 2.1,
    splits: { into: 'picket', count: 2 },
  },
  turret_pod: {
    id: 'turret_pod', name: 'Turret Pod', cls: 'swarm', sprite: 'sw_turretpod', w: 30, h: 30, scale: 2,
    hull: 24, shield: 0, speed: 34, move: 'guard', fire: 'sweep', fireRate: 3.2,
    bulletDamage: 8, bulletSpeed: 300, contact: 5, xp: 7, credits: 5, cost: 2.0,
  },

  // -------------------------------------------------------------------------
  // MID — 32x24, the workhorses. Individually worth aiming at.
  // -------------------------------------------------------------------------
  gunship: {
    id: 'gunship', name: 'Gunship', cls: 'mid', sprite: 'mid_gunship', w: 32, h: 24,
    hull: 46, shield: 0, speed: 105, move: 'hover', fire: 'spread3', fireRate: 1.0,
    bulletDamage: 8, bulletSpeed: 300, contact: 12, xp: 15, credits: 9, cost: 4,
  },
  lancer: {
    id: 'lancer', name: 'Lancer', cls: 'mid', sprite: 'mid_lancer', w: 32, h: 24,
    hull: 38, shield: 8, speed: 120, move: 'mirror', fire: 'needle_burst', fireRate: 0.75,
    bulletDamage: 9, bulletSpeed: 320, contact: 11, xp: 17, credits: 10, cost: 4.5,
  },
  artillery: {
    id: 'artillery', name: 'Artillery Platform', cls: 'mid', sprite: 'mid_artillery', w: 32, h: 24,
    hull: 58, shield: 0, speed: 50, move: 'guard', fire: 'heavy', fireRate: 0.45,
    bulletDamage: 11, bulletSpeed: 260, contact: 12, xp: 18, credits: 12, cost: 4.5,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', cls: 'mid', sprite: 'mid_bulwark', w: 32, h: 24,
    hull: 95, shield: 22, speed: 62, move: 'straight', fire: 'forward', fireRate: 1.4,
    bulletDamage: 9, bulletSpeed: 280, contact: 18, xp: 24, credits: 15, cost: 6,
    armour: 0.22,
  },
  phantom: {
    id: 'phantom', name: 'Phantom', cls: 'mid', sprite: 'mid_phantom', w: 32, h: 24,
    hull: 40, shield: 12, speed: 155, move: 'strafe_run', fire: 'shotgun', fireRate: 0.5,
    bulletDamage: 6, bulletSpeed: 340, contact: 13, xp: 22, credits: 14, cost: 5.5,
    cloak: { period: 4.2, duration: 1.5 },
  },
  drone_carrier: {
    id: 'drone_carrier', name: 'Drone Tender', cls: 'mid', sprite: 'mid_carrier', w: 32, h: 24,
    hull: 62, shield: 10, speed: 78, move: 'skittish', fire: 'none', fireRate: 0,
    contact: 11, xp: 25, credits: 18, cost: 6,
    spawns: { id: 'picket', count: 2, interval: 5.5, max: 6 },
  },

  // -------------------------------------------------------------------------
  // HEAVY — 64x40, reusing the original ship art. Real threats.
  // -------------------------------------------------------------------------
  scout: {
    id: 'scout', name: 'Scout', cls: 'heavy', sprite: 'enemy_scout', w: 64, h: 40,
    hull: 70, shield: 12, speed: 150, move: 'hit_and_run', fire: 'burst3', fireRate: 0.8,
    bulletDamage: 8, bulletSpeed: 340, contact: 15, xp: 30, credits: 20, cost: 7,
  },
  fighter: {
    id: 'fighter', name: 'Fighter', cls: 'heavy', sprite: 'enemy_fighter', w: 64, h: 40,
    hull: 105, shield: 20, speed: 108, move: 'hover', fire: 'spread5', fireRate: 0.85,
    bulletDamage: 9, bulletSpeed: 310, contact: 17, xp: 38, credits: 25, cost: 8.5,
  },
  raider: {
    id: 'raider', name: 'Raider', cls: 'heavy', sprite: 'enemy_pirate', w: 64, h: 40,
    hull: 92, shield: 10, speed: 138, move: 'charge', fire: 'shotgun', fireRate: 0.6,
    bulletDamage: 7, bulletSpeed: 330, contact: 24, xp: 36, credits: 28, cost: 8,
  },
  missile_boat: {
    id: 'missile_boat', name: 'Missile Boat', cls: 'heavy', sprite: 'enemy_bomber', w: 64, h: 40,
    hull: 110, shield: 16, speed: 82, move: 'hover', fire: 'homing4', fireRate: 0.42,
    bulletDamage: 13, bulletSpeed: 250, contact: 16, xp: 42, credits: 30, cost: 9,
  },
  cruiser: {
    id: 'cruiser', name: 'Cruiser', cls: 'heavy', sprite: 'enemy_cruiser', w: 64, h: 40,
    hull: 190, shield: 45, speed: 62, move: 'hover', fire: 'double_wall', fireRate: 0.26,
    bulletDamage: 10, bulletSpeed: 210, contact: 22, xp: 65, credits: 45, cost: 13,
    armour: 0.15,
  },
  battle_carrier: {
    id: 'battle_carrier', name: 'Battle Carrier', cls: 'heavy', sprite: 'enemy_carrier', w: 64, h: 40,
    hull: 165, shield: 30, speed: 58, move: 'skittish', fire: 'single', fireRate: 0.6,
    bulletDamage: 9, bulletSpeed: 260, contact: 18, xp: 70, credits: 55, cost: 13,
    spawns: { id: 'interceptor', count: 2, interval: 6, max: 8 },
  },
  sentinel: {
    id: 'sentinel', name: 'Automated Sentinel', cls: 'heavy', sprite: 'enemy_auto', w: 64, h: 40,
    hull: 140, shield: 25, speed: 55, move: 'guard', fire: 'radial8', fireRate: 0.42,
    bulletDamage: 8, bulletSpeed: 220, contact: 18, xp: 52, credits: 35, cost: 10,
  },
  hunter: {
    id: 'hunter', name: 'Hunter-Killer', cls: 'heavy', sprite: 'enemy_drone', w: 64, h: 40,
    hull: 96, shield: 18, speed: 168, move: 'orbit', fire: 'needle', fireRate: 1.6,
    bulletDamage: 10, bulletSpeed: 430, contact: 16, xp: 45, credits: 30, cost: 9.5,
  },

  censer: {
    id: 'censer', name: 'Censer', cls: 'mid', sprite: 'mid_phantom', w: 32, h: 24,
    hull: 54, shield: 14, speed: 72, move: 'hover', fire: 'repulsor_field', fireRate: 0.22,
    bulletDamage: 9, bulletSpeed: 240, contact: 12, xp: 26, credits: 17, cost: 6,
  },
  pyre: {
    id: 'pyre', name: 'Pyre', cls: 'mid', sprite: 'mid_artillery', w: 32, h: 24,
    hull: 50, shield: 0, speed: 88, move: 'mirror', fire: 'spreading_pool', fireRate: 0.3,
    bulletDamage: 10, bulletSpeed: 250, contact: 12, xp: 24, credits: 16, cost: 5.5,
  },
  basilisk: {
    id: 'basilisk', name: 'Basilisk', cls: 'heavy', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 128, shield: 26, speed: 78, move: 'mirror', fire: 'lance_beam', fireRate: 0.36,
    bulletDamage: 11, bulletSpeed: 260, contact: 17, xp: 50, credits: 34, cost: 10,
  },
  siege_engine: {
    id: 'siege_engine', name: 'Siege Engine', cls: 'heavy', sprite: 'enemy_auto', w: 64, h: 40,
    hull: 205, shield: 40, speed: 42, move: 'guard', fire: 'siege_beam', fireRate: 0.2,
    bulletDamage: 12, bulletSpeed: 220, contact: 20, xp: 68, credits: 46, cost: 13,
    armour: 0.2,
  },
  bulwark_prime: {
    id: 'bulwark_prime', name: 'Bulwark Prime', cls: 'heavy', sprite: 'enemy_cruiser', w: 64, h: 40,
    hull: 230, shield: 55, speed: 52, move: 'hover', fire: 'closing_wall', fireRate: 0.3,
    bulletDamage: 10, bulletSpeed: 205, contact: 22, xp: 72, credits: 50, cost: 14,
    armour: 0.18,
  },

  // -------------------------------------------------------------------------
  // ELITE — named threats. Rare, and they change how a fight is fought.
  // -------------------------------------------------------------------------
  vanguard: {
    id: 'vanguard', name: 'Vanguard', cls: 'elite', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 260, shield: 70, speed: 120, move: 'strafe_run', fire: 'lance_beam', fireRate: 0.42,
    bulletDamage: 10, bulletSpeed: 250, contact: 26, xp: 120, credits: 90, cost: 20,
    armour: 0.2,
  },
  warden: {
    id: 'warden', name: 'Warden', cls: 'elite', sprite: 'enemy_cruiser', w: 64, h: 40,
    hull: 340, shield: 110, speed: 52, move: 'hover', fire: 'cross_beams', fireRate: 0.28,
    bulletDamage: 11, bulletSpeed: 210, contact: 26, xp: 140, credits: 105, cost: 24,
    armour: 0.3, aura: { kind: 'shield', radius: 260, amount: 0.4 },
  },
  harbinger: {
    id: 'harbinger', name: 'Harbinger', cls: 'elite', sprite: 'enemy_boss', w: 96, h: 64,
    hull: 300, shield: 85, speed: 60, move: 'hover', fire: 'missile_barrage', fireRate: 0.28,
    bulletDamage: 11, bulletSpeed: 240, contact: 30, xp: 135, credits: 100, cost: 22,
    armour: 0.22,
  },
  hierophant: {
    id: 'hierophant', name: 'Hierophant', cls: 'elite', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 280, shield: 90, speed: 74, move: 'mirror', fire: 'minefield_zones', fireRate: 0.24,
    bulletDamage: 12, bulletSpeed: 230, contact: 28, xp: 130, credits: 96, cost: 21,
    aura: { kind: 'shield', radius: 200, amount: 0.35 },
  },
  reaper: {
    id: 'reaper', name: 'Reaper', cls: 'elite', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 210, shield: 50, speed: 190, move: 'kamikaze', fire: 'burn_zone', fireRate: 0.5,
    bulletDamage: 14, bulletSpeed: 200, contact: 40, xp: 130, credits: 95, cost: 22,
  },
};

/**
 * The hundred named opponents are ordinary archetypes as far as everything
 * downstream is concerned.
 *
 * Merging them in here rather than teaching the spawner, the scaler and the
 * renderer about a second kind of enemy is the whole reason this change was
 * small: a duel encounter names an enemy id and the existing machinery does
 * the rest. What makes them different is `cls: 'duelist'` — which routes them
 * through their own growth curve below — and the `duel` block they carry.
 */
for (const d of DUELISTS) {
  if (ENEMIES[d.id]) throw new Error(`duelist id "${d.id}" collides with an existing enemy`);
  ENEMIES[d.id] = d;
}

export const ENEMY_IDS = Object.keys(ENEMIES);
export function getEnemy(id) { return ENEMIES[id] || null; }
export function enemiesOfClass(cls) { return ENEMY_IDS.filter(id => ENEMIES[id].cls === cls); }

/**
 * Scale an archetype to a node's threat level.
 *
 * GEOMETRIC, not linear. The player's own power compounds — the Weapons
 * attribute multiplies an item power roll that itself scales with depth — so
 * linear enemy growth meant the gap between a player and a node above their
 * level kept *narrowing*. A level-9 ship could walk into a threat-18 node and
 * win. Compounding both sides keeps a level-appropriate fight feeling the same
 * at every depth while making over-reach genuinely punishing: four threat
 * levels above you is now roughly double the enemy hull, not a third more.
 */
/**
 * The difficulty knobs live in balance.js, next to the defensive and economic
 * numbers they trade against. These re-exports keep the old names working for
 * the call sites and tests that read them directly.
 */
export const TUNING = ENEMY_TUNING;
export const DAMAGE_SCALE = ENEMY_TUNING.damageScale;
export const CLASS_TOUGHNESS = ENEMY_TUNING.toughness;

export function scaleEnemy(def, threat) {
  const t = Math.max(1, threat);
  const duel = def.cls === 'duelist';
  // A lone opponent is on its own curve.
  //
  // The swarm curves are gentle because the encounter's ship COUNT carries
  // most of the growth: at depth you meet more of them, not much tougher
  // ones. A duelist has no count to grow, so if it followed the same curve
  // the deep map would be target practice — its hull has to track the
  // player's measured damage output (1.098/level) and its guns the player's
  // measured effective hull (1.050/level), or the fight stops being one.
  const tough = ENEMY_TUNING.toughness[def.cls] ?? 2.5;
  const hullMul = Math.pow(duel ? DUEL_TUNING.hullGrowth : ENEMY_TUNING.hullGrowth, t - 1);
  // A first-ring duel is where the player learns what a duelist is. That wants
  // a short fight, and a full-sized pool against a starting loadout is not one.
  const duelGrace = duel && t < DUEL_TUNING.earlyHullUntil
    ? DUEL_TUNING.earlyHull
      + (1 - DUEL_TUNING.earlyHull) * ((t - 1) / (DUEL_TUNING.earlyHullUntil - 1))
    : 1;
  const dmgMul = Math.pow(duel ? DUEL_TUNING.damageGrowth : ENEMY_TUNING.damageGrowth, t - 1);
  const rewardMul = 1 + ENEMY_TUNING.rewardGrowth * (t - 1);
  // A bare starting hull meets threat 1-3 with no gear and no levels spent.
  const grace = t >= ENEMY_TUNING.earlyGraceUntil ? 1
    : ENEMY_TUNING.earlyGrace
      + (1 - ENEMY_TUNING.earlyGrace) * ((t - 1) / (ENEMY_TUNING.earlyGraceUntil - 1));
  const DAMAGE_SCALE = ENEMY_TUNING.damageScale * grace;
  return {
    ...def,
    hull: Math.round(def.hull * tough * hullMul * duelGrace),
    shield: Math.round((def.shield || 0) * tough * hullMul * duelGrace),
    bulletDamage: (def.bulletDamage || 0) * dmgMul * DAMAGE_SCALE,
    // Ramming is a scrape, not the fight. See balance.js.
    contact: (def.contact || 0) * dmgMul * DAMAGE_SCALE * ENEMY_TUNING.contactScale,
    explodes: def.explodes
      ? { ...def.explodes, damage: def.explodes.damage * dmgMul * DAMAGE_SCALE }
      : null,
    // Fewer, heavier shots rather than a continuous drizzle. A duelist is
    // exempt: that scale exists to thin out twelve guns firing at once, and
    // applied to the only gun on the field it produces a ship that shoots
    // once every six seconds and a fight made of waiting.
    fireRate: (def.fireRate || 0) * (duel ? 1 : ENEMY_TUNING.fireRateScale),
    xp: Math.round(def.xp * rewardMul),
    credits: Math.round(def.credits * rewardMul),
    threat: t,
  };
}

/** Total budget cost of a list of enemy ids — used to validate encounters. */
export function waveCost(ids) {
  return ids.reduce((sum, id) => sum + (ENEMIES[id]?.cost || 0), 0);
}

/**
 * Choose enemies to fill a budget from an allowed pool. Encounters use this to
 * stay balanced while still varying their exact composition run to run.
 */
export function fillBudget(rng, pool, budget, { maxCount = 90 } = {}) {
  const picks = [];
  let left = budget;
  const affordable = () => pool.filter(id => (ENEMIES[id]?.cost || Infinity) <= left);
  while (picks.length < maxCount) {
    const options = affordable();
    if (options.length === 0) break;
    const id = rng.pick(options);
    picks.push(id);
    left -= ENEMIES[id].cost;
  }
  return picks;
}
