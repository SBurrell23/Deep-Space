/**
 * Trading posts.
 *
 * A store rolls its stock once when first visited and then keeps it, so the
 * player can leave, fight, and come back to the same shelf.
 */

import { WEAPONS, DRONES, AUGMENTS, rarityWeight, getWeapon, getDrone, getAugment } from './weapons.js';
import { RACES, rollRace, hireCost, getRace } from './crew.js';
import { SYSTEMS, installCost, upgradeCost, getSystem } from './systems.js';
import { compiledLayout } from './ships.js';

export const REPAIR_COST_PER_HULL = 2;

function pickFrom(rng, table, sector, exclude = new Set(), filter = () => true) {
  const pool = Object.values(table)
    .filter(i => !exclude.has(i.id) && filter(i))
    .map(item => ({ item, weight: rarityWeight(item.rarity || 1, sector) }))
    .filter(p => p.weight > 0);
  if (!pool.length) return null;
  return rng.weighted(pool).item;
}

/**
 * Build a store's stock.
 * @param sector 1-based sector number, drives rarity and prices
 * @param ship   the player's ship, so the system shelf only offers what fits
 */
export function generateStore(rng, sector, ship) {
  const priceMul = 1 + (sector - 1) * 0.04;
  const price = base => Math.max(5, Math.round(base * priceMul * rng.float(0.9, 1.12)));

  const taken = new Set();
  const items = [];

  // Weapons: 2-3.
  for (let i = 0; i < rng.int(2, 3); i++) {
    const w = pickFrom(rng, WEAPONS, sector, taken, x => !x.friendly);
    if (!w) break;
    taken.add(w.id);
    items.push({ kind: 'weapon', id: w.id, name: w.name, cost: price(w.cost), sold: false });
  }

  // Drones: 1-2.
  for (let i = 0; i < rng.int(1, 2); i++) {
    const d = pickFrom(rng, DRONES, sector, taken);
    if (!d) break;
    taken.add(d.id);
    items.push({ kind: 'drone', id: d.id, name: d.name, cost: price(d.cost), sold: false });
  }

  // Augments: 1-2.
  for (let i = 0; i < rng.int(1, 2); i++) {
    const a = pickFrom(rng, AUGMENTS, sector, taken, x => !ship.augments.includes(x.id));
    if (!a) break;
    taken.add(a.id);
    items.push({ kind: 'augment', id: a.id, name: a.name, cost: price(a.cost), sold: false });
  }

  // Crew: 0-2, only species this sector would plausibly have.
  for (let i = 0; i < rng.int(0, 2); i++) {
    const race = rollRace(rng, sector);
    items.push({
      kind: 'crew', id: race, name: `${RACES[race].name} crew member`,
      cost: hireCost(race, rng, sector), sold: false,
    });
  }

  // Systems this hull has a compartment for but hasn't installed.
  const layout = compiledLayout(ship.shipId, ship.variant);
  const installable = layout.rooms
    .filter(r => r.system && !ship.systems[r.system])
    .map(r => r.system);
  for (const sysId of rng.sample(installable, Math.min(2, installable.length))) {
    items.push({
      kind: 'system', id: sysId, name: SYSTEMS[sysId].name,
      cost: price(installCost(sysId)), sold: false,
    });
  }

  return {
    sector,
    items,
    fuelPrice: Math.round(3 * priceMul),
    missilePrice: Math.round(6 * priceMul),
    dronePartPrice: Math.round(8 * priceMul),
    repairPrice: Math.round(REPAIR_COST_PER_HULL * priceMul * 100) / 100,
    hasRepairs: true,
    visited: false,
  };
}

/** Upgrades offered for systems already installed, priced from ships.js tables. */
export function upgradeOptions(ship) {
  const out = [];
  for (const sys of Object.values(ship.systems)) {
    const def = getSystem(sys.id);
    const cost = upgradeCost(sys.id, sys.level);
    out.push({
      id: sys.id, name: def.name, level: sys.level, maxLevel: def.maxLevel,
      cost, atMax: cost === null, icon: def.icon, desc: def.desc,
    });
  }
  return out.sort((a, b) => getSystem(a.id).order - getSystem(b.id).order);
}

/** Reactor upgrades get steadily more expensive, as they should. */
export function reactorUpgradeCost(currentReactor) {
  if (currentReactor >= 25) return null;
  return Math.round(20 + Math.pow(currentReactor - 7, 1.6) * 3.4);
}

export function itemDetails(item) {
  switch (item.kind) {
    case 'weapon': return getWeapon(item.id);
    case 'drone': return getDrone(item.id);
    case 'augment': return getAugment(item.id);
    case 'crew': return getRace(item.id);
    case 'system': return getSystem(item.id);
    default: return null;
  }
}

/** Scrap returned for selling equipment — deliberately a poor deal. */
export function sellValue(kind, id) {
  const table = { weapon: WEAPONS, drone: DRONES, augment: AUGMENTS }[kind];
  if (!table || !table[id]) return 0;
  return Math.max(3, Math.round(table[id].cost * 0.42));
}
