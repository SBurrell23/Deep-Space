/**
 * Ship layouts.
 *
 * Each deck plan is authored as an ASCII grid, one character per floor tile.
 * A letter marks which room owns that tile; `.` is empty space outside the
 * hull. Rooms are derived as the bounding box of their letter and validated to
 * be solid rectangles, so a typo in a deck plan fails loudly in the test suite
 * rather than producing an unreachable room at runtime.
 *
 * Doors are derived from adjacency: any two different rooms sharing a tile edge
 * get a door between them. `airlocks` lists rooms that also open onto vacuum,
 * which is what makes venting a compartment possible.
 */

import { SYSTEMS } from './systems.js';

// ---------------------------------------------------------------------------
// Layout compilation
// ---------------------------------------------------------------------------

/**
 * Turn an ASCII deck plan into rooms, tiles and doors.
 * Throws on malformed art: ragged rows, non-rectangular rooms, unmapped
 * letters, disconnected compartments, or a room sized wrong for its system.
 */
export function buildLayout(def) {
  const { grid, map, airlocks = [], id } = def;
  const where = `layout "${id}"`;

  if (!Array.isArray(grid) || grid.length === 0) throw new Error(`${where}: empty grid`);
  const width = grid[0].length;
  grid.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`${where}: row ${y} is ${row.length} wide, expected ${width}`);
    }
  });
  const height = grid.length;

  // Collect the tiles belonging to each letter.
  const byChar = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x];
      if (ch === '.') continue;
      if (!byChar.has(ch)) byChar.set(ch, []);
      byChar.get(ch).push({ x, y });
    }
  }
  if (byChar.size === 0) throw new Error(`${where}: no rooms`);

  const rooms = [];
  const tileOwner = new Map(); // "x,y" -> room index

  for (const [ch, tiles] of byChar) {
    if (!(ch in map)) throw new Error(`${where}: character "${ch}" has no entry in map`);
    const xs = tiles.map(t => t.x), ys = tiles.map(t => t.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w * h !== tiles.length) {
      throw new Error(`${where}: room "${ch}" is not a solid rectangle (${tiles.length} tiles in a ${w}x${h} box)`);
    }

    const system = map[ch] === 'empty' ? null : map[ch];
    if (system && !SYSTEMS[system]) throw new Error(`${where}: room "${ch}" names unknown system "${system}"`);
    if (system && SYSTEMS[system].roomSize > w * h) {
      throw new Error(`${where}: ${system} needs ${SYSTEMS[system].roomSize} tiles, room "${ch}" has ${w * h}`);
    }

    const index = rooms.length;
    rooms.push({
      id: index, char: ch, system,
      x: x0, y: y0, w, h,
      tiles: tiles.map(t => ({ x: t.x - x0, y: t.y - y0 })),
      capacity: w * h,
      airlock: airlocks.includes(ch),
    });
    for (const t of tiles) tileOwner.set(`${t.x},${t.y}`, index);
  }

  // Doors between rooms that share a tile edge.
  const doors = [];
  const seen = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = tileOwner.get(`${x},${y}`);
      if (a === undefined) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const b = tileOwner.get(`${x + dx},${y + dy}`);
        if (b === undefined || b === a) continue;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        doors.push({
          id: doors.length, a: Math.min(a, b), b: Math.max(a, b),
          x: x + dx * 0.5, y: y + dy * 0.5,
          vertical: dx === 1,
          open: false, hp: 1, breached: false,
        });
      }
    }
  }

  // Airlock doors — one per flagged room, opening onto vacuum (b === null).
  for (const room of rooms) {
    if (!room.airlock) continue;
    doors.push({
      id: doors.length, a: room.id, b: null,
      x: room.x + room.w / 2, y: room.y - 0.5,
      vertical: false, open: false, hp: 1, breached: false, isAirlock: true,
    });
  }

  assertConnected(rooms, doors, where);

  return { id, width, height, rooms, doors, tileOwner };
}

/** Every room must be walkable from room 0, or crew could get stranded. */
function assertConnected(rooms, doors, where) {
  const adj = new Map(rooms.map(r => [r.id, []]));
  for (const d of doors) {
    if (d.b === null) continue;
    adj.get(d.a).push(d.b);
    adj.get(d.b).push(d.a);
  }
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const n of adj.get(queue.shift())) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  if (seen.size !== rooms.length) {
    const stranded = rooms.filter(r => !seen.has(r.id)).map(r => r.char);
    throw new Error(`${where}: rooms [${stranded.join(', ')}] are cut off from the rest of the ship`);
  }
}

// ---------------------------------------------------------------------------
// The fleet
// ---------------------------------------------------------------------------

/**
 * `unlockedBy` names the ship whose victory unlocks this hull. Layout B of any
 * hull unlocks by winning with that hull's layout A.
 */
export const SHIPS = {
  // 1 ------------------------------------------------------------------ 1 --
  kestrel: {
    id: 'kestrel', name: 'Kestrel', sprite: 'ship_ext_kestrel', order: 1,
    unlockedBy: null,
    blurb: 'A Federation light cruiser, decommissioned and handed to you with a full tank and no instructions.',
    layouts: {
      A: {
        id: 'kestrel_A', name: 'The Kestrel', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'Balanced, forgiving, and the only ship you start with. Two solid weapons and room to grow.',
        grid: [
          '....gg..mm....',
          '....gg..mm....',
          'eehhsssswwppcc',
          'eehhsssswwppcc',
          '....ff..oo....',
          '....ff..oo....',
        ],
        map: {
          e: 'engines', h: 'empty', s: 'shields', w: 'weapons', p: 'piloting', c: 'empty',
          g: 'oxygen', m: 'medbay', f: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'c', 'f', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1 },
        weapons: ['laser_burst2', 'missile_artemis'],
        drones: [], augments: [],
        crew: ['human', 'human', 'human'],
        resources: { scrap: 30, fuel: 16, missiles: 8, droneParts: 0 },
      },
      B: {
        id: 'kestrel_B', name: 'Red-Tail', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'Four hardpoints from the first jump, but only one bar of shielding and a very thin power budget.',
        grid: [
          '....gg..mm....',
          '....gg..mm....',
          'eehhsssswwppcc',
          'eehhsssswwppcc',
          '....ff..oo....',
          '....ff..oo....',
        ],
        map: {
          e: 'engines', h: 'empty', s: 'shields', w: 'weapons', p: 'piloting', c: 'empty',
          g: 'oxygen', m: 'medbay', f: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'c', 'f', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 4, medbay: 1, piloting: 1, doors: 1, sensors: 1 },
        weapons: ['laser_basic', 'laser_basic', 'laser_basic', 'laser_basic'],
        drones: [], augments: [],
        crew: ['human', 'human', 'human', 'engi'],
        resources: { scrap: 20, fuel: 14, missiles: 4, droneParts: 0 },
      },
    },
  },

  // 2 ------------------------------------------------------------------ 2 --
  torus: {
    id: 'torus', name: 'Torus', sprite: 'ship_ext_torus', order: 2,
    unlockedBy: 'kestrel',
    blurb: 'A ring-hulled hauler that spent forty years moving ore and now moves you.',
    layouts: {
      A: {
        id: 'torus_A', name: 'Ore Runner', hull: 34, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 3,
        desc: 'Heavy plating and an ion loadout. Slow to kill anything, very hard to kill.',
        grid: [
          '..ggmmoo..',
          '..ggmmoo..',
          'eesswwddjj',
          'eesswwddjj',
          '..hhppff..',
          '..hhppff..',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', d: 'drones', j: 'empty',
          g: 'oxygen', m: 'medbay', o: 'empty', h: 'doors', p: 'piloting', f: 'sensors',
        },
        airlocks: ['e', 'j', 'h', 'f'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 2, sensors: 1, drones: 2 },
        weapons: ['ion_blast', 'laser_basic'],
        drones: ['defense_1'], augments: ['rock_plating'],
        crew: ['human', 'human', 'engi'],
        resources: { scrap: 25, fuel: 18, missiles: 3, droneParts: 3 },
      },
      B: {
        id: 'torus_B', name: 'Bulk Carrier', hull: 40, reactor: 9, crewSlots: 8,
        weaponSlots: 3, droneSlots: 3,
        desc: 'Forty hull and a nanoforge knitting it back together mid-fight. Bring patience.',
        grid: [
          '..ggmmoo..',
          '..ggmmoo..',
          'eesswwddjj',
          'eesswwddjj',
          '..hhppff..',
          '..hhppff..',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', d: 'drones', j: 'nanoforge',
          g: 'oxygen', m: 'medbay', o: 'empty', h: 'doors', p: 'piloting', f: 'sensors',
        },
        airlocks: ['e', 'j', 'h', 'f'],
        systems: { shields: 2, engines: 1, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, sensors: 1, nanoforge: 1 },
        weapons: ['laser_heavy1', 'ion_blast'],
        drones: [], augments: ['rock_plating', 'repair_arm'],
        crew: ['rockman', 'human', 'engi'],
        resources: { scrap: 20, fuel: 16, missiles: 2, droneParts: 0 },
      },
    },
  },

  // 3 ------------------------------------------------------------------ 3 --
  mantis: {
    id: 'mantis', name: 'Mantis Raider', sprite: 'ship_ext_mantis', order: 3,
    unlockedBy: 'torus',
    blurb: 'Taken intact from a Mantis war band, still smelling faintly of its last crew.',
    layouts: {
      A: {
        id: 'mantis_A', name: 'Kruos', hull: 25, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'A teleporter and two Mantis. Board them, gut them, and take the ship intact for extra scrap.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eessttwwpp',
          'eessttwwpp',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', t: 'teleporter', w: 'weapons', p: 'piloting',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'p', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, sensors: 1, teleporter: 1 },
        weapons: ['laser_basic', 'bomb_small'],
        drones: [], augments: ['crew_stims'],
        crew: ['mantis', 'mantis', 'human'],
        resources: { scrap: 25, fuel: 16, missiles: 4, droneParts: 0 },
      },
      B: {
        id: 'mantis_B', name: 'Basilisk', hull: 20, reactor: 9, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'A level-2 teleporter, four killers, and twenty hull. Every fight is a boarding action or a loss.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eessttwwpp',
          'eessttwwpp',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', t: 'teleporter', w: 'weapons', p: 'piloting',
          m: 'clonebay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'p', 'h', 'o'],
        systems: { shields: 1, engines: 1, oxygen: 1, weapons: 2, clonebay: 1, piloting: 1, doors: 1, sensors: 1, teleporter: 2 },
        weapons: ['bomb_small', 'ion_blast'],
        drones: [], augments: ['crew_stims', 'o2_masks'],
        crew: ['mantis', 'mantis', 'mantis', 'human'],
        resources: { scrap: 15, fuel: 14, missiles: 4, droneParts: 0 },
      },
    },
  },

  // 4 ------------------------------------------------------------------ 4 --
  engi: {
    id: 'engi', name: 'Engi Cruiser', sprite: 'ship_ext_engi', order: 4,
    unlockedBy: 'mantis',
    blurb: 'Modular, immaculate, and assembled by something that does not sleep.',
    layouts: {
      A: {
        id: 'engi_A', name: 'Torus Array', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 2, droneSlots: 3,
        desc: 'One ion cannon and a drone bay. Let the machines do the shooting.',
        grid: [
          '....mmgg....',
          '....mmgg....',
          'eeddsswwppcc',
          'eeddsswwppcc',
          '....hhoo....',
          '....hhoo....',
        ],
        map: {
          e: 'engines', d: 'drones', s: 'shields', w: 'weapons', p: 'piloting', c: 'empty',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'c', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, sensors: 2, drones: 3 },
        weapons: ['ion_blast'],
        drones: ['combat_1', 'repair_1'], augments: ['drone_recovery'],
        crew: ['engi', 'engi', 'human'],
        resources: { scrap: 30, fuel: 16, missiles: 0, droneParts: 8 },
      },
      B: {
        id: 'engi_B', name: 'Vortex', hull: 25, reactor: 10, crewSlots: 8,
        weaponSlots: 3, droneSlots: 3,
        desc: 'A hacking rig and a defense drone. Shut their shields off and walk the damage in.',
        grid: [
          '....mmgg....',
          '....mmgg....',
          'eeddsswwppkk',
          'eeddsswwppkk',
          '....hhoo....',
          '....hhoo....',
        ],
        map: {
          e: 'engines', d: 'drones', s: 'shields', w: 'weapons', p: 'piloting', k: 'hacking',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'k', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, sensors: 1, drones: 2, hacking: 1 },
        weapons: ['laser_heavy1'],
        drones: ['defense_1'], augments: ['hacking_boost'],
        crew: ['engi', 'engi', 'engi'],
        resources: { scrap: 25, fuel: 16, missiles: 0, droneParts: 6 },
      },
    },
  },

  // 5 ------------------------------------------------------------------ 5 --
  zoltan: {
    id: 'zoltan', name: 'Zoltan Ambassador', sprite: 'ship_ext_zoltan', order: 5,
    unlockedBy: 'engi',
    blurb: 'A diplomatic vessel whose crew are, quite literally, the power supply.',
    layouts: {
      A: {
        id: 'zoltan_A', name: 'Adjudicator', hull: 30, reactor: 7, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'Starts every fight behind an energy barrier, and its crew supply power wherever they stand.',
        grid: [
          '..ggmm....',
          '..ggmm....',
          'eesswwppbb',
          'eesswwppbb',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', b: 'battery',
          g: 'oxygen', m: 'medbay', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'b', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1, battery: 1 },
        weapons: ['ion_blast', 'beam_pike'],
        drones: [], augments: ['zoltan_shield'],
        crew: ['zoltan', 'zoltan', 'human'],
        resources: { scrap: 25, fuel: 16, missiles: 3, droneParts: 0 },
      },
      B: {
        id: 'zoltan_B', name: 'Noether', hull: 25, reactor: 6, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'Four Zoltan and almost no reactor. Every bar of power is standing in a room somewhere.',
        grid: [
          '..ggmm....',
          '..ggmm....',
          'eesswwppbb',
          'eesswwppbb',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', b: 'battery',
          g: 'oxygen', m: 'medbay', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'b', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, sensors: 1, battery: 2 },
        weapons: ['beam_mini', 'ion_blast'],
        drones: [], augments: ['zoltan_shield', 'battery_charger'],
        crew: ['zoltan', 'zoltan', 'zoltan', 'zoltan'],
        resources: { scrap: 20, fuel: 16, missiles: 2, droneParts: 0 },
      },
    },
  },

  // 6 ------------------------------------------------------------------ 6 --
  stealth: {
    id: 'stealth', name: 'Stealth Corvette', sprite: 'ship_ext_stealth', order: 6,
    unlockedBy: 'zoltan',
    blurb: 'No shield emitters were fitted. The designers considered them an admission of failure.',
    layouts: {
      A: {
        id: 'stealth_A', name: 'Nisos', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'No shields at all — a cloak, long-range scanners and a glass jaw. Evasion is the only defence.',
        grid: [
          '....ggmm....',
          '....ggmm....',
          'eeccklwwppoo',
          'eeccklwwppoo',
          '....hhnn....',
          '....hhnn....',
        ],
        map: {
          e: 'engines', c: 'cloaking', k: 'empty', l: 'empty', w: 'weapons', p: 'piloting', o: 'oxygen',
          g: 'medbay', m: 'empty', h: 'doors', n: 'sensors',
        },
        airlocks: ['e', 'o', 'h', 'n'],
        systems: { engines: 3, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 2, cloaking: 2 },
        weapons: ['beam_mini', 'laser_burst1'],
        drones: [], augments: ['fleet_sensor'],
        crew: ['human', 'human', 'human'],
        resources: { scrap: 30, fuel: 16, missiles: 4, droneParts: 0 },
      },
      B: {
        id: 'stealth_B', name: 'DA-SR 12', hull: 25, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'A Glaive Beam and a cloak, and nothing else that works. Land the first shot or die.',
        grid: [
          '....ggmm....',
          '....ggmm....',
          'eeccklwwppoo',
          'eeccklwwppoo',
          '....hhnn....',
          '....hhnn....',
        ],
        map: {
          e: 'engines', c: 'cloaking', k: 'empty', l: 'empty', w: 'weapons', p: 'piloting', o: 'oxygen',
          g: 'medbay', m: 'empty', h: 'doors', n: 'sensors',
        },
        airlocks: ['e', 'o', 'h', 'n'],
        systems: { engines: 2, oxygen: 1, weapons: 4, medbay: 1, piloting: 1, doors: 1, sensors: 1, cloaking: 3 },
        weapons: ['beam_glaive'],
        drones: [], augments: ['stealth_weapons'],
        crew: ['human', 'human', 'human'],
        resources: { scrap: 20, fuel: 14, missiles: 2, droneParts: 0 },
      },
    },
  },

  // 7 ------------------------------------------------------------------ 7 --
  rock: {
    id: 'rock', name: 'Rock Bulwark', sprite: 'ship_ext_rock', order: 7,
    unlockedBy: 'stealth',
    blurb: 'Carved rather than built. It does not dodge, and it does not need to.',
    layouts: {
      A: {
        id: 'rock_A', name: 'Bulwark', hull: 35, reactor: 8, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'Thirty-five hull, a fireproof crew, and missiles. Evasion is not part of the plan.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppcc',
          'eesswwppcc',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', c: 'empty',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'c', 'h', 'o'],
        systems: { shields: 2, engines: 1, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1 },
        weapons: ['missile_artemis', 'bomb_fire'],
        drones: [], augments: ['rock_plating'],
        crew: ['rockman', 'rockman', 'rockman'],
        resources: { scrap: 25, fuel: 16, missiles: 12, droneParts: 0 },
      },
      B: {
        id: 'rock_B', name: 'Shivan', hull: 40, reactor: 8, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'Forty hull, one shield layer, and four missile racks. Ammunition is your real hull.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppcc',
          'eesswwppcc',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', c: 'empty',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'c', 'h', 'o'],
        systems: { shields: 2, engines: 1, oxygen: 1, weapons: 4, medbay: 1, piloting: 1, doors: 1, sensors: 1 },
        weapons: ['missile_artemis', 'missile_artemis', 'laser_heavy1'],
        drones: [], augments: ['rock_plating', 'fire_suppression'],
        crew: ['rockman', 'rockman', 'rockman', 'rockman'],
        resources: { scrap: 20, fuel: 16, missiles: 16, droneParts: 0 },
      },
    },
  },

  // 8 ------------------------------------------------------------------ 8 --
  slug: {
    id: 'slug', name: 'Slug Interceptor', sprite: 'ship_ext_slug', order: 8,
    unlockedBy: 'rock',
    blurb: 'Grown, not welded. The corridors are damp and the crew read minds.',
    layouts: {
      A: {
        id: 'slug_A', name: 'Man of War', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'No sensors — the crew see for you. Mind control and an anti-bio beam make crews the target.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppnn',
          'eesswwppnn',
          '..hhcc....',
          '..hhcc....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', n: 'mindcontrol',
          m: 'medbay', g: 'oxygen', h: 'doors', c: 'empty',
        },
        airlocks: ['e', 'n', 'h', 'c'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 2, mindcontrol: 1 },
        weapons: ['beam_anti', 'ion_blast'],
        drones: [], augments: ['slug_gel'],
        crew: ['slug', 'slug', 'human'],
        resources: { scrap: 25, fuel: 16, missiles: 4, droneParts: 0 },
      },
      B: {
        id: 'slug_B', name: 'Stormwalker', hull: 30, reactor: 9, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'A breach bomb, a healing bomb and no medbay. Everything is done with ordnance.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppnn',
          'eesswwppnn',
          '..hhcc....',
          '..hhcc....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', n: 'mindcontrol',
          m: 'empty', g: 'oxygen', h: 'doors', c: 'teleporter',
        },
        airlocks: ['e', 'n', 'h'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, piloting: 1, doors: 2, mindcontrol: 2, teleporter: 1 },
        weapons: ['bomb_breach', 'bomb_healing'],
        drones: [], augments: ['slug_gel', 'o2_masks'],
        crew: ['slug', 'slug', 'slug'],
        resources: { scrap: 20, fuel: 16, missiles: 8, droneParts: 0 },
      },
    },
  },

  // 9 ------------------------------------------------------------------ 9 --
  crystal: {
    id: 'crystal', name: 'Crystal Vessel', sprite: 'ship_ext_crystal', order: 9,
    unlockedBy: 'slug',
    blurb: 'Older than the Federation, and considerably more patient.',
    layouts: {
      A: {
        id: 'crystal_A', name: 'Bravais', hull: 30, reactor: 8, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'Crystal crew can seal a room shut with everyone inside it. Heavy hull, heavier crew.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppcc',
          'eesswwppcc',
          '..hhoo....',
          '..hhoo....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', c: 'teleporter',
          m: 'medbay', g: 'oxygen', h: 'doors', o: 'sensors',
        },
        airlocks: ['e', 'h', 'o'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1, teleporter: 1 },
        weapons: ['laser_heavy1', 'bomb_stun'],
        drones: [], augments: ['crystal_vengeance'],
        crew: ['crystal', 'crystal', 'human'],
        resources: { scrap: 25, fuel: 16, missiles: 4, droneParts: 0 },
      },
      B: {
        id: 'crystal_B', name: 'Carnelian', hull: 35, reactor: 9, crewSlots: 8,
        weaponSlots: 3, droneSlots: 2,
        desc: 'Four Crystal, a level-2 teleporter and a shield siphon. Take theirs and add it to yours.',
        grid: [
          '..mmgg....',
          '..mmgg....',
          'eesswwppcc',
          'eesswwppcc',
          '..hhyy....',
          '..hhyy....',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', c: 'teleporter',
          m: 'medbay', g: 'oxygen', h: 'doors', y: 'siphon',
        },
        airlocks: ['e', 'h'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 2, medbay: 1, piloting: 1, doors: 1, teleporter: 2, siphon: 1 },
        weapons: ['ion_blast', 'bomb_small'],
        drones: [], augments: ['crystal_vengeance', 'crew_stims'],
        crew: ['crystal', 'crystal', 'crystal', 'crystal'],
        resources: { scrap: 20, fuel: 16, missiles: 3, droneParts: 0 },
      },
    },
  },

  // 10 ---------------------------------------------------------------- 10 --
  nomad: {
    id: 'nomad', name: 'Nomad Salvager', sprite: 'ship_ext_nomad', order: 10,
    unlockedBy: 'crystal',
    blurb: 'Six wrecks welded into one ship by someone who refused to die in any of them.',
    layouts: {
      A: {
        id: 'nomad_A', name: 'Magpie', hull: 28, reactor: 9, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'A salvage arm and a nanoforge: every wreck pays more, and the hull mends itself between shots.',
        grid: [
          '..mmggvv..',
          '..mmggvv..',
          'eesswwppnn',
          'eesswwppnn',
          '..hhooff..',
          '..hhooff..',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', n: 'nanoforge',
          m: 'medbay', g: 'oxygen', v: 'salvage', h: 'doors', o: 'sensors', f: 'empty',
        },
        airlocks: ['e', 'h', 'f', 'v'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1, nanoforge: 1, salvage: 1 },
        weapons: ['laser_burst1', 'ion_blast'],
        drones: [], augments: ['salvage_nets'],
        crew: ['human', 'engi', 'vex'],
        resources: { scrap: 35, fuel: 20, missiles: 5, droneParts: 2 },
      },
      B: {
        id: 'nomad_B', name: 'Chronovore', hull: 26, reactor: 10, crewSlots: 8,
        weaponSlots: 4, droneSlots: 2,
        desc: 'A temporal field and an overdrive core. Bend the clock in one room and overcharge another.',
        grid: [
          '..mmggvv..',
          '..mmggvv..',
          'eesswwppnn',
          'eesswwppnn',
          '..hhooff..',
          '..hhooff..',
        ],
        map: {
          e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', n: 'overdrive',
          m: 'medbay', g: 'oxygen', v: 'temporal', h: 'doors', o: 'sensors', f: 'empty',
        },
        airlocks: ['e', 'h', 'f'],
        systems: { shields: 2, engines: 2, oxygen: 1, weapons: 3, medbay: 1, piloting: 1, doors: 1, sensors: 1, overdrive: 1, temporal: 1 },
        weapons: ['laser_charge', 'beam_mini'],
        drones: [], augments: ['echo_core'],
        crew: ['vex', 'synth', 'human'],
        resources: { scrap: 25, fuel: 16, missiles: 4, droneParts: 0 },
      },
    },
  },
};

export const SHIP_IDS = Object.keys(SHIPS).sort((a, b) => SHIPS[a].order - SHIPS[b].order);

export function getShip(id) {
  const s = SHIPS[id];
  if (!s) throw new Error(`unknown ship "${id}"`);
  return s;
}

export function getLayout(shipId, variant = 'A') {
  const ship = getShip(shipId);
  const l = ship.layouts[variant];
  if (!l) throw new Error(`ship "${shipId}" has no layout "${variant}"`);
  return l;
}

/** Compiled layouts are cached — the ASCII parse only needs to happen once. */
const layoutCache = new Map();

export function compiledLayout(shipId, variant = 'A') {
  const key = `${shipId}:${variant}`;
  if (!layoutCache.has(key)) layoutCache.set(key, buildLayout(getLayout(shipId, variant)));
  return layoutCache.get(key);
}

/** Every (ship, variant) pair, in progression order. */
export function allLoadouts() {
  const out = [];
  for (const id of SHIP_IDS) {
    for (const variant of ['A', 'B']) {
      if (SHIPS[id].layouts[variant]) out.push({ shipId: id, variant });
    }
  }
  return out;
}
