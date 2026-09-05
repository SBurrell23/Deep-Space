/**
 * Hostiles encounters that pose a SHAPE, not just a roster.
 *
 * The other thirty-eight are variations on "ships arrive from the right and
 * you shoot them", which is one problem wearing a lot of names — the variety
 * was in the flavour text rather than in anything you did about it. These ask
 * a question about where you fly:
 *
 *   gauntlet   a wall down the far side; go round it, not through it
 *   crossfire  two banks firing across the lane you want to be in
 *   shell      a screen you must open before you can reach what it protects
 *   rear       something jumped in behind you
 *
 * They lean on the per-group `move` override, so the same archetype can hold a
 * line in one fight and come at you in another.
 */

export const SHAPE_ENCOUNTERS = [
  {
    id: 'picket_wall', name: 'The Picket Wall', type: 'asteroid', weight: 14,
    minThreat: 2, maxThreat: 11,
    blurb: 'A line across the lane. There is a way round it.',
    intro:
      'They are not coming to you. They have parked across the corridor and pointed '
      + 'everything the same way, which is efficient and makes them predictable. '
      + 'The gaps are at the top and the bottom, and they know that too.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    waves: [
      { at: 0, spawn: [{ id: 'turret_pod', count: 7, formation: 'gauntlet', move: 'entrench', delay: 0.1 }] },
      { at: 12, spawn: [{ id: 'gunship', count: 4, formation: 'v', delay: 0.2 }] },
      { at: 26, spawn: [{ id: 'artillery', count: 3, formation: 'gauntlet', move: 'entrench', delay: 0.3 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.5, pool: ['interceptor', 'raider'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.1 },
  },

  {
    id: 'the_narrows', name: 'The Narrows', type: 'asteroid', weight: 13,
    minThreat: 4, maxThreat: 15,
    blurb: 'Guns above and below. The middle is the shooting gallery.',
    intro:
      'Two banks, dug into the rock above and below, and a clear lane between them '
      + 'that is clear for a reason. Everything they have is pointed at the middle '
      + 'of it. You can go through fast, or you can go along the edge and take them '
      + 'apart one bank at a time.',
    objective: { kind: 'clear' },
    obstacles: { count: 34, speed: 96, size: 32, toughness: 1.5, contact: 17, spreadX: 6 },
    waves: [
      { at: 0, spawn: [{ id: 'lancer', count: 4, formation: 'crossfire', move: 'entrench', delay: 0.15 }] },
      { at: 16, spawn: [{ id: 'missile_boat', count: 2, formation: 'crossfire', move: 'entrench', delay: 0.25 }] },
      { at: 32, spawn: [{ budget: 0.6, pool: ['interceptor', 'wasp'], formation: 'line', delay: 0.12 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.5, pool: ['gunship', 'raider'], formation: 'v', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.15 },
  },

  {
    id: 'the_shell', name: 'Shell Formation', type: 'asteroid', weight: 12,
    minThreat: 5, maxThreat: 16,
    blurb: 'A screen around something worth screening.',
    intro:
      'The pods are cheap and there are a lot of them, arranged in a sphere around '
      + 'the thing they were built to keep alive. Nothing in the shell will hurt you '
      + 'much. Everything inside it will.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'aegis_pod', count: 8, formation: 'shell', radius: 130, move: 'guard', delay: 0.1 },
          { id: 'artillery', count: 3, formation: 'cluster', move: 'hover', delay: 0.4 },
        ],
      },
      { at: 20, spawn: [{ id: 'aegis_pod', count: 5, formation: 'shell', radius: 90, move: 'guard', delay: 0.2 }] },
      { at: 38, spawn: [{ budget: 0.6, pool: ['hunter', 'phantom'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.2, crates: 1 },
  },

  {
    id: 'behind_you', name: 'Behind You', type: 'asteroid', weight: 11,
    minThreat: 3, maxThreat: 14,
    blurb: 'They waited for you to pass, then lit their drives.',
    intro:
      'The wrecks you flew past were not wrecks. They were cold, and patient, and '
      + 'they are between you and the way you came. Everything you have learned '
      + 'about which way to point is briefly wrong.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    waves: [
      { at: 0, spawn: [{ id: 'raider', count: 5, formation: 'rear', move: 'advance', delay: 0.18 }] },
      { at: 10, spawn: [{ id: 'interceptor', count: 4, formation: 'line', delay: 0.15 }] },
      { at: 24, spawn: [{ id: 'hunter', count: 3, formation: 'rear', move: 'advance', delay: 0.3 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.55, pool: ['wasp', 'zealot'], formation: 'ambush', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.1 },
  },

  {
    id: 'anvil_line', name: 'Anvil Line', type: 'asteroid', weight: 10,
    minThreat: 8, maxThreat: 20,
    blurb: 'A wall in front, a hammer coming in behind it.',
    intro:
      'The line is there to hold you still. It is very good at that, and it is not '
      + 'what kills you. Listen for the second engine note underneath the first.',
    objective: { kind: 'clear' },
    obstacles: { count: 16, speed: 74, size: 40, toughness: 2.6, contact: 22, spreadX: 4.4 },
    waves: [
      { at: 0, spawn: [{ id: 'sentinel', count: 5, formation: 'gauntlet', move: 'entrench', delay: 0.15 }] },
      { at: 14, spawn: [{ id: 'reaper', count: 2, formation: 'rear', move: 'advance', delay: 0.4 }] },
      { at: 30, spawn: [{ id: 'artillery', count: 3, formation: 'crossfire', move: 'entrench', delay: 0.25 }] },
      { at: 48, spawn: [{ budget: 0.6, pool: ['hunter', 'lancer'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.25, crates: 1 },
  },

  {
    id: 'closing_iris', name: 'Closing Iris', type: 'asteroid', weight: 10,
    minThreat: 10, maxThreat: 20,
    blurb: 'A ring, and it is getting smaller.',
    intro:
      'They came in as a sphere and they are shrinking it. There is no side to '
      + 'flank because every side is the same side. The only direction that has ever '
      + 'worked here is through.',
    objective: { kind: 'clear' },
    obstacles: { count: 22, speed: 118, size: 24, toughness: 1, contact: 14, spreadX: 5 },
    waves: [
      { at: 0, spawn: [{ id: 'seeker', count: 6, formation: 'shell', radius: 230, move: 'orbit', delay: 0.12 }] },
      { at: 12, spawn: [{ id: 'turret_pod', count: 5, formation: 'shell', radius: 185, move: 'guard', delay: 0.1 }] },
      { at: 26, spawn: [{ id: 'phantom', count: 3, formation: 'shell', radius: 150, delay: 0.3 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.6, pool: ['zealot', 'bomblet'], formation: 'shell', radius: 210, delay: 0.12 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.2, crates: 1 },
  },
];
