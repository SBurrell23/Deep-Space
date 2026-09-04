/**
 * Power-curve probe.
 *
 * Difficulty is a race between two curves: what the player can take and deal
 * at a given depth, and what the map throws at them there. Fight length and
 * death rate are downstream of that ratio, so when they misbehave this is the
 * table to read first.
 *
 * Builds the same reference ship `balance.js` uses and prints, per threat:
 * durability, output, and the enemy scaling it is up against.
 *
 *   node tests/curve.js
 */

import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const S = await import('../src/game/ship.js');
const { ATTRIBUTE_IDS } = await import('../src/game/attributes.js');
const { generateItem } = await import('../src/game/items.js');
const { ENEMIES, scaleEnemy, CLASS_TOUGHNESS, DAMAGE_SCALE } = await import('../src/game/enemies.js');
const { resolveWeapon, shotInterval } = await import('../src/game/weapons.js');

/** The reference ship balance.js measures against, averaged over seeds. */
function referenceShip(threat, rng, shipId = 'kestrel') {
  const ship = S.createShip(shipId, rng);
  const targetLevel = Math.max(1, Math.min(20, threat));
  for (let l = 1; l < targetLevel; l++) {
    ship.progress.unspentPoints += 2;
    for (let i = 0; i < 2; i++) {
      const a = ship.progress.attributes;
      const lowest = ATTRIBUTE_IDS.reduce((lo, id) => (a[id] < a[lo] ? id : lo), ATTRIBUTE_IDS[0]);
      S.spendAttributePoint(ship, lowest);
    }
  }
  if (threat > 2) {
    for (const slot of ['primary', 'secondary', 'engine', 'shield', 'reactor', 'plating',
      'computer', 'utility1', 'utility2', 'utility3']) {
      const item = generateItem(rng, { slot, level: Math.max(1, threat - 1) });
      ship.inventory.push(item);
      if (S.isUpgrade(ship, item)) S.equip(ship, item.uid);
    }
  }
  S.recompute(ship);
  return ship;
}

/** Sustained single-target output, ignoring energy: enough to compare curves. */
function playerDps(ship) {
  let dps = 0;
  for (const slot of ['primary', 'secondary', 'tertiary']) {
    const item = ship.equipped[slot];
    if (!item?.weaponId) continue;
    const w = resolveWeapon(item, ship.stats);
    if (!w) continue;
    const perShot = (w.damage || 0) * (w.count || 1);
    dps += perShot / Math.max(0.02, shotInterval(w));
  }
  return dps;
}

/** What one second of a typical mid-class enemy's attention is worth. */
function enemyThreatDps(threat) {
  const mid = ['gunship', 'lancer', 'interceptor'].map(id => ENEMIES[id]).filter(Boolean);
  if (!mid.length) return 0;
  let total = 0;
  for (const def of mid) {
    const e = scaleEnemy(def, threat);
    // Rough: one burst per fire interval, all of it landing.
    const rof = def.fireRate || 1;
    total += (e.bulletDamage || 0) * (def.burst || 1) * rof;
  }
  return total / mid.length;
}

const SAMPLES = 6;
console.log('Player against the map, at a level-matched depth\n');
console.log('  threat   maxHull  maxShield   leak    EHP    player dps   enemy dps   EHP/enemy dps   dps/enemy hull');
const rows = [];
for (const threat of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) {
  let hull = 0, shield = 0, leak = 0, dps = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const ship = referenceShip(threat, new RNG(`CURVE-${threat}-${i}`));
    hull += ship.stats.maxHull;
    shield += ship.stats.maxShield;
    leak += ship.stats.shieldLeak;
    dps += playerDps(ship);
  }
  hull /= SAMPLES; shield /= SAMPLES; leak /= SAMPLES; dps /= SAMPLES;
  // Effective HP: the shield stops all but the leak, so it is worth more than
  // its face value, and it is the pool that refills for free between fights.
  const ehp = hull + shield / Math.max(0.01, leak) * leak + shield;
  const edps = enemyThreatDps(threat);
  const midHull = scaleEnemy(ENEMIES.gunship, threat).hull;
  rows.push({ threat, hull, shield, leak, ehp, dps, edps, midHull });
  console.log(`  ${String(threat).padStart(6)}   ${hull.toFixed(0).padStart(7)}  ${shield.toFixed(0).padStart(9)}`
    + `   ${(leak * 100).toFixed(0).padStart(3)}%  ${ehp.toFixed(0).padStart(5)}   ${dps.toFixed(0).padStart(10)}`
    + `   ${edps.toFixed(0).padStart(9)}   ${(ehp / Math.max(1, edps)).toFixed(1).padStart(13)}s`
    + `   ${(dps / Math.max(1, midHull)).toFixed(2).padStart(14)}`);
}

console.log('\nGrowth from threat 1 to 20 (how many times over):');
const a = rows[0], z = rows[rows.length - 1];
console.log(`  player hull    x${(z.hull / a.hull).toFixed(2)}`);
console.log(`  player EHP     x${(z.ehp / a.ehp).toFixed(2)}`);
console.log(`  player dps     x${(z.dps / a.dps).toFixed(2)}`);
console.log(`  enemy dps      x${(z.edps / a.edps).toFixed(2)}`);
console.log(`  enemy hull     x${(z.midHull / a.midHull).toFixed(2)}`);
console.log(`\n  survivability (EHP / enemy dps): x${((z.ehp / z.edps) / (a.ehp / a.edps)).toFixed(2)}`);
console.log(`  killing power  (dps / enemy hull): x${((z.dps / z.midHull) / (a.dps / a.midHull)).toFixed(2)}`);
console.log('\n  Both should stay near x1: the deep end should feel like the shallow');
console.log('  end played better, not like a different game.');
console.log(`\n  (DAMAGE_SCALE ${DAMAGE_SCALE}, class toughness ${JSON.stringify(CLASS_TOUGHNESS)})`);
