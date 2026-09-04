/**
 * Encounter content.
 *
 * An event is data. `choices[].req` gates an option behind crew, systems,
 * augments or resources; `outcomes` is a weighted table so the same choice can
 * pay off differently on different runs. `resolveEvent` in run.js turns an
 * outcome into actual state changes.
 *
 * Outcome grammar (all optional):
 *   text        what happened
 *   scrap/fuel/missiles/droneParts/hull   deltas (may be negative)
 *   crew        { race } to gain a crew member, or 'lose' to lose one
 *   weapon/drone/augment   item id, or true to roll one for the sector
 *   fire/breach/damage     hazards inflicted on your ship
 *   combat      { classId?, faction?, surprise? } start a fight
 *   fleetAdvance  push the pursuing fleet forward
 *   unlockShip  ship id awarded for finding a hidden hull
 */

export const EVENTS = [
  // --- Empty / exploration -------------------------------------------------
  {
    id: 'quiet_beacon', types: ['empty'], weight: 5,
    title: 'Empty Beacon',
    text: 'The beacon logs nothing but background hiss. Your sensors sweep the dark twice and find only the dark.',
    choices: [
      { text: 'Continue.', outcomes: [{ weight: 1, text: 'You take the quiet for what it is: a gift.' }] },
      {
        text: 'Scavenge the beacon housing for parts.',
        outcomes: [
          { weight: 3, text: 'The casing yields a little usable alloy.', scrap: [3, 9] },
          { weight: 1, text: 'A capacitor discharges into the hull as you cut it free.', hull: -1 },
        ],
      },
    ],
  },
  {
    id: 'derelict_hulk', types: ['empty', 'distress'], weight: 4,
    title: 'Derelict Hulk',
    text: 'A freighter drifts here, split along its spine. No power, no signal, no answer to your hails.',
    choices: [
      { text: 'Leave it alone.', outcomes: [{ weight: 1, text: 'Some graves are best left unopened.' }] },
      {
        text: 'Send a boarding party across.',
        req: { crewMin: 2 },
        outcomes: [
          { weight: 4, text: 'The hold still holds. Your crew come back loaded.', scrap: [15, 32], fuel: [0, 2] },
          { weight: 2, text: 'Salvage, and a weapon rack nobody got to.', scrap: [8, 15], weapon: true },
          { weight: 2, text: 'Something is still aboard. Your team barely make it back.', crewHurt: [20, 45] },
          { weight: 1, text: 'It was bait. The hulk was rigged and something undocks behind you.', combat: { classId: 'pirate' } },
        ],
      },
      {
        text: 'Cut it up from here with the salvage arm.',
        req: { system: 'salvage' },
        outcomes: [{ weight: 1, text: 'The arm strips it clean without anyone leaving the ship.', scrap: [20, 38] }],
      },
    ],
  },
  {
    id: 'asteroid_field_quiet', types: ['empty', 'hazard'], weight: 3,
    title: 'Asteroid Field',
    text: 'A slow river of rock grinds past the beacon. There are metals in there worth stopping for.',
    choices: [
      { text: 'Not worth the paint.', outcomes: [{ weight: 1, text: 'You give the field a wide berth.' }] },
      {
        text: 'Mine the field.',
        outcomes: [
          { weight: 3, text: 'A good haul, and nothing hits you on the way out.', scrap: [12, 26] },
          { weight: 2, text: 'You come away with ore and a dented hull.', scrap: [10, 20], hull: -2 },
          { weight: 1, text: 'A tumbling rock opens a compartment to space.', hull: -3, breach: 1 },
        ],
      },
    ],
  },
  {
    id: 'ancient_probe', types: ['empty'], weight: 2,
    title: 'Ancient Probe',
    text: 'The object is older than the Federation and still transmitting, patiently, to nobody.',
    choices: [
      { text: 'Ignore it.', outcomes: [{ weight: 1, text: 'It keeps transmitting as you leave.' }] },
      {
        text: 'Interface with it.',
        req: { systemLevel: { sensors: 2 } },
        outcomes: [
          { weight: 3, text: 'The probe hands over a star chart older than your species.', revealMap: true, scrap: [5, 12] },
          { weight: 2, text: 'Buried in the data is a schematic your fabricator can actually use.', augment: true },
          { weight: 1, text: 'The probe interprets your handshake as a threat.', combat: { classId: 'drone' } },
        ],
      },
      {
        text: 'Take it apart for the alloy.',
        outcomes: [{ weight: 1, text: 'Whatever it was, it is scrap now.', scrap: [10, 20] }],
      },
    ],
  },

  // --- Distress ------------------------------------------------------------
  {
    id: 'distress_medical', types: ['distress'], weight: 4,
    title: 'Medical Emergency',
    text: 'A colony transport is broadcasting on every band. Half their crew are down with something their medbay cannot name.',
    choices: [
      { text: 'You cannot help them. Jump out.', outcomes: [{ weight: 1, text: 'The signal follows you to the edge of the system.' }] },
      {
        text: 'Offer your medbay.',
        req: { system: 'medbay' },
        outcomes: [
          { weight: 4, text: 'You stabilise them. They pay in scrap and gratitude.', scrap: [15, 30], fuel: [1, 3] },
          { weight: 2, text: 'They insist on sending one of their own with you.', crew: { random: true }, scrap: [5, 10] },
          { weight: 1, text: 'Whatever it was, it comes aboard with them.', crewHurt: [10, 30] },
        ],
      },
      {
        text: 'Sell them medical supplies at a markup.',
        req: { scrap: 0 },
        outcomes: [{ weight: 1, text: 'They pay. They also remember your face.', scrap: [18, 34] }],
      },
    ],
  },
  {
    id: 'distress_fuel', types: ['distress'], weight: 4,
    title: 'Out of Fuel',
    text: 'A trader has been drifting here for nine days. Their drive is intact; their tanks are not.',
    choices: [
      { text: 'Leave them.', outcomes: [{ weight: 1, text: 'You are not a charity, and the fleet is behind you.' }] },
      {
        text: 'Give them fuel.',
        req: { fuel: 2 },
        outcomes: [
          { weight: 4, text: 'They pay back double in scrap and point you at a store.', fuel: -1, scrap: [18, 34] },
          { weight: 2, text: 'They hand over a weapon they cannot use.', fuel: -1, weapon: true },
          { weight: 1, text: 'They take the fuel and burn out of the system without a word.', fuel: -1 },
        ],
      },
      {
        text: 'Take their ship instead.',
        req: { crewMin: 3 },
        outcomes: [
          { weight: 3, text: 'It is over quickly. You are not proud of it.', scrap: [22, 40], fuel: [1, 2] },
          { weight: 2, text: 'The trader was better armed than advertised.', combat: { classId: 'fighter' } },
        ],
      },
    ],
  },
  {
    id: 'distress_trap', types: ['distress'], weight: 3,
    title: 'Automated Distress Call',
    text: 'The signal repeats on a fourteen-second loop. It has been repeating for a very long time.',
    choices: [
      { text: 'Jump away.', outcomes: [{ weight: 1, text: 'The loop continues without you.' }] },
      {
        text: 'Investigate.',
        outcomes: [
          { weight: 3, text: 'A wreck, long stripped, with a little left in the margins.', scrap: [8, 18] },
          { weight: 3, text: 'The call was bait. Two raiders drop out of the dark.', combat: { classId: 'pirate', surprise: true } },
          { weight: 1, text: 'You find the source: a survival pod, and someone still in it.', crew: { random: true } },
        ],
      },
    ],
  },
  {
    id: 'distress_slaver', types: ['distress', 'hostile'], weight: 3, sectors: ['pirate', 'hostile', 'abandoned'],
    title: 'Slaver',
    text: 'A slaver hails you, friendly as anything, and offers to sell you labour.',
    choices: [
      {
        text: 'Buy someone free.', req: { scrap: 45 },
        outcomes: [{ weight: 1, text: 'The transaction disgusts you both. They join your crew.', scrap: -45, crew: { random: true } }],
      },
      {
        text: 'Attack the slaver.',
        outcomes: [{ weight: 1, text: 'You do not negotiate with this.', combat: { classId: 'pirate', extraScrap: 15, freeCrew: true } }],
      },
      { text: 'Decline and jump.', outcomes: [{ weight: 1, text: 'They wish you a profitable journey.' }] },
    ],
  },

  // --- Hazards -------------------------------------------------------------
  {
    id: 'solar_flare', types: ['hazard'], weight: 3,
    title: 'Unstable Star',
    text: 'The star here is throwing flares on no schedule at all. Your hull plating is already warming.',
    choices: [
      {
        text: 'Push through toward the next beacon.',
        outcomes: [
          { weight: 3, text: 'You clear the corona with scorched plating.', hull: -2 },
          { weight: 2, text: 'A flare catches you mid-turn and ignites a compartment.', fire: 1 },
          { weight: 2, text: 'You thread the gaps between flares perfectly.' },
        ],
      },
      {
        text: 'Wait it out in the shadow of the planet.',
        outcomes: [
          { weight: 3, text: 'You lose time, and the fleet gains it.', fleetAdvance: 1 },
          { weight: 1, text: 'The wait pays off — you scoop fuel from the upper atmosphere.', fuel: [1, 3], fleetAdvance: 1 },
        ],
      },
    ],
  },
  {
    id: 'ion_storm', types: ['hazard'], weight: 3,
    title: 'Ion Storm',
    text: 'The whole beacon sits inside a standing ion front. Your power grid is browning out just holding position.',
    choices: [
      {
        text: 'Run the gauntlet.',
        outcomes: [
          { weight: 3, text: 'Systems flicker, but you make it through.', ionAll: 1 },
          { weight: 2, text: 'The storm claws two systems offline for a while.', ionAll: 2 },
          { weight: 1, text: 'Your shields absorb it beautifully.' },
        ],
      },
      {
        text: 'Route around it.',
        outcomes: [{ weight: 1, text: 'The detour costs you fuel and time.', fuel: -1, fleetAdvance: 1 }],
      },
    ],
  },
  {
    id: 'pulsar_field', types: ['hazard'], weight: 2,
    title: 'Pulsar',
    text: 'A dead star sweeps the system with a beam on a four-second period. Everything electronic stutters as it passes.',
    choices: [
      {
        text: 'Cross the sweep.',
        outcomes: [
          { weight: 3, text: 'Every system takes a jolt, but nothing burns out.', ionAll: 2 },
          { weight: 2, text: 'The sweep catches your reactor mid-cycle.', ionAll: 3, hull: -1 },
        ],
      },
      {
        text: 'Use the pulsar to scan deep.',
        req: { systemLevel: { sensors: 2 } },
        outcomes: [{ weight: 1, text: 'The pulse doubles your sensor range. The whole sector resolves.', revealMap: true, ionAll: 1 }],
      },
    ],
  },
  {
    id: 'nebula_pocket', types: ['hazard', 'empty'], weight: 2, sectors: ['nebula', 'slug'],
    title: 'Nebula Pocket',
    text: 'Your sensors return nothing but static. Somewhere in the fog, something is matching your course.',
    choices: [
      {
        text: 'Hold course and go quiet.',
        outcomes: [
          { weight: 3, text: 'Whatever it was loses interest.' },
          { weight: 2, text: 'It was a scout. It found you first.', combat: { classId: 'scout', surprise: true } },
        ],
      },
      {
        text: 'Have a Slug read the fog.',
        req: { race: 'slug' },
        outcomes: [
          { weight: 3, text: 'Your Slug points, unbothered. You slip past a waiting ambush.', scrap: [8, 16] },
          { weight: 1, text: '"There is nothing out there," they say, "but there was."', scrap: [4, 10] },
        ],
      },
    ],
  },

  // --- Hostile encounters --------------------------------------------------
  {
    id: 'hostile_standard', types: ['hostile'], weight: 6,
    title: 'Hostile Contact',
    text: 'A ship drops out of FTL on an intercept vector and charges weapons without a word.',
    choices: [
      { text: 'Fight.', outcomes: [{ weight: 1, text: 'Battle stations.', combat: {} }] },
      {
        text: 'Hail them first.',
        outcomes: [
          { weight: 3, text: 'They do not answer. They just get closer.', combat: {} },
          { weight: 1, text: 'They mistook you for someone else, and pay for the inconvenience.', scrap: [8, 18] },
        ],
      },
    ],
  },
  {
    id: 'hostile_toll', types: ['hostile'], weight: 3, sectors: ['pirate', 'hostile', 'abandoned'],
    title: 'Toll Collectors',
    text: 'Two raiders bracket you and open a channel. "Passage through here is not free."',
    choices: [
      {
        text: 'Pay the toll.', req: { scrap: 30 },
        outcomes: [
          { weight: 3, text: 'They take the scrap and let you pass.', scrap: -30 },
          { weight: 1, text: 'They take the scrap and attack anyway.', scrap: -30, combat: { classId: 'pirate' } },
        ],
      },
      { text: 'Refuse.', outcomes: [{ weight: 1, text: 'The channel closes. Weapons come up.', combat: { classId: 'pirate' } }] },
      {
        text: 'Fire first.',
        req: { weaponReady: true },
        outcomes: [{ weight: 1, text: 'You open the engagement on your terms.', combat: { classId: 'pirate', surprise: true, playerAdvantage: true } }],
      },
    ],
  },
  {
    id: 'hostile_boarders', types: ['hostile'], weight: 3, sectors: ['mantis', 'pirate'],
    title: 'Boarding Party',
    text: 'They do not target your hull. They target your airlocks.',
    choices: [
      { text: 'Repel them.', outcomes: [{ weight: 1, text: 'Seal the corridors and meet them at the door.', combat: { classId: 'pirate', boards: true } }] },
      {
        text: 'Vent the boarding corridors before they cycle through.',
        req: { systemLevel: { doors: 2 } },
        outcomes: [
          { weight: 3, text: 'They arrive in vacuum. The fight is very short.', combat: { classId: 'pirate', weakened: true } },
          { weight: 1, text: 'The doors hold long enough to matter.', combat: { classId: 'pirate' } },
        ],
      },
    ],
  },
  {
    id: 'hostile_auto', types: ['hostile'], weight: 3, sectors: ['abandoned', 'uncharted', 'engi'],
    title: 'Automated Defenses',
    text: 'No crew, no hail, no hesitation. The hull comes about and fires.',
    choices: [
      { text: 'Destroy it.', outcomes: [{ weight: 1, text: 'It will not surrender. It cannot.', combat: { classId: 'auto' } }] },
      {
        text: 'Try to hack its command loop.',
        req: { system: 'hacking' },
        outcomes: [
          { weight: 3, text: 'You convince it you are friendly. It goes back to sleep.', scrap: [10, 22] },
          { weight: 2, text: 'The hack half-lands. It fights, but badly.', combat: { classId: 'auto', weakened: true } },
        ],
      },
    ],
  },

  // --- Repair / stations ---------------------------------------------------
  {
    id: 'repair_station', types: ['repair'], weight: 5,
    title: 'Repair Station',
    text: 'An automated dock, still on the Federation network, still honouring old credentials.',
    choices: [
      { text: 'Dock and repair.', outcomes: [{ weight: 1, text: 'The arms work over your hull for an hour.', hullRepairFull: true }] },
      {
        text: 'Strip the station for parts instead.',
        outcomes: [
          { weight: 3, text: 'You gut it. The next ship through will find nothing.', scrap: [20, 40] },
          { weight: 1, text: 'The station objects.', combat: { classId: 'drone' } },
        ],
      },
    ],
  },
  {
    id: 'friendly_convoy', types: ['empty', 'distress'], weight: 3, sectors: ['civilian', 'engi', 'zoltan'],
    title: 'Federation Convoy',
    text: 'Three freighters and a tired escort, running the same direction you are and for the same reason.',
    choices: [
      {
        text: 'Trade with them.',
        outcomes: [
          { weight: 3, text: 'They have fuel to spare and want scrap for it.', fuel: [2, 4], scrap: [-8, -4] },
          { weight: 2, text: 'They resupply you for free. Morale is worth something.', missiles: [2, 5], fuel: [1, 2] },
        ],
      },
      {
        text: 'Warn them about the fleet behind you.',
        outcomes: [{ weight: 1, text: 'They change course. One of their crew asks to come with you.', crew: { random: true } }],
      },
      { text: 'Keep moving.', outcomes: [{ weight: 1, text: 'You have your own problems.' }] },
    ],
  },

  // --- Race-specific -------------------------------------------------------
  {
    id: 'engi_repair_swarm', types: ['empty', 'distress'], weight: 2, sectors: ['engi'],
    title: 'Repair Swarm',
    text: 'A cloud of Engi maintenance drones surrounds your hull and begins, without asking, to fix things.',
    choices: [
      { text: 'Let them work.', outcomes: [{ weight: 1, text: 'They leave as suddenly as they came. Your hull is noticeably better.', hull: [4, 8] }] },
      {
        text: 'Capture a few for parts.',
        outcomes: [
          { weight: 3, text: 'You net three before the swarm scatters.', droneParts: [2, 4] },
          { weight: 2, text: 'The swarm objects, forcefully.', hull: -3 },
        ],
      },
    ],
  },
  {
    id: 'mantis_challenge', types: ['hostile', 'empty'], weight: 2, sectors: ['mantis'],
    title: 'Mantis Challenge',
    text: 'A Mantis captain hails you to propose single combat, crew against crew, ships untouched.',
    choices: [
      {
        text: 'Accept.', req: { crewMin: 2 },
        outcomes: [
          { weight: 3, text: 'Your best walks back aboard. Theirs does not.', scrap: [25, 45], crewHurt: [15, 35] },
          { weight: 2, text: 'You lose the duel, and a crew member with it.', crew: 'lose' },
        ],
      },
      {
        text: 'Accept, and send a Mantis.',
        req: { race: 'mantis' },
        outcomes: [{ weight: 1, text: 'Their captain salutes the corpse and pays the wager.', scrap: [35, 60] }],
      },
      { text: 'Refuse.', outcomes: [{ weight: 1, text: 'They call you a coward on an open channel and let you go.', combat: { classId: 'fighter' }, chance: 0.4 }] },
    ],
  },
  {
    id: 'zoltan_toll', types: ['empty', 'hostile'], weight: 2, sectors: ['zoltan'],
    title: 'Zoltan Customs',
    text: 'A Zoltan cutter requests permission to inspect your cargo, in the politest possible terms.',
    choices: [
      {
        text: 'Permit the inspection.',
        outcomes: [
          { weight: 3, text: 'They find nothing objectionable and refuel you for your trouble.', fuel: [1, 3] },
          { weight: 1, text: 'They confiscate "unlicensed ordnance".', missiles: [-4, -2] },
        ],
      },
      {
        text: 'Refuse politely.',
        outcomes: [
          { weight: 2, text: 'They log a complaint and depart.' },
          { weight: 2, text: 'The cutter powers its very good shields.', combat: { classId: 'fighter', faction: 'zoltan' } },
        ],
      },
      {
        text: 'Have your Zoltan speak for you.',
        req: { race: 'zoltan' },
        outcomes: [{ weight: 1, text: 'Two sentences settle it. You are escorted through with a gift.', scrap: [12, 24], fuel: [1, 2] }],
      },
    ],
  },
  {
    id: 'rock_shrine', types: ['empty'], weight: 2, sectors: ['rock'],
    title: 'Rock Shrine',
    text: 'A shrine carved into a tumbling monolith, tended by nobody for a very long time.',
    choices: [
      {
        text: 'Leave an offering.', req: { scrap: 20 },
        outcomes: [
          { weight: 3, text: 'A Rock vessel observes the gesture and gifts you ordnance.', scrap: -20, missiles: [4, 9] },
          { weight: 2, text: 'Nothing happens. It was a rock.', scrap: -20 },
        ],
      },
      {
        text: 'Loot the shrine.',
        outcomes: [
          { weight: 2, text: 'The offerings are old and valuable.', scrap: [25, 45] },
          { weight: 3, text: 'A Rock cruiser was watching. It is not pleased.', combat: { classId: 'bomber', faction: 'rock' } },
        ],
      },
      {
        text: 'Have a Rockman pay respects.',
        req: { race: 'rockman' },
        outcomes: [{ weight: 1, text: 'Old words, correctly said. The shrine opens a compartment.', scrap: [20, 35], augment: true }],
      },
    ],
  },
  {
    id: 'crystal_relic', types: ['empty'], weight: 1, sectors: ['uncharted', 'abandoned'],
    title: 'Crystalline Structure',
    text: 'A lattice hangs in the void, perfectly regular, kilometres across, and older than anything on your charts.',
    choices: [
      {
        text: 'Send a probe.',
        outcomes: [
          { weight: 3, text: 'The lattice resonates. A stasis pod detaches and drifts toward you.', crew: { race: 'crystal' } },
          { weight: 2, text: 'The probe returns readings your computer cannot store.', scrap: [15, 30] },
          { weight: 1, text: 'The lattice responds by resonating your hull instead.', hull: -4, breach: 1 },
        ],
      },
      {
        text: 'Take a sample.',
        req: { crewMin: 3 },
        outcomes: [
          { weight: 3, text: 'The fragment is worth a fortune to the right buyer.', scrap: [30, 55] },
          { weight: 2, text: 'The lattice does not consent to being sampled.', crewHurt: [25, 50], hull: -2 },
        ],
      },
      { text: 'Do not touch it.', outcomes: [{ weight: 1, text: 'Wise.' }] },
    ],
  },

  // --- Ship unlocks --------------------------------------------------------
  {
    id: 'hidden_hangar', types: ['empty', 'distress'], weight: 1, sectors: ['abandoned', 'uncharted'],
    title: 'Sealed Hangar',
    text: 'Buried in the rock of a dead moon: a hangar door, still powered, still locked, with a hull behind it.',
    choices: [
      {
        text: 'Cut through the door.',
        req: { crewMin: 2 },
        outcomes: [
          { weight: 3, text: 'The ship inside is intact, and the registry transfers cleanly.', unlockShip: true, scrap: [10, 20] },
          { weight: 2, text: 'The hangar was stripped decades ago, but the tooling remains.', scrap: [20, 35] },
        ],
      },
      {
        text: 'Hack the hangar authority.',
        req: { system: 'hacking' },
        outcomes: [{ weight: 1, text: 'The door opens on its own. The ship inside is yours on paper.', unlockShip: true, scrap: [5, 15] }],
      },
      { text: 'Move on.', outcomes: [{ weight: 1, text: 'You have a fleet behind you and no time for archaeology.' }] },
    ],
  },

  // --- Big-ticket gambles --------------------------------------------------
  {
    id: 'black_market', types: ['store', 'empty'], weight: 2, sectors: ['pirate', 'abandoned'],
    title: 'Black Market Contact',
    text: 'An unlisted freighter offers goods with no provenance and no refunds.',
    choices: [
      {
        text: 'Buy the sealed crate. (35 scrap)', req: { scrap: 35 },
        outcomes: [
          { weight: 3, text: 'A weapon, and a good one.', scrap: -35, weapon: true },
          { weight: 2, text: 'An augment of uncertain legality.', scrap: -35, augment: true },
          { weight: 2, text: 'Rocks. Literally rocks.', scrap: -35 },
        ],
      },
      {
        text: 'Buy the drone schematics. (30 scrap)', req: { scrap: 30 },
        outcomes: [
          { weight: 3, text: 'The schematics are genuine.', scrap: -30, drone: true },
          { weight: 1, text: 'They are for a drone that was never built.', scrap: -30, droneParts: [1, 2] },
        ],
      },
      { text: 'Decline.', outcomes: [{ weight: 1, text: 'They shrug and close the channel.' }] },
    ],
  },
  {
    id: 'gambling_den', types: ['store', 'empty'], weight: 2, sectors: ['civilian', 'pirate'],
    title: 'Station Card Game',
    text: 'A long-running game in a docking bay, and an open chair.',
    choices: [
      {
        text: 'Buy in. (25 scrap)', req: { scrap: 25 },
        outcomes: [
          { weight: 3, text: 'You walk out ahead.', scrap: [15, 60] },
          { weight: 3, text: 'You walk out lighter.', scrap: -25 },
          { weight: 1, text: 'You win the pot and someone follows you out.', scrap: [40, 80], combat: { classId: 'pirate' } },
        ],
      },
      {
        text: 'Send your luckiest crew member.', req: { crewMin: 3 },
        outcomes: [
          { weight: 3, text: 'They come back grinning.', scrap: [20, 45] },
          { weight: 2, text: 'They come back with a black eye and an apology.', crewHurt: [10, 25] },
        ],
      },
      { text: 'Watch, and leave.', outcomes: [{ weight: 1, text: 'You have seen enough card games.' }] },
    ],
  },
  {
    id: 'refugee_ship', types: ['distress'], weight: 3,
    title: 'Refugee Transport',
    text: 'Four hundred people in a hull rated for eighty, and a drive that will not restart.',
    choices: [
      {
        text: 'Give them fuel and let them go.', req: { fuel: 2 },
        outcomes: [
          { weight: 3, text: 'They will make it to the next system. That is all anyone can promise.', fuel: -2, scrap: [10, 20] },
          { weight: 2, text: 'Two of them stay to work off the debt.', fuel: -2, crew: { random: true } },
        ],
      },
      {
        text: 'Take aboard who you can.', req: { crewSpace: 1 },
        outcomes: [{ weight: 1, text: 'One more mouth, one more pair of hands.', crew: { random: true } }],
      },
      { text: 'You cannot save everyone.', outcomes: [{ weight: 1, text: 'You jump. The transport stays where it is.' }] },
    ],
  },
  {
    id: 'fleet_scout', types: ['hostile', 'empty'], weight: 3,
    title: 'Fleet Scout',
    text: 'A Swarm scout is sitting at the beacon, transmitting your position on a tight beam.',
    choices: [
      { text: 'Kill it before the transmission completes.', outcomes: [{ weight: 1, text: 'Fast, then. Very fast.', combat: { classId: 'scout', mustKill: true } }] },
      {
        text: 'Jam the transmission and slip away.',
        req: { systemLevel: { sensors: 2 } },
        outcomes: [
          { weight: 3, text: 'The beam breaks up. You are gone before it re-acquires.' },
          { weight: 2, text: 'You jam it too late. The fleet adjusts course.', fleetAdvance: 1 },
        ],
      },
      { text: 'Run for the next beacon.', outcomes: [{ weight: 1, text: 'The transmission completes. Behind you, the fleet turns.', fleetAdvance: 1 }] },
    ],
  },
];

/** Events keyed by id, for direct lookup by the store and scripted encounters. */
export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));

/**
 * Pick an event for a beacon. Filters by beacon type and (where an event names
 * them) sector type, then weights the survivors.
 */
export function rollEvent(rng, beaconType, sectorType) {
  const pool = EVENTS.filter(e => {
    if (!e.types.includes(beaconType)) return false;
    if (e.sectors && !e.sectors.includes(sectorType)) return false;
    return true;
  });
  if (pool.length === 0) {
    return EVENTS_BY_ID[beaconType === 'hostile' ? 'hostile_standard' : 'quiet_beacon'];
  }
  return rng.weighted(pool);
}

/** Weighted pick from an outcome table. */
export function rollOutcome(rng, choice) {
  if (!choice.outcomes || choice.outcomes.length === 0) return { text: '' };
  return rng.weighted(choice.outcomes);
}

/**
 * Can the player take this choice? Returns { ok, reason } so the UI can show a
 * greyed-out option with an explanation rather than hiding it.
 */
export function checkRequirement(req, state) {
  if (!req) return { ok: true };
  const { ship, run } = state;

  if (req.scrap != null && run.scrap < req.scrap) return { ok: false, reason: `Requires ${req.scrap} scrap` };
  if (req.fuel != null && run.fuel < req.fuel) return { ok: false, reason: `Requires ${req.fuel} fuel` };
  if (req.missiles != null && run.missiles < req.missiles) return { ok: false, reason: `Requires ${req.missiles} missiles` };

  if (req.system && !ship.systems[req.system]) {
    return { ok: false, reason: `Requires ${req.system}` };
  }
  if (req.systemLevel) {
    for (const [sysId, lvl] of Object.entries(req.systemLevel)) {
      const s = ship.systems[sysId];
      if (!s || s.level < lvl) return { ok: false, reason: `Requires ${sysId} level ${lvl}` };
    }
  }
  if (req.race && !ship.crew.some(c => !c.dead && c.race === req.race)) {
    return { ok: false, reason: `Requires a ${req.race} crew member` };
  }
  if (req.crewMin != null && ship.crew.filter(c => !c.dead).length < req.crewMin) {
    return { ok: false, reason: `Requires ${req.crewMin} crew` };
  }
  if (req.crewSpace != null && ship.crewSlots - ship.crew.filter(c => !c.dead).length < req.crewSpace) {
    return { ok: false, reason: 'No room for more crew' };
  }
  if (req.augment && !ship.augments.includes(req.augment)) {
    return { ok: false, reason: `Requires ${req.augment}` };
  }
  if (req.weaponReady && !ship.weapons.some(w => w.powered)) {
    return { ok: false, reason: 'Requires a powered weapon' };
  }
  return { ok: true };
}
