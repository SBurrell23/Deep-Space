/**
 * Ship attributes, levelling, and the derived-stat pipeline.
 *
 * The player's ship is described by six attributes. Everything the action game
 * reads — hull, shield pool, damage, energy, speed, cooldowns — is DERIVED from
 * those attributes plus equipped gear, never stored directly. That keeps a
 * single source of truth: swap a part or spend a point and every dependent
 * number updates for free, and the tests can assert the whole pipeline.
 */

import { DEFENCE_TUNING as D } from './balance.js';

export const ATTRIBUTES = [
  {
    id: 'hull', name: 'Hull', icon: 'icon_hull', accent: '#5cf59b',
    blurb: 'Structural integrity. Damage to your hull persists between jumps.',
    perPoint: '+32 max hull, +4% repair received',
  },
  {
    id: 'shields', name: 'Shields', icon: 'icon_sys_shields', accent: '#4fe3f5',
    blurb: 'A regenerating buffer that absorbs damage before your hull does.',
    perPoint: '+16 max shield, faster recharge, shorter break delay',
  },
  {
    id: 'weapons', name: 'Weapons', icon: 'icon_sys_weapons', accent: '#ff5c72',
    blurb: 'Raw firepower. Scales every weapon you equip.',
    perPoint: '+11% weapon damage',
  },
  {
    id: 'reactor', name: 'Reactor', icon: 'icon_power', accent: '#ffcc5c',
    blurb: 'Energy capacity and regeneration. Firing and dashing both draw on it.',
    perPoint: '+16 max energy, +1.9 energy/sec',
  },
  {
    id: 'thrusters', name: 'Thrusters', icon: 'icon_sys_engines', accent: '#c07ef5',
    blurb: 'Top speed, acceleration and dash recovery.',
    perPoint: '+13 speed, +7% acceleration, faster dash recharge',
  },
  {
    id: 'systems', name: 'Systems', icon: 'icon_sys_sensors', accent: '#8494b8',
    blurb: 'Ability cooldowns, pickup range, and how much your gear gives you.',
    perPoint: '-5% cooldowns, +6% equipment effect, +8 pickup range',
  },
];

export const ATTRIBUTE_IDS = ATTRIBUTES.map(a => a.id);
export const ATTRIBUTES_BY_ID = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));

/** Attributes are capped so no single stat can trivialise the whole run. */
export const ATTR_CAP = 20;
export const MAX_LEVEL = 20;
export const POINTS_PER_LEVEL = 2;

// ---------------------------------------------------------------------------
// Experience curve
// ---------------------------------------------------------------------------

/**
 * XP required to advance FROM `level` to `level + 1`.
 *
 * Tuned against the autoplay harness so a full run to level 20 lands near the
 * two-hour mark: roughly 2-3 cleared nodes per level throughout, rather than
 * fast early levels and a long grind at the end.
 */
export function xpToNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(80 * Math.pow(level, 1.42));
}

/** Total XP from level 1 to reach `level`. */
export function xpTotalFor(level) {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** XP a cleared node of the given threat is worth, before encounter modifiers. */
export function nodeXpValue(threat) {
  return Math.round(45 * Math.pow(Math.max(1, threat), 1.3));
}

/**
 * Apply XP, returning how many levels were gained. Levels can stack from a
 * single big payout, so this loops rather than levelling once.
 */
export function grantXp(progress, amount) {
  if (!(amount > 0) || progress.level >= MAX_LEVEL) return 0;
  progress.xp += Math.round(amount);
  progress.xpEarned = (progress.xpEarned || 0) + Math.round(amount);
  let gained = 0;
  while (progress.level < MAX_LEVEL && progress.xp >= xpToNext(progress.level)) {
    progress.xp -= xpToNext(progress.level);
    progress.level++;
    progress.unspentPoints += POINTS_PER_LEVEL;
    gained++;
  }
  if (progress.level >= MAX_LEVEL) progress.xp = 0;
  return gained;
}

/** Spend one point. Returns false when capped or out of points. */
export function spendPoint(progress, attrId) {
  if (!ATTRIBUTES_BY_ID[attrId]) return false;
  if (progress.unspentPoints <= 0) return false;
  if (progress.attributes[attrId] >= ATTR_CAP) return false;
  progress.attributes[attrId]++;
  progress.unspentPoints--;
  return true;
}

export function newProgress(startingAttributes) {
  const attributes = {};
  for (const id of ATTRIBUTE_IDS) attributes[id] = startingAttributes?.[id] ?? 1;
  return { level: 1, xp: 0, xpEarned: 0, unspentPoints: 0, attributes };
}

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------

/**
 * Fold attributes + equipment into the flat stat block the action game reads.
 *
 * `gearMods` is the summed modifier bag from equipped items (see items.js).
 * Flat bonuses land before percentages so a +10 hull plate is worth the same
 * whether you find it early or late.
 */
function clampv(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function deriveStats(attributes, gearMods = {}) {
  const a = attributes;
  const m = gearMods;
  const add = (k) => m[k] || 0;
  const mul = (k) => 1 + (m[k] || 0);

  // Systems boosts the *effect* of gear, so it multiplies gear-sourced bonuses.
  const sysScale = 1 + 0.06 * (a.systems - 1);

  const maxHull = Math.round((150 + 32 * a.hull + add('hull') * sysScale) * mul('hullPct'));
  const maxShield = Math.round((25 + 16 * a.shields + add('shield') * sysScale) * mul('shieldPct'));

  return {
    maxHull: Math.max(1, maxHull),
    repairPct: 1 + 0.04 * (a.hull - 1) + add('repairPct'),

    maxShield: Math.max(0, maxShield),
    // Recharge accelerates with the attribute but the delay floor keeps a hit
    // meaningful — otherwise high shields removes damage from the game.
    shieldRegen: (2.5 + 0.55 * a.shields + add('shieldRegen') * sysScale) * mul('shieldRegenPct'),
    // The fraction of every hit that reaches the hull even at full shield.
    // Without it a shield large enough to eat a whole fight makes that fight
    // free, and a run of free fights has no stakes and nothing to spend gold
    // on. Investing in Shields buys a tighter seal, never a perfect one.
    shieldLeak: clampv(
      D.shieldLeakBase - D.shieldLeakPerShields * a.shields - add('shieldSeal') * sysScale * 0.012,
      D.shieldLeakFloor, D.shieldLeakBase),
    shieldDelay: Math.max(1.4, 3.6 - 0.07 * a.shields - add('shieldDelay') * sysScale),

    damageMult: (1 + 0.11 * (a.weapons - 1)) * mul('damagePct'),
    critChance: Math.min(0.6, 0.02 + add('crit')),
    critMult: 1.75 + add('critMult'),
    fireRateMult: mul('fireRatePct'),

    maxEnergy: Math.max(10, Math.round((50 + 16 * a.reactor + add('energy') * sysScale) * mul('energyPct'))),
    energyRegen: (7 + 1.9 * a.reactor + add('energyRegen') * sysScale) * mul('energyRegenPct'),
    energyCostMult: Math.max(0.35, 1 - add('energyCost')),

    speed: (200 + 13 * a.thrusters + add('speed') * sysScale) * mul('speedPct'),
    accel: (1500 + 105 * a.thrusters) * mul('accelPct'),
    // Drag is what makes a ship feel heavy or twitchy; gear can trade one for
    // the other without touching top speed.
    drag: Math.max(2.5, 7.5 - 0.1 * a.thrusters + add('drag')),
    dashCooldown: Math.max(0.5, (2.6 - 0.06 * a.thrusters - add('dashCooldown')) * cooldownMult(a, m)),
    dashCharges: 1 + Math.floor(add('dashCharges')),

    cooldownMult: cooldownMult(a, m),
    pickupRange: 46 + 8 * (a.systems - 1) + add('pickupRange') * sysScale,
    magnetSpeed: 260 + add('magnetSpeed'),

    // Utility effects contributed by gear abilities.
    contactArmour: add('contactArmour'),
    thorns: add('thorns'),
    lifesteal: add('lifesteal'),
    xpPct: add('xpPct'),
    creditsPct: add('creditsPct'),
    luck: add('luck'),
  };
}

function cooldownMult(a, m) {
  return Math.max(0.35, (1 - 0.05 * (a.systems - 1)) * (1 - (m.cooldownPct || 0)));
}

/**
 * A preview of what one more point would do, for the level-up screen. Returns
 * the changed derived stats as { label, from, to } rows.
 */
export function previewPoint(attributes, gearMods, attrId) {
  const before = deriveStats(attributes, gearMods);
  const after = deriveStats({ ...attributes, [attrId]: attributes[attrId] + 1 }, gearMods);
  const rows = [];
  const track = [
    ['maxHull', 'Max hull', 0], ['maxShield', 'Max shield', 0],
    ['shieldRegen', 'Shield regen', 1], ['shieldDelay', 'Shield delay', 2],
    ['damageMult', 'Damage', 2], ['maxEnergy', 'Max energy', 0],
    ['energyRegen', 'Energy regen', 1], ['speed', 'Speed', 0],
    ['cooldownMult', 'Cooldowns', 2], ['pickupRange', 'Pickup range', 0],
    ['dashCooldown', 'Dash cooldown', 2],
  ];
  for (const [key, label, dp] of track) {
    if (Math.abs(before[key] - after[key]) < 1e-9) continue;
    rows.push({ label, from: round(before[key], dp), to: round(after[key], dp) });
  }
  return rows;
}

const round = (v, dp) => Number(v.toFixed(dp));
