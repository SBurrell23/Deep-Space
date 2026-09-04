/**
 * The reference ship every probe measures against.
 *
 * One copy, because three probes had their own and they drifted: all of them
 * spent attribute points in a loop without ever raising `progress.level`, so
 * the "level 20" ship they measured was formally level 1. Nothing level-gated
 * was ever exercised — the heavy weapon mount unlocks at 13, which meant the
 * whole tertiary class went unmeasured while its numbers were being tuned.
 *
 * This is what a player plausibly flies at a given depth: levelled to the
 * node's threat, points spread evenly, and gear rolled at that depth.
 */

import * as S from '../src/game/ship.js';
import { ATTRIBUTE_IDS, MAX_LEVEL } from '../src/game/attributes.js';
import { generateItem, SLOT_IDS } from '../src/game/items.js';

export function referenceShip(threat, rng, shipId = 'kestrel') {
  const ship = S.createShip(shipId, rng);
  const targetLevel = Math.max(1, Math.min(MAX_LEVEL, Math.round(threat)));

  // Level FIRST, then spend: the slots a ship has are a function of its level,
  // and gear cannot be equipped into a mount that has not been cut yet.
  ship.progress.level = targetLevel;
  for (let l = 1; l < targetLevel; l++) {
    ship.progress.unspentPoints += 2;
    for (let i = 0; i < 2; i++) {
      const a = ship.progress.attributes;
      const lowest = ATTRIBUTE_IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), ATTRIBUTE_IDS[0]);
      S.spendAttributePoint(ship, lowest);
    }
  }

  if (threat > 2) {
    // Whatever mounts this hull actually has, in slot order.
    for (const slot of SLOT_IDS) {
      if (!S.hasSlot(ship, slot)) continue;
      const item = generateItem(rng, { slot, level: Math.max(1, Math.round(threat) - 1) });
      ship.inventory.push(item);
      if (S.isUpgrade(ship, item)) S.equip(ship, item.uid);
    }
  }

  S.recompute(ship);
  ship.hull = ship.stats.maxHull;
  ship.shield = ship.stats.maxShield;
  return ship;
}
