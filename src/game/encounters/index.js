/**
 * Encounter registry.
 *
 * An encounter is pure data describing one node's contents: what spawns, in
 * what shape, when, and what winning means. The registry indexes them by type
 * and threat band so the universe generator can ask for "a tunnel suitable for
 * threat 9" and get a weighted pick.
 *
 * Content lives in the sibling files; this module only assembles and validates.
 * `validateEncounter` is exercised by the test suite against every registered
 * encounter, so a malformed one fails CI rather than a player's run.
 */

import { ENEMIES } from '../enemies.js';
import { FORMATIONS } from '../spawner.js';
import { TERRAIN_STYLES } from '../terrain.js';

import { COMBAT_ENCOUNTERS } from './combat.js';
import { HAZARD_ENCOUNTERS } from './hazard.js';
import { BOSS_ENCOUNTERS } from './bosses.js';
import { STORY_ENCOUNTERS } from './story.js';
import { ADVANCED_ENCOUNTERS } from './advanced.js';

/** Every encounter type, and whether it is played in the action sim. */
export const ENCOUNTER_TYPES = {
  // Hostiles is every straight fight: what used to be Hostiles, Swarm and
  // Pursuit. Three node types that all came down to "ships are shooting at
  // you" made the map look varied while playing identically, and one of them
  // could be won by running out a clock rather than winning. A Hostiles node
  // means the same thing every time: destroy everything that turns up.
  hostiles: { action: true, icon: 'node_swarm', label: 'Hostiles' },
  elite: { action: true, icon: 'node_boss', label: 'Elite' },
  asteroid: { action: true, icon: 'node_asteroid', label: 'Debris Field' },
  tunnel: { action: true, icon: 'node_tunnel', label: 'Passage' },
  survival: { action: true, icon: 'node_survival', label: 'Hold Out' },
  derelict: { action: true, icon: 'node_derelict', label: 'Derelict' },
  boss: { action: true, icon: 'node_boss', label: 'Capital Ship' },
  masterfleet: { action: true, icon: 'node_masterfleet', label: 'The Master Fleet' },
  shop: { action: false, icon: 'node_shop', label: 'Trading Post' },
  anomaly: { action: false, icon: 'node_anomaly', label: 'Anomaly' },
  empty: { action: false, icon: 'node_empty', label: 'Quiet' },
};

export const ALL_ENCOUNTERS = [
  ...COMBAT_ENCOUNTERS,
  ...HAZARD_ENCOUNTERS,
  ...BOSS_ENCOUNTERS,
  ...STORY_ENCOUNTERS,
  ...ADVANCED_ENCOUNTERS,
];

export const ENCOUNTERS_BY_ID = Object.fromEntries(ALL_ENCOUNTERS.map(e => [e.id, e]));

export function getEncounter(id) { return ENCOUNTERS_BY_ID[id] || null; }

export function encountersOfType(type) {
  return ALL_ENCOUNTERS.filter(e => e.type === type);
}

/** Encounters legal at a threat level, optionally filtered by type. */
export function candidatesFor(threat, type = null) {
  return ALL_ENCOUNTERS.filter(e =>
    (!type || e.type === type)
    && threat >= (e.minThreat ?? 1)
    && threat <= (e.maxThreat ?? 99)
    && !e.excludeFromPool);
}

/**
 * Pick an encounter for a node. `avoid` holds recently-used ids so the same
 * fight doesn't appear three beacons running — repetition is the fastest way
 * for a procedural game to feel small.
 */
export function pickEncounter(rng, threat, type, avoid = []) {
  let pool = candidatesFor(threat, type);
  if (pool.length === 0) pool = candidatesFor(threat);
  if (pool.length === 0) pool = ALL_ENCOUNTERS.filter(e => !e.excludeFromPool);

  const fresh = pool.filter(e => !avoid.includes(e.id));
  const from = fresh.length > 0 ? fresh : pool;
  return rng.weighted(from.map(e => ({ e, weight: e.weight ?? 10 })), 'weight').e;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const OBJECTIVE_KINDS = ['clear', 'survive', 'reach', 'boss', 'destroy'];

/**
 * Check one encounter, returning an array of problem strings (empty = valid).
 * Deliberately strict: a typo'd enemy id would otherwise spawn nothing and
 * quietly turn a fight into an empty room the player waits out.
 */
export function validateEncounter(e) {
  const errs = [];
  const at = (msg) => errs.push(`${e.id || '(no id)'}: ${msg}`);

  if (!e.id) at('missing id');
  if (!e.name) at('missing name');
  if (!ENCOUNTER_TYPES[e.type]) at(`unknown type "${e.type}"`);
  if (!e.blurb) at('missing blurb (shown on the map node)');

  const min = e.minThreat ?? 1, max = e.maxThreat ?? 99;
  if (min > max) at(`minThreat ${min} exceeds maxThreat ${max}`);
  if (min < 1) at('minThreat below 1');

  const obj = e.objective || { kind: 'clear' };
  if (!OBJECTIVE_KINDS.includes(obj.kind)) at(`unknown objective "${obj.kind}"`);
  if (obj.kind === 'survive' && !(obj.seconds > 0)) at('survive objective needs seconds');
  if (obj.kind === 'reach' && !e.terrain && !(obj.distance > 0)) {
    at('reach objective needs terrain or an explicit distance');
  }
  if (obj.kind === 'destroy' && !obj.tag) at('destroy objective needs a tag');

  const action = ENCOUNTER_TYPES[e.type]?.action;
  if (action && obj.kind !== 'reach' && obj.kind !== 'survive'
      && (!e.waves || e.waves.length === 0)) {
    at('action encounter has no waves');
  }

  let taggedSeen = new Set();
  for (const [i, wave] of (e.waves || []).entries()) {
    if (!Array.isArray(wave.spawn) || wave.spawn.length === 0) {
      at(`wave ${i} has no spawn groups`);
      continue;
    }
    if (wave.at == null && wave.after == null && wave.whenRemaining == null && i > 0) {
      at(`wave ${i} has no trigger (at / after / whenRemaining)`);
    }
    for (const [j, g] of wave.spawn.entries()) {
      const where = `wave ${i} group ${j}`;
      if (!g.id && !g.ids && !g.budget) at(`${where}: needs id, ids or budget`);
      if (g.id && !ENEMIES[g.id]) at(`${where}: unknown enemy "${g.id}"`);
      for (const id of g.ids || []) if (!ENEMIES[id]) at(`${where}: unknown enemy "${id}"`);
      for (const id of g.pool || []) if (!ENEMIES[id]) at(`${where}: unknown pool enemy "${id}"`);
      if (g.budget && !g.pool) at(`${where}: budget group needs a pool`);
      if (g.formation && !FORMATIONS[g.formation]) at(`${where}: unknown formation "${g.formation}"`);
      if (g.count != null && !(g.count > 0)) at(`${where}: count must be positive`);
      if (g.tag) taggedSeen.add(g.tag);
    }
  }

  if (obj.kind === 'destroy' && !taggedSeen.has(obj.tag)) {
    at(`destroy objective targets tag "${obj.tag}" which nothing spawns with`);
  }
  if (obj.kind === 'boss' && !(e.waves || []).some(w => w.spawn.some(g => g.tag === 'boss' || g.boss))) {
    at('boss objective but no group tagged "boss"');
  }

  if (e.terrain && !TERRAIN_STYLES[e.terrain.style || 'rock']) {
    at(`unknown terrain style "${e.terrain.style}"`);
  }

  return errs;
}

/** Validate everything. Returns { ok, errors, count }. */
export function validateAll() {
  const errors = [];
  const seen = new Set();
  for (const e of ALL_ENCOUNTERS) {
    if (seen.has(e.id)) errors.push(`duplicate encounter id "${e.id}"`);
    seen.add(e.id);
    errors.push(...validateEncounter(e));
  }
  return { ok: errors.length === 0, errors, count: ALL_ENCOUNTERS.length };
}

/** Coverage report — used by the tests to catch threat bands with no content. */
export function coverage() {
  const rows = [];
  for (let t = 1; t <= 20; t++) {
    const byType = {};
    for (const type of Object.keys(ENCOUNTER_TYPES)) {
      byType[type] = candidatesFor(t, type).length;
    }
    rows.push({ threat: t, total: candidatesFor(t).length, byType });
  }
  return rows;
}
