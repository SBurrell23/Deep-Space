/**
 * The universe map.
 *
 * A radial spiderweb: nodes are laid out in concentric rings around the origin,
 * linked outward (ring to ring), sideways (around a ring), and occasionally by
 * long warp lanes that skip a ring entirely. Threat rises with distance from
 * the origin, so "how far out do I dare go" is the run's central decision.
 *
 * Fog of war hides everything more than a few jumps from somewhere you have
 * been. The Master Fleet sits at the rim and becomes visible from a long way
 * off once you are deep enough — a fixed point on the horizon to steer by.
 */

import { pickEncounter, ENCOUNTER_TYPES } from './encounters/index.js';

export const RINGS = 12;
export const MAX_THREAT = 20;

/** Node lifecycle. `seen` means "revealed by fog, not yet visited". */
export const NODE_STATE = { UNKNOWN: 'unknown', SEEN: 'seen', VISITED: 'visited', CLEARED: 'cleared' };

/**
 * Type mix by ring depth. Early rings are gentler and denser in shops; the rim
 * is mostly teeth. Weights are relative within each band.
 */
const TYPE_MIX = [
  // Hostiles is one named ship; a debris field is where the small ones went.
  // The two are now genuinely different fights rather than two names for a
  // crowd, so the rocks carry a much larger share than they used to — forty
  // of the old crowd encounters live there, and a run that never saw one
  // would be missing most of the game's written content.
  // ring 0-2
  { hostiles: 34, asteroid: 20, tunnel: 11, derelict: 7, anomaly: 16, shop: 10, empty: 8, survival: 5, elite: 0, boss: 0 },
  // ring 3-5
  { hostiles: 34, asteroid: 19, tunnel: 11, derelict: 8, anomaly: 14, shop: 8, empty: 5, survival: 6, elite: 5, boss: 3 },
  // ring 6-8
  { hostiles: 32, asteroid: 17, tunnel: 11, derelict: 8, anomaly: 12, shop: 7, empty: 3, survival: 7, elite: 9, boss: 6 },
  // ring 9-11
  { hostiles: 30, asteroid: 14, tunnel: 10, derelict: 7, anomaly: 10, shop: 6, empty: 2, survival: 7, elite: 13, boss: 10 },
];

function mixForRing(ring) {
  return TYPE_MIX[Math.min(TYPE_MIX.length - 1, Math.floor(ring / 3))];
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function generateUniverse(rng, opts = {}) {
  const rings = opts.rings ?? RINGS;
  const nodes = [];
  let nextId = 0;

  // Origin.
  nodes.push(makeNode(nextId++, 0, 0, 0, 0, rng));

  // Rings outward. Node count grows so the rim is wide and the core is tight.
  const ringIndex = [[0]];
  for (let r = 1; r < rings; r++) {
    const count = Math.round(5 + r * 2.1);
    const ids = [];
    const angleOffset = rng.float(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      // Jitter the angle and radius so the web looks grown, not drafted.
      const angle = angleOffset + (i / count) * Math.PI * 2 + rng.float(-0.055, 0.055);
      const radius = r + rng.float(-0.16, 0.16);
      const id = nextId++;
      nodes.push(makeNode(id, r, angle, Math.cos(angle) * radius, Math.sin(angle) * radius, rng));
      ids.push(id);
    }
    ringIndex.push(ids);
  }

  // --- links ---
  const link = (a, b) => {
    if (a === b) return;
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
  };

  for (let r = 0; r < rings - 1; r++) {
    const inner = ringIndex[r], outer = ringIndex[r + 1];
    // Every inner node reaches outward, so the web is always traversable.
    for (const a of inner) {
      const targets = nearestByAngle(nodes, a, outer, rng.int(1, 3));
      for (const b of targets) link(a, b);
    }
    // Every outer node needs at least one way back in, or the rim strands you.
    for (const b of outer) {
      if (!nodes[b].links.some(l => nodes[l].ring === r)) {
        const [a] = nearestByAngle(nodes, b, inner, 1);
        if (a != null) link(a, b);
      }
    }
  }

  // Circumferential links — these are what make it a web rather than a tree.
  for (let r = 1; r < rings; r++) {
    const ids = ringIndex[r];
    for (let i = 0; i < ids.length; i++) {
      if (rng.chance(0.62)) link(ids[i], ids[(i + 1) % ids.length]);
    }
  }

  // Long warp lanes: rare shortcuts that skip two rings. High risk, high reward.
  const laneCount = Math.round(rings * 0.9);
  for (let i = 0; i < laneCount; i++) {
    const r = rng.int(1, rings - 4);
    const from = rng.pick(ringIndex[r]);
    const to = rng.pick(ringIndex[r + 3]);
    if (from != null && to != null) {
      link(from, to);
      nodes[from].lanes = (nodes[from].lanes || []).concat(to);
      nodes[to].lanes = (nodes[to].lanes || []).concat(from);
    }
  }

  // --- content ---
  const recent = [];
  for (const n of nodes) {
    n.threat = threatForRing(n.ring, rings, rng);
    n.type = n.id === 0 ? 'empty' : pickType(rng, n.ring);
    const enc = pickEncounter(rng, n.threat, n.type, recent);
    n.encounterId = enc?.id || null;
    n.blurb = enc?.blurb || '';
    n.encounterName = enc?.name || ENCOUNTER_TYPES[n.type]?.label || '';
    recent.push(n.encounterId);
    if (recent.length > 6) recent.shift();
  }

  // --- the Master Fleet ---
  const rim = ringIndex[rings - 1];
  const masterFleetId = rng.pick(rim);
  const mf = nodes[masterFleetId];
  mf.type = 'masterfleet';
  mf.threat = MAX_THREAT;
  mf.encounterId = 'masterfleet_1';
  mf.encounterName = 'The Master Fleet';
  mf.blurb = 'Every ship that has been hunting you, in one place.';
  mf.isMasterFleet = true;

  const map = {
    seed: rng.seed,
    rings,
    nodes,
    ringIndex,
    currentId: 0,
    masterFleetId,
    masterFleetVisible: false,
    masterFleetDefeated: false,
    jumps: 0,
  };

  nodes[0].state = NODE_STATE.VISITED;
  nodes[0].cleared = true;
  nodes[0].state = NODE_STATE.CLEARED;

  return map;
}

function makeNode(id, ring, angle, x, y, rng) {
  return {
    id, ring, angle, x, y,
    threat: 1,
    type: 'empty',
    encounterId: null,
    encounterName: '',
    blurb: '',
    state: NODE_STATE.UNKNOWN,
    cleared: false,
    links: [],
    // Cosmetic prop for the encounter backdrop, chosen once so a node looks
    // the same every time you look at it.
    prop: rng.pick(['bg_planet_rocky', 'bg_planet_gas', 'bg_planet_ice', 'bg_planet_lava', 'bg_station', 'bg_wreck', null, null, null]),
  };
}

function threatForRing(ring, rings, rng) {
  const base = 1 + Math.pow(ring / (rings - 1), 1.28) * (MAX_THREAT - 1);
  // Variance means a ring is a band, not a wall — you can find a soft node out
  // deep, or get bitten by a hard one close in.
  const jitter = rng.int(-1, 1) + (rng.chance(0.12) ? rng.int(1, 2) : 0);
  // The first two rings are the tutorial in all but name.
  if (ring <= 1) return clamp(Math.round(base + Math.max(0, jitter)), 1, 2);
  if (ring === 2) return clamp(Math.round(base + jitter), 2, 4);
  return clamp(Math.round(base + jitter), 1, MAX_THREAT);
}

function pickType(rng, ring) {
  const mix = mixForRing(ring);
  const entries = Object.entries(mix).filter(([, w]) => w > 0).map(([type, weight]) => ({ type, weight }));
  return rng.weighted(entries, 'weight').type;
}

function nearestByAngle(nodes, fromId, candidateIds, count) {
  const from = nodes[fromId];
  const scored = candidateIds.map(id => ({ id, d: angleDelta(from.angle, nodes[id].angle) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, Math.max(1, count)).map(s => s.id);
}

function angleDelta(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

/**
 * Reveal outward from a node. Nodes within `radius` jumps become `seen` unless
 * already visited. Returns how many were newly revealed.
 *
 * `opts.limit` caps how many nodes a single reveal may uncover. The web is
 * dense enough that hop count alone is a terrible unit of generosity — at
 * radius six a survey bonus was handing over most of the universe — so charted
 * bonuses spend a node budget, breadth-first, and stop when it runs out.
 */
export function revealFrom(map, nodeId, radius, opts = {}) {
  const limit = opts.limit ?? Infinity;
  let revealed = 0;
  const seen = new Set([nodeId]);
  let frontier = [nodeId];

  for (let step = 0; step < radius; step++) {
    const next = [];
    for (const id of frontier) {
      for (const l of map.nodes[id].links) {
        if (seen.has(l)) continue;
        seen.add(l);
        next.push(l);
        const n = map.nodes[l];
        if (n.state === NODE_STATE.UNKNOWN) {
          if (revealed >= limit) return revealed;
          n.state = NODE_STATE.SEEN;
          revealed++;
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return revealed;
}

/** Scan radius: base 2, plus gear and the Farsight perk. */
export function scanRadius(ship) {
  const gear = Math.round(ship?.stats?.scan || 0);
  const perk = ship?.stats?.scanBonus || 0;
  return clamp(2 + gear + perk, 2, 5);
}

/**
 * The Master Fleet becomes a visible landmark once you are deep enough — it is
 * meant to loom on the horizon long before you can fight it.
 */
export function updateMasterFleetVisibility(map, ship) {
  if (map.masterFleetVisible) return false;
  const here = map.nodes[map.currentId];
  const deepEnough = here.ring >= Math.floor(map.rings * 0.55);
  const strongEnough = (ship?.progress?.level || 1) >= 12;
  if (deepEnough || strongEnough) {
    map.masterFleetVisible = true;
    const mf = map.nodes[map.masterFleetId];
    if (mf.state === NODE_STATE.UNKNOWN) mf.state = NODE_STATE.SEEN;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

export function nodeById(map, id) { return map.nodes[id] || null; }
export function currentNode(map) { return map.nodes[map.currentId]; }

/** Nodes you can jump to from here: linked, and not hidden by fog. */
export function reachable(map) {
  const here = currentNode(map);
  return here.links
    .map(id => map.nodes[id])
    .filter(n => n.state !== NODE_STATE.UNKNOWN);
}

export function canJumpTo(map, id) {
  return reachable(map).some(n => n.id === id);
}

/**
 * Everywhere the player may move to in one action: adjacent nodes, plus
 * anything on the far side of a corridor of already-cleared space. This is what
 * the map highlights, so the yellow means "you can go there" rather than "this
 * happens to touch you".
 */
export function travelable(map) {
  const out = new Map();
  const seen = new Set([map.currentId]);
  const queue = [map.currentId];

  while (queue.length) {
    const at = queue.shift();
    for (const next of map.nodes[at].links) {
      if (seen.has(next)) continue;
      seen.add(next);
      const node = map.nodes[next];
      if (node.state === NODE_STATE.UNKNOWN) continue;
      out.set(next, node);
      // Only cleared space may be crossed; an uncleared node is a destination.
      if (node.cleared) queue.push(next);
    }
  }
  out.delete(map.currentId);
  return [...out.values()];
}

export function canTravelTo(map, id) {
  return id !== map.currentId && travelable(map).some(n => n.id === id);
}

/**
 * Shortest route to `id` that only PASSES THROUGH cleared nodes.
 *
 * Cleared nodes hold nothing, so walking back across explored space one beacon
 * at a time is busywork. This finds a route the player has already earned and
 * lets the map offer it as a single move. The destination itself need not be
 * cleared — it is the one node the route may end on.
 *
 * Returns the node ids to travel in order (excluding the current node), or
 * null if no such route exists.
 */
export function routeThroughCleared(map, id) {
  if (id === map.currentId) return null;
  if (canJumpTo(map, id)) return null;      // adjacent; a plain jump covers it

  const prev = new Map([[map.currentId, null]]);
  const queue = [map.currentId];

  while (queue.length) {
    const at = queue.shift();
    for (const next of map.nodes[at].links) {
      if (prev.has(next)) continue;
      const node = map.nodes[next];
      if (node.state === NODE_STATE.UNKNOWN) continue;
      prev.set(next, at);
      if (next === id) {
        const path = [];
        for (let cur = id; cur != null && cur !== map.currentId; cur = prev.get(cur)) path.unshift(cur);
        return path.length ? path : null;
      }
      // You may only continue onward through space you have already cleared.
      if (node.cleared) queue.push(next);
    }
  }
  return null;
}

/** Move. The caller is responsible for running the destination's encounter. */
export function jumpTo(map, id, ship) {
  if (!canJumpTo(map, id)) return false;
  map.currentId = id;
  map.jumps++;
  const n = map.nodes[id];
  if (n.state === NODE_STATE.SEEN || n.state === NODE_STATE.UNKNOWN) n.state = NODE_STATE.VISITED;
  revealFrom(map, id, scanRadius(ship));
  updateMasterFleetVisibility(map, ship);
  return true;
}

/** Mark the current node resolved. Cleared nodes pay out only once. */
export function markCleared(map, id = map.currentId) {
  const n = map.nodes[id];
  if (!n) return false;
  const wasFresh = !n.cleared;
  n.cleared = true;
  n.state = NODE_STATE.CLEARED;
  return wasFresh;
}

/** Has this node already paid out? Revisits are travel only. */
export function isCleared(map, id) { return !!map.nodes[id]?.cleared; }

// ---------------------------------------------------------------------------
// Queries for the UI
// ---------------------------------------------------------------------------

/** Straight-line distance from the origin, for the "depth" readout. */
export function depthOf(map, id = map.currentId) {
  const n = map.nodes[id];
  return n ? Math.hypot(n.x, n.y) : 0;
}

export function stats(map) {
  let visited = 0, cleared = 0, seen = 0;
  for (const n of map.nodes) {
    if (n.cleared) cleared++;
    if (n.state === NODE_STATE.VISITED || n.state === NODE_STATE.CLEARED) visited++;
    if (n.state === NODE_STATE.SEEN) seen++;
  }
  return { total: map.nodes.length, visited, cleared, seen, jumps: map.jumps };
}

/**
 * Bearing from the current node to the Master Fleet, so the map can draw a
 * compass needle once it is visible.
 */
export function bearingToMasterFleet(map) {
  const here = currentNode(map);
  const mf = map.nodes[map.masterFleetId];
  if (!here || !mf) return null;
  return {
    angle: Math.atan2(mf.y - here.y, mf.x - here.x),
    distance: Math.hypot(mf.x - here.x, mf.y - here.y),
    rings: mf.ring - here.ring,
  };
}

/** Serialise: node state is small, so the whole map round-trips into a save. */
export function serialize(map) {
  return {
    seed: map.seed,
    rings: map.rings,
    currentId: map.currentId,
    masterFleetId: map.masterFleetId,
    masterFleetVisible: map.masterFleetVisible,
    masterFleetDefeated: map.masterFleetDefeated,
    jumps: map.jumps,
    // Only the mutable per-node bits; the rest regenerates from the seed.
    nodeState: map.nodes.map(n => (n.cleared ? 2 : n.state === 'visited' ? 1 : n.state === 'seen' ? 0 : -1)),
  };
}

export function deserialize(data, rng) {
  const map = generateUniverse(rng, { rings: data.rings });
  map.currentId = data.currentId;
  map.masterFleetVisible = data.masterFleetVisible;
  map.masterFleetDefeated = data.masterFleetDefeated;
  map.jumps = data.jumps || 0;
  (data.nodeState || []).forEach((s, i) => {
    const n = map.nodes[i];
    if (!n) return;
    if (s === 2) { n.cleared = true; n.state = NODE_STATE.CLEARED; }
    else if (s === 1) n.state = NODE_STATE.VISITED;
    else if (s === 0) n.state = NODE_STATE.SEEN;
    else n.state = NODE_STATE.UNKNOWN;
  });
  return map;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
