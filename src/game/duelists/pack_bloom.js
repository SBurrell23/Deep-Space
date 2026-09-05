/**
 * The Bloom — twenty duelists.
 *
 * The Bloom is not a navy. It is something that grows on ships: a colony that
 * takes a hull, keeps the parts of it that still work, and replaces the rest
 * with itself. Nothing here was built. Everything here was grown over.
 *
 * That biology is the whole design brief. A Bloom duelist is rarely the most
 * dangerous object in the arena by the end of the fight, because its job is to
 * change the arena rather than to win the exchange in it. They seed, they
 * split, they regrow, and they leave things alive in the space behind them.
 * Fighting one is a question of floor space, not of aim.
 *
 * The trap that shape walks into is sameness — twenty ships that all drop a
 * cloud is one ship twenty times — so the pack is deliberately built around a
 * different *shape of problem* per hull rather than a different flavour of
 * poison. One punishes standing still, one punishes approaching, one punishes
 * firing at all, one punishes spreading damage, one punishes saving energy for
 * later. Only six of the twenty leave a persistent zone; the rest earn their
 * place by taking away a different freedom.
 *
 * Stat multipliers are written against the role, not the fantasy: a `glass`
 * hull trades roughly half a tank's hull budget for sixty per cent more speed,
 * which is the difference between a ship you outmanoeuvre and one you outrange.
 * Absolute hull, shield, xp, credits and cost come from the loader.
 */
export const PACK_BLOOM = [
  // ---------------------------------------------------------------------------
  // LOW BAND (1–7) — one idea each, stated plainly, with a long tell.
  // ---------------------------------------------------------------------------
  {
    id: 'spore_tiller',
    name: 'Spore Tiller',
    faction: 'Bloom',
    band: 'low',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'beetle', nose: 'maw', wing: 'folded', pod: 'none',
      engine: 'vent_bank', crest: 'none', pal: 'plague',
    },

    hullMul: 0.88,
    shieldMul: 0.05,
    damageMul: 0.85,
    armour: 0.04,
    speed: 118,
    contact: 10,

    move: 'duel_stalk',
    fire: 'spreading_pool',
    fireRate: 0.5,
    bulletSpeed: 265,

    abilities: ['venom_cloud'],

    strategy: 'It paints the floor and never hurries. Keep moving into clean space; the way it kills you is by making you turn back through your own wake.',
    blurb: 'It does not chase. It plants, and waits for you to run out of floor.',
    intro: 'The Tiller comes in at walking pace with its mouth open. Everywhere you have '
      + 'already been is going soft behind you. There is no hurry in it at all, which is '
      + 'the part you should be worried about.',
  },

  {
    id: 'coppice_hulk',
    name: 'Coppice Hulk',
    faction: 'Bloom',
    band: 'low',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'barge', nose: 'ram_plate', wing: 'stub', pod: 'claw_arms',
      engine: 'quad_block', crest: 'horns', pal: 'rust',
    },

    hullMul: 1.15,
    shieldMul: 0.05,
    damageMul: 0.95,
    armour: 0.14,
    speed: 88,
    contact: 17,

    move: 'duel_pressure',
    fire: 'forward',
    fireRate: 0.75,
    bulletSpeed: 270,

    abilities: ['ram_charge', 'split_form'],

    strategy: 'Do not finish it against a wall. It comes apart into two halves that keep walking, and you want the room behind you free when that happens.',
    blurb: 'Cut it down and it comes back thicker. That is what cutting it down is for.',
    intro: 'It walks straight at you and shoulders through whatever is in the way. Killing '
      + 'it is not the end of the exchange. It is the middle of it.',
  },

  {
    id: 'bracken_wing',
    name: 'Bracken Wing',
    faction: 'Bloom',
    band: 'low',
    squadron: 2,
    role: 'skirmisher',

    art: {
      core: 'crescent', nose: 'spike', wing: 'scythe', pod: 'none',
      engine: 'twin_cone', crest: 'none', pal: 'verdant',
    },

    hullMul: 0.82,
    shieldMul: 0,
    damageMul: 0.8,
    armour: 0.02,
    speed: 152,
    contact: 9,

    move: 'duel_strafe',
    fire: 'single',
    fireRate: 0.8,
    bulletSpeed: 320,

    abilities: ['burn_trail'],

    strategy: 'Each pass draws a burning line across your lane and the lines do not fade quickly. Be through the gap on the pass that makes it, not the one after.',
    blurb: 'Two hulls running your lane, marking the only part of it you were using.',
    intro: 'They cross in front of you, one high and one low, and leave the crossing '
      + 'burning. The safe part of the field is whatever they have not drawn on yet. It '
      + 'gets smaller every pass.',
  },

  {
    id: 'rhizome_anchor',
    name: 'Rhizome Anchor',
    faction: 'Bloom',
    band: 'low',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'ring', nose: 'blunt', wing: 'spar_frame', pod: 'launch_bay',
      engine: 'none', crest: 'dish', pal: 'abyss',
    },

    hullMul: 1.38,
    shieldMul: 0.22,
    damageMul: 0.8,
    armour: 0.2,
    speed: 74,
    contact: 12,

    move: 'duel_anchor',
    fire: 'radial8',
    fireRate: 0.45,
    bulletSpeed: 245,

    abilities: ['mine_lattice', 'hardlight_shield'],

    strategy: 'This is a clock, not a duel. The rings are survivable forever; the lattice is not, so open hard and accept the chip damage rather than trading patiently.',
    blurb: 'Rooted, armoured, and quietly making the arena smaller.',
    intro: 'It stops dead at the far side and puts its roots down. The ring it throws every '
      + 'couple of seconds is not the threat. The threat is what keeps growing outward from '
      + 'it while you deal with the rings.',
  },

  {
    id: 'nettle_drifter',
    name: 'Nettle Drifter',
    faction: 'Bloom',
    band: 'low',
    squadron: 1,
    role: 'glass',

    art: {
      core: 'spindle', nose: 'forked', wing: 'fan', pod: 'none',
      engine: 'pulse_pods', crest: 'spine_fin', pal: 'magenta',
    },

    hullMul: 0.68,
    shieldMul: 0,
    damageMul: 1.05,
    armour: 0,
    speed: 172,
    contact: 14,

    move: 'duel_erratic',
    fire: 'repulsor_field',
    fireRate: 0.4,
    bulletSpeed: 300,

    abilities: ['nova_pulse', 'phase_out'],

    strategy: 'Nothing about it survives a clean hit, so it makes sure you never take one at close range. Shoot it from distance and lead the jinks. Closing is how it wins.',
    blurb: 'Thin, twitchy, and wrapped in something you do not want to touch.',
    intro: 'It jerks about the field in short bursts, carrying a haze it cannot switch off. '
      + 'Everything you would normally do to a hull this thin involves getting nearer to it.',
  },

  {
    id: 'pollen_mortar',
    name: 'Pollen Mortar',
    faction: 'Bloom',
    band: 'low',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'obelisk', nose: 'cowl', wing: 'sail', pod: 'missile_rack',
      engine: 'vent_bank', crest: 'antenna', pal: 'rust',
    },

    hullMul: 1.0,
    shieldMul: 0.1,
    damageMul: 1.25,
    armour: 0.08,
    speed: 78,
    contact: 10,

    move: 'duel_wall',
    fire: 'heavy',
    fireRate: 0.38,
    bulletSpeed: 248,

    abilities: ['gravity_snare', 'cluster_bomb'],

    strategy: 'The pull is the attack and the shell is only the delivery. Break the drag the moment it starts and everything it fires lands on the spot you left.',
    blurb: 'A gun that decides where you will be standing, then fires there.',
    intro: 'It hugs the right wall and lobs slowly, which would be an easy problem. Then '
      + 'something takes hold of you and starts dragging, and the arithmetic of a slow lob '
      + 'changes completely.',
  },

  // ---------------------------------------------------------------------------
  // MID BAND (5–13) — the fight stops being about the ship and starts being
  // about the room. Two of these are squadrons, which is where the faction's
  // multiplication starts to bite.
  // ---------------------------------------------------------------------------
  {
    id: 'callus_bulwark',
    name: 'Callus Bulwark',
    faction: 'Bloom',
    band: 'mid',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'hammerhead', nose: 'blunt', wing: 'stub', pod: 'shield_emitter',
      engine: 'quad_block', crest: 'banner', pal: 'bone',
    },

    hullMul: 1.42,
    shieldMul: 0.12,
    damageMul: 0.95,
    armour: 0.27,
    speed: 82,
    contact: 18,

    move: 'duel_boxer',
    fire: 'wall',
    fireRate: 0.42,
    bulletSpeed: 250,

    abilities: ['reflect_field', 'barrier_wall'],

    strategy: 'When the scar tissue goes pale, stop firing. Everything you put into that window comes back down the same line, and it will not have moved by then.',
    blurb: 'Scar tissue with engines. It gives back exactly what you put in.',
    intro: 'It advances, stops, and lets you hit it. The rhythm is the tell. Learning when '
      + 'not to shoot is more of this fight than learning when to.',
  },

  {
    id: 'seedhead_scatter',
    name: 'Seedhead Scatter',
    faction: 'Bloom',
    band: 'mid',
    squadron: 3,
    role: 'glass',

    art: {
      core: 'crescent', nose: 'split_prow', wing: 'none', pod: 'none',
      engine: 'pulse_pods', crest: 'none', pal: 'verdant',
    },

    hullMul: 0.75,
    shieldMul: 0,
    damageMul: 0.85,
    armour: 0,
    speed: 165,
    contact: 8,

    move: 'duel_circle',
    fire: 'needle',
    fireRate: 0.75,
    bulletSpeed: 350,

    abilities: ['decoy_split'],

    strategy: 'The copies never fire. Track which bodies are actually throwing needles and let the rest orbit; wasted shots are the only way three hulls this thin outlast you.',
    blurb: 'Three thin bodies circling, and rarely only three.',
    intro: 'They orbit at a fixed distance, needling, going nowhere. Commit to one and it '
      + 'comes apart into several of itself, and only one of those was ever there.',
  },

  {
    id: 'blight_matron',
    name: 'Blight Matron',
    faction: 'Bloom',
    band: 'mid',
    squadron: 1,
    role: 'support',

    art: {
      core: 'mantaform', nose: 'sensor_dome', wing: 'delta', pod: 'launch_bay',
      engine: 'spread_rail', crest: 'halo', pal: 'plague',
    },

    hullMul: 1.05,
    shieldMul: 0.3,
    damageMul: 0.8,
    armour: 0.08,
    speed: 132,
    contact: 9,

    move: 'duel_keepaway',
    fire: 'homing2',
    fireRate: 0.55,
    bulletSpeed: 260,

    abilities: ['summon_wing', 'repair_weave', 'retro_burn'],

    strategy: 'Every second spent in your own half is another body in the field. You have to cross, and you have to eat the burn on the way; there is no version of this won at range.',
    blurb: 'It will not fight you. It will build until something else does.',
    intro: 'It runs the moment you close, and it leaves things behind while it runs. The '
      + 'brood is not the fight, and clearing the brood is not progress.',
  },

  {
    id: 'tendril_lash',
    name: 'Tendril Lash',
    faction: 'Bloom',
    band: 'mid',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'husk', nose: 'maw', wing: 'gull', pod: 'claw_arms',
      engine: 'single_bell', crest: 'horns', pal: 'magenta',
    },

    hullMul: 1.12,
    shieldMul: 0.1,
    damageMul: 1.15,
    armour: 0.12,
    speed: 128,
    contact: 19,

    move: 'duel_lunge',
    fire: 'cross',
    fireRate: 0.6,
    bulletSpeed: 300,

    abilities: ['chain_lightning', 'frenzy'],

    strategy: 'Nothing absorbs the arc — anything between you only gives it a shorter path, so your own escorts make it worse. Stay outside the lunge and finish it above half hull, because under half the pauses stop.',
    blurb: 'It closes, holds, and the discharge finds you through whatever is in the way.',
    intro: 'It sits at middle distance and covers that distance in one motion. The lash does '
      + 'not need to be aimed, only near. When its hull opens up, the resting between lunges '
      + 'stops happening.',
  },

  {
    id: 'rustfall_seeder',
    name: 'Rustfall Seeder',
    faction: 'Bloom',
    band: 'mid',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'wedge', nose: 'drill', wing: 'swept', pod: 'drum_magazine',
      engine: 'stacked_trio', crest: 'vent_stack', pal: 'rust',
    },

    hullMul: 1.02,
    shieldMul: 0.14,
    damageMul: 1.2,
    armour: 0.1,
    speed: 96,
    contact: 11,

    move: 'duel_bob',
    fire: 'minefield_zones',
    fireRate: 0.4,
    bulletSpeed: 255,

    abilities: ['target_lock', 'homing_swarm'],

    strategy: 'Its route is fixed, so the patches land on a rhythm you can learn and route around. The lock is the part you cannot: once marked, change the line you were flying or the swarm meets you at the end of it.',
    blurb: 'It traces the same figure over and over, and seeds the corners of it.',
    intro: 'It runs a lazy figure-eight across the far half and drops three patches every '
      + 'crossing. Once it has looked at you properly, the missiles stop having to guess.',
  },

  {
    id: 'bulbil_pair',
    name: 'Bulbil Pair',
    faction: 'Bloom',
    band: 'mid',
    squadron: 2,
    role: 'bruiser',

    art: {
      core: 'dagger', nose: 'spike', wing: 'blade_pair', pod: 'chin_cannon',
      engine: 'twin_cone', crest: 'blade_crest', pal: 'verdant',
    },

    hullMul: 0.95,
    shieldMul: 0.06,
    damageMul: 1.0,
    armour: 0.08,
    speed: 140,
    contact: 15,

    move: 'duel_flank',
    fire: 'burst3',
    fireRate: 0.7,
    bulletSpeed: 310,

    abilities: ['split_form'],

    strategy: 'Turn and face them on the first pass. Each one you break leaves two smaller ones doing the same thing from behind, and four of those is a different fight entirely.',
    blurb: 'Two, then four. They come from behind on purpose.',
    intro: 'They break high and low and are gone from in front of you inside a second. The '
      + 'first pass is the easy one, because the first pass is when there are the fewest.',
  },

  // ---------------------------------------------------------------------------
  // HIGH BAND (11–20) — assumes a levelled ship, so each of these takes away a
  // freedom rather than adding damage: your height, your energy, your choice of
  // where to stand, your ability to react late.
  // ---------------------------------------------------------------------------
  {
    id: 'necrosis_crown',
    name: 'Necrosis Crown',
    faction: 'Bloom',
    band: 'high',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'cathedral', nose: 'lance_tip', wing: 'sail', pod: 'spinal_gun',
      engine: 'stacked_trio', crest: 'halo', pal: 'abyss',
    },

    hullMul: 1.18,
    shieldMul: 0.28,
    damageMul: 1.35,
    armour: 0.14,
    speed: 90,
    contact: 12,

    move: 'duel_mirror',
    fire: 'siege_beam',
    fireRate: 0.36,
    bulletSpeed: 250,

    abilities: ['siege_mode', 'beam_sweep', 'railshot'],

    strategy: 'Climbing does nothing — it copies your height exactly. Siege mode is the only window in the fight: while it is rooted it cannot follow, so bank everything on the seconds after it plants.',
    blurb: 'It sits at your height, always, and burns along the line that makes.',
    intro: 'It matches you up and down without apparent effort and cuts along the result. '
      + 'Then it digs in and stops being able to follow you at all. That is the only part '
      + 'of this that belongs to you.',
  },

  {
    id: 'mycelial_shroud',
    name: 'Mycelial Shroud',
    faction: 'Bloom',
    band: 'high',
    squadron: 1,
    role: 'support',

    art: {
      core: 'lattice', nose: 'cowl', wing: 'long_straight', pod: 'dorsal_turret',
      engine: 'ring_drive', crest: 'dish', pal: 'plague',
    },

    hullMul: 1.1,
    shieldMul: 0.34,
    damageMul: 0.9,
    armour: 0.1,
    speed: 112,
    contact: 10,

    move: 'duel_drift_wide',
    fire: 'orb',
    fireRate: 0.45,
    bulletSpeed: 240,

    abilities: ['emp_pulse', 'drone_bay', 'repair_weave'],

    strategy: 'Spend everything before the pulse lands. Anything you were saving for later is a gift to this ship, and its drones are only dangerous during the seconds you are flying an unarmed hull.',
    blurb: 'It drifts corner to corner and takes the charge out of everything you have.',
    intro: 'It sweeps the whole field on a slow diagonal, shedding orbs it does not bother '
      + 'to aim. The pulse comes round about every ten seconds. What it leaves you with is '
      + 'the mess it has already made.',
  },

  {
    id: 'canker_throne',
    name: 'Canker Throne',
    faction: 'Bloom',
    band: 'high',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'ring', nose: 'sensor_dome', wing: 'spar_frame', pod: 'twin_lasers',
      engine: 'ring_drive', crest: 'lamp', pal: 'abyss',
    },

    hullMul: 1.45,
    shieldMul: 0.25,
    damageMul: 1.05,
    armour: 0.3,
    speed: 72,
    contact: 20,

    move: 'duel_anchor',
    fire: 'cross_beams',
    fireRate: 0.38,
    bulletSpeed: 242,

    abilities: ['singularity', 'nova_pulse', 'hardlight_shield'],

    strategy: 'Fight it on a diagonal. The beams lock to the axes and never track, so the pull only kills you if you were already lined up with one — let the drag carry you across a quadrant instead of fighting it.',
    blurb: 'A fixed cross of light, and something pulling you onto it.',
    intro: 'It anchors in the middle distance and throws a cross that does not move. Then '
      + 'the floor tilts toward it. The beams are not the difficult part; being allowed to '
      + 'choose where you stand is.',
  },

  {
    id: 'catkin_drift',
    name: 'Catkin Drift',
    faction: 'Bloom',
    band: 'high',
    squadron: 4,
    role: 'skirmisher',

    art: {
      core: 'spindle', nose: 'forked', wing: 'canard', pod: 'side_barbettes',
      engine: 'hex_cluster', crest: 'spine_fin', pal: 'verdant',
    },

    hullMul: 0.9,
    shieldMul: 0.08,
    damageMul: 0.9,
    armour: 0.02,
    speed: 160,
    contact: 8,

    move: 'duel_escort',
    fire: 'single',
    fireRate: 0.85,
    bulletSpeed: 340,

    abilities: ['blink_strike'],

    strategy: 'Four bodies arrive in the same instant, so open ground is the worst place to read the tell. Put an edge at your back before the charge finishes and at most two of them get an angle.',
    blurb: 'Four hulls flying as one, and all four arrive at once.',
    intro: 'They hold formation at range and do nothing worth watching. Then the formation '
      + 'is on top of you, still in formation, with no travel in between.',
  },

  {
    id: 'wither_lance',
    name: 'Wither Lance',
    faction: 'Bloom',
    band: 'high',
    squadron: 1,
    role: 'glass',

    art: {
      core: 'dagger', nose: 'lance_tip', wing: 'twin_boom', pod: 'spinal_gun',
      engine: 'single_bell', crest: 'blade_crest', pal: 'magenta',
    },

    hullMul: 0.7,
    shieldMul: 0.05,
    damageMul: 1.5,
    armour: 0,
    speed: 196,
    contact: 13,

    move: 'duel_pounce',
    fire: 'needle_burst',
    fireRate: 1.1,
    bulletSpeed: 360,

    abilities: ['shatter_shot', 'overload_burst'],

    strategy: 'It commits to one straight run and cannot correct mid-crossing, so be off the line before it starts. Dodging late is worse than useless — the shots come apart, and the fragments go where you were going.',
    blurb: 'It waits at the edge for one line across the field, and then takes it.',
    intro: 'It sits in a corner with its drives cold until it decides. The crossing takes '
      + 'under a second. Everything it fires on the way breaks up before it reaches you.',
  },

  // ---------------------------------------------------------------------------
  // ANY BAND (1–20) — three that stay legible at every depth, because the
  // problem they set is structural rather than numerical.
  // ---------------------------------------------------------------------------
  {
    id: 'gall_brood',
    name: 'Gall Brood',
    faction: 'Bloom',
    band: 'any',
    squadron: 2,
    role: 'support',

    art: {
      core: 'husk', nose: 'blunt', wing: 'folded', pod: 'shield_emitter',
      engine: 'hex_cluster', crest: 'vent_stack', pal: 'plague',
    },

    hullMul: 1.0,
    shieldMul: 0.4,
    damageMul: 0.75,
    armour: 0.12,
    speed: 124,
    contact: 8,

    move: 'duel_pounce',
    fire: 'sweep',
    fireRate: 0.6,
    bulletSpeed: 270,

    abilities: ['repair_weave'],

    strategy: 'Spread damage is thrown away here — they weave each other back up faster than a drizzle takes it off. Pick one, empty everything into it, and the survivor is an ordinary fight.',
    blurb: 'Two growths that keep each other alive.',
    intro: 'They lurk at the edges and cross in pairs. Whatever you take off one comes back '
      + 'off the other, and you tend to notice this about forty seconds into a fight you '
      + 'thought you were winning.',
  },

  {
    id: 'thistledown_flight',
    name: 'Thistledown Flight',
    faction: 'Bloom',
    band: 'any',
    squadron: 3,
    role: 'skirmisher',

    art: {
      core: 'mantaform', nose: 'split_prow', wing: 'fan', pod: 'gatling_ring',
      engine: 'spread_rail', crest: 'antenna', pal: 'ember',
    },

    hullMul: 0.85,
    shieldMul: 0.1,
    damageMul: 0.85,
    armour: 0.04,
    speed: 148,
    contact: 9,

    move: 'duel_escort',
    fire: 'spread3',
    fireRate: 0.75,
    bulletSpeed: 300,

    abilities: ['flak_curtain'],

    strategy: 'The curtains take the top and bottom of the field, leaving the middle, which is exactly where three sets of spreads are pointed. Take the middle anyway, and take it before the third curtain goes up.',
    blurb: 'Three of them, and a ceiling and a floor made of flak.',
    intro: 'They drift in loose formation and put flak where the edges of the field used to '
      + 'be. The lane they leave you is the one all three of them are aiming down.',
  },

  {
    id: 'heartrot_bastion',
    name: 'Heartrot Bastion',
    faction: 'Bloom',
    band: 'any',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'trident', nose: 'ram_plate', wing: 'delta', pod: 'side_barbettes',
      engine: 'quad_block', crest: 'banner', pal: 'ember',
    },

    hullMul: 1.4,
    shieldMul: 0.18,
    damageMul: 1.1,
    armour: 0.25,
    speed: 84,
    contact: 18,

    move: 'duel_pressure',
    fire: 'closing_wall',
    fireRate: 0.4,
    bulletSpeed: 246,

    abilities: ['mega_laser', 'shield_recharge'],

    strategy: 'The lance splits the arena along its own axis, so get onto the far side of it while the spine is charging rather than trying to outrun the sweep. It cannot turn fast enough to punish you for going past.',
    blurb: 'It advances, and once a fight it cuts the field in half.',
    intro: 'It walks forward slowly and does not stop for anything you do. Every so often '
      + 'the whole spine lights and the field becomes two rooms. You want to already be in '
      + 'the other one.',
  },
];
