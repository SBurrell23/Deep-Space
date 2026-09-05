/**
 * The hundred duelists.
 *
 * A Hostiles node is one named opponent now. The five packs in this directory
 * are the roster — five factions of twenty, each written to fight in its own
 * way — and this module is the only place that turns an authored ship into
 * something the simulation can spawn.
 *
 * WHY THE AUTHORED SHIPS DO NOT CARRY ABSOLUTE NUMBERS
 *
 * A pack declares `hullMul`, `shieldMul` and `damageMul` — a ship's shape
 * relative to the average — and never a hull total. That is deliberate. A
 * hundred ships with a hundred hand-picked hull values is a hundred numbers to
 * re-derive every time the player's damage curve moves, and it moved four
 * times in the last week. With ratios, retuning the whole roster is one
 * constant in balance.js, and no ship's *identity* changes when it happens:
 * the tank is still 1.4 and the glass cannon still 0.7, whatever a fight is
 * worth this month.
 *
 * Armour is folded back out of the pool for the same reason. Armour multiplies
 * effective hull, so leaving it in would make a heavily armoured ship a longer
 * fight rather than a differently shaped one — and across a hundred opponents,
 * "this one just takes ages" is the least interesting difference available.
 */

import { DUEL_TUNING as DUEL } from '../balance.js';
import { PACK_REACH } from './pack_reach.js';
import { PACK_CHOIR } from './pack_choir.js';
import { PACK_HOLLOW } from './pack_hollow.js';
import { PACK_BLOOM } from './pack_bloom.js';
import { PACK_CONCORD } from './pack_concord.js';

export const DUEL_PACKS = {
  reach: PACK_REACH,
  choir: PACK_CHOIR,
  hollow: PACK_HOLLOW,
  bloom: PACK_BLOOM,
  concord: PACK_CONCORD,
};

/** Which depths a band is legal at. */
export const DUEL_BANDS = {
  low: { minThreat: 1, maxThreat: 7 },
  mid: { minThreat: 5, maxThreat: 13 },
  high: { minThreat: 11, maxThreat: 20 },
  any: { minThreat: 1, maxThreat: 20 },
};

export const DUEL_ROLES = ['tank', 'bruiser', 'skirmisher', 'glass', 'artillery', 'support'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Turn one authored ship into an enemy archetype.
 *
 * The result is an ordinary entry in the ENEMIES table — the spawner, the
 * scaler and the renderer need to know nothing about duelists — plus a `duel`
 * block carrying everything that is about the opponent rather than about the
 * body: its abilities, its bestiary text, and how many bodies it has.
 */
export function buildDuelist(src) {
  const band = DUEL_BANDS[src.band] || DUEL_BANDS.any;
  const squadron = clamp(Math.round(src.squadron || 1), 1, 5);
  const armour = clamp(src.armour ?? 0, 0, 0.3);
  const shieldMul = clamp(src.shieldMul ?? 0, 0, 0.5);

  const pool = DUEL.hullBase * clamp(src.hullMul ?? 1, 0.55, 1.6) * (1 - armour);
  const perBody = pool / squadron;

  return {
    id: src.id,
    name: src.name,
    cls: 'duelist',
    sprite: `duel_${src.id}`,
    w: 64, h: 40,

    hull: Math.round(perBody * (1 - shieldMul)),
    shield: Math.round(perBody * shieldMul),
    armour,
    speed: clamp(src.speed ?? 120, 50, 220),

    move: src.move,
    fire: src.fire || 'single',
    fireRate: clamp(src.fireRate ?? 0.7, 0.2, 2),
    // Split between the bodies, the same way the hull pool is.
    //
    // A squadron shares one hull budget but NOT one set of guns: five bodies
    // firing a full pattern each is five times the incoming fire for the same
    // toughness, and it measured that way — a four-body formation cost 24% of
    // the bar where a lone ship of the same budget cost 10%. `2 / (1 + n)`
    // leaves a formation meaningfully heavier than one ship (four bodies put
    // out 1.6x a single hull's fire) without it being the hardest content in
    // the game by an accident of arithmetic.
    bulletDamage: DUEL.damageBase * clamp(src.damageMul ?? 1, 0.6, 1.6)
      * (2 / (1 + squadron)),
    bulletSpeed: clamp(src.bulletSpeed ?? 300, 200, 420),
    contact: clamp(src.contact ?? 12, 4, 24),

    // Split between the bodies so a squadron and a lone ship pay the same for
    // the same node. Otherwise five bodies would be five times the reward for
    // one fight, and the map would be solved by hunting squadrons.
    xp: Math.max(1, Math.round(DUEL.xpBase / squadron)),
    credits: Math.max(1, Math.round(DUEL.creditsBase / squadron)),
    // Duels are never filled from a budget, but the field is read by the
    // encounter validator and by anything that samples the enemy table.
    cost: Math.round(pool / 100),

    /** Shows a health bar and refuses to wander off the field. */
    named: true,

    duel: {
      faction: src.faction,
      band: src.band,
      role: src.role,
      squadron,
      art: src.art,
      abilities: (src.abilities || []).slice(0, 4),
      strategy: src.strategy,
      blurb: src.blurb,
      intro: src.intro,
      minThreat: band.minThreat,
      maxThreat: band.maxThreat,
      hullMul: src.hullMul,
      shieldMul,
      damageMul: src.damageMul,
      pool: Math.round(pool),
    },
  };
}

export const DUELIST_SOURCES = [
  ...PACK_REACH, ...PACK_CHOIR, ...PACK_HOLLOW, ...PACK_BLOOM, ...PACK_CONCORD,
];

export const DUELISTS = DUELIST_SOURCES.map(buildDuelist);
export const DUELISTS_BY_ID = Object.fromEntries(DUELISTS.map(d => [d.id, d]));
export const DUELIST_IDS = DUELISTS.map(d => d.id);

export function getDuelist(id) { return DUELISTS_BY_ID[id] || null; }

/** Every duelist legal at a threat level. */
export function duelistsFor(threat) {
  return DUELISTS.filter(d => threat >= d.duel.minThreat && threat <= d.duel.maxThreat);
}
