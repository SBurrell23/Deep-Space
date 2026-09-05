/**
 * Encounters built around area denial and telegraphed beams.
 *
 * These exist to give the newer enemy archetypes somewhere to appear, and to
 * ask a different question from the rest of the roster. A bullet asks "can you
 * dodge this"; a zone asks "where are you going to stand", and a telegraphed
 * beam asks "can you read this before it fires". Deep space should not be more
 * of the same thing with bigger numbers.
 *
 * See docs/ENCOUNTERS.md for the schema.
 */

export const ADVANCED_ENCOUNTERS = [
  {
    id: 'censer_choir', name: 'Censer Choir', type: 'asteroid', weight: 11,
    minThreat: 7, maxThreat: 16,
    blurb: 'Three ships that will not let you close.',
    intro: 'They hold a loose triangle and burn the space between them. There is a way through it; there is not a way over it.',
    objective: { kind: 'clear' },
    obstacles: { count: 40, speed: 140, size: 16, toughness: 0.8, contact: 11, spreadX: 6.5 },
    waves: [
      { at: 0, spawn: [{ id: 'censer', count: 3, formation: 'arc', delay: 0.5 }] },
      // The artillery is the actual threat. The censers just decide where you
      // are allowed to be while you deal with it.
      { at: 10, spawn: [{ id: 'artillery', count: 2, formation: 'column', delay: 0.6 }] },
      { after: 'cleared', spawn: [{ budget: 0.7, pool: ['censer', 'gunship', 'lancer'], formation: 'v', delay: 0.35 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.2 },
  },

  {
    id: 'ashfall', name: 'Ashfall', type: 'asteroid', weight: 10,
    minThreat: 8, maxThreat: 18,
    blurb: 'They set the sky on fire behind you as you move.',
    intro: 'Pyres do not aim at you. They aim at where you were going.',
    objective: { kind: 'clear' },
    obstacles: { count: 34, speed: 96, size: 32, toughness: 1.5, contact: 17, spreadX: 6 },
    waves: [
      { at: 0, spawn: [{ id: 'pyre', count: 2, formation: 'echelon', delay: 0.5 }] },
      { at: 14, spawn: [{ budget: 0.6, pool: ['wasp', 'interceptor'], formation: 'pincer', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ id: 'pyre', count: 3, formation: 'line', delay: 0.7 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.15 },
  },

  {
    id: 'basilisk_watch', name: "Basilisk's Watch", type: 'asteroid', weight: 10,
    minThreat: 9, maxThreat: 19,
    blurb: 'A lance that tracks you until the moment it fires.',
    intro: 'It paints the line first. Whether that is a courtesy or a taunt is unclear.',
    objective: { kind: 'clear' },
    obstacles: { count: 22, speed: 118, size: 24, toughness: 1, contact: 14, spreadX: 5 },
    waves: [
      { at: 0, spawn: [{ id: 'basilisk', count: 2, formation: 'column', gap: 90, delay: 0.8 }] },
      // Screen ships to stop you simply parking outside the beam's arc.
      { at: 12, spawn: [{ budget: 0.55, pool: ['picket', 'wasp', 'interceptor'], formation: 'random', delay: 0.25 }] },
      { whenRemaining: 2, spawn: [{ id: 'basilisk', count: 1, formation: 'line' }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.2, crates: 1 },
  },

  {
    id: 'siege_line', name: 'The Siege Line', type: 'elite', weight: 9,
    minThreat: 11, maxThreat: 20,
    blurb: 'Emplaced guns that cut rather than shoot.',
    intro: 'They are anchored and they are patient. The beam takes almost two full seconds to charge, which is either generous or contemptuous.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'siege_engine', count: 2, formation: 'line', delay: 1 }] },
      { at: 16, spawn: [{ id: 'aegis_pod', count: 3, formation: 'cluster', delay: 0.3 }] },
      { after: 'cleared', spawn: [{ id: 'siege_engine', count: 1, elite: true, formation: 'line' }] },
    ],
    rewards: { xpMult: 1.5, creditsMult: 1.4, crates: 1 },
  },

  {
    id: 'wall_and_hammer', name: 'Wall And Hammer', type: 'asteroid', weight: 10,
    minThreat: 10, maxThreat: 20,
    blurb: 'Walls from the front, closing walls from the edges.',
    intro: 'The gap is always there. It is rarely where you would like it to be.',
    objective: { kind: 'clear' },
    obstacles: { count: 40, speed: 140, size: 16, toughness: 0.8, contact: 11, spreadX: 6.5 },
    waves: [
      { at: 0, spawn: [{ id: 'bulwark_prime', count: 1, formation: 'line' }] },
      { at: 8, spawn: [{ id: 'cruiser', count: 1, formation: 'line' }] },
      { at: 22, spawn: [{ budget: 0.5, pool: ['zealot', 'seeker'], formation: 'pincer', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.4, creditsMult: 1.3, crates: 1 },
  },

  {
    id: 'harbinger_hunt', name: 'The Harbinger', type: 'boss', weight: 10,
    minThreat: 13, maxThreat: 20,
    blurb: 'It does not close. It simply keeps launching.',
    intro: 'A capital hull built around a magazine. It has never needed to be fast.',
    objective: { kind: 'boss' },
    waves: [
      { at: 0, spawn: [{ id: 'harbinger', count: 1, elite: true, threatBonus: 1, formation: 'line', tag: 'boss' }] },
      { at: 20, spawn: [{ id: 'aegis_pod', count: 2, formation: 'cluster', delay: 0.4 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.6, pool: ['interceptor', 'wasp'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 2.1, creditsMult: 2, crates: 2 },
  },

  {
    id: 'hierophant_rite', name: 'The Hierophant', type: 'boss', weight: 10,
    minThreat: 14, maxThreat: 20,
    blurb: 'It divides the field into places you may not go.',
    intro: 'It lays its patches down in a considered order, and shelters everything that stands inside them.',
    objective: { kind: 'boss' },
    waves: [
      { at: 0, spawn: [{ id: 'hierophant', count: 1, elite: true, threatBonus: 1, formation: 'line', tag: 'boss' }] },
      // The escorts sit inside the aura, so the zones are protecting them too.
      { at: 12, spawn: [{ id: 'artillery', count: 3, formation: 'arc', delay: 0.5 }] },
      { whenRemaining: 2, spawn: [{ id: 'censer', count: 2, formation: 'echelon', delay: 0.4 }] },
    ],
    rewards: { xpMult: 2.2, creditsMult: 2, crates: 2 },
  },
];
