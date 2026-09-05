export const PACK_CHOIR = [
  // ---------------------------------------------------------------------------
  // LOW BAND — the Choir teaches its grammar here. Every ship in this band has
  // exactly one ceremony, held long enough to be read the first time you see it.
  // ---------------------------------------------------------------------------
  {
    id: 'choir_lesser_litany',
    name: 'Lesser Litany',
    faction: 'Choir',
    band: 'low',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'crescent', nose: 'lance_tip', wing: 'sail', pod: 'twin_lasers',
      engine: 'single_bell', crest: 'blade_crest', pal: 'bone',
    },

    hullMul: 0.78,
    shieldMul: 0.18,
    damageMul: 0.85,
    armour: 0.04,
    speed: 132,
    contact: 9,

    move: 'duel_wall',
    fire: 'sweep',
    fireRate: 0.9,
    bulletSpeed: 300,

    abilities: ['beam_sweep'],

    strategy: 'It only travels up and down the right edge, and the beam follows it. Sit in the row it has already passed and stay off its horizontal.',
    blurb: 'A single sung line, drawn slowly across the field until it finds you.',
    intro: 'It runs the far edge like a finger down a page. The lamp along its spine brightens before the cut, '
      + 'and it never hurries the pause between the two.',
  },

  {
    id: 'choir_lamp_bearer',
    name: 'Lamp-Bearer',
    faction: 'Choir',
    band: 'low',
    squadron: 1,
    role: 'support',

    art: {
      core: 'spindle', nose: 'cowl', wing: 'folded', pod: 'shield_emitter',
      engine: 'vent_bank', crest: 'lamp', pal: 'gold',
    },

    hullMul: 0.72,
    shieldMul: 0.30,
    damageMul: 0.75,
    armour: 0.06,
    speed: 158,
    contact: 8,

    move: 'duel_keepaway',
    fire: 'parting_shot',
    fireRate: 1.0,
    bulletSpeed: 330,

    abilities: ['burn_trail', 'hardlight_shield'],

    strategy: 'Never follow it down its own wake. Cut the corner it is running to and meet it there, or shoot it across the diagonal.',
    blurb: 'It runs, and it leaves the path it ran along on fire behind it.',
    intro: 'It will not stand and fight. It backs away at exactly the speed you close, shooting over its own shoulder, '
      + 'and the lamp on its crest drips burning oil into the lane you were about to use.',
  },

  {
    id: 'choir_thurifers',
    name: 'Thurifers',
    faction: 'Choir',
    band: 'low',
    squadron: 2,
    role: 'skirmisher',

    art: {
      core: 'ring', nose: 'sensor_dome', wing: 'none', pod: 'drum_magazine',
      engine: 'ring_drive', crest: 'halo', pal: 'bone',
    },

    hullMul: 0.85,
    shieldMul: 0.12,
    damageMul: 0.80,
    armour: 0.03,
    speed: 140,
    contact: 10,

    move: 'duel_circle',
    fire: 'orb',
    fireRate: 0.5,
    bulletSpeed: 250,

    abilities: ['venom_cloud'],

    strategy: 'The censers only orbit where you are, so the smoke collects around you. Keep walking the fight into clean space; do not win the ground you are standing on.',
    blurb: 'Two swinging censers circling you at arm\'s length, filling the room they have chosen.',
    intro: 'They orbit and they smoke, and the orbs they lob are slow enough to look harmless. '
      + 'Ten seconds later there is nowhere in the middle of the field worth being.',
  },

  {
    id: 'choir_ossuary_gate',
    name: 'Ossuary Gate',
    faction: 'Choir',
    band: 'low',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'obelisk', nose: 'blunt', wing: 'spar_frame', pod: 'shield_emitter',
      engine: 'none', crest: 'banner', pal: 'bone',
    },

    hullMul: 1.34,
    shieldMul: 0.34,
    damageMul: 0.85,
    armour: 0.22,
    speed: 74,
    contact: 16,

    move: 'duel_anchor',
    fire: 'wall',
    fireRate: 0.42,
    bulletSpeed: 258,

    abilities: ['barrier_wall', 'shield_recharge'],

    strategy: 'It never moves, so you choose your side of the field before it raises the wall, not after. Commit early and shoot through the same gap twice.',
    blurb: 'A door that has been shut for a long time and intends to stay that way.',
    intro: 'It is anchored, armoured and entirely uninterested in you. Its work is deciding which half of the field '
      + 'you are allowed to have, and it does that faster than you can cross.',
  },

  {
    id: 'choir_pale_deacon',
    name: 'Pale Deacon',
    faction: 'Choir',
    band: 'low',
    squadron: 1,
    role: 'glass',

    art: {
      core: 'spindle', nose: 'spike', wing: 'blade_pair', pod: 'none',
      engine: 'pulse_pods', crest: 'spine_fin', pal: 'void',
    },

    hullMul: 0.66,
    shieldMul: 0.05,
    damageMul: 1.15,
    armour: 0,
    speed: 186,
    contact: 7,

    move: 'duel_erratic',
    fire: 'needle',
    fireRate: 1.25,
    bulletSpeed: 352,

    abilities: ['blink_strike', 'phase_out'],

    strategy: 'Leading it is wasted ammunition — it is never where your lead put it. Wait for the arrival flare and fire at where it lands, not where it is.',
    blurb: 'Thin, unarmoured, and it dies the moment you actually hit it. That is the whole problem.',
    intro: 'It does not travel between two points so much as stop existing at one and start at the other. '
      + 'Two clean hits end it. Landing the first is the fight.',
  },

  {
    id: 'choir_bell_choir',
    name: 'Bell Choir',
    faction: 'Choir',
    band: 'low',
    squadron: 3,
    role: 'artillery',

    art: {
      core: 'lattice', nose: 'sensor_dome', wing: 'fan', pod: 'dorsal_turret',
      engine: 'pulse_pods', crest: 'antenna', pal: 'pearl',
    },

    hullMul: 0.95,
    shieldMul: 0.10,
    damageMul: 1.0,
    armour: 0.06,
    speed: 86,
    contact: 9,

    move: 'duel_escort',
    fire: 'heavy',
    fireRate: 0.38,
    bulletSpeed: 244,

    abilities: ['target_lock'],

    strategy: 'Three locks converge on one point, so never be at that point when the shells land. Move laterally through the formation — inside their spacing the three lines cannot meet.',
    blurb: 'Three open frames tolling in time. The shells arrive together because they were always going to.',
    intro: 'They lock, they wait a beat, and then all three heavy shells land in the same square metre. '
      + 'The beat is generous. It is also the only warning you get.',
  },

  // ---------------------------------------------------------------------------
  // MID BAND — the liturgies get longer and start layering. From here on a
  // Choir ship is doing two things at once and only one of them is shooting.
  // ---------------------------------------------------------------------------
  {
    id: 'choir_precentor',
    name: 'The Precentor',
    faction: 'Choir',
    band: 'mid',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'cathedral', nose: 'cowl', wing: 'sail', pod: 'spinal_gun',
      engine: 'stacked_trio', crest: 'banner', pal: 'bone',
    },

    hullMul: 1.20,
    shieldMul: 0.28,
    damageMul: 1.15,
    armour: 0.16,
    speed: 88,
    contact: 13,

    move: 'duel_mirror',
    fire: 'siege_beam',
    fireRate: 0.36,
    bulletSpeed: 262,

    abilities: ['siege_mode', 'mega_laser', 'homing_swarm'],

    strategy: 'It copies your height until it plants itself, and once planted it cannot correct. Bait the anchor at one edge of the field, then spend the whole rooted stretch on the other.',
    blurb: 'It matches you all the way up and all the way down, and then it stops matching.',
    intro: 'Everything it owns fires in a straight line, which sounds survivable until you notice it has been holding '
      + 'your exact altitude for twenty seconds. When the buttresses lock down it is committed. So are you.',
  },

  {
    id: 'choir_sacristan',
    name: 'The Sacristan',
    faction: 'Choir',
    band: 'mid',
    squadron: 1,
    role: 'support',

    art: {
      core: 'ring', nose: 'forked', wing: 'spar_frame', pod: 'launch_bay',
      engine: 'hex_cluster', crest: 'dish', pal: 'pearl',
    },

    hullMul: 0.90,
    shieldMul: 0.40,
    damageMul: 0.80,
    armour: 0.08,
    speed: 118,
    contact: 10,

    move: 'duel_bob',
    fire: 'homing2',
    fireRate: 0.6,
    bulletSpeed: 280,

    abilities: ['drone_bay', 'repair_weave'],

    strategy: 'It out-repairs any damage you can spare while its escorts are alive. Ignore the drones entirely, eat the chip damage and put everything into the hull.',
    blurb: 'It keeps the vessels clean, the lamps lit, and itself alive longer than it has any right to.',
    intro: 'It traces the same lazy figure across the back of the field and never once tries to kill you quickly. '
      + 'That is the trap: split your fire between it and the bay it opens, and it simply stitches itself shut again.',
  },

  {
    id: 'choir_gilded_reliquary',
    name: 'Gilded Reliquary',
    faction: 'Choir',
    band: 'mid',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'obelisk', nose: 'ram_plate', wing: 'folded', pod: 'side_barbettes',
      engine: 'quad_block', crest: 'horns', pal: 'gold',
    },

    hullMul: 1.42,
    shieldMul: 0.26,
    damageMul: 1.0,
    armour: 0.26,
    speed: 78,
    contact: 18,

    move: 'duel_pressure',
    fire: 'closing_wall',
    fireRate: 0.40,
    bulletSpeed: 246,

    abilities: ['chain_lightning', 'split_form'],

    strategy: 'Do not empty a burst into the casket — half of it is packaging, and it opens at half hull into something faster. Save the burst for what climbs out, and never fight it inside arc range.',
    blurb: 'A gold box walking slowly toward you with something worse inside it.',
    intro: 'It advances and does not stop advancing. The walls it throws squeeze you into the middle lane, '
      + 'which is where the arc reaches, and the reliquary itself is only the lid.',
  },

  {
    id: 'choir_verger',
    name: 'The Verger',
    faction: 'Choir',
    band: 'mid',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'mantaform', nose: 'forked', wing: 'scythe', pod: 'gatling_ring',
      engine: 'twin_cone', crest: 'spine_fin', pal: 'crimson',
    },

    hullMul: 0.86,
    shieldMul: 0.14,
    damageMul: 1.05,
    armour: 0.05,
    speed: 172,
    contact: 12,

    move: 'duel_flank',
    fire: 'shotgun',
    fireRate: 0.55,
    bulletSpeed: 336,

    abilities: ['retro_burn', 'shatter_shot'],

    strategy: 'It wants your back against a wall so the shotgun has nowhere to miss. Fight it in the open middle, and stop leading it — the reverse burn is timed to eat your lead.',
    blurb: 'It keeps order by arriving behind you and closing the distance you left open.',
    intro: 'It swings wide, comes round the back and is at knife range before the manoeuvre reads as one. '
      + 'When you finally lead it properly, it stops dead and lets the shot go past.',
  },

  {
    id: 'choir_twin_lectors',
    name: 'Twin Lectors',
    faction: 'Choir',
    band: 'mid',
    squadron: 2,
    role: 'bruiser',

    art: {
      core: 'trident', nose: 'split_prow', wing: 'blade_pair', pod: 'twin_lasers',
      engine: 'spread_rail', crest: 'banner', pal: 'gold',
    },

    hullMul: 1.10,
    shieldMul: 0.20,
    damageMul: 0.95,
    armour: 0.12,
    speed: 128,
    contact: 13,

    move: 'duel_strafe',
    fire: 'spread5',
    fireRate: 0.7,
    bulletSpeed: 300,

    abilities: ['flak_curtain'],

    strategy: 'The gap between the two hulls looks like the safe lane and is the killing ground. Take the fight to the top or bottom of the field and make them read one at a time.',
    blurb: 'Two of them, reading antiphonally, and the space between them is not a gap.',
    intro: 'They cross the lane in opposite directions and fill the middle with flak on the pass. '
      + 'Splitting them is the whole job; while they are paired every route through is one they have already lined.',
  },

  {
    id: 'choir_reredos',
    name: 'The Reredos',
    faction: 'Choir',
    band: 'mid',
    squadron: 4,
    role: 'glass',

    art: {
      core: 'lattice', nose: 'blunt', wing: 'sail', pod: 'spinal_gun',
      engine: 'none', crest: 'antenna', pal: 'void',
    },

    hullMul: 0.90,
    shieldMul: 0.08,
    damageMul: 1.10,
    armour: 0.02,
    speed: 96,
    contact: 8,

    move: 'duel_escort',
    fire: 'needle_burst',
    fireRate: 0.5,
    bulletSpeed: 348,

    abilities: ['railshot'],

    strategy: 'Four rails, one per lane, and they all telegraph together. Move on the tell and cross between the lines rather than along them; each panel dies to a single sustained burst.',
    blurb: 'A screen of four thin frames, each holding one lane of the field open for a rail.',
    intro: 'They line up flat across the far side like panels of an altarpiece. Each one owns a horizontal strip '
      + 'and none of them will fire into another\'s, which is the only mercy in the arrangement.',
  },

  // ---------------------------------------------------------------------------
  // HIGH BAND — full ceremonies. Each of these is two or three moves long, and
  // the answer is always to break the first move rather than survive the last.
  // ---------------------------------------------------------------------------
  {
    id: 'choir_high_cantor',
    name: 'High Cantor',
    faction: 'Choir',
    band: 'high',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'cathedral', nose: 'maw', wing: 'gull', pod: 'claw_arms',
      engine: 'hex_cluster', crest: 'horns', pal: 'crimson',
    },

    hullMul: 1.25,
    shieldMul: 0.32,
    damageMul: 1.20,
    armour: 0.18,
    speed: 112,
    contact: 15,

    move: 'duel_boxer',
    fire: 'bracket_beams',
    fireRate: 0.5,
    bulletSpeed: 292,

    abilities: ['gravity_snare', 'nova_pulse', 'emp_pulse'],

    strategy: 'Snare, silence, detonation — it never skips a step and never reorders them. Be at maximum range when the snare goes out; if it lands, spend everything you have on getting outward, not on shooting.',
    blurb: 'Three verses. It drags you in for the first, holds you for the second and finishes the third alone.',
    intro: 'It advances and withdraws on a count you can hear. The pull comes first and is the only part of the sequence '
      + 'you get a vote on.',
  },

  {
    id: 'choir_mirror_chancel',
    name: 'Mirror Chancel',
    faction: 'Choir',
    band: 'high',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'ring', nose: 'cowl', wing: 'sail', pod: 'shield_emitter',
      engine: 'vent_bank', crest: 'halo', pal: 'pearl',
    },

    hullMul: 1.45,
    shieldMul: 0.44,
    damageMul: 0.95,
    armour: 0.28,
    speed: 84,
    contact: 17,

    move: 'duel_stalk',
    fire: 'cross_beams',
    fireRate: 0.36,
    bulletSpeed: 250,

    abilities: ['reflect_field', 'repair_weave', 'hardlight_shield'],

    strategy: 'It has almost no offence of its own — nearly everything that kills you here is yours coming back. When the halo whitens, stop firing entirely and use the window to reposition off the cross.',
    blurb: 'A polished chancel that has never fired an unprovoked shot in its life.',
    intro: 'It closes at walking pace and asks nothing of you but patience. Every fight it wins is won with the ammunition '
      + 'you spent on it, so the discipline it demands is not aiming — it is holding fire.',
  },

  {
    id: 'choir_iron_confessor',
    name: 'Iron Confessor',
    faction: 'Choir',
    band: 'high',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'husk', nose: 'ram_plate', wing: 'stub', pod: 'claw_arms',
      engine: 'quad_block', crest: 'none', pal: 'crimson',
    },

    hullMul: 1.15,
    shieldMul: 0.10,
    damageMul: 1.35,
    armour: 0.14,
    speed: 154,
    contact: 20,

    move: 'duel_lunge',
    fire: 'burst5',
    fireRate: 0.85,
    bulletSpeed: 318,

    abilities: ['ram_charge', 'frenzy'],

    strategy: 'Below half hull it stops observing the forms and simply comes at you, faster each time. Do not pace this fight — take it down through the last third in one committed push, with the middle of the field clear behind you.',
    blurb: 'It kept the liturgy for as long as the liturgy was working.',
    intro: 'It holds station, lunges, backs off, holds again — an orderly ship in an orderly fight. '
      + 'Then the hull opens up, the ceremony stops, and there is nothing left in it but the charge.',
  },

  {
    id: 'choir_apse_wardens',
    name: 'Apse Wardens',
    faction: 'Choir',
    band: 'high',
    squadron: 3,
    role: 'bruiser',

    art: {
      core: 'trident', nose: 'lance_tip', wing: 'canard', pod: 'missile_rack',
      engine: 'twin_cone', crest: 'blade_crest', pal: 'abyss',
    },

    hullMul: 1.05,
    shieldMul: 0.22,
    damageMul: 1.0,
    armour: 0.10,
    speed: 134,
    contact: 12,

    move: 'duel_flank',
    fire: 'spiral',
    fireRate: 0.62,
    bulletSpeed: 286,

    abilities: ['overload_burst'],

    strategy: 'Each one detonates where it dies, so kill them where you are not. Pull the wounded one away from its partners and off your own position before you finish it — three deaths in one corner is three overlapping bursts.',
    blurb: 'Three wardens of the same recess, each carrying the same last rite.',
    intro: 'They come round from behind in turn, spiralling shot into the space you vacate. '
      + 'Killing one is easy and, done carelessly, is how the other two get you.',
  },

  {
    id: 'choir_void_cathedral',
    name: 'Void Cathedral',
    faction: 'Choir',
    band: 'high',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'cathedral', nose: 'maw', wing: 'sail', pod: 'launch_bay',
      engine: 'hex_cluster', crest: 'vent_stack', pal: 'void',
    },

    hullMul: 1.30,
    shieldMul: 0.30,
    damageMul: 1.25,
    armour: 0.20,
    speed: 92,
    contact: 14,

    move: 'duel_drift_wide',
    fire: 'lance_beam',
    fireRate: 0.38,
    bulletSpeed: 256,

    abilities: ['singularity', 'mine_lattice', 'venom_cloud'],

    strategy: 'It does not aim at you, it consecrates ground, and the ground it has finished with is the only ground left. Follow it corner to corner one step behind and shoot it from the space it has just abandoned.',
    blurb: 'It sails corner to corner sanctifying the field, and sanctified field is field you cannot stand on.',
    intro: 'The beam is almost an afterthought. What kills you is arithmetic: gas, lattice and a collapsing well, '
      + 'laid down faster than they expire, until the playable half of the map is a diagonal you have to keep walking.',
  },

  // ---------------------------------------------------------------------------
  // ANY BAND — the Choir's standing offices, met at every depth. They scale by
  // threat rather than by gaining new moves, so their puzzle never changes.
  // ---------------------------------------------------------------------------
  {
    id: 'choir_ostiary',
    name: 'The Ostiary',
    faction: 'Choir',
    band: 'any',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'crescent', nose: 'drill', wing: 'swept', pod: 'chin_cannon',
      engine: 'pulse_pods', crest: 'none', pal: 'void',
    },

    hullMul: 0.82,
    shieldMul: 0.16,
    damageMul: 0.95,
    armour: 0.06,
    speed: 178,
    contact: 10,

    move: 'duel_pounce',
    fire: 'burst3',
    fireRate: 0.8,
    bulletSpeed: 340,

    abilities: ['decoy_split', 'cluster_bomb'],

    strategy: 'Only one of the four is carrying, and it is the one that keeps crossing the field — the copies lurk. Watch which body moves after the split and put the bombs behind you before you commit to it.',
    blurb: 'A doorkeeper, and by the time you know which door it is standing at there are four of it.',
    intro: 'It waits at an edge until it has a line, then crosses the whole field in a breath. '
      + 'The copies do not shoot, which is worth remembering, and does not help nearly as much as it should.',
  },

  {
    id: 'choir_ashen_almoner',
    name: 'Ashen Almoner',
    faction: 'Choir',
    band: 'any',
    squadron: 2,
    role: 'support',

    art: {
      core: 'spindle', nose: 'cowl', wing: 'gull', pod: 'launch_bay',
      engine: 'ring_drive', crest: 'lamp', pal: 'gold',
    },

    hullMul: 0.88,
    shieldMul: 0.36,
    damageMul: 0.80,
    armour: 0.08,
    speed: 122,
    contact: 9,

    move: 'duel_circle',
    fire: 'spread3',
    fireRate: 0.75,
    bulletSpeed: 296,

    abilities: ['summon_wing'],

    strategy: 'The two hulls are not the same job. Kill the one that is not shooting at you — it is the one calling the wing, and the other cannot replace it.',
    blurb: 'One of the pair distributes alms. The other distributes ships.',
    intro: 'They orbit you together and only one of them ever fires. The quiet one keeps opening its bay, '
      + 'and every second you spend on the loud one is a second it spends filling the field.',
  },

  {
    id: 'choir_chorus',
    name: 'The Chorus',
    faction: 'Choir',
    band: 'any',
    squadron: 5,
    role: 'glass',

    art: {
      core: 'spindle', nose: 'lance_tip', wing: 'fan', pod: 'none',
      engine: 'single_bell', crest: 'antenna', pal: 'pearl',
    },

    hullMul: 1.0,
    shieldMul: 0.06,
    damageMul: 0.90,
    armour: 0.02,
    speed: 150,
    contact: 7,

    move: 'duel_strafe',
    fire: 'single',
    fireRate: 0.65,
    bulletSpeed: 310,

    abilities: ['beam_sweep'],

    strategy: 'Five beams sweeping in unison leave four gaps, and the gaps are inside the formation, not outside it. Get in among them, stay there, and take them one voice at a time — each hull folds to a single pass.',
    blurb: 'Five thin voices holding one chord. The chord has spaces in it.',
    intro: 'They run the lane abreast and sing together, which means the safest place on the field is the middle of them. '
      + 'Everything about that is wrong and all of it is true.',
  },
];

/**
 * The Choir.
 *
 * A machine cult that holds the void to be an audience rather than an absence.
 * Their hulls are cathedrals, reliquaries and screens — tall, buttressed, hung
 * with banners and lamps — because a rite performed where nobody can see it is
 * not a rite. Half of what these ships carry is not weaponry, and they will not
 * part with any of it.
 *
 * That belief is why they fight in liturgies rather than exchanges. A Choir
 * attack has an order of service: an opening, a held pause, and a conclusion
 * that arrives regardless of what happened during the pause. The pause is not
 * hesitation and it is not a design concession — it is the point. The Choir
 * telegraphs because it is performing, and it does not shorten the performance
 * because you are inconvenienced by it.
 *
 * Mechanically this gives the pack one shared shape: every ship in it is
 * survivable if you answer its FIRST move, and close to unsurvivable if you
 * wait to answer its last. That is deliberate, and it is why the pack leans on
 * beams, zones and consecrated ground instead of on volume of fire. Bullets ask
 * whether you can dodge. The Choir asks where you intend to stand, decides that
 * the answer is unacceptable, and takes the ground away a piece at a time.
 *
 * The low band exists to teach that grammar with one clause per ship. The mid
 * band layers two. The high band runs the full three-move ceremony and expects
 * you to already know that the counter lives in the first bar of it.
 */
