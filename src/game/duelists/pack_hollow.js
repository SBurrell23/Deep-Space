/**
 * Duelist pack: the Hollow. Twenty ships, one contract — see docs/duelist-spec.md.
 * The faction note and the reasoning behind how these fight is at the foot of
 * the file, where it can be read after the ships rather than instead of them.
 */

export const PACK_HOLLOW = [
  // ---------------------------------------------------------------------------
  // LOW (1–7) — each of these teaches exactly one habit and then tests it.
  // ---------------------------------------------------------------------------
  {
    id: 'hollow_survey_nine',
    name: 'Survey Nine',
    faction: 'Hollow',
    band: 'low',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'spindle', nose: 'sensor_dome', wing: 'long_straight',
      pod: 'spinal_gun', engine: 'single_bell', crest: 'dish', pal: 'frost',
    },

    hullMul: 0.9,
    shieldMul: 0.15,
    damageMul: 1.0,
    armour: 0.06,
    speed: 76,
    contact: 8,

    move: 'duel_anchor',
    fire: 'single',
    // Deliberately the slowest cadence in the low band. The whole ship is one
    // question — did you move when it painted you — and a busy gun buries it.
    fireRate: 0.55,
    bulletSpeed: 330,

    abilities: ['target_lock', 'railshot'],

    strategy: 'Move across its nose the moment the lock tone starts. The rail fires down the line it painted, not at where you have got to.',
    blurb: 'A survey mast that finished its survey and kept the instruments running.',
    intro: 'It paints you before it shoots you, and it paints you the same way every time. '
      + 'The tone is the whole warning, and it lasts about a second. '
      + 'Standing still is the only mistake it knows how to punish, and it is very good at it.',
  },

  {
    id: 'hollow_perimeter_ninety',
    name: 'Perimeter Ninety',
    faction: 'Hollow',
    band: 'low',
    squadron: 1,
    role: 'support',

    art: {
      core: 'lattice', nose: 'blunt', wing: 'spar_frame',
      pod: 'missile_rack', engine: 'vent_bank', crest: 'antenna', pal: 'void',
    },

    hullMul: 1.0,
    shieldMul: 0.1,
    damageMul: 0.8,
    armour: 0.1,
    speed: 88,
    contact: 9,

    move: 'duel_wall',
    fire: 'mine_drop',
    fireRate: 0.5,
    bulletSpeed: 240,

    abilities: ['mine_lattice', 'retro_burn'],

    strategy: 'It gives ground on purpose, and the ground it gives up fills with mines. Push through early, while the field is still worth crossing.',
    blurb: 'It is still walking a boundary that stopped meaning anything decades ago.',
    intro: 'It does not come at you and it does not shoot at you. '
      + 'It backs along its line laying the same pattern it has always laid, and the playable half of the field gets smaller every pass. '
      + 'Waiting it out is the losing move.',
  },

  {
    id: 'hollow_docking_marshal',
    name: 'Docking Marshal',
    faction: 'Hollow',
    band: 'low',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'obelisk', nose: 'ram_plate', wing: 'stub',
      pod: 'shield_emitter', engine: 'quad_block', crest: 'lamp', pal: 'obsidian',
    },

    hullMul: 1.35,
    shieldMul: 0.3,
    damageMul: 0.85,
    // Heavy for the band, but it never manoeuvres and never surprises anyone;
    // the armour is what buys the walk time the fight is built around.
    armour: 0.2,
    speed: 74,
    contact: 16,

    move: 'duel_pressure',
    fire: 'forward',
    fireRate: 0.8,
    bulletSpeed: 270,

    abilities: ['barrier_wall', 'emp_pulse'],

    strategy: 'Do not give ground. Every metre you retreat it fences off behind you, and the pulse takes the energy you were saving to get back out.',
    blurb: 'Traffic control for a berth that no longer exists, enforced at gunpoint.',
    intro: 'It is running an approach procedure on a station that came apart long ago. '
      + 'You are in the wrong lane, and it intends to correct that by making the other lanes unavailable. '
      + 'It is slower than you and it will still get where it is going.',
  },

  {
    id: 'hollow_ledger_unit',
    name: 'Ledger Unit',
    faction: 'Hollow',
    band: 'low',
    squadron: 2,
    role: 'skirmisher',

    art: {
      core: 'dagger', nose: 'spike', wing: 'blade_pair',
      pod: 'twin_lasers', engine: 'twin_cone', crest: 'none', pal: 'ion',
    },

    hullMul: 0.8,
    shieldMul: 0.1,
    damageMul: 0.85,
    armour: 0.04,
    speed: 150,
    contact: 10,

    move: 'duel_escort',
    fire: 'forward',
    fireRate: 1.0,
    bulletSpeed: 320,

    // One ability, because the arc exists once per body and two arcs on a
    // two-body fight is already the entire puzzle.
    abilities: ['chain_lightning'],

    strategy: 'Never cross the space between the two of them. Work from outside the pair and kill whichever one you can reach without passing through it.',
    blurb: 'Two hulls holding a fixed offset, and a live arc doing the counting.',
    intro: 'They fly a spacing you could measure with a ruler and have not deviated from it once. '
      + 'The gap between them is not empty. '
      + 'Everything else about this fight is ordinary; the geometry is not.',
  },

  {
    id: 'hollow_assay_probes',
    name: 'Assay Probes',
    faction: 'Hollow',
    band: 'low',
    squadron: 3,
    role: 'glass',

    art: {
      core: 'ring', nose: 'sensor_dome', wing: 'fan',
      pod: 'none', engine: 'pulse_pods', crest: 'antenna', pal: 'pearl',
    },

    // Three bodies out of a hull budget this small means one clean hit each.
    hullMul: 0.7,
    shieldMul: 0,
    damageMul: 0.75,
    armour: 0,
    speed: 168,
    contact: 7,

    move: 'duel_circle',
    fire: 'needle',
    fireRate: 0.9,
    bulletSpeed: 340,

    abilities: ['blink_strike'],

    strategy: 'Do not lead them. They jump the instant a reading finishes, so shoot the arrival rather than the approach.',
    blurb: 'Three sampling probes taking readings of a wreck that was surveyed a century ago.',
    intro: 'They orbit at a fixed radius, take a reading, and are suddenly somewhere else. '
      + 'Aiming where they are going is how you spend a whole magazine on empty space. '
      + 'They break on one hit, if you can arrange to be pointing at one.',
  },

  {
    id: 'hollow_wake_marker',
    name: 'Wake Marker',
    faction: 'Hollow',
    band: 'low',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'husk', nose: 'cowl', wing: 'none',
      pod: 'dorsal_turret', engine: 'none', crest: 'halo', pal: 'abyss',
    },

    hullMul: 1.1,
    shieldMul: 0.2,
    damageMul: 1.0,
    armour: 0.12,
    speed: 86,
    contact: 12,

    move: 'duel_bob',
    fire: 'sweep',
    fireRate: 1.1,
    bulletSpeed: 280,

    abilities: ['beam_sweep'],

    strategy: 'The beam turns one way at a constant rate. Travel with it. Going the other way doubles the time you spend underneath it.',
    blurb: 'A channel marker still marking a channel, with the only lamp it has left.',
    intro: 'Its drives are gone and the beacon head still turns, once every few seconds, exactly as fast as it always did. '
      + 'The safe side of the field is a moving thing here. '
      + 'It is not aiming at you and that does not help you at all.',
  },

  // ---------------------------------------------------------------------------
  // MID (5–13) — the band where a fight has two problems in it at once.
  // ---------------------------------------------------------------------------
  {
    id: 'hollow_refit_cradle',
    name: 'Refit Cradle',
    faction: 'Hollow',
    band: 'mid',
    squadron: 1,
    role: 'support',

    art: {
      core: 'lattice', nose: 'forked', wing: 'spar_frame',
      pod: 'claw_arms', engine: 'ring_drive', crest: 'vent_stack', pal: 'void',
    },

    hullMul: 1.2,
    shieldMul: 0.25,
    damageMul: 0.8,
    armour: 0.14,
    speed: 82,
    contact: 10,

    move: 'duel_keepaway',
    fire: 'homing2',
    fireRate: 0.6,
    bulletSpeed: 260,

    abilities: ['repair_weave', 'drone_bay', 'hardlight_shield'],

    strategy: 'A careful fight is a stalemate — it mends faster than trickle damage. Hold everything, close inside the drone screen, and spend it in one window.',
    blurb: 'A dockyard arm still working an order nobody ever closed.',
    intro: 'It keeps its distance, builds what it is meant to build, and repairs whatever you take off it. '
      + 'Nothing about it is fast and nothing about it is in a hurry. '
      + 'If this fight goes long you have already lost it.',
  },

  {
    id: 'hollow_nightside_beacon',
    name: 'Nightside Beacon',
    faction: 'Hollow',
    band: 'mid',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'trident', nose: 'lance_tip', wing: 'sail',
      pod: 'spinal_gun', engine: 'spread_rail', crest: 'dish', pal: 'frost',
    },

    hullMul: 1.15,
    shieldMul: 0.2,
    damageMul: 1.25,
    armour: 0.16,
    speed: 72,
    contact: 11,

    move: 'duel_mirror',
    fire: 'siege_beam',
    // Bottom of the legal range on purpose: a siege beam that comes round often
    // stops being a decision and starts being weather.
    fireRate: 0.36,
    bulletSpeed: 250,

    abilities: ['siege_mode', 'railshot'],

    strategy: 'It matches your height until it plants itself, and then it cannot turn at all. Cross its line while it is charging and stay crossed.',
    blurb: 'It follows you up and down until it is satisfied, then stops moving entirely.',
    intro: 'It will not close and it will not be shaken off vertically; it simply sits at range copying your height. '
      + 'Then the drives cut, the spine lights, and for the next few seconds it is a fixed line pointing at where you were. '
      + 'The whole fight happens in those few seconds.',
  },

  {
    id: 'hollow_quarantine_line',
    name: 'Quarantine Line',
    faction: 'Hollow',
    band: 'mid',
    squadron: 2,
    role: 'tank',

    art: {
      core: 'mantaform', nose: 'blunt', wing: 'folded',
      pod: 'shield_emitter', engine: 'quad_block', crest: 'none', pal: 'obsidian',
    },

    hullMul: 1.4,
    shieldMul: 0.35,
    damageMul: 0.9,
    armour: 0.24,
    speed: 76,
    contact: 15,

    move: 'duel_strafe',
    fire: 'wall',
    fireRate: 0.4,
    bulletSpeed: 250,

    abilities: ['reflect_field'],

    strategy: 'When the plating goes bright, stop shooting. Your own guns are the heaviest thing on this field and it will hand them straight back.',
    blurb: 'Two hulls still enforcing a cordon around nothing.',
    intro: 'They sweep the cordon line abreast, slowly, with the patience of things that have done this ten thousand times. '
      + 'They are armoured enough that the temptation is to hold the trigger down. '
      + 'That is the trap, and it is the entire trap.',
  },

  {
    id: 'hollow_ordnance_steward',
    name: 'Ordnance Steward',
    faction: 'Hollow',
    band: 'mid',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'hammerhead', nose: 'maw', wing: 'gull',
      pod: 'drum_magazine', engine: 'stacked_trio', crest: 'horns', pal: 'ion',
    },

    hullMul: 1.2,
    shieldMul: 0.15,
    damageMul: 1.15,
    armour: 0.15,
    speed: 96,
    contact: 14,

    move: 'duel_boxer',
    fire: 'spread5',
    fireRate: 0.85,
    bulletSpeed: 290,

    abilities: ['flak_curtain', 'cluster_bomb'],

    strategy: 'The flak fills the top and the bottom of the field first. The last safe ground is directly in front of it, which is also where it is walking.',
    blurb: 'It is still issuing the day\'s ordnance, at the ceiling and the floor, on schedule.',
    intro: 'It comes in, gives you a volley, and steps back out, and the edges of the field fill up while it does. '
      + 'Running for a wall is the instinct and the instinct is wrong here. '
      + 'You will end up fighting this one nose to nose, which is what it is for.',
  },

  {
    id: 'hollow_hull_twelve',
    name: 'Hull Twelve',
    faction: 'Hollow',
    band: 'mid',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'husk', nose: 'split_prow', wing: 'folded',
      pod: 'none', engine: 'vent_bank', crest: 'spine_fin', pal: 'abyss',
    },

    // The heaviest hull a single mid-band ship is allowed, because half of that
    // hull is the second fight that starts when the first one ends.
    hullMul: 1.45,
    shieldMul: 0.1,
    damageMul: 0.9,
    armour: 0.22,
    speed: 80,
    contact: 17,

    move: 'duel_pressure',
    fire: 'heavy',
    fireRate: 0.5,
    bulletSpeed: 260,

    abilities: ['split_form', 'overload_burst'],

    strategy: 'It comes apart when you break it, and the halves appear where the whole one was standing. Break it at range and be elsewhere when it does.',
    blurb: 'Most of it is missing. The remainder has not been told that this changes anything.',
    intro: 'You can see through it in two places. It advances anyway, at the pace it was built to advance at. '
      + 'Killing it is not one event, and the second half of it is closer to you than the first.',
  },

  {
    id: 'hollow_cargo_tally',
    name: 'Cargo Tally',
    faction: 'Hollow',
    band: 'mid',
    squadron: 4,
    role: 'skirmisher',

    art: {
      core: 'lattice', nose: 'blunt', wing: 'stub',
      pod: 'drum_magazine', engine: 'pulse_pods', crest: 'none', pal: 'pearl',
    },

    hullMul: 0.95,
    shieldMul: 0.1,
    damageMul: 0.75,
    armour: 0.05,
    speed: 132,
    contact: 8,

    move: 'duel_flank',
    fire: 'spread3',
    fireRate: 0.8,
    bulletSpeed: 300,

    abilities: ['shatter_shot'],

    strategy: 'Their rounds break up when they land, so a wall at your back doubles every volley. Fight in open middle and kill the outer two first.',
    blurb: 'Four inventory drones counting a hold that was emptied by somebody else.',
    intro: 'They split around you without hurrying and take up stations behind. '
      + 'Individually they are nothing; the arithmetic is that you cannot face all four. '
      + 'Where you stand matters more here than what you shoot.',
  },

  // ---------------------------------------------------------------------------
  // HIGH (11–20) — assumes you can already dodge. These attack your habits.
  // ---------------------------------------------------------------------------
  {
    id: 'hollow_long_watch',
    name: 'The Long Watch',
    faction: 'Hollow',
    band: 'high',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'ring', nose: 'cowl', wing: 'sail',
      pod: 'spinal_gun', engine: 'ring_drive', crest: 'halo', pal: 'void',
    },

    hullMul: 1.25,
    shieldMul: 0.3,
    damageMul: 1.3,
    armour: 0.18,
    speed: 74,
    contact: 12,

    move: 'duel_anchor',
    fire: 'orb',
    fireRate: 0.45,
    bulletSpeed: 250,

    abilities: ['singularity', 'railshot'],

    strategy: 'It pulls you onto a line and then fires down it. Burn across the pull, never against it — fighting the drag just keeps you on the line longer.',
    blurb: 'A gun platform that would rather move the field than move itself.',
    intro: 'It has not changed position since you arrived and it does not intend to. '
      + 'Instead the space between you folds, gently, and your own momentum stops being yours. '
      + 'Wherever that leaves you is where the rail is already pointing.',
  },

  {
    id: 'hollow_silent_custodian',
    name: 'Silent Custodian',
    faction: 'Hollow',
    band: 'high',
    squadron: 1,
    role: 'glass',

    art: {
      core: 'spindle', nose: 'lance_tip', wing: 'blade_pair',
      pod: 'twin_lasers', engine: 'twin_cone', crest: 'none', pal: 'frost',
    },

    // Almost half its budget is shield, and it gets that shield back every time
    // it returns. The fragility is real only inside the window.
    hullMul: 0.68,
    shieldMul: 0.4,
    damageMul: 1.4,
    armour: 0,
    speed: 186,
    contact: 9,

    move: 'duel_pounce',
    fire: 'needle_burst',
    fireRate: 1.3,
    bulletSpeed: 355,

    abilities: ['phase_out', 'shield_recharge'],

    strategy: 'It comes back whole, so a slow fight never finishes. Hold your damage while it is out of phase and spend all of it the instant it is solid.',
    blurb: 'It leaves the fight for a second at a time and returns exactly as it left.',
    intro: 'It waits at the edge of the field, crosses it faster than you can turn, and is gone before your burst lands. '
      + 'Every hit you place in the wrong second is a hit you do not get back. '
      + 'It has more patience than you do; the only thing you have is timing.',
  },

  {
    id: 'hollow_vault_regent',
    name: 'Vault Regent',
    faction: 'Hollow',
    band: 'high',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'obelisk', nose: 'ram_plate', wing: 'none',
      pod: 'shield_emitter', engine: 'quad_block', crest: 'lamp', pal: 'obsidian',
    },

    hullMul: 1.45,
    shieldMul: 0.3,
    damageMul: 1.2,
    // The armour ceiling. It is the only thing in the pack that is meant to be
    // unkillable from the front, and the fight is the geometry of getting off it.
    armour: 0.3,
    speed: 70,
    contact: 18,

    move: 'duel_stalk',
    fire: 'closing_wall',
    fireRate: 0.35,
    bulletSpeed: 240,

    abilities: ['hardlight_shield', 'gravity_snare', 'mega_laser'],

    strategy: 'Nothing goes through the face plate, so work it from above or below. It drags you back onto the axis every few seconds; be moving off again before the snare ends.',
    blurb: 'A vault door with drives, still refusing an entry it was never given.',
    intro: 'It closes on you a metre at a time and the front of it does not take damage. '
      + 'Off the axis is the only place worth shooting from, and off the axis is exactly where it will not let you stay. '
      + 'When the whole face lights, the axis is the one place you cannot be.',
  },

  {
    id: 'hollow_cold_assembly',
    name: 'Cold Assembly',
    faction: 'Hollow',
    band: 'high',
    squadron: 5,
    role: 'glass',

    art: {
      core: 'lattice', nose: 'blunt', wing: 'none',
      pod: 'missile_rack', engine: 'pulse_pods', crest: 'none', pal: 'pearl',
    },

    // Five bodies, no shield, no armour: every one of them dies to a clean pass,
    // and the fight is entirely about how many are still firing.
    hullMul: 1.0,
    shieldMul: 0,
    damageMul: 0.7,
    armour: 0,
    speed: 158,
    contact: 7,

    move: 'duel_escort',
    fire: 'homing1',
    fireRate: 0.55,
    bulletSpeed: 260,

    abilities: ['homing_swarm'],

    strategy: 'Seekers from five sources is more than the field has room for. Kill from the outside in — the edge hulls are the ones closing the box.',
    blurb: 'A production run that finished assembling itself after the yard went dark.',
    intro: 'Five identical hulls in a formation with no gaps in it, none of them fully finished. '
      + 'Each one is one good pass from scrap and each one is launching. '
      + 'The only way this gets easier is if you make it smaller, quickly.',
  },

  {
    id: 'hollow_manifest_eleven',
    name: 'Manifest Eleven',
    faction: 'Hollow',
    band: 'high',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'mantaform', nose: 'cowl', wing: 'swept',
      pod: 'none', engine: 'spread_rail', crest: 'antenna', pal: 'void',
    },

    hullMul: 0.85,
    shieldMul: 0.25,
    damageMul: 1.1,
    armour: 0.06,
    speed: 172,
    contact: 10,

    move: 'duel_drift_wide',
    fire: 'spread3',
    fireRate: 0.9,
    bulletSpeed: 320,

    abilities: ['decoy_split', 'target_lock'],

    strategy: 'Only one of them paints you. Listen for the lock, shoot whichever hull made it, and let the rest of them fly.',
    blurb: 'A ship that files copies of itself and has never once been audited.',
    intro: 'It runs corner to corner trailing duplicates that fly the same line and fire the same shots. '
      + 'Shooting all of them is how you run out of time. '
      + 'One of them is doing something the others are not, and it does it out loud.',
  },

  // ---------------------------------------------------------------------------
  // ANY (1–20) — three that scale the whole map. Their puzzles do not depend on
  // the player's power level, only on where the player is standing.
  // ---------------------------------------------------------------------------
  {
    id: 'hollow_berth_warden',
    name: 'Berth Warden',
    faction: 'Hollow',
    band: 'any',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'crescent', nose: 'maw', wing: 'scythe',
      pod: 'gatling_ring', engine: 'hex_cluster', crest: 'horns', pal: 'ion',
    },

    hullMul: 1.15,
    shieldMul: 0.2,
    damageMul: 1.05,
    armour: 0.14,
    speed: 118,
    contact: 14,

    move: 'duel_lunge',
    fire: 'burst3',
    fireRate: 1.0,
    bulletSpeed: 300,

    abilities: ['nova_pulse', 'burn_trail'],

    strategy: 'You cannot follow it and you cannot stand beside it. Get ahead of the patrol line and let it arrive at you.',
    blurb: 'It walks a berth that burned out years ago, and the wash is still hot.',
    intro: 'It holds, dashes, and holds again, and the ground it crossed stays lit behind it. '
      + 'Chasing means flying through the wake; staying close means being there when the ring goes out. '
      + 'The answer is to stop moving toward it at all.',
  },

  {
    id: 'hollow_relay_ninetyone',
    name: 'Relay Ninety-One',
    faction: 'Hollow',
    band: 'any',
    squadron: 2,
    role: 'support',

    art: {
      core: 'ring', nose: 'sensor_dome', wing: 'spar_frame',
      pod: 'none', engine: 'vent_bank', crest: 'dish', pal: 'frost',
    },

    hullMul: 1.05,
    shieldMul: 0.3,
    damageMul: 0.8,
    armour: 0.1,
    speed: 104,
    contact: 9,

    move: 'duel_circle',
    fire: 'parting_shot',
    fireRate: 0.6,
    bulletSpeed: 280,

    abilities: ['repair_weave'],

    strategy: 'Each one mends the other, so killing one slowly kills neither. Bring them down together, or drive them far enough apart that the weave drops.',
    blurb: 'Two relays passing a message between them that has no recipient left.',
    intro: 'They orbit you in opposition, always on the far side of each other, always talking. '
      + 'Whatever you take off one comes back from the other within a few seconds. '
      + 'This is not a damage problem. It is a scheduling one.',
  },

  {
    id: 'hollow_standing_order',
    name: 'Standing Order Six',
    faction: 'Hollow',
    band: 'any',
    squadron: 3,
    role: 'bruiser',

    art: {
      core: 'husk', nose: 'split_prow', wing: 'folded',
      pod: 'chin_cannon', engine: 'stacked_trio', crest: 'spine_fin', pal: 'abyss',
    },

    hullMul: 1.1,
    shieldMul: 0.05,
    damageMul: 1.0,
    armour: 0.08,
    speed: 140,
    // The contact ceiling: the collision is the attack, so it has to be worth
    // the whole telegraph rather than a scrape you can afford to eat.
    contact: 20,

    move: 'duel_erratic',
    fire: 'cross',
    fireRate: 0.7,
    bulletSpeed: 280,

    abilities: ['ram_charge'],

    strategy: 'They commit one at a time, and the tell is the hull that stops jinking and flies straight. Sidestep that one; the other two cannot correct in time.',
    blurb: 'Three wrecks carrying out the last instruction anybody gave them.',
    intro: 'Their attitude control is long gone, so they move in ugly little bursts that go nowhere in particular. '
      + 'Then one of them goes quiet and straight, and that one is not manoeuvring any more. '
      + 'It is not trying to hit you. It is completing a task.',
  },
];

/**
 * The Hollow.
 *
 * These are automated hulls whose crews, yards and chains of command are all
 * gone. Nobody switched them off, so they are still running the last procedure
 * they were issued: survey this volume, hold this cordon, mark this channel,
 * count this cargo. There is no anger in any of it. A Hollow ship will not
 * taunt you, chase you past its assigned sector, celebrate a kill or break off
 * from a fight it is losing, because none of those are steps in the procedure.
 * Several of them are visibly wrecked and are executing anyway.
 *
 * That is why they fight the way they do. A ship with a grudge improvises; a
 * ship running a checklist repeats, and repetition is the only thing in this
 * game the player can actually learn. So every duelist here is built around one
 * mechanical, unblinking motion — a lock, a sweep, a wall, a pull — that
 * happens on a fixed cadence whether or not it makes sense against the ship in
 * front of it. The threat is never that they are clever. It is that they are
 * exact, and that they will still be doing this in an hour.
 *
 * Two design consequences worth recording, because both were deliberate:
 *
 * Nothing in this pack is aimed at the player's ship so much as at a piece of
 * ground. Locks paint a line, beams sweep a sector, mines fill a boundary,
 * snares move the field itself. That keeps the answer to every fight spatial —
 * stand somewhere else — rather than a damage race, which is the failure mode
 * a hundred duelists could very easily collapse into.
 *
 * The squadrons carry one ability each rather than the permitted two. Effects
 * stack per body, and a five-body formation with two abilities apiece is not a
 * harder puzzle, it is an unreadable one. The single hulls are where the
 * layered loadouts live.
 */
