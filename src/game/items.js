/**
 * Equipment, loot generation, and the modifier bag.
 *
 * Items are generated procedurally rather than drawn from a fixed list: a base
 * template supplies the item's identity and mod profile, the rarity tier scales
 * it, and affixes bolt on extra properties. That keeps loot varied across runs
 * without hand-authoring hundreds of entries.
 *
 * Every item ultimately reduces to a `mods` bag, which attributes.js folds into
 * derived stats. Items that do something the stat pipeline can't express carry
 * an `ability` id instead, resolved by the combat sim.
 */

import { WEAPONS, weaponIds } from './weapons.js';

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/**
 * Declaration order is the order the loadout screen reads in, and the screen
 * pairs them off two to a row: hull beside shield, engine beside reactor, and
 * so on. Reordering this list rearranges that screen.
 */
export const SLOTS = [
  { id: 'primary', name: 'Primary Weapon', icon: 'icon_sys_weapons', kind: 'weapon' },
  { id: 'secondary', name: 'Secondary Weapon', icon: 'icon_missile', kind: 'weapon' },
  // Cut into the hull at level 13; locked before that.
  { id: 'tertiary', name: 'Heavy Mount', icon: 'icon_sys_overdrive', kind: 'weapon', unlockLevel: 13 },
  { id: 'plating', name: 'Hull Plating', icon: 'icon_hull', kind: 'gear' },
  { id: 'shield', name: 'Shield Generator', icon: 'icon_sys_shields', kind: 'gear' },
  { id: 'engine', name: 'Engine', icon: 'icon_sys_engines', kind: 'gear' },
  { id: 'reactor', name: 'Reactor Core', icon: 'icon_power', kind: 'gear' },
  { id: 'computer', name: 'Nav Computer', icon: 'icon_sys_sensors', kind: 'gear' },
  { id: 'utility1', name: 'Utility I', icon: 'icon_sys_battery', kind: 'utility' },
  { id: 'utility2', name: 'Utility II', icon: 'icon_sys_battery', kind: 'utility' },
  { id: 'utility3', name: 'Utility III', icon: 'icon_sys_battery', kind: 'utility' },
];

/** Every utility mount, in trigger order. */
export const UTILITY_SLOTS = SLOTS.filter(s => s.kind === 'utility').map(s => s.id);

export const SLOT_IDS = SLOTS.map(s => s.id);
export const SLOTS_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));

/** Which base-template pool feeds a slot. Every utility mount shares one pool. */
export function poolForSlot(slotId) {
  if (UTILITY_SLOTS.includes(slotId)) return 'utility';
  return slotId;
}

/** Slots available to a ship at this level. */
export function slotsForLevel(level) {
  return SLOTS.filter(s => !s.unlockLevel || level >= s.unlockLevel);
}

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

export const RARITIES = [
  { id: 'salvaged', name: 'Salvaged', tier: 1, colour: '#8494b8', scale: 0.72, affixes: 0, weight: 100 },
  { id: 'standard', name: 'Standard', tier: 2, colour: '#5cf59b', scale: 1.00, affixes: 1, weight: 62 },
  { id: 'military', name: 'Military', tier: 3, colour: '#4fe3f5', scale: 1.32, affixes: 2, weight: 28 },
  { id: 'prototype', name: 'Prototype', tier: 4, colour: '#c07ef5', scale: 1.70, affixes: 3, weight: 9 },
  { id: 'relic', name: 'Relic', tier: 5, colour: '#ffcc5c', scale: 2.15, affixes: 4, weight: 2 },
];

export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));

/**
 * Pick a rarity. Deeper space and higher `luck` shift the curve upward; the
 * weights themselves stay fixed so the tail never fully closes off.
 */
/**
 * Active abilities are the loudest thing an item can carry, so they are a
 * reason to be excited about a blue drop rather than the default state of a
 * utility slot. Nothing below Military rolls one at all, and even at Military
 * most rolls are plain stat gear.
 */
export const ABILITY_MIN_TIER = 3;                       // Military
export const ABILITY_CHANCE = { 3: 0.30, 4: 0.45, 5: 0.60 };

/** Whether a roll of this rarity should reach for an ability-bearing base. */
export function rollsAbility(rng, tier) {
  if (tier < ABILITY_MIN_TIER) return false;
  return rng.chance(ABILITY_CHANCE[tier] ?? 0);
}

export function rollRarity(rng, { threat = 1, luck = 0, floor = 1 } = {}) {
  const push = 1 + threat * 0.055 + luck;
  const pool = RARITIES
    .filter(r => r.tier >= floor)
    .map(r => ({ r, weight: r.weight * Math.pow(push, r.tier - 1) }));
  return rng.weighted(pool, 'weight').r;
}

// ---------------------------------------------------------------------------
// Base templates
//
// `mods` values are the roll at rarity scale 1.0 and level 1; generation scales
// them by rarity and item level. A `[min, max]` pair rolls within the range.
// ---------------------------------------------------------------------------

export const BASES = {
  engine: [
    { id: 'ion_thruster', name: 'Ion Thruster', desc: 'Steady, efficient, unremarkable.', mods: { speed: [14, 22], accelPct: [0.05, 0.10] } },
    { id: 'burst_drive', name: 'Burst Drive', desc: 'Violent acceleration, poor top end.', mods: { accelPct: [0.18, 0.30], speed: [4, 9] } },
    { id: 'glide_array', name: 'Glide Array', desc: 'Low drag. Takes practice to stop.', mods: { speed: [18, 28], drag: [-2.2, -1.2] } },
    { id: 'vector_pods', name: 'Vector Pods', desc: 'Tight handling for close work.', mods: { drag: [1.4, 2.4], accelPct: [0.14, 0.24], speed: [6, 12] } },
    { id: 'slipstream', name: 'Slipstream Coil', desc: 'Recharges dashes fast.', mods: { dashCooldown: [0.5, 0.9], speed: [8, 14] } },
    { id: 'overburn', name: 'Overburn Nacelles', desc: 'Fast, thirsty.', mods: { speed: [26, 38], energyRegenPct: [-0.16, -0.08] } },
  ],
  shield: [
    { id: 'deflector', name: 'Deflector Screen', desc: 'A dependable bubble.', mods: { shield: [16, 26] } },
    { id: 'fast_cycler', name: 'Fast Cycler', desc: 'Thin, but back up quickly.', mods: { shield: [6, 12], shieldRegen: [2.2, 3.6], shieldDelay: [0.5, 0.9] } },
    { id: 'bulwark_field', name: 'Bulwark Field', desc: 'Heavy and slow to recover.', mods: { shield: [30, 46], shieldRegenPct: [-0.24, -0.12] } },
    { id: 'reactive_screen', name: 'Reactive Screen', desc: 'Punishes anything that touches it.', mods: { shield: [12, 20], thorns: [4, 9] } },
    { id: 'siphon_screen', name: 'Siphon Screen', desc: 'Bleeds energy off incoming fire.', mods: { shield: [12, 20], energyRegen: [1.6, 3.0] } },
    { id: 'phase_screen', name: 'Phase Screen', desc: 'Shrugs off collisions.', mods: { shield: [14, 22], contactArmour: [0.25, 0.45] } },
  ],
  reactor: [
    { id: 'cell_bank', name: 'Cell Bank', desc: 'A big, dumb battery.', mods: { energy: [22, 34] } },
    { id: 'fusion_core', name: 'Fusion Core', desc: 'Balanced output.', mods: { energy: [12, 20], energyRegen: [2.4, 4.0] } },
    { id: 'flux_core', name: 'Flux Core', desc: 'Regenerates hard, holds little.', mods: { energyRegen: [5.0, 7.5], energyPct: [-0.20, -0.10] } },
    { id: 'efficient_core', name: 'Efficiency Core', desc: 'Everything costs less.', mods: { energyCost: [0.10, 0.20] } },
    { id: 'unstable_core', name: 'Unstable Core', desc: 'Enormous output, fragile housing.', mods: { energy: [30, 48], energyRegen: [3, 5], hullPct: [-0.14, -0.07] } },
    { id: 'capacitor_web', name: 'Capacitor Web', desc: 'Feeds the guns directly.', mods: { energy: [14, 22], fireRatePct: [0.08, 0.15] } },
  ],
  plating: [
    { id: 'ablative', name: 'Ablative Plating', desc: 'Simple armour.', mods: { hull: [18, 30] } },
    { id: 'composite', name: 'Composite Weave', desc: 'Light armour that keeps you quick.', mods: { hull: [10, 18], speed: [5, 10] } },
    { id: 'reinforced', name: 'Reinforced Bulkheads', desc: 'Heavy. Very heavy.', mods: { hull: [34, 52], speedPct: [-0.14, -0.07] } },
    { id: 'nanoweave', name: 'Nanoweave Hull', desc: 'Repairs mean more.', mods: { hull: [12, 20], repairPct: [0.20, 0.38] } },
    { id: 'spiked_hull', name: 'Ram Prow', desc: 'Built for hitting things.', mods: { hull: [14, 24], contactArmour: [0.35, 0.6], thorns: [5, 11] } },
    { id: 'scavenger_hull', name: 'Scavenger Frame', desc: 'Salvage rigging bolted on.', mods: { hull: [10, 18], creditsPct: [0.10, 0.20], pickupRange: [14, 26] } },
  ],
  computer: [
    { id: 'targeting', name: 'Targeting Computer', desc: 'Finds the seams in armour.', mods: { crit: [0.05, 0.10] } },
    { id: 'fire_control', name: 'Fire Control Suite', desc: 'Trims the firing cycle.', mods: { fireRatePct: [0.09, 0.16] } },
    { id: 'survey_array', name: 'Survey Array', desc: 'Reads the map further out.', mods: { scan: [1, 1], xpPct: [0.06, 0.12] } },
    { id: 'salvage_ai', name: 'Salvage AI', desc: 'Better prices, better finds.', mods: { creditsPct: [0.14, 0.26], luck: [0.05, 0.12] } },
    { id: 'combat_ai', name: 'Combat AI', desc: 'Runs your systems hot.', mods: { cooldownPct: [0.10, 0.18] } },
    { id: 'tractor_unit', name: 'Tractor Unit', desc: 'Hoovers up loot.', mods: { pickupRange: [40, 70], magnetSpeed: [90, 170] } },
    { id: 'overwatch', name: 'Overwatch Module', desc: 'Marks what is about to hurt you.', mods: { crit: [0.03, 0.07], cooldownPct: [0.05, 0.10] } },
  ],
  utility: [
    { id: 'repair_bay', name: 'Repair Bay', desc: 'Patches the hull between fights.', ability: 'repair_pulse', mods: { repairPct: [0.10, 0.20] } },
    { id: 'emp_charge', name: 'EMP Charge', desc: 'Wipes nearby enemy fire.', ability: 'emp_burst', mods: {} },
    { id: 'phase_cloak', name: 'Phase Cloak', desc: 'Brief intangibility.', ability: 'phase_shift', mods: {} },
    { id: 'overcharge', name: 'Overcharge Module', desc: 'A window of brutal fire rate.', ability: 'overcharge', mods: { fireRatePct: [0.04, 0.09] } },
    { id: 'decoy_pod', name: 'Decoy Pod', desc: 'Something else for them to shoot.', ability: 'decoy', mods: {} },
    { id: 'nova_core', name: 'Nova Core', desc: 'A ring of destruction, centred on you.', ability: 'nova', mods: {} },
    { id: 'drone_bay', name: 'Escort Drone Bay', desc: 'A drone flies wing for a while and shoots.', ability: 'escort_drone', mods: {} },
    { id: 'time_dilator', name: 'Time Dilator', desc: 'Slows everything but you.', ability: 'dilate', mods: { cooldownPct: [0.04, 0.09] } },
    { id: 'shield_burst', name: 'Emergency Screen', desc: 'Instantly restores your shield.', ability: 'shield_burst', mods: { shieldRegen: [1.0, 2.0] } },
    { id: 'siphon_beam', name: 'Siphon Beam', desc: 'Drains hull from what you hit.', mods: { lifesteal: [0.02, 0.045] } },
    { id: 'ammo_printer', name: 'Ammo Printer', desc: 'Weapons cost less to fire.', mods: { energyCost: [0.08, 0.16] } },
    { id: 'grav_anchor', name: 'Grav Anchor', desc: 'You stop when you mean to.', mods: { drag: [2.0, 3.4], accelPct: [0.10, 0.18] } },
    { id: 'blast_shunt', name: 'Blast Shunt', desc: 'Collisions barely register.', mods: { contactArmour: [0.4, 0.7] } },
    { id: 'scholar_chip', name: "Cartographer's Chip", desc: 'Learn more from every fight.', mods: { xpPct: [0.12, 0.22] } },
  ],
};

// ---------------------------------------------------------------------------
// Affixes — extra properties rolled onto rarer items.
// ---------------------------------------------------------------------------

export const AFFIXES = [
  { id: 'hardened', name: 'Hardened', mods: { hull: [8, 16] } },
  { id: 'shielded', name: 'Shielded', mods: { shield: [7, 14] } },
  { id: 'charged', name: 'Charged', mods: { energy: [8, 16] } },
  { id: 'swift', name: 'Swift', mods: { speed: [7, 14] } },
  { id: 'honed', name: 'Honed', mods: { damagePct: [0.05, 0.11] } },
  { id: 'rapid', name: 'Rapid', mods: { fireRatePct: [0.05, 0.10] } },
  { id: 'keen', name: 'Keen', mods: { crit: [0.03, 0.07] } },
  { id: 'brutal', name: 'Brutal', mods: { critMult: [0.20, 0.45] } },
  { id: 'cycling', name: 'Cycling', mods: { cooldownPct: [0.05, 0.11] } },
  { id: 'flowing', name: 'Flowing', mods: { energyRegen: [1.4, 2.8] } },
  { id: 'frugal', name: 'Frugal', mods: { energyCost: [0.05, 0.11] } },
  { id: 'resilient', name: 'Resilient', mods: { shieldRegen: [1.2, 2.4] } },
  { id: 'quickset', name: 'Quickset', mods: { shieldDelay: [0.3, 0.6] } },
  { id: 'magnetic', name: 'Magnetic', mods: { pickupRange: [18, 34] } },
  { id: 'lucrative', name: 'Lucrative', mods: { creditsPct: [0.08, 0.16] } },
  { id: 'insightful', name: 'Insightful', mods: { xpPct: [0.06, 0.13] } },
  { id: 'barbed', name: 'Barbed', mods: { thorns: [4, 9] } },
  { id: 'vampiric', name: 'Vampiric', mods: { lifesteal: [0.015, 0.03] } },
  { id: 'nimble', name: 'Nimble', mods: { accelPct: [0.08, 0.15] } },
  { id: 'reinforced', name: 'Reinforced', mods: { hullPct: [0.05, 0.10] } },
  { id: 'fortunate', name: 'Fortunate', mods: { luck: [0.06, 0.14] } },
  { id: 'kinetic', name: 'Kinetic', mods: { contactArmour: [0.2, 0.4] } },
];

// ---------------------------------------------------------------------------
// Abilities — active effects granted by utility gear.
// The sim implements the behaviour; this is the data half.
// ---------------------------------------------------------------------------

export const ABILITIES = {
  repair_pulse: { name: 'Repair Pulse', cooldown: 22, energy: 30, icon: 'icon_repair', desc: 'Restore 18% of max hull.' },
  emp_burst: { name: 'EMP Burst', cooldown: 14, energy: 25, icon: 'icon_sys_hacking', desc: 'Destroy every enemy projectile within 220 units.' },
  phase_shift: { name: 'Phase Shift', cooldown: 16, energy: 20, icon: 'icon_sys_cloaking', desc: 'Become untouchable for 2.2 seconds.' },
  overcharge: { name: 'Overcharge', cooldown: 20, energy: 35, icon: 'icon_sys_overdrive', desc: '+90% fire rate for 6 seconds.' },
  decoy: { name: 'Launch Decoy', cooldown: 18, energy: 22, icon: 'icon_sys_drones', desc: 'A decoy pulls enemy fire for 6 seconds.' },
  nova: { name: 'Nova', cooldown: 24, energy: 40, icon: 'icon_sys_siphon', desc: 'A shockwave deals heavy damage around you.' },
  escort_drone: { name: 'Escort Drone', cooldown: 26, energy: 30, icon: 'icon_sys_drones', desc: 'Summon a drone that fires for 14 seconds.' },
  dilate: { name: 'Time Dilation', cooldown: 28, energy: 38, icon: 'icon_sys_temporal', desc: 'Slow everything but you by 55% for 4 seconds.' },
  shield_burst: { name: 'Emergency Screen', cooldown: 20, energy: 28, icon: 'icon_sys_shields', desc: 'Instantly refill your shield.' },
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

let itemSeq = 0;
/** Reset so a reloaded run doesn't collide ids with a fresh one. */
export function resetItemIds(n = 0) { itemSeq = n; }
export function itemIdCounter() { return itemSeq; }

function rollValue(rng, spec, scale) {
  const [lo, hi] = Array.isArray(spec) ? spec : [spec, spec];
  const raw = rng.float(lo, hi) * scale;
  // Small fractional mods (percentages) keep 3dp; whole-number mods round.
  return Math.abs(raw) < 3 ? Number(raw.toFixed(3)) : Math.round(raw);
}

/**
 * The bases a roll of this rarity may draw from.
 *
 * Below Military the ability-bearing templates are simply not in the bag; at
 * Military and above they are in it only when the ability roll came up. A pool
 * that turns out to be all one kind falls back to the whole list rather than
 * failing to produce an item.
 */
function basesFor(rng, pool, tier) {
  const all = BASES[pool] || [];
  if (!all.some(b => b.ability)) return all;
  const want = rollsAbility(rng, tier);
  const picked = all.filter(b => (want ? !!b.ability : !b.ability));
  return picked.length ? picked : all;
}

function rollMods(rng, modSpec, scale, into = {}) {
  for (const [key, spec] of Object.entries(modSpec || {})) {
    into[key] = Number(((into[key] || 0) + rollValue(rng, spec, scale)).toFixed(3));
  }
  return into;
}

/**
 * Generate one item.
 *
 * `level` is the item level (usually the node's threat), which scales mods
 * alongside rarity so deep-space loot genuinely outclasses starting gear.
 */
export function generateItem(rng, { slot, level = 1, rarity = null, luck = 0, rarityFloor = 1 } = {}) {
  const pool = poolForSlot(slot || rng.pick(SLOT_IDS));
  const slotId = slot || (pool === 'utility' ? 'utility1' : pool);

  if (pool === 'primary' || pool === 'secondary' || pool === 'tertiary') {
    return generateWeaponItem(rng, { slot: slotId, level, rarity, luck, rarityFloor });
  }

  const rar = rarity ? RARITY_BY_ID[rarity] : rollRarity(rng, { threat: level, luck, floor: rarityFloor });
  const base = rng.pick(basesFor(rng, pool, rar.tier));
  // Item level scaling is deliberately gentle; rarity should matter more than
  // depth, so an early Relic stays exciting rather than being outgrown at once.
  const scale = rar.scale * (1 + 0.055 * (level - 1));

  const mods = rollMods(rng, base.mods, scale);
  const affixes = [];
  const available = rng.shuffle(AFFIXES);
  for (let i = 0; i < rar.affixes && i < available.length; i++) {
    affixes.push(available[i].name);
    rollMods(rng, available[i].mods, rar.scale, mods);
  }

  return {
    uid: `it${++itemSeq}`,
    baseId: base.id,
    slot: slotId,
    pool,
    name: affixes.length ? `${affixes[0]} ${base.name}` : base.name,
    baseName: base.name,
    desc: base.desc,
    rarity: rar.id,
    tier: rar.tier,
    level,
    icon: SLOTS_BY_ID[slotId]?.icon || 'icon_sys_battery',
    mods,
    affixes,
    ability: base.ability || null,
    value: itemValue({ tier: rar.tier, level }),
  };
}

/** Weapons are items too, but their identity is the weapon definition. */
function generateWeaponItem(rng, { slot, level, rarity, luck, rarityFloor }) {
  const kind = slot === 'tertiary' ? 'tertiary' : slot === 'secondary' ? 'secondary' : 'primary';
  const candidates = weaponIds().filter(id => WEAPONS[id].kind === kind);
  const def = WEAPONS[rng.pick(candidates)];
  const rar = rarity ? RARITY_BY_ID[rarity] : rollRarity(rng, { threat: level, luck, floor: rarityFloor });
  const scale = rar.scale * (1 + 0.055 * (level - 1));

  const mods = {};
  const affixes = [];
  const available = rng.shuffle(AFFIXES.filter(a => !a.mods.shield && !a.mods.hull));
  for (let i = 0; i < rar.affixes && i < available.length; i++) {
    affixes.push(available[i].name);
    rollMods(rng, available[i].mods, rar.scale, mods);
  }

  // The weapon's own damage scales with rarity and level — this is the main
  // reason to keep picking up guns rather than settling on the first one.
  const power = Number((rar.scale * (1 + 0.075 * (level - 1))).toFixed(3));

  return {
    uid: `it${++itemSeq}`,
    baseId: def.id,
    slot,
    pool: kind,
    name: affixes.length ? `${affixes[0]} ${def.name}` : def.name,
    baseName: def.name,
    desc: def.desc,
    rarity: rar.id,
    tier: rar.tier,
    level,
    icon: def.icon || 'icon_sys_weapons',
    weaponId: def.id,
    power,
    mods,
    affixes,
    ability: null,
    value: itemValue({ tier: rar.tier, level }),
  };
}

export function itemValue({ tier, level }) {
  return Math.round((28 + 34 * (tier - 1)) * (1 + 0.16 * (level - 1)));
}

/** Sell price is a fraction of value — buying back is always a loss. */
export function sellValue(item) { return Math.max(6, Math.round(item.value * 0.42)); }

// ---------------------------------------------------------------------------
// Loadout maths
// ---------------------------------------------------------------------------

/** Sum every equipped item's mods into one bag. */
export function sumMods(equipped) {
  const out = {};
  for (const item of Object.values(equipped || {})) {
    if (!item) continue;
    for (const [k, v] of Object.entries(item.mods || {})) out[k] = (out[k] || 0) + v;
  }
  return out;
}

/** The abilities currently available, in slot order. */
export function equippedAbilities(equipped) {
  const out = [];
  for (const slotId of SLOT_IDS) {
    const item = equipped?.[slotId];
    if (item?.ability && ABILITIES[item.ability]) {
      out.push({ slot: slotId, id: item.ability, ...ABILITIES[item.ability], source: item.name });
    }
  }
  return out;
}

/** Human-readable mod lines for tooltips and the inventory screen. */
export const MOD_LABELS = {
  hull: ['Max hull', 'flat'], hullPct: ['Max hull', 'pct'],
  shield: ['Max shield', 'flat'], shieldPct: ['Max shield', 'pct'],
  shieldRegen: ['Shield regen', 'flat1'], shieldRegenPct: ['Shield regen', 'pct'],
  shieldDelay: ['Shield delay', 'flat1neg'],
  energy: ['Max energy', 'flat'], energyPct: ['Max energy', 'pct'],
  energyRegen: ['Energy regen', 'flat1'], energyRegenPct: ['Energy regen', 'pct'],
  energyCost: ['Energy cost', 'pctneg'],
  damagePct: ['Damage', 'pct'], fireRatePct: ['Fire rate', 'pct'],
  crit: ['Crit chance', 'pct'], critMult: ['Crit damage', 'pct'],
  speed: ['Speed', 'flat'], speedPct: ['Speed', 'pct'],
  accelPct: ['Acceleration', 'pct'], drag: ['Handling', 'flat1'],
  dashCooldown: ['Dash cooldown', 'flat1neg'], dashCharges: ['Dash charges', 'flat'],
  cooldownPct: ['Cooldowns', 'pctneg'],
  pickupRange: ['Pickup range', 'flat'], magnetSpeed: ['Pickup speed', 'flat'],
  repairPct: ['Repair received', 'pct'], contactArmour: ['Collision resist', 'pct'],
  thorns: ['Thorns damage', 'flat'], lifesteal: ['Lifesteal', 'pct'],
  xpPct: ['Experience', 'pct'], creditsPct: ['Credits', 'pct'],
  luck: ['Loot quality', 'pct'], scan: ['Map scan range', 'flat'],
};

export function describeMod(key, value) {
  const entry = MOD_LABELS[key];
  if (!entry) return `${key} ${value > 0 ? '+' : ''}${value}`;
  const [label, kind] = entry;
  const sign = value > 0 ? '+' : '';
  switch (kind) {
    case 'pct': return `${label} ${sign}${Math.round(value * 100)}%`;
    // These read better inverted: a positive roll is a *reduction*.
    case 'pctneg': return `${label} ${value > 0 ? '-' : '+'}${Math.abs(Math.round(value * 100))}%`;
    case 'flat1': return `${label} ${sign}${value.toFixed(1)}`;
    case 'flat1neg': return `${label} ${value > 0 ? '-' : '+'}${Math.abs(value).toFixed(1)}s`;
    default: return `${label} ${sign}${Math.round(value)}`;
  }
}

export function describeItem(item) {
  const lines = Object.entries(item.mods || {}).map(([k, v]) => describeMod(k, v));
  if (item.ability && ABILITIES[item.ability]) {
    const ab = ABILITIES[item.ability];
    lines.push(`ACTIVE — ${ab.name}: ${ab.desc}`);
  }
  if (item.weaponId) {
    const w = WEAPONS[item.weaponId];
    if (w) lines.unshift(`${Math.round(w.damage * item.power)} damage · ${w.rof.toFixed(1)}/sec · ${Math.round(w.energy)} energy`);
  }
  return lines;
}

/**
 * A crude power score, used to sort loot and to let shops price sensibly.
 * Not shown to the player as truth — just an ordering hint.
 */
export function powerScore(item) {
  let score = item.tier * 10 + item.level * 2;
  for (const [k, v] of Object.entries(item.mods || {})) {
    const kind = MOD_LABELS[k]?.[1];
    score += kind === 'pct' || kind === 'pctneg' ? Math.abs(v) * 60 : Math.abs(v) * 0.6;
  }
  if (item.ability) score += 22;
  if (item.power) score += item.power * 18;
  return Math.round(score);
}
