/**
 * Standard combat encounters: fleets, patrols, ambushes, elites.
 * See docs/ENCOUNTERS.md for the schema.
 *
 * Every encounter here is built around ONE readable idea — a support ship that
 * must die first, a screen you have to push through, a spawner that outpaces
 * you if ignored. Composition is chosen so the parts interact: something that
 * holds station and shoots, plus something that closes, so the player is always
 * choosing where to be rather than just what to shoot.
 */
export const COMBAT_ENCOUNTERS = [
  // -------------------------------------------------------------------------
  // LOW BAND (1–8) — readable, forgiving, teaches the vocabulary.
  // -------------------------------------------------------------------------
  {
    id: 'picket_line', name: 'Picket Line', type: 'hostiles', weight: 14,
    minThreat: 1, maxThreat: 6,
    blurb: 'A thin screen of automated drones, and whatever it calls in.',
    intro: 'Someone left a tripwire out here. It has noticed you.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'picket', count: 5, formation: 'v', delay: 0.3 }] },
      { after: 'cleared', spawn: [{ budget: 0.55, pool: ['picket', 'wasp'], formation: 'arc', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.25 }] },
    ],
  },

  {
    id: 'gun_and_wasps', name: 'Standing Patrol', type: 'hostiles', weight: 12,
    minThreat: 1, maxThreat: 5,
    blurb: 'One Gunship holding a lane. Wasps run it from above and below.',
    intro: 'The Gunship does not chase. It does not need to.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'gunship', count: 1, formation: 'column' }] },
      { at: 8, spawn: [{ id: 'wasp', count: 5, formation: 'pincer', delay: 0.15 }] },
      { after: 'cleared', spawn: [{ budget: 0.6, pool: ['picket', 'wasp', 'interceptor'], formation: 'arc', delay: 0.2 }] },
    ],
  },

  {
    id: 'mine_garden', name: 'Mine Garden', type: 'hostiles', weight: 11,
    minThreat: 1, maxThreat: 7,
    blurb: 'Mines seeded across the lane. Turret pods cover the gaps between them.',
    intro: 'Someone planted this and never came back for the harvest.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'drifting_mine', count: 6, formation: 'ambush' }] },
      { at: 8, spawn: [{ id: 'turret_pod', count: 2, formation: 'column', gap: 90 }] },
      { after: 'cleared', spawn: [{ budget: 0.6, pool: ['picket', 'seeker'], formation: 'arc', delay: 0.2 }] },
    ],
  },

  {
    id: 'scout_patrol', name: 'Scout Patrol', type: 'hostiles', weight: 12,
    minThreat: 1, maxThreat: 6,
    blurb: 'A Scout runs the lane and leaves. What it told is already on the way.',
    intro: 'It comes in fast, holds just long enough to look at you, and goes.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'picket', count: 4, formation: 'line', delay: 0.25 }] },
      { at: 7, spawn: [{ id: 'scout', count: 1, formation: 'column' }] },
      { after: 'cleared', spawn: [{ budget: 0.4, pool: ['wasp', 'picket'], formation: 'echelon', delay: 0.2 }] },
    ],
  },

  {
    id: 'wasp_nest', name: 'Wasp Nest', type: 'hostiles', weight: 12,
    minThreat: 1, maxThreat: 6,
    blurb: 'Wasps from the edges while Bomblet Carriers seed the space you back into.',
    intro: 'Small things, fast, and there is no corner they have not thought about.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'wasp', count: 6, formation: 'arc', delay: 0.15 }] },
      { at: 10, spawn: [{ id: 'bomblet', count: 2, formation: 'column', gap: 80 }] },
      { whenRemaining: 2, spawn: [{ id: 'wasp', count: 5, formation: 'pincer', delay: 0.12 }] },
    ],
  },

  {
    id: 'seeker_tide', name: 'Seeker Tide', type: 'hostiles', weight: 12,
    minThreat: 1, maxThreat: 7,
    blurb: 'Unarmed ramming pods drive you sideways into a turret sweep.',
    intro: 'The pods have no guns. They do not need any if you keep moving where they want.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'seeker', count: 4, formation: 'arc', delay: 0.2 }] },
      { at: 9, spawn: [{ id: 'turret_pod', count: 2, formation: 'echelon', gap: 70 }] },
      { whenRemaining: 3, spawn: [{ id: 'seeker', count: 5, formation: 'pincer', delay: 0.15 }] },
    ],
  },

  {
    id: 'cold_start', name: 'Cold Start', type: 'hostiles', weight: 9,
    minThreat: 2, maxThreat: 8,
    blurb: 'Something was already drifting here with its drives cold. It is close.',
    intro: 'Three pods light up at knife range. They have no guns, which is not comfort.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'seeker', count: 3, formation: 'ambush' }] },
      { at: 6, spawn: [{ budget: 0.55, pool: ['wasp', 'interceptor'], formation: 'random', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ budget: 0.55, pool: ['gunship', 'splitter'], formation: 'v', delay: 0.25 }] },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['interceptor', 'zealot', 'picket'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1, crates: 0 },
  },

  {
    id: 'splitter_bloom', name: 'Splitter Bloom', type: 'hostiles', weight: 11,
    minThreat: 2, maxThreat: 9,
    blurb: 'Splitters, and only Splitters. Killing one makes two more.',
    intro: 'The problem gets bigger before it gets smaller. There is no way around that.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'splitter', count: 4, formation: 'arc', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ id: 'splitter', count: 5, formation: 'v', delay: 0.18 }] },
      { after: 'cleared', spawn: [{ id: 'splitter', count: 6, formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1, crates: 0 },
  },

  {
    id: 'tender_run', name: 'Tender Run', type: 'hostiles', weight: 11,
    minThreat: 2, maxThreat: 9,
    blurb: 'A Drone Tender that floods the lane if you leave it alone. It runs when you do not.',
    intro: 'The Tender keeps its distance and keeps building. Its escort is arranged so that chasing it costs you.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'drone_carrier', count: 1, formation: 'column', tag: 'tender' },
          { id: 'gunship', count: 1, formation: 'line', wait: 1.5 },
        ],
      },
      { at: 12, spawn: [{ id: 'interceptor', count: 3, formation: 'pincer', delay: 0.3 }] },
      { at: 26, spawn: [{ budget: 0.5, pool: ['wasp', 'interceptor'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.1, crates: 1 },
  },

  {
    id: 'lancer_duel', name: 'Lancers', type: 'hostiles', weight: 11,
    minThreat: 3, maxThreat: 9,
    blurb: 'Lancers copy your vertical position. Artillery fires where you were going.',
    intro: 'You cannot shake them by climbing. They climb with you, and the heavy shells land where that leaves you.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'lancer', count: 2, formation: 'line' }] },
      { at: 10, spawn: [{ id: 'artillery', count: 2, formation: 'column', gap: 90 }] },
      { after: 'cleared', spawn: [{ ids: ['lancer', 'lancer', 'interceptor', 'interceptor'], formation: 'v', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1, crates: 0 },
  },

  {
    id: 'zealot_run', name: 'Zealot Run', type: 'hostiles', weight: 11,
    minThreat: 3, maxThreat: 10,
    blurb: 'Suicide drones from the edges. Gunships hold the ground they push you onto.',
    intro: 'The Zealots do not want to trade. They want you standing still for half a second.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'zealot', count: 4, formation: 'pincer', delay: 0.3 }] },
      { at: 8, spawn: [{ id: 'gunship', count: 2, formation: 'line' }] },
      { whenRemaining: 3, spawn: [{ id: 'zealot', count: 6, formation: 'arc', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['zealot', 'seeker'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1, crates: 0 },
  },

  {
    id: 'raider_boarding', name: 'Boarding Run', type: 'hostiles', weight: 11,
    minThreat: 4, maxThreat: 11,
    blurb: 'Raiders close to shotgun range on purpose. Seekers make backing off cost the same.',
    intro: 'They are not paid to shoot from distance. Nothing out here is.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'raider', count: 2, formation: 'v', gap: 60 }] },
      {
        at: 12,
        spawn: [
          { id: 'raider', count: 1, formation: 'column' },
          { id: 'seeker', count: 4, formation: 'random', delay: 0.2 },
        ],
      },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['raider', 'seeker', 'zealot'], formation: 'cluster', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1, creditsMult: 1.3, crates: 0 },
  },

  {
    id: 'scrap_court', name: 'Scrap Court', type: 'hostiles', weight: 10,
    minThreat: 4, maxThreat: 12,
    blurb: 'Turret pods welded into a drifting minefield. Raiders arrive while you are threading it.',
    intro: 'Someone made a room out of wreckage and left guns in the walls.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'turret_pod', count: 3, formation: 'random' },
          { id: 'drifting_mine', count: 6, formation: 'random', delay: 0.15 },
        ],
      },
      { at: 12, spawn: [{ id: 'raider', count: 1, formation: 'column' }] },
      { whenRemaining: 3, spawn: [{ budget: 0.55, pool: ['raider', 'seeker', 'wasp'], formation: 'pincer', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['turret_pod', 'bomblet'], formation: 'echelon', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.1, creditsMult: 1.15, crates: 0 },
  },

  {
    id: 'holding_pattern', name: 'Holding Pattern', type: 'hostiles', weight: 10,
    minThreat: 4, maxThreat: 11,
    blurb: 'Your drive is spooling. Nothing here has to die — you only have to still be here.',
    intro: 'Seventy seconds. The field never empties, and a Tender arrives halfway through to make sure of it.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ budget: 0.4, pool: ['picket', 'wasp'], formation: 'arc', delay: 0.2 }] },
      { at: 14, spawn: [{ budget: 0.45, pool: ['interceptor', 'seeker'], formation: 'pincer', delay: 0.2 }] },
      { at: 28, spawn: [{ id: 'drone_carrier', count: 1, formation: 'column' }] },
      { at: 42, spawn: [{ budget: 0.5, pool: ['gunship', 'splitter'], formation: 'v', delay: 0.25 }] },
      { at: 56, spawn: [{ budget: 0.45, pool: ['zealot', 'interceptor'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1, crates: 0 },
  },

  // -------------------------------------------------------------------------
  // MID BAND (5–14) — auras, spawners, ships that must be killed in an order.
  // -------------------------------------------------------------------------
  {
    id: 'aegis_battery', name: 'Aegis Battery', type: 'hostiles', weight: 11,
    minThreat: 5, maxThreat: 12,
    blurb: 'Artillery sat behind an Aegis Pod. Nothing dies until the pod does.',
    intro: 'The pod shelters everything near it and refuses to come to you. The guns do not have to move at all.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'artillery', count: 3, formation: 'line' },
          { id: 'aegis_pod', count: 1, formation: 'column', wait: 1 },
        ],
      },
      { at: 15, spawn: [{ budget: 0.55, pool: ['gunship', 'turret_pod'], formation: 'echelon', delay: 0.25 }] },
      {
        after: 'cleared',
        spawn: [
          { id: 'aegis_pod', count: 2, formation: 'cluster' },
          { id: 'artillery', count: 2, formation: 'arc', wait: 1.2 },
        ],
      },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.1, crates: 1 },
  },

  {
    id: 'fighter_wing', name: 'Fighter Wing', type: 'hostiles', weight: 11,
    minThreat: 5, maxThreat: 12,
    blurb: 'Fighters hold the far side laying down spread fire. Interceptors dive through it.',
    intro: 'The Fighters want you pinned against the left wall. The Interceptors are what happens if you go.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'fighter', count: 2, formation: 'line' }] },
      { at: 12, spawn: [{ id: 'interceptor', count: 4, formation: 'pincer', delay: 0.2 }] },
      {
        whenRemaining: 3,
        spawn: [
          { id: 'fighter', count: 1, formation: 'column' },
          { budget: 0.5, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.15, wait: 1.5 },
        ],
      },
    ],
    rewards: { xpMult: 1.15, creditsMult: 1.1, crates: 0 },
  },

  {
    id: 'bomblet_lattice', name: 'Lattice', type: 'hostiles', weight: 10,
    minThreat: 5, maxThreat: 13,
    blurb: 'Bomblet Carriers build a mine lattice while drones push you into it.',
    intro: 'Every second you spend not killing carriers, the playable part of the field gets smaller.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'bomblet', count: 3, formation: 'echelon', gap: 60 },
          { id: 'picket', count: 6, formation: 'arc', delay: 0.15, wait: 1.5 },
        ],
      },
      {
        at: 14,
        spawn: [
          { id: 'bomblet', count: 2, formation: 'column', gap: 80 },
          { budget: 0.5, pool: ['picket', 'wasp', 'seeker'], formation: 'pincer', delay: 0.2 },
        ],
      },
      { whenRemaining: 4, spawn: [{ budget: 0.6, pool: ['splitter', 'interceptor', 'bomblet'], formation: 'random', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1, crates: 0 },
  },

  {
    id: 'bulwark_advance', name: 'Bulwark Advance', type: 'hostiles', weight: 11,
    minThreat: 6, maxThreat: 14,
    blurb: 'Two Bulwarks abreast, unhurried and armoured. Wasps come from above and below.',
    intro: 'They do not manoeuvre. They advance. Cover out here is a thing you make, not a thing you find.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'bulwark', count: 2, formation: 'line' }] },
      { at: 10, spawn: [{ id: 'wasp', count: 8, formation: 'pincer', delay: 0.12 }] },
      {
        whenRemaining: 2,
        spawn: [
          { id: 'bulwark', count: 2, formation: 'v', gap: 70 },
          { id: 'gunship', count: 2, formation: 'echelon', wait: 2 },
        ],
      },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['wasp', 'interceptor', 'zealot'], formation: 'pincer', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1.15, crates: 1 },
  },

  {
    id: 'relay_strike', name: 'Relay Strike', type: 'hostiles', weight: 10,
    minThreat: 6, maxThreat: 14,
    blurb: 'Three anchored relays calling in the patrol. Kill the relays; the patrol is optional.',
    intro: 'The pods sit still and talk. Everything arriving is because of them, and none of it has to be fought.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'turret_pod', count: 3, formation: 'column', gap: 100, tag: 'relay' },
          { id: 'gunship', count: 2, formation: 'line', wait: 1.5 },
        ],
      },
      { at: 12, spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp', 'seeker'], formation: 'pincer', delay: 0.2 }] },
      { at: 24, spawn: [{ budget: 0.55, pool: ['gunship', 'lancer'], formation: 'v', delay: 0.3 }] },
      { at: 36, spawn: [{ budget: 0.5, pool: ['zealot', 'interceptor'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.15, crates: 1 },
  },

  {
    id: 'interceptor_storm', name: 'Relay Storm', type: 'hostiles', weight: 10,
    minThreat: 6, maxThreat: 14,
    blurb: 'Interceptors in relays past two Artillery platforms firing where you have to be.',
    intro: 'The Interceptors sweep through and come back around. The guns cover the only place their pass leaves you.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'interceptor', count: 8, formation: 'arc', delay: 0.12 }] },
      { at: 10, spawn: [{ id: 'artillery', count: 2, formation: 'column', gap: 110 }] },
      { at: 22, spawn: [{ id: 'interceptor', count: 8, formation: 'pincer', delay: 0.1 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.2, creditsMult: 1, crates: 0 },
  },

  {
    id: 'elite_honour_guard', name: 'Honour Guard', type: 'elite', weight: 8,
    minThreat: 6, maxThreat: 13,
    blurb: 'Two Bulwarks in a flag officer\'s colours. Reinforced, and they do not break formation.',
    intro: 'Same hull, twice as much of it. They will still be coming forward in a minute.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'bulwark', count: 2, formation: 'line', elite: true }] },
      {
        at: 14,
        spawn: [
          { id: 'gunship', count: 2, formation: 'v' },
          { id: 'lancer', count: 1, formation: 'column', wait: 2 },
        ],
      },
      { whenRemaining: 2, spawn: [{ budget: 0.65, pool: ['interceptor', 'wasp', 'seeker'], formation: 'pincer', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.25, crates: 1 },
  },

  {
    id: 'phantom_hunt', name: 'Ghost Screen', type: 'hostiles', weight: 9,
    minThreat: 7, maxThreat: 15,
    blurb: 'Two Phantoms hidden in a drone screen. They are the only things that matter.',
    intro: 'They cloak every four seconds. The drones are cover, and the drones do not have to die.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'phantom', count: 2, formation: 'random', tag: 'ghost' },
          { id: 'picket', count: 8, formation: 'random', delay: 0.15, wait: 1 },
        ],
      },
      { at: 14, spawn: [{ budget: 0.6, pool: ['picket', 'wasp', 'splitter'], formation: 'arc', delay: 0.2 }] },
      { at: 28, spawn: [{ budget: 0.55, pool: ['interceptor', 'wasp'], formation: 'pincer', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.2, crates: 1 },
  },

  {
    id: 'shielded_swarm', name: 'Shielded Cloud', type: 'hostiles', weight: 9,
    minThreat: 7, maxThreat: 15,
    blurb: 'Aegis Pods buried in a drone cloud. Everything is twice the work until you dig them out.',
    intro: 'The pods run from you at exactly the speed of the cloud they are hiding in.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'aegis_pod', count: 2, formation: 'cluster', radius: 80 },
          { id: 'picket', count: 8, formation: 'arc', delay: 0.12, wait: 1 },
        ],
      },
      { at: 12, spawn: [{ budget: 0.6, pool: ['wasp', 'splitter', 'interceptor'], formation: 'random', delay: 0.15 }] },
      {
        at: 26,
        spawn: [
          { id: 'aegis_pod', count: 1, formation: 'column' },
          { budget: 0.6, pool: ['picket', 'seeker', 'zealot'], formation: 'pincer', delay: 0.15 },
        ],
      },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.1, crates: 0 },
  },

  {
    id: 'missile_screen', name: 'Missile Screen', type: 'hostiles', weight: 10,
    minThreat: 8, maxThreat: 16,
    blurb: 'Homing fire from the back of the field. A mine drift across the front of it.',
    intro: 'The missiles make you move. The mines decide where moving is allowed.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'drifting_mine', count: 8, formation: 'random' },
          { id: 'missile_boat', count: 2, formation: 'column', gap: 90, wait: 2 },
        ],
      },
      {
        at: 14,
        spawn: [
          { id: 'missile_boat', count: 1, formation: 'line' },
          { id: 'bomblet', count: 3, formation: 'echelon', delay: 0.3 },
        ],
      },
      { after: 'cleared', spawn: [{ budget: 0.7, pool: ['missile_boat', 'bomblet', 'drifting_mine'], formation: 'arc', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.25, creditsMult: 1.15, crates: 1 },
  },

  {
    id: 'hive_break', name: 'Hive', type: 'hostiles', weight: 9,
    minThreat: 9, maxThreat: 18,
    blurb: 'Two Tenders and a Battle Carrier, all producing faster than you can clear.',
    intro: 'Nothing here is dangerous on its own. All of it is still here in two minutes if you fight the output instead of the source.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'drone_carrier', count: 2, formation: 'column', gap: 100 },
          { id: 'interceptor', count: 4, formation: 'pincer', delay: 0.2, wait: 2 },
        ],
      },
      { at: 16, spawn: [{ id: 'battle_carrier', count: 1, formation: 'column' }] },
      { whenRemaining: 6, spawn: [{ budget: 0.7, pool: ['interceptor', 'wasp', 'picket'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.25, crates: 1 },
  },

  {
    id: 'sentinel_cordon', name: 'Sentinel Cordon', type: 'hostiles', weight: 10,
    minThreat: 9, maxThreat: 17,
    blurb: 'Anchored Sentinels throwing overlapping rings. There is a rhythm to the gaps.',
    intro: 'They do not move and they do not aim. They do not have to; the rings intersect where you are standing.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'sentinel', count: 3, formation: 'echelon', gap: 80 }] },
      { at: 16, spawn: [{ id: 'turret_pod', count: 4, formation: 'pincer', delay: 0.2 }] },
      {
        whenRemaining: 2,
        spawn: [
          { id: 'sentinel', count: 2, formation: 'column', gap: 110 },
          { id: 'hunter', count: 1, formation: 'line', wait: 2 },
        ],
      },
      { after: 'cleared', spawn: [{ budget: 0.4, pool: ['sentinel', 'turret_pod'], formation: 'cluster', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.3, creditsMult: 1.2, crates: 1 },
  },

  {
    id: 'vanguard_duel', name: 'Vanguard', type: 'elite', weight: 8,
    minThreat: 9, maxThreat: 16,
    blurb: 'One Vanguard, flown properly, and a rotating cast whose only job is to be in the way.',
    intro: 'It closes, spirals, and peels off before you finish the thought. The small ships exist so you flinch at the wrong moment.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'vanguard', count: 1, formation: 'column' }] },
      { at: 12, spawn: [{ id: 'interceptor', count: 6, formation: 'pincer', delay: 0.25 }] },
      { at: 30, spawn: [{ budget: 0.4, pool: ['lancer'], formation: 'v', delay: 0.4 }] },
      { whenRemaining: 1, spawn: [{ budget: 0.7, pool: ['interceptor', 'wasp', 'zealot'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.35, creditsMult: 1.3, crates: 1 },
  },

  // -------------------------------------------------------------------------
  // HIGH BAND (10–20) — assumes a levelled ship; stacks two threats at once.
  // -------------------------------------------------------------------------
  {
    id: 'hunter_pack', name: 'Hunter Pack', type: 'elite', weight: 8,
    minThreat: 10, maxThreat: 18,
    blurb: 'Hunter-Killers orbiting at a fixed radius, needling. They are behind you in two seconds.',
    intro: 'You cannot outrun the ring. You can only make it smaller, one at a time, while it fires.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'hunter', count: 3, formation: 'arc', delay: 0.4 }] },
      { at: 16, spawn: [{ id: 'hunter', count: 2, formation: 'pincer', delay: 0.5 }] },
      { whenRemaining: 2, spawn: [{ budget: 0.6, pool: ['interceptor', 'phantom', 'hunter'], formation: 'random', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.35, creditsMult: 1.25, crates: 1 },
  },

  {
    id: 'carrier_cull', name: 'Carrier Cull', type: 'hostiles', weight: 9,
    minThreat: 11, maxThreat: 20,
    blurb: 'Two Battle Carriers bleeding Interceptors. The swarm is not the fight.',
    intro: 'The escorts will outlive you if you let them. The carriers will not, if you can reach them.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'battle_carrier', count: 1, formation: 'column', tag: 'carrier' },
          { id: 'fighter', count: 2, formation: 'line', wait: 2 },
        ],
      },
      {
        at: 18,
        spawn: [
          { id: 'battle_carrier', count: 1, formation: 'column', tag: 'carrier' },
          { id: 'hunter', count: 1, formation: 'echelon', wait: 1.5 },
        ],
      },
      { at: 34, spawn: [{ budget: 0.6, pool: ['interceptor', 'hunter', 'phantom'], formation: 'pincer', delay: 0.25 }] },
    ],
    rewards: { xpMult: 1.35, creditsMult: 1.35, crates: 1 },
  },

  {
    id: 'warden_shell', name: 'Warden Shell', type: 'elite', weight: 7,
    minThreat: 12, maxThreat: 20,
    blurb: 'A Warden and everything sheltering inside its aura. The aura moves with it.',
    intro: 'Forty per cent off every hit, out to a radius wider than you would like. The guns inside it never have to reposition.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'warden', count: 1, formation: 'column' },
          { id: 'artillery', count: 3, formation: 'arc', wait: 2 },
        ],
      },
      { at: 18, spawn: [{ id: 'sentinel', count: 2, formation: 'echelon', gap: 90 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.55, pool: ['gunship', 'artillery', 'turret_pod'], formation: 'cluster', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.45, creditsMult: 1.4, crates: 1 },
  },

  {
    id: 'splinter_storm', name: 'Splinter Storm', type: 'hostiles', weight: 8,
    minThreat: 12, maxThreat: 20,
    blurb: 'Splitters under an Aegis aura. Slower to kill, and killing them doubles them.',
    intro: 'Every one you break makes two more, and the pods make breaking them take longer.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'splitter', count: 8, formation: 'arc', delay: 0.15 },
          { id: 'aegis_pod', count: 2, formation: 'cluster', wait: 1.5 },
        ],
      },
      { at: 14, spawn: [{ id: 'zealot', count: 8, formation: 'pincer', delay: 0.2 }] },
      { whenRemaining: 6, spawn: [{ budget: 0.6, pool: ['splitter', 'interceptor', 'wasp'], formation: 'random', delay: 0.15 }] },
      { after: 'cleared', spawn: [{ budget: 0.55, pool: ['splitter', 'zealot', 'seeker'], formation: 'pincer', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.4, creditsMult: 1.2, crates: 1 },
  },

  {
    id: 'gun_line', name: 'Gun Line', type: 'hostiles', weight: 9,
    minThreat: 13, maxThreat: 20,
    blurb: 'Artillery and Sentinels dug in behind a Bulwark screen. The screen is slow; the guns are not.',
    intro: 'Three hulls of armour between you and the things doing the damage, and they are walking toward you.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'bulwark', count: 3, formation: 'line' },
          { id: 'artillery', count: 3, formation: 'column', gap: 90, wait: 2.5 },
        ],
      },
      { at: 16, spawn: [{ id: 'sentinel', count: 2, formation: 'echelon', gap: 100 }] },
      { whenRemaining: 3, spawn: [{ budget: 0.6, pool: ['gunship', 'lancer', 'phantom'], formation: 'v', delay: 0.3 }] },
      { after: 'cleared', spawn: [{ budget: 0.45, pool: ['hunter', 'interceptor'], formation: 'pincer', delay: 0.2 }] },
    ],
    rewards: { xpMult: 1.35, creditsMult: 1.3, crates: 1 },
  },

  {
    id: 'siege_break', name: 'Siege', type: 'hostiles', weight: 8,
    minThreat: 13, maxThreat: 20,
    blurb: 'You will not clear this. You only have to be alive at the end of it.',
    intro: 'Eighty seconds under a siege line. Killing things buys room, not victory.',
    objective: { kind: 'clear' },
    waves: [
      {
        at: 0,
        spawn: [
          { id: 'sentinel', count: 2, formation: 'echelon', gap: 90 },
          { id: 'drifting_mine', count: 6, formation: 'random', delay: 0.2, wait: 2 },
        ],
      },
      { at: 18, spawn: [{ id: 'cruiser', count: 1, formation: 'column' }] },
      { at: 34, spawn: [{ budget: 0.5, pool: ['hunter', 'phantom', 'interceptor'], formation: 'pincer', delay: 0.2 }] },
      {
        at: 50,
        spawn: [
          { id: 'cruiser', count: 1, formation: 'column' },
          { id: 'missile_boat', count: 2, formation: 'line', wait: 2 },
        ],
      },
      { at: 66, spawn: [{ budget: 0.45, pool: ['zealot', 'seeker', 'interceptor'], formation: 'random', delay: 0.15 }] },
    ],
    rewards: { xpMult: 1.5, creditsMult: 1.35, crates: 1 },
  },

  {
    id: 'reaper_pair', name: 'Reapers', type: 'elite', weight: 7,
    minThreat: 13, maxThreat: 20,
    blurb: 'Reapers ram. The slow orbs are not meant to hit you, only to hold you still.',
    intro: 'One at first. The second arrives before you have finished with the first.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'reaper', count: 1, formation: 'column' }] },
      { at: 20, spawn: [{ id: 'reaper', count: 1, formation: 'column' }] },
      { whenRemaining: 2, spawn: [{ budget: 0.6, pool: ['zealot', 'seeker', 'interceptor'], formation: 'pincer', delay: 0.2 }] },
      { after: 'cleared', spawn: [{ budget: 0.5, pool: ['hunter', 'phantom'], formation: 'arc', delay: 0.4 }] },
    ],
    rewards: { xpMult: 1.45, creditsMult: 1.35, crates: 1 },
  },

  {
    id: 'cruiser_wall', name: 'Wall of Fire', type: 'elite', weight: 7,
    minThreat: 14, maxThreat: 20,
    blurb: 'A Cruiser volley has exactly one gap. The Zealots exist to make you late to it.',
    intro: 'Two Cruisers, alternating. Find the gap, be at the gap, and be somewhere else when the drones arrive.',
    objective: { kind: 'clear' },
    waves: [
      { at: 0, spawn: [{ id: 'cruiser', count: 2, formation: 'column', gap: 120 }] },
      { at: 16, spawn: [{ id: 'zealot', count: 8, formation: 'pincer', delay: 0.2 }] },
      {
        whenRemaining: 3,
        spawn: [
          { id: 'cruiser', count: 1, formation: 'column' },
          { id: 'bulwark', count: 2, formation: 'line', wait: 2 },
        ],
      },
      { after: 'cleared', spawn: [{ budget: 0.55, pool: ['gunship', 'lancer', 'artillery'], formation: 'arc', delay: 0.3 }] },
    ],
    rewards: { xpMult: 1.5, creditsMult: 1.4, crates: 1 },
  },
];
