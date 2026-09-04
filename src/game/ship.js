/**
 * The player's ship during a run.
 *
 * Holds the durable state — hull damage that persists between encounters,
 * progression, inventory and what is bolted into each slot — and recomputes the
 * derived stat block whenever any of it changes. Nothing else may write
 * `ship.stats`; call `recompute` instead.
 */

import { deriveStats, newProgress, grantXp, spendPoint, ATTRIBUTE_IDS } from './attributes.js';
import { SLOT_IDS, sumMods, equippedAbilities, generateItem, BASES, RARITY_BY_ID, powerScore } from './items.js';
import { WEAPONS } from './weapons.js';
import { SHIPS } from './ships.js';

export const INVENTORY_SIZE = 24;

/** Build the starting ship for a hull. */
export function createShip(shipId, rng) {
  const def = SHIPS[shipId] || SHIPS.kestrel;
  const ship = {
    shipId: def.id,
    name: def.name,
    sprite: def.sprite,
    perk: def.perk,

    progress: newProgress(def.attributes),
    equipped: Object.fromEntries(SLOT_IDS.map(s => [s, null])),
    inventory: [],

    hull: 1,        // replaced by recompute below
    shield: 0,
    credits: 60,
    stats: null,
  };

  for (const [slot, baseId] of Object.entries(def.gear || {})) {
    ship.equipped[slot] = makeStartingItem(rng, slot, baseId);
  }

  recompute(ship);
  ship.hull = ship.stats.maxHull;
  ship.shield = ship.stats.maxShield;
  return ship;
}

/**
 * Starting gear is a fixed, unrolled version of a base so a hull's opening hand
 * is identical every run — the variety comes from what you find, not from
 * whether your first weapon rolled well.
 */
function makeStartingItem(rng, slot, baseId) {
  if (WEAPONS[baseId]) {
    const def = WEAPONS[baseId];
    return {
      uid: `start_${slot}`, baseId, slot, pool: def.kind,
      name: def.name, baseName: def.name, desc: def.desc,
      rarity: 'standard', tier: 2, level: 1,
      icon: def.icon || 'icon_sys_weapons',
      weaponId: def.id, power: 1, mods: {}, affixes: [],
      ability: null, value: 40, starting: true,
    };
  }
  const pool = slot === 'utility1' || slot === 'utility2' ? 'utility' : slot;
  const base = (BASES[pool] || []).find(b => b.id === baseId);
  if (!base) return null;
  const mods = {};
  for (const [k, spec] of Object.entries(base.mods || {})) {
    const [lo, hi] = Array.isArray(spec) ? spec : [spec, spec];
    const v = (lo + hi) / 2;
    mods[k] = Math.abs(v) < 3 ? Number(v.toFixed(3)) : Math.round(v);
  }
  return {
    uid: `start_${slot}`, baseId, slot, pool,
    name: base.name, baseName: base.name, desc: base.desc,
    rarity: 'standard', tier: 2, level: 1,
    icon: 'icon_sys_battery',
    mods, affixes: [], ability: base.ability || null,
    value: 40, starting: true,
  };
}

/** Recompute derived stats, clamping current hull/shield into the new maxima. */
export function recompute(ship) {
  const mods = sumMods(ship.equipped);
  ship.stats = deriveStats(ship.progress.attributes, mods);
  ship.abilities = equippedAbilities(ship.equipped);
  applyPerkStats(ship);
  ship.hull = Math.min(ship.hull, ship.stats.maxHull);
  ship.shield = Math.min(ship.shield ?? ship.stats.maxShield, ship.stats.maxShield);
  return ship.stats;
}

/** Hull perks that are cleanest to express as flat stat edits. */
function applyPerkStats(ship) {
  const s = ship.stats;
  switch (ship.perk?.id) {
    case 'adaptable': s.xpPct = (s.xpPct || 0) + 0.08; break;
    case 'hold_full': s.creditsPct = (s.creditsPct || 0) + 0.25; s.repairDiscount = 0.2; break;
    case 'bloodlust': s.killHeal = 0.015; break;
    case 'wingmates': s.droneLifePct = 0.6; s.droneRofPct = 0.4; break;
    case 'zoltan_screen': s.negateEvery = 12; break;
    case 'ghost': s.dashCharges = (s.dashCharges || 0) + 1; s.dashWake = true; break;
    case 'ram': s.contactArmour = Math.min(0.85, (s.contactArmour || 0) + 0.6); s.ramDamage = 34; break;
    case 'farsight': s.scanBonus = 2; s.alwaysRevealThreat = true; break;
    case 'resonance': s.killShield = 0.06; break;
    case 'scavenger': s.rarityFloorBonus = 1; s.crateChance = 2; break;
  }
  // Ghost adds a charge after deriveStats has already sized the dash pool.
  return s;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export function addXp(ship, amount) {
  const scaled = amount * (1 + (ship.stats.xpPct || 0));
  return grantXp(ship.progress, scaled);
}

export function spendAttributePoint(ship, attrId) {
  const ok = spendPoint(ship.progress, attrId);
  if (ok) {
    const beforeMaxHull = ship.stats.maxHull;
    recompute(ship);
    // Raising max hull grants the difference, so investing in Hull is an
    // immediate repair rather than a bigger empty bar.
    ship.hull += Math.max(0, ship.stats.maxHull - beforeMaxHull);
    ship.hull = Math.min(ship.hull, ship.stats.maxHull);
  }
  return ok;
}

export function hasUnspentPoints(ship) { return ship.progress.unspentPoints > 0; }

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function inventoryFull(ship) { return ship.inventory.length >= INVENTORY_SIZE; }

export function addItem(ship, item) {
  if (!item) return false;
  if (inventoryFull(ship)) return false;
  ship.inventory.push(item);
  return true;
}

export function removeItem(ship, uid) {
  const i = ship.inventory.findIndex(x => x.uid === uid);
  if (i < 0) return null;
  return ship.inventory.splice(i, 1)[0];
}

/**
 * Equip an item from the inventory. The displaced item goes back to the
 * inventory; if there is no room the swap is refused rather than losing gear.
 */
export function equip(ship, uid, slotId = null) {
  const item = ship.inventory.find(x => x.uid === uid);
  if (!item) return { ok: false, reason: 'not in inventory' };

  const slot = slotId || defaultSlotFor(ship, item);
  if (!slot || !SLOT_IDS.includes(slot)) return { ok: false, reason: 'no slot' };
  if (!fitsSlot(item, slot)) return { ok: false, reason: `${item.name} does not fit that slot` };

  const displaced = ship.equipped[slot];
  if (displaced && inventoryFull(ship)) {
    return { ok: false, reason: 'inventory full — sell something first' };
  }

  removeItem(ship, uid);
  ship.equipped[slot] = item;
  if (displaced) ship.inventory.push(displaced);
  recompute(ship);
  return { ok: true, displaced };
}

export function unequip(ship, slotId) {
  const item = ship.equipped[slotId];
  if (!item) return { ok: false, reason: 'slot empty' };
  if (inventoryFull(ship)) return { ok: false, reason: 'inventory full' };
  ship.equipped[slotId] = null;
  ship.inventory.push(item);
  recompute(ship);
  return { ok: true };
}

export function fitsSlot(item, slotId) {
  if (item.pool === 'utility') return slotId === 'utility1' || slotId === 'utility2';
  if (item.pool === 'primary') return slotId === 'primary';
  if (item.pool === 'secondary') return slotId === 'secondary';
  return item.pool === slotId;
}

/** Prefer an empty compatible slot, else the one it would replace. */
export function defaultSlotFor(ship, item) {
  const candidates = SLOT_IDS.filter(s => fitsSlot(item, s));
  const empty = candidates.find(s => !ship.equipped[s]);
  return empty || candidates[0] || null;
}

/** Does equipping this beat what is already there? Used to flag upgrades. */
export function isUpgrade(ship, item) {
  const slot = defaultSlotFor(ship, item);
  if (!slot) return false;
  const current = ship.equipped[slot];
  if (!current) return true;
  return powerScore(item) > powerScore(current);
}

// ---------------------------------------------------------------------------
// Damage and repair between encounters
// ---------------------------------------------------------------------------

/** Damage persists between nodes; this is how the run gets tense. */
export function applyEncounterResult(ship, world) {
  ship.hull = Math.max(0, Math.min(ship.stats.maxHull, world.player.hull));
  ship.shield = Math.min(ship.stats.maxShield, world.player.shield);
  return ship;
}

export function repair(ship, amount) {
  const before = ship.hull;
  ship.hull = Math.min(ship.stats.maxHull, ship.hull + amount * (ship.stats.repairPct || 1));
  return ship.hull - before;
}

export function repairFraction(ship, frac) {
  return repair(ship, ship.stats.maxHull * frac);
}

export function isDestroyed(ship) { return ship.hull <= 0; }
export function hullFraction(ship) { return ship.hull / ship.stats.maxHull; }

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

/**
 * Roll loot for a cleared node. `crates` come from the sim; each is one item.
 * The scavenger perk raises the rarity floor rather than just the odds, which
 * is what makes it feel different from a plain luck bonus.
 */
export function rollLoot(ship, rng, { threat, crates = 1, rarityFloor = 1 }) {
  const items = [];
  const floor = Math.min(5, rarityFloor + (ship.stats.rarityFloorBonus || 0));
  for (let i = 0; i < crates; i++) {
    items.push(generateItem(rng, {
      slot: rng.pick(SLOT_IDS),
      level: threat,
      luck: ship.stats.luck || 0,
      rarityFloor: floor,
    }));
  }
  return items;
}

/** A compact summary for the UI and the save file. */
export function summarise(ship) {
  return {
    shipId: ship.shipId,
    name: ship.name,
    level: ship.progress.level,
    hull: Math.round(ship.hull),
    maxHull: ship.stats.maxHull,
    credits: ship.credits,
    attributes: { ...ship.progress.attributes },
  };
}
