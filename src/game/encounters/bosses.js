/**
 * Capital-ship encounters and the Master Fleet finale.
 * See docs/ENCOUNTERS.md for the schema.
 *
 * A boss is not just a big enemy. Each one here pairs a capital ship with an
 * escort that changes how the capital ship must be approached: something to
 * kill first, something that punishes standing still, something that refills
 * the field while you work. The capital ship carries `tag: 'boss'`, so the
 * objective ends the moment it dies — escorts are pressure, not homework.
 *
 * `elite: true` is 2.2x hull and damage; `threatBonus` stacks the node's threat
 * scaling on top of that. Together they are the only reason a heavy hull can
 * survive long enough to have phases at all.
 */
export const BOSS_ENCOUNTERS = [
  // -------------------------------------------------------------------------
  // LOW BAND — threat 3-12. Readable, one idea each, survivable at level 4-8.
  // -------------------------------------------------------------------------
  {
    id: 'boss_tollkeeper', name: 'The Tollkeeper', type: 'boss', weight: 10,
    minThreat: 3, maxThreat: 9,
    blurb: 'An old customs platform that never got the order to stand down.',
    intro:
      'It broadcasts a tariff schedule on nine channels. The rates are in a currency '
      + 'that stopped existing before you were born. When you do not pay, it begins '
      + 'the collection procedure, exactly as written.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'sentinel', count: 1, elite: true, threatBonus: 2, formation: 'column', tag: 'boss' },
          { id: 'turret_pod', count: 4, formation: 'arc', radius: 150, delay: 0.2 },
        ],
      },
      { at: 26, spawn: [{ id: 'turret_pod', count: 3, formation: 'pincer', delay: 0.4 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.4, pool: ['picket', 'wasp', 'interceptor'], formation: 'arc', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.8, creditsMult: 2.2, crates: 1 },
  },
  {
    id: 'boss_wasp_mother', name: 'Mother of Wasps', type: 'boss', weight: 10,
    minThreat: 4, maxThreat: 11,
    blurb: 'A tender that has been building drones out here for years.',
    intro:
      'The tender does not fight. It has never needed to. It opens its bays and lets '
      + 'the arithmetic do the work: it can build them faster than you can shoot them, '
      + 'for as long as it is alive.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'battle_carrier', count: 1, elite: true, threatBonus: 1, formation: 'column', tag: 'boss' },
          { id: 'wasp', count: 5, formation: 'v', delay: 0.15 },
        ],
      },
      { at: 20, spawn: [{ id: 'interceptor', count: 4, formation: 'pincer', delay: 0.3 }] },
      { at: 44, spawn: [{ budget: 0.45, pool: ['wasp', 'interceptor', 'splitter'], formation: 'random', delay: 0.2 }] },
      { whenRemaining: 1, spawn: [{ id: 'drone_carrier', count: 1, formation: 'line' }] },
    ],
    rewards: { xpMult: 1.9, creditsMult: 1.8, crates: 1 },
  },
  {
    id: 'boss_ironmonger', name: 'The Ironmonger', type: 'boss', weight: 10,
    minThreat: 5, maxThreat: 12,
    blurb: 'A hauler that was cut open and refitted with far too many guns.',
    intro:
      'Someone spent a working lifetime welding armour onto a cargo frame. The result '
      + 'is slow, ugly, and cannot be flanked. It fills the lane with metal and waits '
      + 'for you to run out of room.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [{ id: 'cruiser', count: 1, elite: true, threatBonus: 2, formation: 'column', tag: 'boss' }],
      },
      { at: 14, spawn: [{ id: 'bulwark', count: 2, formation: 'echelon', delay: 0.5 }] },
      { at: 38, spawn: [{ id: 'artillery', count: 2, formation: 'line', gap: 120, delay: 0.4 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.4, pool: ['zealot', 'seeker'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 2, creditsMult: 2, crates: 1 },
  },
  {
    id: 'boss_long_needle', name: 'The Long Needle', type: 'boss', weight: 10,
    minThreat: 6, maxThreat: 13,
    blurb: 'A hunter-killer circling behind a screen of shield pods.',
    intro:
      'It has been orbiting this rock for months, waiting for something to come '
      + 'through. It will not close. It will not run. It simply keeps its distance and '
      + 'files holes in you until the arithmetic is finished.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'hunter', count: 1, elite: true, threatBonus: 2, formation: 'column', tag: 'boss' },
          { id: 'aegis_pod', count: 3, formation: 'arc', radius: 170, delay: 0.3 },
        ],
      },
      { at: 30, spawn: [{ id: 'aegis_pod', count: 2, formation: 'pincer', delay: 0.5 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.5, pool: ['interceptor', 'wasp', 'turret_pod'], formation: 'arc', delay: 0.2 }] },
    ],
    rewards: { xpMult: 2, creditsMult: 1.8, crates: 1 },
  },

  // -------------------------------------------------------------------------
  // MID BAND — threat 8-18. Auras, spawners and stacked threats.
  // -------------------------------------------------------------------------
  {
    id: 'warden_patrol', name: 'The Warden', type: 'boss', weight: 10,
    minThreat: 8, maxThreat: 20,
    blurb: 'A capital ship holding this junction alone.',
    intro:
      'It does not hail you. It simply turns to face you. Whatever it was told to '
      + 'guard here, nobody has come to relieve it, and it has stopped expecting them.',
    objective: { kind: 'boss' },
    waves: [
      { at: 0, spawn: [{ id: 'warden', count: 1, elite: true, threatBonus: 1, formation: 'column', tag: 'boss' }] },
      { at: 18, spawn: [{ budget: 0.5, pool: ['picket', 'interceptor'], formation: 'pincer', delay: 0.3 }] },
      { at: 44, spawn: [{ id: 'lancer', count: 3, formation: 'echelon', delay: 0.35 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.45, pool: ['zealot', 'interceptor'], formation: 'arc', delay: 0.2 }] },
    ],
    rewards: { xpMult: 2, creditsMult: 2, crates: 2 },
  },
  {
    id: 'boss_gravedigger', name: 'The Gravedigger', type: 'boss', weight: 10,
    minThreat: 8, maxThreat: 15,
    blurb: 'A ram-ship that seeds the field before it charges.',
    intro:
      'The wrecks out here are all the same shape: engines intact, cockpit flattened. '
      + 'It does not shoot much. It does not have to. It lays the ground first, then it '
      + 'comes straight down the middle.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'drifting_mine', count: 6, formation: 'random', delay: 0.3 },
          { id: 'reaper', count: 1, elite: true, threatBonus: 2, formation: 'column', wait: 4, tag: 'boss' },
        ],
      },
      { at: 24, spawn: [{ id: 'bomblet', count: 3, formation: 'line', gap: 130, delay: 0.4 }] },
      { at: 50, spawn: [{ budget: 0.5, pool: ['drifting_mine', 'zealot', 'seeker'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 2.1, creditsMult: 1.9, crates: 2 },
  },
  {
    id: 'boss_praise_be', name: 'Praise-Be', type: 'boss', weight: 10,
    minThreat: 9, maxThreat: 16,
    blurb: 'A flagship whose escorts are consumable.',
    intro:
      'The transmission is a roster. Names, ranks, and the order in which they will be '
      + 'spent. Yours is not on it, but there is a blank line at the bottom, and it is '
      + 'the right length.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'vanguard', count: 1, elite: true, threatBonus: 2, formation: 'column', tag: 'boss' },
          { id: 'zealot', count: 4, formation: 'v', delay: 0.2 },
        ],
      },
      { at: 16, spawn: [{ id: 'zealot', count: 5, formation: 'pincer', delay: 0.22 }] },
      { at: 34, spawn: [{ id: 'seeker', count: 6, formation: 'arc', delay: 0.18 }] },
      { at: 56, spawn: [{ budget: 0.5, pool: ['zealot', 'splitter', 'interceptor'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 2.2, creditsMult: 1.9, crates: 2 },
  },
  {
    id: 'boss_hollow_crown', name: 'The Hollow Crown', type: 'boss', weight: 9,
    minThreat: 10, maxThreat: 18,
    blurb: 'A warden inside a ring of shield pods. Nothing gets through at first.',
    intro:
      'The ship at the centre has been dead for a decade. Its escort has not noticed, '
      + 'and keeps the screens up over an empty bridge, and answers hails in a voice '
      + 'that was recorded a long time ago.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'warden', count: 1, elite: true, threatBonus: 3, formation: 'column', tag: 'boss' },
          { id: 'aegis_pod', count: 4, formation: 'arc', radius: 190, delay: 0.25 },
        ],
      },
      { at: 28, spawn: [{ id: 'aegis_pod', count: 3, formation: 'pincer', delay: 0.4 }] },
      { at: 52, spawn: [{ id: 'artillery', count: 3, formation: 'line', gap: 110, delay: 0.4 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.55, pool: ['lancer', 'phantom', 'interceptor'], formation: 'arc', delay: 0.25 }] },
    ],
    rewards: { xpMult: 2.3, creditsMult: 2.2, crates: 2 },
  },
  {
    id: 'boss_pale_argus', name: 'Pale Argus', type: 'boss', weight: 9,
    minThreat: 10, maxThreat: 18,
    blurb: 'A sentinel that fires in every direction at once, and never stops watching.',
    intro:
      'It has no forward arc. That was considered a design flaw once. Out here, with '
      + 'nothing to protect and nobody left to be relieved by, it turned out to be the '
      + 'only feature that mattered.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'sentinel', count: 1, elite: true, threatBonus: 4, formation: 'column', tag: 'boss' },
          { id: 'turret_pod', count: 3, formation: 'echelon', delay: 0.3 },
        ],
      },
      { at: 22, spawn: [{ id: 'missile_boat', count: 2, formation: 'line', gap: 150, delay: 0.5 }] },
      { at: 46, spawn: [{ id: 'hunter', count: 2, formation: 'pincer', delay: 0.4 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.5, pool: ['turret_pod', 'bomblet', 'aegis_pod'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 2.2, creditsMult: 2.1, crates: 2 },
  },
  {
    id: 'boss_castor_pollux', name: 'Castor and Pollux', type: 'boss', weight: 8,
    minThreat: 11, maxThreat: 19,
    blurb: 'Two capital ships that will not fight you separately.',
    intro:
      'Sister ships, launched the same week, never once flown apart. One is patient and '
      + 'one is not. Neither has anything left to say to anyone but the other.',
    objective: { kind: 'boss' },
    waves: [
      { at: 0, spawn: [{ id: 'vanguard', count: 1, elite: true, threatBonus: 2, formation: 'column', tag: 'boss' }] },
      { at: 20, spawn: [{ id: 'reaper', count: 1, elite: true, threatBonus: 2, formation: 'pincer', tag: 'boss' }] },
      { at: 42, spawn: [{ budget: 0.5, pool: ['lancer', 'phantom'], formation: 'echelon', delay: 0.35 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.5, pool: ['interceptor', 'zealot', 'seeker'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 2.5, creditsMult: 2.3, crates: 2 },
  },
  {
    id: 'boss_undertow', name: 'The Undertow', type: 'boss', weight: 8,
    minThreat: 12, maxThreat: 19,
    blurb: 'A carrier that keeps the lane full while a cruiser walks it.',
    intro:
      'The carrier stays back. It has learned that it does not need to be near you to '
      + 'be the reason you die. Its escort simply advances, at a fixed speed, forever.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'cruiser', count: 1, elite: true, threatBonus: 3, formation: 'column', tag: 'boss' },
          { id: 'battle_carrier', count: 1, formation: 'line', wait: 6 },
        ],
      },
      { at: 26, spawn: [{ id: 'drone_carrier', count: 2, formation: 'pincer', delay: 0.5 }] },
      { at: 52, spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp', 'splitter'], formation: 'random', delay: 0.2 }] },
      { whenRemaining: 2, spawn: [{ id: 'missile_boat', count: 2, formation: 'echelon', delay: 0.4 }] },
    ],
    rewards: { xpMult: 2.4, creditsMult: 2.4, crates: 2 },
  },

  // -------------------------------------------------------------------------
  // HIGH BAND — threat 15-20. Assumes a levelled ship. Stacks threats.
  // -------------------------------------------------------------------------
  {
    id: 'boss_cartographer', name: 'The Cartographer', type: 'boss', weight: 8,
    minThreat: 15, maxThreat: 20,
    blurb: 'It has been mapping this region. You are on the map now.',
    intro:
      'The first thing it sends you is your own approach vector, drawn correctly, '
      + 'including the two corrections you have not made yet. Then it sends the '
      + 'survey it has been compiling. Your ship is listed under obstacles.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'warden', count: 1, elite: true, threatBonus: 5, formation: 'column', tag: 'boss' },
          { id: 'phantom', count: 3, formation: 'arc', delay: 0.3 },
        ],
      },
      { at: 22, spawn: [{ id: 'phantom', count: 3, formation: 'pincer', delay: 0.35 }] },
      { at: 44, spawn: [{ id: 'hunter', count: 3, formation: 'echelon', delay: 0.3 }] },
      { at: 68, spawn: [{ budget: 0.6, pool: ['phantom', 'lancer', 'aegis_pod'], formation: 'random', delay: 0.25 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.5, pool: ['interceptor', 'hunter'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 3, creditsMult: 2.8, crates: 3 },
  },
  {
    id: 'boss_famine_late_model', name: 'Famine, Late Model', type: 'boss', weight: 8,
    minThreat: 15, maxThreat: 20,
    blurb: 'Two reapers, refurbished, running an old contract.',
    intro:
      'The hulls are older than the war they were built for. Everything inside them has '
      + 'been replaced twice. Whatever the original order was, it is still the order, '
      + 'and it is still being carried out.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'reaper', count: 1, elite: true, threatBonus: 4, formation: 'column', tag: 'boss' },
          { id: 'seeker', count: 6, formation: 'arc', delay: 0.15 },
        ],
      },
      { at: 24, spawn: [{ id: 'reaper', count: 1, elite: true, threatBonus: 3, formation: 'pincer', tag: 'boss' }] },
      { at: 48, spawn: [{ id: 'zealot', count: 7, formation: 'random', delay: 0.18 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.6, pool: ['zealot', 'seeker', 'raider'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 3, creditsMult: 2.6, crates: 3 },
  },
  {
    id: 'boss_long_war', name: 'The Long War', type: 'boss', weight: 7,
    minThreat: 16, maxThreat: 20,
    blurb: 'A flagship and its last two escorts, still in formation.',
    intro:
      'They have not received an order in a very long time. They have not needed one. '
      + 'The formation is correct, the intervals are correct, and there is nobody left '
      + 'alive who could tell them to stop.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'vanguard', count: 1, elite: true, threatBonus: 5, formation: 'column', tag: 'boss' },
          { id: 'cruiser', count: 1, formation: 'echelon', wait: 3 },
          { id: 'battle_carrier', count: 1, formation: 'echelon', wait: 6 },
        ],
      },
      { at: 30, spawn: [{ id: 'fighter', count: 3, formation: 'v', delay: 0.3 }] },
      { at: 58, spawn: [{ budget: 0.6, pool: ['lancer', 'artillery', 'bulwark'], formation: 'line', delay: 0.35 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.55, pool: ['hunter', 'phantom', 'interceptor'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 3.2, creditsMult: 3, crates: 3 },
  },
  {
    id: 'boss_thresher', name: 'The Thresher', type: 'boss', weight: 7,
    minThreat: 17, maxThreat: 20,
    blurb: 'It fills the field with smaller problems and then becomes the large one.',
    intro:
      'It does not aim at you. It aims at where the room is, and takes the room away, '
      + 'a little at a time, until there is one place left to be and it is already '
      + 'moving there.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'reaper', count: 1, elite: true, threatBonus: 5, formation: 'column', tag: 'boss' },
          { id: 'splitter', count: 5, formation: 'arc', delay: 0.2 },
        ],
      },
      { at: 20, spawn: [{ id: 'drifting_mine', count: 8, formation: 'random', delay: 0.25 }] },
      { at: 40, spawn: [{ id: 'splitter', count: 6, formation: 'pincer', delay: 0.2 }] },
      { at: 64, spawn: [{ budget: 0.7, pool: ['bomblet', 'splitter', 'drifting_mine', 'zealot'], formation: 'random', delay: 0.2 }] },
      { whenRemaining: 2, spawn: [{ id: 'sentinel', count: 2, formation: 'pincer', delay: 0.5 }] },
    ],
    rewards: { xpMult: 3.2, creditsMult: 2.8, crates: 3 },
  },

  // -------------------------------------------------------------------------
  // THE MASTER FLEET — three consecutive encounters, played back to back by the
  // run code. Never in the random pool. This is the hardest content in the game
  // and it is meant to read as an army rather than as a ship.
  // -------------------------------------------------------------------------
  {
    id: 'masterfleet_1', name: 'The Master Fleet — Screen', type: 'masterfleet', weight: 0,
    minThreat: 18, maxThreat: 20, excludeFromPool: true,
    blurb: 'The outer screen. There is no gap in it.',
    intro:
      'It is not a formation so much as a weather system. The screen is the part they '
      + 'can afford to lose, and there is a great deal of it. Nothing here is '
      + 'individually dangerous. That is not the point.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ budget: 0.8, pool: ['picket', 'wasp', 'interceptor'], formation: 'arc', delay: 0.12 }] },
      { at: 14, spawn: [{ budget: 0.7, pool: ['interceptor', 'zealot', 'seeker'], formation: 'pincer', delay: 0.14 }] },
      { at: 30, spawn: [{ id: 'gunship', count: 4, formation: 'v', delay: 0.25 }] },
      { at: 46, spawn: [{ budget: 0.8, pool: ['lancer', 'splitter', 'turret_pod'], formation: 'line', delay: 0.2 }] },
      { at: 64, spawn: [{ id: 'drone_carrier', count: 3, formation: 'echelon', delay: 0.4 }] },
      { at: 82, spawn: [{ budget: 0.9, pool: ['interceptor', 'wasp', 'zealot', 'bomblet'], formation: 'random', delay: 0.12 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.7, pool: ['raider', 'scout', 'interceptor'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 3.5, creditsMult: 3, crates: 2 },
  },
  {
    id: 'masterfleet_2', name: 'The Master Fleet — Command Element', type: 'masterfleet', weight: 0,
    minThreat: 18, maxThreat: 20, excludeFromPool: true,
    blurb: 'The ships that give the orders, and the ones that carry them.',
    intro:
      'Past the screen the traffic thins and improves. These are the crews that were '
      + 'kept. They fly like people who expect to be alive tomorrow, which is the '
      + 'first genuinely unsettling thing you have seen out here.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'cruiser', count: 2, formation: 'echelon', delay: 0.5 },
          { id: 'aegis_pod', count: 3, formation: 'arc', radius: 180, delay: 0.3 },
        ],
      },
      { at: 18, spawn: [{ id: 'vanguard', count: 1, elite: true, threatBonus: 2, formation: 'column' }] },
      { at: 34, spawn: [{ budget: 0.7, pool: ['missile_boat', 'hunter', 'phantom'], formation: 'pincer', delay: 0.3 }] },
      { at: 54, spawn: [{ id: 'warden', count: 1, elite: true, threatBonus: 2, formation: 'line' }] },
      { at: 74, spawn: [{ id: 'battle_carrier', count: 2, formation: 'echelon', delay: 0.5 }] },
      { at: 94, spawn: [{ budget: 0.8, pool: ['fighter', 'sentinel', 'lancer', 'artillery'], formation: 'line', delay: 0.25 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.7, pool: ['phantom', 'hunter', 'raider'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 4, creditsMult: 3.5, crates: 3 },
  },
  {
    id: 'masterfleet_3', name: 'The Master Fleet — Flagship', type: 'masterfleet', weight: 0,
    minThreat: 18, maxThreat: 20, excludeFromPool: true,
    blurb: 'The last ship. It has been waiting the whole time.',
    intro:
      'It is bigger than the ships that made it, and older than the orders it follows. '
      + 'It does not hail you, or turn, or manoeuvre. It has spent a long time learning '
      + 'that it does not have to. Everything else out here was arithmetic. This is the '
      + 'answer.',
    objective: { kind: 'boss' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'warden', count: 1, elite: true, threatBonus: 8, formation: 'column', tag: 'boss' },
          { id: 'aegis_pod', count: 4, formation: 'arc', radius: 200, delay: 0.25 },
        ],
      },
      { at: 16, spawn: [{ id: 'vanguard', count: 1, elite: true, threatBonus: 3, formation: 'pincer' }] },
      { at: 32, spawn: [{ budget: 0.6, pool: ['zealot', 'seeker', 'interceptor'], formation: 'random', delay: 0.15 }] },
      { at: 48, spawn: [{ id: 'reaper', count: 1, elite: true, threatBonus: 3, formation: 'pincer' }] },
      { at: 62, spawn: [{ id: 'aegis_pod', count: 3, formation: 'arc', radius: 170, delay: 0.3 }] },
      { at: 78, spawn: [{ budget: 0.7, pool: ['hunter', 'phantom', 'missile_boat'], formation: 'echelon', delay: 0.25 }] },
      { at: 96, spawn: [{ budget: 0.7, pool: ['zealot', 'splitter', 'bomblet', 'interceptor'], formation: 'random', delay: 0.15 }] },
      { at: 116, spawn: [{ id: 'cruiser', count: 2, formation: 'pincer', delay: 0.5 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.8, pool: ['fighter', 'raider', 'hunter', 'sentinel'], formation: 'arc', delay: 0.2 }] },
    ],
    rewards: { xpMult: 6, creditsMult: 5, crates: 5 },
  },
];
