/**
 * One encounter per duelist.
 *
 * These are generated rather than authored, because there is nothing left to
 * author: the ship IS the encounter. A duel has no wave script, no budget and
 * no composition to get right — a named opponent arrives, and the node is over
 * when it is dead. Everything that used to make one Hostiles encounter differ
 * from another (who turns up, in what order, in what shape) now lives in the
 * duelist itself, in `src/game/duelists/`.
 *
 * The objective is `destroy` on a tag rather than `clear`. That matters: a
 * duelist can summon escorts, split, or throw out decoys, and none of that
 * should be something the player has to mop up. The tagged bodies are the
 * fight; anything else on the field is weather.
 */

import { DUELISTS } from '../duelists/index.js';

/**
 * Where a squadron enters.
 *
 * A pair reads best abreast, three as a curve, four or five as a chevron —
 * the point is that a squadron should look like one opponent with several
 * bodies rather than like the crowd this whole change was meant to remove.
 */
const FORMATION_FOR = { 1: 'line', 2: 'line', 3: 'arc', 4: 'v', 5: 'v' };

/**
 * A squadron is worth slightly more than a lone ship of the same budget.
 *
 * Several bodies is a harder problem than one — you cannot focus, and the
 * threat comes from more than one bearing at a time — even when the hull pool
 * is identical, so the pay has to acknowledge that or squadrons become the
 * nodes players learn to avoid.
 */
const SQUADRON_BONUS = { 1: 1, 2: 1.06, 3: 1.1, 4: 1.14, 5: 1.18 };

function encounterFor(d) {
  const n = d.duel.squadron;
  return {
    id: `duel_${d.id}`,
    name: d.name,
    type: 'hostiles',
    weight: 10,
    minThreat: d.duel.minThreat,
    maxThreat: d.duel.maxThreat,
    blurb: d.duel.blurb,
    intro: d.duel.intro,
    objective: { kind: 'destroy', tag: 'duelist' },
    waves: [{
      at: 0,
      spawn: [{
        // `ids` rather than `id` + `count` on purpose: an explicit count is
        // scaled down globally to thin out crowds, and a squadron of five
        // quietly becoming two is exactly the bug that would be hardest to
        // notice from the outside.
        ids: Array.from({ length: n }, () => d.id),
        formation: FORMATION_FOR[n] || 'line',
        tag: 'duelist',
        delay: 0.4,
      }],
    }],
    rewards: {
      xpMult: SQUADRON_BONUS[n] || 1,
      creditsMult: SQUADRON_BONUS[n] || 1,
      crates: d.duel.band === 'high' ? 1 : 0,
    },
    /** Lets the bestiary and the brief find the ship behind the fight. */
    duelist: d.id,
  };
}

export const DUEL_ENCOUNTERS = DUELISTS.map(encounterFor);
