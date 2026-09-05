/**
 * Hazard and exploration encounters: asteroid fields, tunnels, survival holds,
 * pursuits and derelicts. See docs/ENCOUNTERS.md for the schema.
 *
 * These are the run's texture — the nodes that are not a dogfight. Each one is
 * built around a single idea, and each one is honest about it in its `blurb`,
 * because the blurb is all the player gets before committing to the node.
 *
 * Two recurring bits of arithmetic, written down so the numbers below can be
 * checked rather than trusted:
 *
 *   Obstacle fields are seeded ONCE (terrain.seedObstacles) and never refill.
 *   The last rock sits at roughly `w * (1 + spreadX)` and is irrelevant once it
 *   passes the player at x=150, so a field lasts about
 *       (960 * (1 + spreadX) - 150) / speed  seconds.
 *   `spreadX` is therefore sized to the objective's clock, and `count` is set
 *   from a rocks-per-screen density so a longer field is not a thinner one.
 *
 *   Corridors scroll at `scroll` px/s over `length` px, so a tunnel runs for
 *   about (length - 896) / scroll seconds. Wave triggers stay inside that.
 */

export const HAZARD_ENCOUNTERS = [
  // =========================================================================
  // ASTEROID — destructible rock drifting in from the right.
  // =========================================================================

  {
    // Idea: the tutorial for terrain. Rock is slow, sparse, and the only thing
    // that can kill you here is impatience.
    id: 'debris_drift', name: 'Debris Drift', type: 'asteroid', weight: 12,
    minThreat: 1, maxThreat: 7,
    blurb: 'Slow-tumbling rock. Nothing hostile in it yet.',
    intro: 'The remains of something that broke up a long way from here. It is still spreading out.',
    objective: { kind: 'survive', seconds: 50 },
    obstacles: { count: 28, speed: 105, size: 24, toughness: 1, contact: 15, spreadX: 4.9 },
    waves: [
      { at: 20, spawn: [{ id: 'picket', count: 3, formation: 'random', delay: 0.5 }] },
      { at: 34, spawn: [{ budget: 0.35, pool: ['picket', 'drifting_mine'], formation: 'random', delay: 0.4 }] },
    ],
    rewards: { xpMult: 0.75, creditsMult: 1.3, crates: 1 },
  },

  {
    // Idea: the rocks are cover, and they are not your cover. Scavengers sit
    // behind the biggest ones and make you come around the side.
    id: 'shepherd_rocks', name: 'Shepherd Rocks', type: 'asteroid', weight: 10,
    minThreat: 2, maxThreat: 8,
    blurb: 'Scavengers holding station behind the larger rocks.',
    intro: 'They are not moving to meet you. They do not have to.',
    objective: { kind: 'clear' },
    obstacles: { count: 40, speed: 120, size: 32, toughness: 1.6, contact: 18, spreadX: 6 },
    waves: [
      { at: 0, spawn: [{ id: 'turret_pod', count: 3, formation: 'echelon', delay: 0.4 }] },
      { at: 16, spawn: [{ budget: 0.6, pool: ['picket', 'wasp', 'bomblet'], formation: 'random', delay: 0.35 }] },
      { after: 'cleared', spawn: [{ budget: 0.7, pool: ['gunship', 'interceptor', 'turret_pod'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1, creditsMult: 1.25, crates: 1 },
  },

  {
    // Idea: rock so big and so tough you cannot shoot a hole in it in time.
    // The answer is routing, not firepower — and the turrets know your route.
    id: 'mining_lane_collapse', name: 'Collapsed Mining Lane', type: 'asteroid', weight: 10,
    minThreat: 4, maxThreat: 10,
    blurb: 'Ore fragments too heavy to shoot apart. Fly around them.',
    intro: 'A cut face gave way somewhere upstream. What is left of the seam is coming down the lane.',
    objective: { kind: 'survive', seconds: 62 },
    obstacles: { count: 24, speed: 78, size: 40, toughness: 3.2, contact: 26, spreadX: 4.2 },
    waves: [
      { at: 6, spawn: [{ id: 'turret_pod', count: 2, formation: 'column', gap: 120 }] },
      { at: 22, spawn: [{ budget: 0.5, pool: ['bomblet', 'picket', 'drifting_mine'], formation: 'random', delay: 0.4 }] },
      { at: 40, spawn: [{ budget: 0.55, pool: ['artillery', 'turret_pod'], formation: 'echelon', delay: 0.6 }] },
    ],
    rewards: { xpMult: 0.85, creditsMult: 1.5, crates: 1 },
  },

  {
    // Idea: a wall of fast, small, brittle rock. Nothing is aiming at you. You
    // still have about a second and a half of warning per impact.
    id: 'hail_of_rock', name: 'Hail', type: 'asteroid', weight: 9,
    minThreat: 5, maxThreat: 12,
    blurb: 'Fast gravel, edge to edge. No hostiles. No gaps either.',
    intro: 'Small enough to shoot. Too many to shoot. Pick one.',
    objective: { kind: 'survive', seconds: 42 },
    obstacles: { count: 100, speed: 205, size: 16, toughness: 0.6, contact: 13, spreadX: 8.4 },
    waves: [
      { at: 24, spawn: [{ id: 'wasp', count: 4, formation: 'random', delay: 0.3 }] },
    ],
    rewards: { xpMult: 0.6, creditsMult: 1.8, crates: 2 },
  },

  {
    // Idea: everything you break makes more of it. Rocks fragment, splitters
    // split, and restraint is the actual mechanic.
    id: 'splinter_field', name: 'Splinter Field', type: 'asteroid', weight: 10,
    minThreat: 8, maxThreat: 14,
    blurb: 'Rock and machines that both come apart into smaller problems.',
    intro: 'Shooting the field is how the field got this size.',
    objective: { kind: 'clear' },
    obstacles: { count: 58, speed: 140, size: 24, toughness: 1.2, contact: 18, spreadX: 6.5 },
    waves: [
      { at: 0, spawn: [{ id: 'splitter', count: 4, formation: 'arc', delay: 0.35 }] },
      { at: 18, spawn: [{ budget: 0.65, pool: ['splitter', 'bomblet', 'interceptor'], formation: 'random', delay: 0.3 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.7, pool: ['splitter', 'gunship', 'lancer'], formation: 'v', delay: 0.3 }] },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['raider', 'splitter'], formation: 'cluster', delay: 0.4 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.3, crates: 1 },
  },

  {
    // Idea: dense fast rock AND ships that are comfortable inside it. The rocks
    // hurt them too, which is the only thing keeping this fair.
    id: 'kuiper_gauntlet', name: 'Kuiper Gauntlet', type: 'asteroid', weight: 9,
    minThreat: 12, maxThreat: 20,
    blurb: 'A raider lane run straight through a dense belt.',
    intro: 'They have flown this belt before. You have not.',
    objective: { kind: 'survive', seconds: 62 },
    obstacles: { count: 100, speed: 165, size: 24, toughness: 1.4, contact: 20, spreadX: 10 },
    waves: [
      { at: 4, spawn: [{ budget: 0.5, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.25 }] },
      { at: 20, spawn: [{ budget: 0.6, pool: ['raider', 'phantom'], formation: 'echelon', delay: 0.4 }] },
      { at: 36, spawn: [{ budget: 0.6, pool: ['hunter', 'lancer'], formation: 'arc', delay: 0.35 }] },
      { at: 50, spawn: [{ budget: 0.5, pool: ['raider', 'interceptor'], formation: 'cluster', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.5, crates: 2 },
  },

  {
    // Idea: the belt itself is the boss. Nothing shoots at you for the first
    // twenty seconds and it is still the worst node on the map.
    id: 'annihilation_belt', name: 'The Annihilation Belt', type: 'asteroid', weight: 7,
    minThreat: 15, maxThreat: 20,
    blurb: 'Heavy rock at speed. Hull damage is the price of entry.',
    intro: 'Two planets that could not agree on an orbit. This is what is left of the argument.',
    objective: { kind: 'survive', seconds: 68 },
    obstacles: { count: 106, speed: 155, size: 32, toughness: 2.2, contact: 28, spreadX: 10.1 },
    waves: [
      { at: 22, spawn: [{ budget: 0.55, pool: ['hunter', 'phantom'], formation: 'random', delay: 0.4 }] },
      { at: 42, spawn: [{ budget: 0.6, pool: ['missile_boat', 'raider'], formation: 'echelon', delay: 0.5 }] },
      { at: 56, spawn: [{ budget: 0.45, pool: ['hunter', 'interceptor'], formation: 'cluster', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 2.1, crates: 3 },
  },

  // =========================================================================
  // TUNNEL — corridor terrain, `reach` objective. Field height is 540.
  // =========================================================================

  {
    // Idea: teach the corridor. Wide, slow, forgiving, and the pinches are
    // signposted by two long chambers on either side of them.
    id: 'stone_throat', name: 'Stone Throat', type: 'tunnel', weight: 12,
    minThreat: 1, maxThreat: 6,
    blurb: 'A wide gap through a dead rock. Slow going, but it is a shortcut.',
    intro: 'The passage is old and worn smooth. Whatever cut it is not here any more.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'rock', length: 9600, minAperture: 235, maxAperture: 430,
      roughness: 0.8, chambers: 4, pinches: 2, scroll: 175,
    },
    rewards: { xpMult: 0.7, creditsMult: 1.4, crates: 1 },
  },

  {
    // Idea: ice reads as open. It is not. The walls are pale, the gaps look
    // wider than they are, and there are five pinches in a fifty-second run.
    id: 'glass_run', name: 'Glass Run', type: 'tunnel', weight: 11,
    minThreat: 3, maxThreat: 9,
    blurb: 'A fissure in old ice. The walls are brighter than the gap.',
    intro: 'Comet ice, hollowed by something that melted its way out. The bore is not straight.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'ice', length: 12000, minAperture: 190, maxAperture: 400,
      roughness: 1.1, chambers: 3, pinches: 5, scroll: 215,
    },
    rewards: { xpMult: 0.8, creditsMult: 1.5, crates: 1 },
  },

  {
    // Idea: the corridor is the pressure and the guns are the problem. Turret
    // pods are bolted to the duct, so you meet them at the tightest points.
    id: 'foundry_ducts', name: 'Foundry Ducts', type: 'tunnel', weight: 10,
    minThreat: 5, maxThreat: 11,
    blurb: 'A working exhaust duct. The pods bolted to it still have power.',
    intro: 'The foundry above has been cold for years. Nobody told its defences.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'metal', length: 13000, minAperture: 200, maxAperture: 380,
      roughness: 0.9, chambers: 3, pinches: 4, scroll: 205,
    },
    waves: [
      { at: 8, spawn: [{ id: 'turret_pod', count: 2, formation: 'column', gap: 160 }] },
      { at: 22, spawn: [{ budget: 0.4, pool: ['picket', 'wasp'], formation: 'line', delay: 0.35 }] },
      { at: 38, spawn: [{ id: 'turret_pod', count: 3, formation: 'echelon', delay: 0.5 }] },
      { at: 52, spawn: [{ budget: 0.45, pool: ['interceptor', 'picket'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1, creditsMult: 1.5, crates: 1 },
  },

  {
    // Idea: five chambers, five ambushes, and narrow rock in between where you
    // cannot fight at all. The corridor decides when the fight happens.
    id: 'rock_cathedral', name: 'The Cathedral', type: 'tunnel', weight: 10,
    minThreat: 7, maxThreat: 13,
    blurb: 'Wide chambers strung on a narrow passage. Something waits in each.',
    intro: 'Five rooms cut into the rock, each one bigger than a hangar. Somebody was living here.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'rock', length: 15000, minAperture: 175, maxAperture: 440,
      roughness: 1, chambers: 5, pinches: 5, scroll: 210,
    },
    waves: [
      { at: 10, spawn: [{ budget: 0.4, pool: ['picket', 'zealot'], formation: 'cluster', delay: 0.3 }] },
      { at: 26, spawn: [{ budget: 0.5, pool: ['gunship', 'turret_pod'], formation: 'line', delay: 0.4 }] },
      // 'cluster' rather than 'ambush' here: ambush scatters across the full
      // field height, which inside a corridor means spawning inside the rock.
      { at: 42, spawn: [{ budget: 0.5, pool: ['zealot', 'interceptor'], formation: 'cluster', delay: 0.35 }] },
      { at: 58, spawn: [{ budget: 0.55, pool: ['lancer', 'gunship'], formation: 'arc', delay: 0.4 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.4, crates: 2 },
  },

  {
    // Idea: an ice tunnel so narrow the walls do more damage than anything
    // shooting at you. So nothing shoots at you. It does not help.
    id: 'the_needle', name: 'The Needle', type: 'tunnel', weight: 9,
    minThreat: 9, maxThreat: 15,
    blurb: 'Seven pinches in under a minute. The ice takes more hull than guns do.',
    intro: 'The chart lists it as passable. The chart was drawn by something smaller.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'ice', length: 11500, minAperture: 152, maxAperture: 330,
      roughness: 1.3, chambers: 2, pinches: 7, scroll: 250,
    },
    rewards: { xpMult: 0.7, creditsMult: 2.2, crates: 2 },
  },

  {
    // Idea: a long fast metal run with things flying it in the other direction.
    // Head-on traffic in a corridor you cannot leave.
    id: 'scrapline_conduit', name: 'Scrapline Conduit', type: 'tunnel', weight: 9,
    minThreat: 12, maxThreat: 20,
    blurb: 'A hull-breaker run at speed, with traffic coming the other way.',
    intro: 'The conduit runs the length of the wreck. So does everything else in here.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'metal', length: 16500, minAperture: 165, maxAperture: 360,
      roughness: 1.2, chambers: 3, pinches: 6, scroll: 265,
    },
    waves: [
      { at: 9, spawn: [{ budget: 0.35, pool: ['interceptor', 'wasp'], formation: 'column', gap: 90, delay: 0.2 }] },
      { at: 24, spawn: [{ id: 'turret_pod', count: 4, formation: 'echelon', delay: 0.5 }] },
      { at: 38, spawn: [{ budget: 0.45, pool: ['hunter', 'lancer'], formation: 'line', delay: 0.35 }] },
      { at: 52, spawn: [{ budget: 0.4, pool: ['interceptor', 'zealot'], formation: 'cluster', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1.8, crates: 2 },
  },

  {
    // Idea: the tightest passage in the game, and short enough to be a dare
    // rather than a grind. Eight pinches, one chamber, no enemies at all.
    id: 'hairline', name: 'Hairline', type: 'tunnel', weight: 7,
    minThreat: 16, maxThreat: 20,
    blurb: 'A crack in the ice barely wider than the ship. Nothing lives in it.',
    intro: 'Nothing is waiting in here. Nothing needs to be.',
    objective: { kind: 'reach' },
    terrain: {
      style: 'ice', length: 12500, minAperture: 134, maxAperture: 300,
      roughness: 1.4, chambers: 1, pinches: 8, scroll: 285,
    },
    rewards: { xpMult: 0.8, creditsMult: 2.8, crates: 3 },
  },

  // =========================================================================
  // SURVIVAL — hold a position while the script keeps arriving.
  // =========================================================================

  {
    // Idea: the first hold-out. Steady, escalating, and short enough to read
    // as a rhythm rather than a war of attrition.
    id: 'hold_the_beacon', name: 'Hold the Beacon', type: 'survival', weight: 11,
    minThreat: 1, maxThreat: 7,
    blurb: 'Sit on the beacon until it finishes transmitting. Fifty seconds.',
    intro: 'The beacon needs a clear line for fifty seconds. You need to be the clear line.',
    objective: { kind: 'survive', seconds: 50 },
    waves: [
      { at: 0, spawn: [{ id: 'picket', count: 4, formation: 'line', delay: 0.3 }] },
      { at: 10, spawn: [{ budget: 0.4, pool: ['wasp', 'picket'], formation: 'arc', delay: 0.25 }] },
      { at: 20, spawn: [{ budget: 0.45, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.3 }] },
      { at: 30, spawn: [{ budget: 0.5, pool: ['gunship', 'picket'], formation: 'v', delay: 0.3 }] },
      { at: 40, spawn: [{ budget: 0.5, pool: ['interceptor', 'zealot'], formation: 'pincer', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1, crates: 1 },
  },

  {
    // Idea: the only cover is a drifting rock field that is itself being shot
    // to pieces. Hold long enough and you are standing in open space.
    id: 'rock_shelter', name: 'Rock Shelter', type: 'survival', weight: 10,
    minThreat: 4, maxThreat: 10,
    blurb: 'Hold among the rocks. They will not last as long as you have to.',
    intro: 'There is cover here for about a minute. The hold is longer than that.',
    objective: { kind: 'survive', seconds: 65 },
    obstacles: { count: 44, speed: 72, size: 32, toughness: 2.4, contact: 20, spreadX: 4.4 },
    waves: [
      { at: 0, spawn: [{ budget: 0.4, pool: ['picket', 'wasp'], formation: 'random', delay: 0.3 }] },
      { at: 12, spawn: [{ budget: 0.45, pool: ['gunship', 'turret_pod'], formation: 'echelon', delay: 0.4 }] },
      { at: 24, spawn: [{ budget: 0.5, pool: ['artillery', 'bomblet'], formation: 'line', delay: 0.4 }] },
      { at: 36, spawn: [{ budget: 0.5, pool: ['lancer', 'interceptor'], formation: 'arc', delay: 0.3 }] },
      { at: 48, spawn: [{ budget: 0.55, pool: ['gunship', 'zealot'], formation: 'pincer', delay: 0.3 }] },
      { at: 55, spawn: [{ budget: 0.4, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.2, crates: 1 },
  },

  {
    // Idea: a proper siege. Shield auras arrive in the middle third, so the
    // fight you were winning stops working and you have to re-target.
    id: 'siege_of_the_relay', name: 'Siege of the Relay', type: 'survival', weight: 10,
    minThreat: 7, maxThreat: 13,
    blurb: 'Seventy-five seconds under a shielded assault. Kill the pods first.',
    intro: 'They brought the pods. They intend to be here a while.',
    objective: { kind: 'survive', seconds: 75 },
    waves: [
      { at: 0, spawn: [{ budget: 0.45, pool: ['picket', 'interceptor'], formation: 'arc', delay: 0.25 }] },
      { at: 12, spawn: [{ budget: 0.5, pool: ['gunship', 'lancer'], formation: 'v', delay: 0.3 }] },
      { at: 24, spawn: [{ id: 'aegis_pod', count: 2, formation: 'column', gap: 140 }, { budget: 0.35, pool: ['gunship'], formation: 'line', delay: 0.3 }] },
      { at: 36, spawn: [{ budget: 0.5, pool: ['artillery', 'bulwark'], formation: 'echelon', delay: 0.5 }] },
      { at: 48, spawn: [{ id: 'aegis_pod', count: 2, formation: 'pincer' }, { budget: 0.4, pool: ['lancer', 'interceptor'], formation: 'random', delay: 0.3 }] },
      { at: 60, spawn: [{ budget: 0.55, pool: ['scout', 'phantom'], formation: 'arc', delay: 0.35 }] },
      { at: 65, spawn: [{ budget: 0.35, pool: ['zealot', 'wasp'], formation: 'cluster', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.35, creditsMult: 1.1, crates: 1 },
  },

  {
    // Idea: a hold in the dark against things that are not always there.
    // Phantoms cloak, so half the hold is spent shooting at where they were.
    id: 'the_long_dark', name: 'The Long Dark', type: 'survival', weight: 9,
    minThreat: 11, maxThreat: 20,
    blurb: 'Seventy seconds in an unlit lane. Most of what is here is cloaked.',
    intro: 'The lane runs between two dead stars. Your sensors are guessing and they know it.',
    objective: { kind: 'survive', seconds: 70 },
    waves: [
      { at: 0, spawn: [{ id: 'phantom', count: 2, formation: 'line', delay: 0.5 }] },
      { at: 14, spawn: [{ budget: 0.55, pool: ['phantom', 'interceptor'], formation: 'random', delay: 0.35 }] },
      { at: 26, spawn: [{ budget: 0.55, pool: ['drifting_mine', 'bomblet'], formation: 'random', delay: 0.25 }] },
      { at: 38, spawn: [{ budget: 0.6, pool: ['phantom', 'hunter'], formation: 'pincer', delay: 0.4 }] },
      { at: 50, spawn: [{ budget: 0.6, pool: ['hunter', 'lancer'], formation: 'arc', delay: 0.35 }] },
      { at: 60, spawn: [{ budget: 0.5, pool: ['phantom', 'zealot'], formation: 'cluster', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.4, creditsMult: 1.3, crates: 2 },
  },

  {
    // Idea: volume. Nothing here is individually dangerous and there is never
    // a moment where the screen is not full.
    id: 'black_tide', name: 'Black Tide', type: 'survival', weight: 9,
    minThreat: 10, maxThreat: 16,
    blurb: 'Eighty-five seconds against small things that keep arriving.',
    intro: 'Two tenders on the far side are still building them. You will not reach the tenders.',
    objective: { kind: 'survive', seconds: 85 },
    waves: [
      { at: 0, spawn: [{ budget: 0.45, pool: ['picket', 'wasp'], formation: 'arc', delay: 0.2 }] },
      { at: 10, spawn: [{ budget: 0.45, pool: ['wasp', 'interceptor'], formation: 'random', delay: 0.2 }] },
      { at: 20, spawn: [{ id: 'drone_carrier', count: 1, formation: 'column' }, { budget: 0.3, pool: ['picket'], formation: 'line', delay: 0.2 }] },
      { at: 30, spawn: [{ budget: 0.5, pool: ['zealot', 'seeker'], formation: 'pincer', delay: 0.2 }] },
      { at: 42, spawn: [{ budget: 0.5, pool: ['splitter', 'wasp'], formation: 'random', delay: 0.25 }] },
      { at: 54, spawn: [{ id: 'drone_carrier', count: 2, formation: 'echelon', delay: 0.6 }] },
      { at: 66, spawn: [{ budget: 0.55, pool: ['interceptor', 'zealot', 'wasp'], formation: 'arc', delay: 0.2 }] },
      { at: 74, spawn: [{ budget: 0.5, pool: ['seeker', 'picket'], formation: 'cluster', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.45, creditsMult: 1.1, crates: 1 },
  },

  {
    // Idea: the longest hold on the map, structured as three fights stacked in
    // sequence, ending with an elite that arrives while the last wave is alive.
    id: 'last_ninety', name: 'The Last Ninety', type: 'survival', weight: 8,
    minThreat: 14, maxThreat: 20,
    blurb: 'Ninety-five seconds. They send everything, in order, and then a Vanguard.',
    intro: 'A fleet exercise, and you are the exercise.',
    objective: { kind: 'survive', seconds: 95 },
    waves: [
      { at: 0, spawn: [{ budget: 0.45, pool: ['interceptor', 'wasp'], formation: 'arc', delay: 0.2 }] },
      { at: 12, spawn: [{ budget: 0.5, pool: ['gunship', 'lancer'], formation: 'v', delay: 0.3 }] },
      { at: 24, spawn: [{ budget: 0.55, pool: ['artillery', 'bulwark'], formation: 'line', delay: 0.4 }] },
      { at: 36, spawn: [{ budget: 0.55, pool: ['scout', 'raider'], formation: 'echelon', delay: 0.35 }] },
      { at: 48, spawn: [{ budget: 0.55, pool: ['missile_boat', 'sentinel'], formation: 'column', gap: 130, delay: 0.5 }] },
      { at: 60, spawn: [{ budget: 0.5, pool: ['hunter', 'phantom'], formation: 'pincer', delay: 0.3 }] },
      { at: 72, spawn: [{ id: 'vanguard', count: 1, formation: 'column' }] },
      { at: 84, spawn: [{ budget: 0.45, pool: ['zealot', 'interceptor'], formation: 'cluster', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.6, creditsMult: 1.4, crates: 2 },
  },

  // =========================================================================
  // CHASE — outrun, not outshoot.
  // =========================================================================

  {
    // Idea: the first time something follows you. Seekers do not shoot and do
    // not stop, and there are always more behind the ones you killed.
    id: 'run_the_picket', name: 'Run the Picket', type: 'asteroid', weight: 11,
    minThreat: 1, maxThreat: 5,
    blurb: 'Seeker pods have your track. Stay ahead of them for forty-five seconds.',
    intro: 'They do not shoot. They only need to touch you once.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    arena: { scroll: 190 },
    waves: [
      { at: 0, spawn: [{ id: 'seeker', count: 3, formation: 'line', delay: 0.4 }] },
      { at: 8, spawn: [{ id: 'seeker', count: 3, formation: 'echelon', delay: 0.35 }] },
      { at: 16, spawn: [{ budget: 0.4, pool: ['seeker', 'wasp'], formation: 'random', delay: 0.3 }] },
      { at: 25, spawn: [{ budget: 0.45, pool: ['seeker', 'zealot'], formation: 'pincer', delay: 0.3 }] },
      { at: 34, spawn: [{ budget: 0.4, pool: ['seeker', 'interceptor'], formation: 'cluster', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1.2, crates: 1 },
  },

  {
    // Idea: a swarm that is slightly faster than you are. Killing them is
    // possible and it is not the plan; the clock is the plan.
    id: 'outrun_the_swarm', name: 'Outrun the Swarm', type: 'asteroid', weight: 10,
    minThreat: 3, maxThreat: 9,
    blurb: 'A swarm with a better top speed than yours. Fifty-five seconds of it.',
    intro: 'You cannot kill them all. You have counted. Fly.',
    objective: { kind: 'clear' },
    obstacles: { count: 22, speed: 118, size: 24, toughness: 1, contact: 14, spreadX: 5 },
    arena: { scroll: 215 },
    waves: [
      { at: 0, spawn: [{ budget: 0.5, pool: ['zealot', 'interceptor'], formation: 'arc', delay: 0.2 }] },
      { at: 11, spawn: [{ budget: 0.5, pool: ['seeker', 'zealot'], formation: 'random', delay: 0.25 }] },
      { at: 22, spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp'], formation: 'pincer', delay: 0.2 }] },
      { at: 33, spawn: [{ budget: 0.55, pool: ['zealot', 'seeker'], formation: 'cluster', delay: 0.2 }] },
      { at: 44, spawn: [{ budget: 0.5, pool: ['interceptor', 'zealot'], formation: 'arc', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.3, crates: 1 },
  },

  {
    // Idea: hunter-killers orbit rather than close, so you are never allowed a
    // clean line on them and never allowed to stand still either.
    id: 'hounds', name: 'Hounds', type: 'asteroid', weight: 10,
    minThreat: 6, maxThreat: 12,
    blurb: 'Hunter-killers circling. They will not close and they will not leave.',
    intro: 'They keep their distance and their needles are faster than you are.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    arena: { scroll: 225 },
    waves: [
      { at: 0, spawn: [{ id: 'hunter', count: 1, formation: 'column' }] },
      { at: 10, spawn: [{ id: 'hunter', count: 2, formation: 'pincer', delay: 0.5 }] },
      { at: 22, spawn: [{ budget: 0.45, pool: ['interceptor', 'phantom'], formation: 'random', delay: 0.3 }] },
      { at: 34, spawn: [{ id: 'hunter', count: 2, formation: 'echelon', delay: 0.6 }] },
      { at: 46, spawn: [{ budget: 0.5, pool: ['hunter', 'zealot'], formation: 'cluster', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.3, crates: 1 },
  },

  {
    // Idea: the inversion. You are the one chasing, the target is running, and
    // it drops escorts behind it the whole way. Miss the window and it is gone.
    id: 'courier_run', name: 'Courier Run', type: 'asteroid', weight: 9,
    minThreat: 8, maxThreat: 15,
    blurb: 'A tender running for a jump point. Kill it before it gets there.',
    intro: 'It will not fight you. It only has to stay ahead of you for ninety seconds.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    arena: { scroll: 240 },
    waves: [
      { at: 0, spawn: [{ id: 'drone_carrier', count: 1, formation: 'column', tag: 'courier', elite: true }] },
      { at: 10, spawn: [{ budget: 0.4, pool: ['interceptor', 'wasp'], formation: 'line', delay: 0.3 }] },
      { at: 26, spawn: [{ budget: 0.45, pool: ['lancer', 'interceptor'], formation: 'arc', delay: 0.3 }] },
      { at: 44, spawn: [{ budget: 0.45, pool: ['hunter', 'phantom'], formation: 'pincer', delay: 0.4 }] },
      { at: 62, spawn: [{ budget: 0.4, pool: ['zealot', 'interceptor'], formation: 'cluster', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.9, crates: 2 },
  },

  {
    // Idea: you cannot kill the thing behind you, only outlast it. The Reaper
    // is priced far above the node budget on purpose — shooting it is a losing
    // trade and the clock is the only exit.
    id: 'reaper_on_your_tail', name: 'Reaper on Your Tail', type: 'asteroid', weight: 8,
    minThreat: 13, maxThreat: 20,
    blurb: 'A Reaper has your scent. Seventy seconds. You will not win the trade.',
    intro: 'It is faster than you, it rams, and it does not lose interest. Fly for seventy seconds.',
    objective: { kind: 'clear' },
    obstacles: { count: 26, speed: 104, size: 24, toughness: 1.2, contact: 15, spreadX: 5.4 },
    arena: { scroll: 250 },
    waves: [
      { at: 0, spawn: [{ id: 'reaper', count: 1, formation: 'column' }] },
      { at: 14, spawn: [{ budget: 0.4, pool: ['interceptor', 'zealot'], formation: 'random', delay: 0.25 }] },
      { at: 28, spawn: [{ budget: 0.45, pool: ['hunter', 'seeker'], formation: 'pincer', delay: 0.3 }] },
      { at: 42, spawn: [{ budget: 0.45, pool: ['zealot', 'interceptor'], formation: 'arc', delay: 0.25 }] },
      { at: 56, spawn: [{ budget: 0.4, pool: ['seeker', 'zealot'], formation: 'cluster', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.5, creditsMult: 1.6, crates: 2 },
  },

  // =========================================================================
  // HOLD-OUTS, second set — the wrecks.
  //
  // These were the Derelict node type, which is gone: six clear-the-field
  // fights that happened to be set in a wreck, which is scenery rather than a
  // different question. Held instead of cleared they finally play like their
  // own description — something waking up around you while you stay put — and
  // they keep the salvage payout that made them worth the detour.
  // =========================================================================

  {
    // Idea: the introduction. Two drifting mines are the warning; the drones
    // behind the bulkhead are the lesson, and the bay mouth is the only place
    // the cutting rig will reach.
    id: 'cold_hulk', name: 'Cold Hulk', type: 'survival', weight: 11,
    minThreat: 1, maxThreat: 6,
    blurb: 'Hold the open bay of a dead freighter for forty-five seconds.',
    intro:
      'No power, no signal, no distress call, and somebody left the bay doors open. '
      + 'The rig needs three quarters of a minute clamped to the mouth of it. '
      + 'Whatever is inside has that long to reach you.',
    objective: { kind: 'survive', seconds: 45 },
    waves: [
      { at: 0, spawn: [{ id: 'drifting_mine', count: 2, formation: 'line', delay: 0.6 }] },
      { at: 7, spawn: [{ id: 'picket', count: 4, formation: 'ambush', delay: 0.3 }] },
      { at: 18, spawn: [{ budget: 0.4, pool: ['picket', 'wasp'], formation: 'arc', delay: 0.3 }] },
      { at: 30, spawn: [{ budget: 0.5, pool: ['picket', 'wasp', 'turret_pod'], formation: 'random', delay: 0.3 }] },
      { at: 38, spawn: [{ budget: 0.35, pool: ['interceptor'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 0.9, creditsMult: 1.5, crates: 2 },
  },

  {
    // Idea: a genuinely profitable wreck with a thin guard. Low xp, real money.
    // The node the player takes when the hull bar is the problem — and the one
    // that punishes greed, because the pay is in the clock, not in the kills.
    id: 'salvage_run', name: 'Salvage Run', type: 'survival', weight: 10,
    minThreat: 1, maxThreat: 8,
    blurb: 'Fifty seconds clamped to a cargo spine. A thin guard, and a lot of crates.',
    intro:
      'Sealed containers, still pressurised, and an automated guard too old to be '
      + 'much of one. The winch is slow. That is the whole difficulty.',
    objective: { kind: 'survive', seconds: 50 },
    obstacles: { count: 20, speed: 60, size: 24, toughness: 1, contact: 12, spreadX: 3 },
    waves: [
      { at: 0, spawn: [{ id: 'turret_pod', count: 2, formation: 'line', delay: 0.4 }] },
      { at: 9, spawn: [{ id: 'picket', count: 3, formation: 'ambush', delay: 0.35 }] },
      { at: 22, spawn: [{ budget: 0.45, pool: ['picket', 'turret_pod', 'bomblet'], formation: 'random', delay: 0.3 }] },
      { at: 34, spawn: [{ budget: 0.45, pool: ['wasp', 'bomblet'], formation: 'echelon', delay: 0.35 }] },
      { at: 44, spawn: [{ budget: 0.35, pool: ['interceptor', 'picket'], formation: 'cluster', delay: 0.2 }] },
    ],
    rewards: { xpMult: 0.55, creditsMult: 2.3, crates: 3 },
  },

  {
    // Idea: a dead carrier whose launch cycle never stopped. The wreck itself
    // produces the fight, so the tenders are the clock: kill them and the hold
    // is quiet, ignore them and the last twenty seconds are a wall.
    id: 'the_carrier_grave', name: 'The Carrier Grave', type: 'survival', weight: 10,
    minThreat: 4, maxThreat: 10,
    blurb: 'Seventy seconds beside a carrier still cycling its bays. Kill the tenders.',
    intro:
      'The hull is open to space along a hundred metres and the launch bays are '
      + 'still running on stored charge. Nothing here is commanding them. Nothing '
      + 'here needs to.',
    objective: { kind: 'survive', seconds: 70 },
    waves: [
      { at: 0, spawn: [{ id: 'picket', count: 3, formation: 'line', delay: 0.4 }] },
      { at: 8, spawn: [{ id: 'drone_carrier', count: 1, formation: 'ambush' }, { id: 'wasp', count: 3, formation: 'ambush', delay: 0.3 }] },
      { at: 26, spawn: [{ id: 'drone_carrier', count: 1, formation: 'column' }, { budget: 0.4, pool: ['interceptor', 'picket'], formation: 'arc', delay: 0.3 }] },
      { at: 44, spawn: [{ budget: 0.5, pool: ['gunship', 'interceptor'], formation: 'v', delay: 0.3 }] },
      { at: 58, spawn: [{ budget: 0.45, pool: ['wasp', 'zealot'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1.5, crates: 2 },
  },

  {
    // Idea: it was sealed from the outside, and the seal is the reason the
    // crates are still here. Splitters mean the field gets MORE crowded the
    // harder you work, which is the wrong instinct for a hold.
    id: 'quarantine_ward', name: 'Quarantine Ward', type: 'survival', weight: 9,
    minThreat: 7, maxThreat: 13,
    blurb: 'Seventy seconds inside a hospital ship welded shut from the outside.',
    intro:
      'Somebody cut the airlocks closed rather than open, and they had a reason. '
      + 'Shooting the reason apart makes two of it.',
    objective: { kind: 'survive', seconds: 70 },
    waves: [
      { at: 0, spawn: [{ id: 'drifting_mine', count: 4, formation: 'random', delay: 0.4 }] },
      { at: 9, spawn: [{ id: 'splitter', count: 4, formation: 'ambush', delay: 0.3 }] },
      { at: 24, spawn: [{ budget: 0.55, pool: ['splitter', 'bomblet', 'drifting_mine'], formation: 'random', delay: 0.3 }] },
      { at: 40, spawn: [{ budget: 0.55, pool: ['phantom', 'splitter'], formation: 'pincer', delay: 0.35 }] },
      { at: 56, spawn: [{ budget: 0.5, pool: ['lancer', 'splitter'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.6, crates: 2 },
  },

  {
    // Idea: the reactor is still hot, which means the sentries still have power
    // and the salvage is worth taking. Guns that do not move, in a room you
    // cannot leave.
    id: 'sealed_reactor_deck', name: 'Sealed Reactor Deck', type: 'survival', weight: 9,
    minThreat: 10, maxThreat: 16,
    blurb: 'Seventy-five seconds tapping a reactor that never scrammed.',
    intro:
      'Everything on this deck still has power. That is why the tap is worth '
      + 'setting, and it is why the deck sentries are going to object to it.',
    objective: { kind: 'survive', seconds: 75 },
    waves: [
      { at: 0, spawn: [{ id: 'turret_pod', count: 3, formation: 'echelon', delay: 0.4 }] },
      { at: 10, spawn: [{ id: 'sentinel', count: 1, formation: 'ambush' }, { id: 'aegis_pod', count: 2, formation: 'ambush', delay: 0.4 }] },
      { at: 28, spawn: [{ budget: 0.55, pool: ['sentinel', 'artillery'], formation: 'line', delay: 0.5 }] },
      { at: 46, spawn: [{ budget: 0.6, pool: ['bulwark', 'lancer', 'turret_pod'], formation: 'arc', delay: 0.35 }] },
      { at: 62, spawn: [{ budget: 0.5, pool: ['missile_boat', 'sentinel'], formation: 'column', gap: 140, delay: 0.5 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.9, crates: 3 },
  },

  {
    // Idea: forty wrecks nobody has stripped, which is a question rather than
    // an opportunity. The answer arrives at seventy seconds and is a Warden.
    id: 'ossuary', name: 'The Ossuary', type: 'survival', weight: 7,
    minThreat: 14, maxThreat: 20,
    blurb: 'Eighty-five seconds in a shipbreaker yard. Something in it is still crewed.',
    intro:
      'Forty hulls nose to tail and not one of them stripped. Ask why before you '
      + 'set the clamps, because you will have worked it out by the end anyway.',
    objective: { kind: 'survive', seconds: 85 },
    obstacles: { count: 30, speed: 66, size: 40, toughness: 3, contact: 24, spreadX: 4 },
    waves: [
      { at: 0, spawn: [{ id: 'drifting_mine', count: 5, formation: 'random', delay: 0.5 }] },
      { at: 12, spawn: [{ id: 'phantom', count: 3, formation: 'ambush', delay: 0.35 }, { id: 'aegis_pod', count: 1, formation: 'ambush' }] },
      { at: 32, spawn: [{ budget: 0.6, pool: ['hunter', 'raider', 'phantom'], formation: 'pincer', delay: 0.4 }] },
      { at: 52, spawn: [{ budget: 0.65, pool: ['cruiser', 'missile_boat'], formation: 'line', delay: 0.6 }] },
      { at: 70, spawn: [{ id: 'warden', count: 1, formation: 'column' }] },
    ],
    rewards: { xpMult: 1.5, creditsMult: 2.2, crates: 3 },
  },

  // =========================================================================
  // HOLD-OUTS, third set — written for the node mix that came after the
  // Derelict type was retired. Each one has to ask a different question from
  // "can you outlast this", or a run's worth of them is one node repeated.
  // =========================================================================

  {
    // Idea: the shallowest hold there is. Forty seconds, one clean rhythm, and
    // the ships arrive from alternating edges so the answer is a figure of
    // eight rather than a corner to sit in.
    id: 'the_last_lamp', name: 'The Last Lamp', type: 'survival', weight: 11,
    minThreat: 1, maxThreat: 6,
    blurb: 'Forty seconds keeping a navigation lamp lit. They come from both sides.',
    intro:
      'It is the only lit thing for two jumps in any direction, which is why it '
      + 'matters and why they know where it is. Forty seconds to bring the cell '
      + 'back up.',
    objective: { kind: 'survive', seconds: 40 },
    waves: [
      { at: 0, spawn: [{ id: 'picket', count: 3, formation: 'line', delay: 0.3 }] },
      { at: 9, spawn: [{ budget: 0.4, pool: ['wasp', 'picket'], formation: 'pincer', delay: 0.25 }] },
      { at: 18, spawn: [{ budget: 0.4, pool: ['picket', 'seeker'], formation: 'rear', move: 'advance', delay: 0.3 }] },
      { at: 27, spawn: [{ budget: 0.45, pool: ['wasp', 'interceptor'], formation: 'pincer', delay: 0.25 }] },
      { at: 34, spawn: [{ budget: 0.35, pool: ['zealot'], formation: 'cluster', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1.05, crates: 1 },
  },

  {
    // Idea: the field fills with mines rather than with ships. The question is
    // not what to shoot, it is where there will still be room to stand in
    // thirty seconds' time.
    id: 'the_silting', name: 'The Silting', type: 'survival', weight: 10,
    minThreat: 2, maxThreat: 9,
    blurb: 'Sixty seconds while the lane fills up behind you. Space runs out before time does.',
    intro:
      'They are not really trying to hit you. They are seeding the lane, patiently, '
      + 'and every one they lay is one fewer place you can be when the last of them '
      + 'arrives.',
    objective: { kind: 'survive', seconds: 60 },
    waves: [
      { at: 0, spawn: [{ id: 'bomblet', count: 2, formation: 'echelon', delay: 0.5 }] },
      { at: 12, spawn: [{ id: 'drifting_mine', count: 4, formation: 'random', delay: 0.4 }] },
      { at: 22, spawn: [{ id: 'bomblet', count: 3, formation: 'arc', delay: 0.45 }] },
      { at: 34, spawn: [{ budget: 0.45, pool: ['bomblet', 'drifting_mine'], formation: 'random', delay: 0.35 }] },
      { at: 46, spawn: [{ budget: 0.5, pool: ['gunship', 'interceptor'], formation: 'v', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.2, crates: 1 },
  },

  {
    // Idea: a hold with a wall in it. Entrenched guns hold the middle third
    // from the first second, so the sixty seconds are spent in the top and
    // bottom lanes — and the reinforcements come down those.
    id: 'the_bulkhead_watch', name: 'The Bulkhead Watch', type: 'survival', weight: 10,
    minThreat: 6, maxThreat: 12,
    blurb: 'Sixty-five seconds with the middle of the lane already spoken for.',
    intro:
      'The guns went in before you did and they are pointed at the only comfortable '
      + 'place to stand. Everything that arrives after them knows that too.',
    objective: { kind: 'survive', seconds: 65 },
    waves: [
      { at: 0, spawn: [{ id: 'turret_pod', count: 5, formation: 'crossfire', move: 'entrench', delay: 0.2 }] },
      { at: 14, spawn: [{ budget: 0.45, pool: ['lancer', 'gunship'], formation: 'gauntlet', move: 'entrench', delay: 0.3 }] },
      { at: 28, spawn: [{ budget: 0.5, pool: ['interceptor', 'wasp'], formation: 'pincer', delay: 0.25 }] },
      { at: 42, spawn: [{ id: 'artillery', count: 2, formation: 'crossfire', move: 'entrench', delay: 0.4 }] },
      { at: 54, spawn: [{ budget: 0.5, pool: ['phantom', 'raider'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.15, crates: 1 },
  },

  {
    // Idea: the hold where standing still is fatal. Everything here lays
    // ground rather than shooting at you, so the eighty seconds are one long
    // slow walk around a field that keeps closing.
    id: 'the_scorch_watch', name: 'The Scorch Watch', type: 'survival', weight: 8,
    minThreat: 12, maxThreat: 20,
    blurb: 'Eighty seconds on burning ground. Nothing here is aiming at you.',
    intro:
      'They are not shooting at you, which is worse. They are shooting at the floor, '
      + 'and there is a finite amount of floor.',
    objective: { kind: 'survive', seconds: 80 },
    waves: [
      { at: 0, spawn: [{ id: 'pyre', count: 2, formation: 'echelon', delay: 0.5 }] },
      { at: 14, spawn: [{ id: 'censer', count: 2, formation: 'arc', delay: 0.4 }, { budget: 0.35, pool: ['interceptor'], formation: 'line', delay: 0.3 }] },
      { at: 30, spawn: [{ budget: 0.55, pool: ['pyre', 'artillery'], formation: 'crossfire', move: 'entrench', delay: 0.4 }] },
      { at: 48, spawn: [{ id: 'hierophant', count: 1, formation: 'column' }] },
      { at: 64, spawn: [{ budget: 0.5, pool: ['hunter', 'reaper'], formation: 'pincer', delay: 0.35 }] },
    ],
    rewards: { xpMult: 1.45, creditsMult: 1.3, crates: 2 },
  },
];
