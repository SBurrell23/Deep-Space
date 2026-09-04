/**
 * Procedural generation: the sector tree you travel through, and the beacon
 * map inside each sector.
 *
 * Beacons are laid out on a jittered grid and connected with a spanning tree
 * plus extra local edges, which reliably produces a map that is fully
 * traversable but still forces route choices. The exit always sits on the
 * right; the pursuing fleet always advances from the left.
 */

export const SECTOR_TYPES = {
  civilian: {
    id: 'civilian', name: 'Civilian Sector', color: '#4fe3f5', danger: 0.7,
    storeChance: 0.32, blurb: 'Trade lanes and settled worlds. Comparatively safe.',
  },
  hostile: {
    id: 'hostile', name: 'Hostile Sector', color: '#ff5c72', danger: 1.25,
    storeChance: 0.22, blurb: 'Contested space. Expect to fight for every beacon.',
  },
  nebula: {
    id: 'nebula', name: 'Nebula Sector', color: '#c07ef5', danger: 1.0, nebula: true,
    storeChance: 0.18, blurb: 'Sensors are useless in here — and so is the fleet’s.',
  },
  pirate: {
    id: 'pirate', name: 'Pirate Territory', color: '#d98c1f', danger: 1.2,
    storeChance: 0.28, blurb: 'Raiders, ambushes, and the occasional honest fence.',
  },
  engi: {
    id: 'engi', name: 'Engi Homeworlds', color: '#5cf59b', danger: 0.85,
    storeChance: 0.4, blurb: 'Drone parts are plentiful and the repairs are cheap.',
  },
  mantis: {
    id: 'mantis', name: 'Mantis Territory', color: '#22b35c', danger: 1.35,
    storeChance: 0.2, blurb: 'They board first and negotiate never.',
  },
  rock: {
    id: 'rock', name: 'Rock Controlled', color: '#d98c1f', danger: 1.15,
    storeChance: 0.26, blurb: 'Heavy hulls and heavier missiles.',
  },
  zoltan: {
    id: 'zoltan', name: 'Zoltan Space', color: '#ffcc5c', danger: 0.95,
    storeChance: 0.35, blurb: 'Orderly, well-lit, and shielded to the teeth.',
  },
  slug: {
    id: 'slug', name: 'Slug Nebula', color: '#7b3fb3', danger: 1.1, nebula: true,
    storeChance: 0.22, blurb: 'Something in the fog already knows you are coming.',
  },
  abandoned: {
    id: 'abandoned', name: 'Abandoned Sector', color: '#8494b8', danger: 1.3,
    storeChance: 0.15, blurb: 'Whatever emptied this place did a thorough job.',
  },
  uncharted: {
    id: 'uncharted', name: 'Uncharted Space', color: '#e8f0ff', danger: 1.4,
    storeChance: 0.3, blurb: 'No charts, no rescue, no idea what is out here.',
  },
};

export const SECTOR_TYPE_IDS = Object.keys(SECTOR_TYPES);

export const BEACON_TYPES = {
  empty: { id: 'empty', name: 'Empty Beacon', icon: 'icon_star' },
  hostile: { id: 'hostile', name: 'Hostile Contact', icon: 'icon_skull' },
  store: { id: 'store', name: 'Trading Post', icon: 'icon_shop' },
  distress: { id: 'distress', name: 'Distress Beacon', icon: 'icon_distress' },
  hazard: { id: 'hazard', name: 'Environmental Hazard', icon: 'icon_hazard' },
  repair: { id: 'repair', name: 'Repair Station', icon: 'icon_repair' },
  exit: { id: 'exit', name: 'Sector Exit', icon: 'icon_exit' },
  unknown: { id: 'unknown', name: 'Uncharted', icon: 'icon_warning' },
};

export const TOTAL_SECTORS = 8;

// ---------------------------------------------------------------------------
// The sector tree
// ---------------------------------------------------------------------------

/**
 * Build the branching map of sectors. Column 0 holds the single starting
 * sector; the final column holds the Swarm's home, where the flagship waits.
 */
export function generateSectorTree(rng) {
  const columns = [];
  for (let depth = 0; depth < TOTAL_SECTORS; depth++) {
    const count = depth === 0 || depth === TOTAL_SECTORS - 1 ? 1 : rng.int(2, 3);
    const col = [];
    for (let i = 0; i < count; i++) {
      col.push({
        id: `s${depth}_${i}`,
        depth, index: i,
        type: pickSectorType(rng, depth),
        visited: false,
      });
    }
    columns.push(col);
  }
  // Final sector is always the Swarm's home ground.
  const last = columns[TOTAL_SECTORS - 1][0];
  last.type = 'uncharted';
  last.isFinal = true;
  last.name = 'The Last Stand';

  // Link each sector forward to one or two sectors in the next column.
  for (let d = 0; d < columns.length - 1; d++) {
    const next = columns[d + 1];
    for (const s of columns[d]) {
      const n = Math.min(next.length, rng.int(1, 2));
      s.links = rng.sample(next.map(x => x.id), n);
    }
    // Guarantee every sector in the next column is reachable.
    for (const target of next) {
      if (!columns[d].some(s => s.links.includes(target.id))) {
        rng.pick(columns[d]).links.push(target.id);
      }
    }
  }
  columns[columns.length - 1][0].links = [];

  const all = columns.flat();
  return { columns, sectors: Object.fromEntries(all.map(s => [s.id, s])), startId: columns[0][0].id };
}

function pickSectorType(rng, depth) {
  if (depth === 0) return 'civilian';
  const pool = SECTOR_TYPE_IDS
    .filter(id => id !== 'uncharted' || depth >= 4)
    .map(id => {
      const t = SECTOR_TYPES[id];
      // Danger rises with depth: mild sectors thin out, harsh ones thicken.
      const fit = 1 - Math.abs(t.danger - (0.75 + depth * 0.08)) * 1.3;
      return { id, weight: Math.max(0.15, fit) };
    });
  return rng.weighted(pool).id;
}

// ---------------------------------------------------------------------------
// The beacon map inside a sector
// ---------------------------------------------------------------------------

const MAP_COLS = 6;
const MAP_ROWS = 4;

/**
 * Lay out one sector's beacons.
 * @param rng     seeded generator
 * @param sector  { depth, type } from the sector tree
 */
export function generateSectorMap(rng, sector) {
  const type = SECTOR_TYPES[sector.type] || SECTOR_TYPES.civilian;
  const beaconCount = rng.int(15, 20);

  // Scatter beacons across a jittered grid so they never overlap.
  const cells = [];
  for (let c = 0; c < MAP_COLS; c++) {
    for (let r = 0; r < MAP_ROWS; r++) cells.push({ c, r });
  }
  const chosen = rng.sample(cells, Math.min(beaconCount, cells.length));

  // Always include a cell in the first and last column so start/exit exist.
  ensureColumn(rng, chosen, cells, 0);
  ensureColumn(rng, chosen, cells, MAP_COLS - 1);

  const beacons = chosen.map((cell, i) => ({
    id: i,
    col: cell.c, row: cell.r,
    x: (cell.c + 0.5) / MAP_COLS + rng.float(-0.045, 0.045),
    y: (cell.r + 0.5) / MAP_ROWS + rng.float(-0.06, 0.06),
    links: [],
    type: 'unknown',
    visited: false, explored: false,
    fleet: false,
    event: null,
    store: null,
  }));

  connectBeacons(rng, beacons);

  // Start on the leftmost beacon, exit on the rightmost.
  const start = beacons.reduce((a, b) => (b.x < a.x ? b : a));
  const exit = beacons.reduce((a, b) => (b.x > a.x ? b : a));
  start.type = 'empty';
  start.visited = true;
  start.explored = true;
  exit.type = 'exit';
  exit.isExit = true;

  assignBeaconTypes(rng, beacons, type, sector.depth, start, exit);

  return {
    sectorId: sector.id,
    sectorType: sector.type,
    depth: sector.depth,
    nebula: !!type.nebula,
    beacons,
    startId: start.id,
    exitId: exit.id,
    currentId: start.id,
    fleetColumn: -2.6,
    jumpsMade: 0,
  };
}

function ensureColumn(rng, chosen, cells, col) {
  if (chosen.some(c => c.c === col)) return;
  const candidates = cells.filter(c => c.c === col && !chosen.includes(c));
  if (candidates.length) chosen.push(rng.pick(candidates));
}

/**
 * Connect the beacons: a nearest-neighbour spanning tree guarantees the map is
 * fully traversable, then a few short extra edges create real route choices.
 */
function connectBeacons(rng, beacons) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const link = (a, b) => {
    if (a.id === b.id) return;
    if (!a.links.includes(b.id)) a.links.push(b.id);
    if (!b.links.includes(a.id)) b.links.push(a.id);
  };

  // Spanning tree, growing from the leftmost beacon.
  const connected = [beacons.reduce((a, b) => (b.x < a.x ? b : a))];
  const remaining = beacons.filter(b => b !== connected[0]);
  while (remaining.length) {
    let best = null, bestD = Infinity, bestFrom = null;
    for (const r of remaining) {
      for (const c of connected) {
        const d = dist(r, c);
        if (d < bestD) { bestD = d; best = r; bestFrom = c; }
      }
    }
    link(best, bestFrom);
    connected.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }

  // Extra edges between near neighbours, biased left-to-right.
  for (const a of beacons) {
    const near = beacons
      .filter(b => b !== a && !a.links.includes(b.id))
      .sort((p, q) => dist(a, p) - dist(a, q))
      .slice(0, 3);
    for (const b of near) {
      if (a.links.length >= 4 || b.links.length >= 4) continue;
      if (dist(a, b) > 0.34) continue;
      if (rng.chance(0.42)) link(a, b);
    }
  }
}

function assignBeaconTypes(rng, beacons, type, depth, start, exit) {
  const pool = beacons.filter(b => b !== start && b !== exit);

  // A sector always offers at least one store when it can.
  const storeCount = rng.chance(type.storeChance + 0.35) ? rng.int(1, 2) : 1;
  const stores = rng.sample(pool, Math.min(storeCount, pool.length));
  for (const b of stores) b.type = 'store';

  const rest = pool.filter(b => b.type === 'unknown');
  const table = [
    { id: 'hostile', weight: 4.2 * type.danger },
    { id: 'empty', weight: 2.4 },
    { id: 'distress', weight: 1.9 },
    { id: 'hazard', weight: 1.5 * type.danger },
    { id: 'repair', weight: 0.9 },
  ];
  for (const b of rest) b.type = rng.weighted(table).id;

  void depth;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function beaconById(map, id) { return map.beacons.find(b => b.id === id) || null; }

export function canJumpTo(map, id) {
  const cur = beaconById(map, map.currentId);
  return !!cur && cur.links.includes(id);
}

export function reachableBeacons(map) {
  const cur = beaconById(map, map.currentId);
  return cur ? cur.links.map(id => beaconById(map, id)).filter(Boolean) : [];
}

/**
 * Move to a beacon. Returns the beacon, or null if it isn't adjacent.
 * The pursuing fleet advances one step with every jump.
 */
export function jumpTo(map, id) {
  if (!canJumpTo(map, id)) return null;
  const b = beaconById(map, id);
  map.currentId = id;
  map.jumpsMade++;
  b.visited = true;
  b.explored = true;
  advanceFleet(map);
  return b;
}

/**
 * The Swarm fleet sweeps left to right. Beacons it reaches become far more
 * dangerous, which is the clock that stops you exploring a sector forever.
 */
export function advanceFleet(map, amount = 1) {
  // Roughly one column per two and a half jumps: enough pressure that you
  // cannot sweep a whole sector, loose enough that a careful route across it
  // stays ahead of the front.
  map.fleetColumn += amount * 0.4;
  for (const b of map.beacons) {
    b.fleet = b.col <= map.fleetColumn;
  }
  return map.fleetColumn;
}

export function isBeaconOverrun(map, id) {
  const b = beaconById(map, id);
  return !!b && b.fleet;
}

/** True when the fleet has reached the beacon the player is sitting on. */
export function playerOverrun(map) {
  return isBeaconOverrun(map, map.currentId);
}

export function atExit(map) { return map.currentId === map.exitId; }

/** Reveal every beacon's type — Long-Range Scanners, or a map bought at a store. */
export function revealMap(map) {
  for (const b of map.beacons) b.explored = true;
}

/** Shortest hop count between two beacons, or Infinity. Used for map hints. */
export function hopsBetween(map, fromId, toId) {
  if (fromId === toId) return 0;
  const seen = new Set([fromId]);
  let frontier = [fromId], hops = 0;
  while (frontier.length) {
    hops++;
    const next = [];
    for (const id of frontier) {
      for (const link of beaconById(map, id).links) {
        if (seen.has(link)) continue;
        if (link === toId) return hops;
        seen.add(link);
        next.push(link);
      }
    }
    frontier = next;
  }
  return Infinity;
}
