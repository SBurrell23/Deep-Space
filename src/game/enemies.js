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

export const ENEMY_CLASSES = ['swarm', 'mid', 'heavy', 'elite'];

export const ENEMIES = {
  // -------------------------------------------------------------------------
  // SWARM — 16x16, individually trivial, dangerous in numbers.
  // -------------------------------------------------------------------------
  picket: {
    id: 'picket', name: 'Picket Drone', cls: 'swarm', sprite: 'sw_drone', w: 16, h: 16,
    hull: 9, shield: 0, speed: 118, move: 'sine', fire: 'forward', fireRate: 1.1,
    bulletDamage: 5, bulletSpeed: 260, contact: 6, xp: 4, credits: 2, cost: 1,
  },
  wasp: {
    id: 'wasp', name: 'Wasp', cls: 'swarm', sprite: 'sw_wasp', w: 16, h: 16,
    hull: 7, shield: 0, speed: 175, move: 'zigzag', fire: 'single', fireRate: 0.9,
    bulletDamage: 5, bulletSpeed: 330, contact: 6, xp: 4, credits: 2, cost: 1,
  },
  seeker: {
    id: 'seeker', name: 'Seeker Pod', cls: 'swarm', sprite: 'sw_seeker', w: 16, h: 16,
    hull: 12, shield: 0, speed: 130, move: 'charge', fire: 'none', fireRate: 0,
    contact: 13, xp: 5, credits: 2, cost: 1.2,
  },
  zealot: {
    id: 'zealot', name: 'Zealot', cls: 'swarm', sprite: 'sw_kamikaze', w: 16, h: 16,
    hull: 8, shield: 0, speed: 165, move: 'kamikaze', fire: 'none', fireRate: 0,
    contact: 22, xp: 6, credits: 3, cost: 1.5, explodes: { radius: 74, damage: 16 },
  },
  drifting_mine: {
    id: 'drifting_mine', name: 'Drifting Mine', cls: 'swarm', sprite: 'sw_mine', w: 16, h: 16,
    hull: 6, shield: 0, speed: 60, move: 'drift', fire: 'none', fireRate: 0,
    contact: 26, xp: 3, credits: 2, cost: 0.9, explodes: { radius: 90, damage: 20 },
  },
  interceptor: {
    id: 'interceptor', name: 'Interceptor', cls: 'swarm', sprite: 'sw_interceptor', w: 16, h: 16,
    hull: 11, shield: 0, speed: 205, move: 'swoop', fire: 'single', fireRate: 1.4,
    bulletDamage: 6, bulletSpeed: 350, contact: 8, xp: 6, credits: 3, cost: 1.4,
  },
  aegis_pod: {
    id: 'aegis_pod', name: 'Aegis Pod', cls: 'swarm', sprite: 'sw_shielder', w: 16, h: 16,
    hull: 16, shield: 10, speed: 95, move: 'skittish', fire: 'none', fireRate: 0,
    contact: 5, xp: 8, credits: 5, cost: 2.2,
    // Shelters everything nearby — kill it first or the fight drags.
    aura: { kind: 'shield', radius: 190, amount: 0.55 },
  },
  bomblet: {
    id: 'bomblet', name: 'Bomblet Carrier', cls: 'swarm', sprite: 'sw_bomber', w: 16, h: 16,
    hull: 14, shield: 0, speed: 90, move: 'hover', fire: 'mine_drop', fireRate: 0.5,
    bulletDamage: 9, contact: 7, xp: 6, credits: 3, cost: 1.6,
  },
  splitter: {
    id: 'splitter', name: 'Splitter', cls: 'swarm', sprite: 'sw_splitter', w: 16, h: 16,
    hull: 16, shield: 0, speed: 105, move: 'sine', fire: 'forward', fireRate: 0.8,
    bulletDamage: 6, bulletSpeed: 250, contact: 7, xp: 5, credits: 3, cost: 1.6,
    splits: { into: 'picket', count: 2 },
  },
  turret_pod: {
    id: 'turret_pod', name: 'Turret Pod', cls: 'swarm', sprite: 'sw_turretpod', w: 16, h: 16,
    hull: 20, shield: 0, speed: 40, move: 'guard', fire: 'sweep', fireRate: 3.2,
    bulletDamage: 6, bulletSpeed: 300, contact: 6, xp: 6, credits: 4, cost: 1.5,
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
    hull: 110, shield: 16, speed: 82, move: 'hover', fire: 'homing2', fireRate: 0.5,
    bulletDamage: 13, bulletSpeed: 250, contact: 16, xp: 42, credits: 30, cost: 9,
  },
  cruiser: {
    id: 'cruiser', name: 'Cruiser', cls: 'heavy', sprite: 'enemy_cruiser', w: 64, h: 40,
    hull: 190, shield: 45, speed: 62, move: 'hover', fire: 'wall', fireRate: 0.34,
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

  // -------------------------------------------------------------------------
  // ELITE — named threats. Rare, and they change how a fight is fought.
  // -------------------------------------------------------------------------
  vanguard: {
    id: 'vanguard', name: 'Vanguard', cls: 'elite', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 260, shield: 70, speed: 120, move: 'strafe_run', fire: 'spiral', fireRate: 1.3,
    bulletDamage: 10, bulletSpeed: 250, contact: 26, xp: 120, credits: 90, cost: 20,
    armour: 0.2,
  },
  warden: {
    id: 'warden', name: 'Warden', cls: 'elite', sprite: 'enemy_cruiser', w: 64, h: 40,
    hull: 340, shield: 110, speed: 52, move: 'hover', fire: 'spiral_double', fireRate: 0.8,
    bulletDamage: 11, bulletSpeed: 210, contact: 26, xp: 140, credits: 105, cost: 24,
    armour: 0.3, aura: { kind: 'shield', radius: 260, amount: 0.4 },
  },
  reaper: {
    id: 'reaper', name: 'Reaper', cls: 'elite', sprite: 'enemy_elite', w: 64, h: 40,
    hull: 210, shield: 50, speed: 190, move: 'kamikaze', fire: 'orb', fireRate: 0.7,
    bulletDamage: 14, bulletSpeed: 200, contact: 40, xp: 130, credits: 95, cost: 22,
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES);
export function getEnemy(id) { return ENEMIES[id] || null; }
export function enemiesOfClass(cls) { return ENEMY_IDS.filter(id => ENEMIES[id].cls === cls); }

/**
 * Scale an archetype to a node's threat level.
 *
 * Hull grows faster than damage on purpose: fights should get longer and demand
 * more sustained accuracy as you go out, without one stray bullet at threat 18
 * deleting a fully-levelled ship.
 */
/**
 * Per-class toughness multiplier applied on top of each archetype's base hull.
 *
 * Not one global number: swarm enemies were dying to a single starting-weapon
 * shot, but the same multiplier on an elite — which already carries a 1.7x
 * elite flag and an encounter's threatBonus — produced capital ships with
 * 16,000 hull that took 80 seconds of unbroken fire to kill while shooting
 * back. Tuned per class with tests/balance.js.
 */
/**
 * Global multiplier on all enemy damage output.
 *
 * A single honest lever for overall lethality. Hull persists between nodes, so
 * per-encounter damage compounds across a run: at 1.0 even a well-played run
 * bled out around ring 5 having cleared a fifth of the nodes it should.
 */
export const DAMAGE_SCALE = 0.58;

export const CLASS_TOUGHNESS = { swarm: 8.5, mid: 5.0, heavy: 3.2, elite: 1.8 };

export function scaleEnemy(def, threat) {
  const t = Math.max(1, threat);
  const tough = CLASS_TOUGHNESS[def.cls] ?? 2.5;
  const hullMul = 1 + 0.15 * (t - 1);
  const dmgMul = 1 + 0.03 * (t - 1);
  const rewardMul = 1 + 0.30 * (t - 1);
  return {
    ...def,
    hull: Math.round(def.hull * tough * hullMul),
    shield: Math.round((def.shield || 0) * tough * hullMul),
    bulletDamage: (def.bulletDamage || 0) * dmgMul * DAMAGE_SCALE,
    contact: (def.contact || 0) * dmgMul * DAMAGE_SCALE,
    explodes: def.explodes
      ? { ...def.explodes, damage: def.explodes.damage * dmgMul * DAMAGE_SCALE }
      : null,
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
