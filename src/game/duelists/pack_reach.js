/**
 * The Reach — human privateers, breakers and salvage crews working the far edge.
 *
 * Nothing in this pack was built as a warship. A Reach hull is a hopper barge,
 * a hospital tender, a dredger or an ore lighter that somebody cut a gun port
 * into, and every one of them still handles like the thing it used to be. That
 * is the design constraint the whole faction is written against: a Reach ship
 * commits. It cannot pivot out of a mistake, so its threat has to be announced
 * by where it is going rather than by what it is about to fire.
 *
 * Two faction-wide numbers follow from that and are deliberate:
 *
 * `shieldMul` stays at or under 0.30 everywhere. Shield generators are the one
 * component you cannot cut off a wreck and weld back on, so the Reach buys its
 * survivability in `armour` instead. The practical effect is that these fights
 * reward sustained fire over burst — there is no shield gate to break through,
 * only a flat tax on every hit — which makes them read differently from any
 * faction that solves toughness with shields.
 *
 * Contact damage runs high for the tonnage. Half of these crews board for a
 * living, and a hull that has spent ten years shoving ore lighters around does
 * not consider ramming an accident.
 */
export const PACK_REACH = [
  // ---------------------------------------------------------------------------
  // LOW BAND — the opening rings. One idea each, telegraphed a long way out.
  // ---------------------------------------------------------------------------
  {
    id: 'gallows_bell',
    name: 'Gallows Bell',
    faction: 'Reach',
    band: 'low',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'barge', nose: 'ram_plate', wing: 'stub', pod: 'side_barbettes',
      engine: 'vent_bank', crest: 'banner', pal: 'rust',
    },

    hullMul: 1.30,
    shieldMul: 0.05,
    damageMul: 0.85,
    armour: 0.22,
    // Slower than the player by a wide margin on purpose: the pressure has to
    // come from the shrinking field, not from the ship catching anyone.
    speed: 78,
    contact: 18,

    move: 'duel_pressure',
    fire: 'closing_wall',
    fireRate: 0.45,
    bulletSpeed: 250,

    abilities: ['barrier_wall', 'flak_curtain'],

    strategy: 'It never backs up, so the lane only ever gets shorter. Take the top or bottom edge before the first barrier goes up — the middle is the part it is buying.',
    blurb: 'A hopper barge with the hopper cut away and the guns welded into the hole.',
    intro: 'It comes forward at walking pace and does not stop for anything you do. '
      + 'Every wall it throws takes a little more of the field, and the walls close from the outside in. '
      + 'You will run out of room before it runs out of hull.',
  },

  {
    id: 'tallow_run',
    name: 'Tallow Run',
    faction: 'Reach',
    band: 'low',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'dagger', nose: 'spike', wing: 'swept', pod: 'chin_cannon',
      engine: 'twin_cone', crest: 'none', pal: 'ember',
    },

    hullMul: 0.80,
    shieldMul: 0,
    damageMul: 0.95,
    armour: 0.04,
    speed: 168,
    contact: 11,

    move: 'duel_strafe',
    fire: 'shotgun',
    fireRate: 0.70,
    bulletSpeed: 330,

    abilities: ['retro_burn', 'burn_trail'],

    strategy: 'Never follow it. The lane it has just crossed keeps burning, so move against the pass rather than after it.',
    blurb: 'A rendering tender that runs lamp oil, and leaks the whole way.',
    intro: 'It crosses your lane at knife range and leaves the crossing alight behind it. '
      + 'The shotgun is the part you can see coming. The trail is what you fly into afterwards.',
  },

  {
    id: 'kettle_bottom',
    name: 'Kettle Bottom',
    faction: 'Reach',
    band: 'low',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'beetle', nose: 'blunt', wing: 'none', pod: 'spinal_gun',
      engine: 'single_bell', crest: 'dish', pal: 'bone',
    },

    hullMul: 0.95,
    shieldMul: 0,
    damageMul: 1.15,
    armour: 0.10,
    speed: 74,
    contact: 10,

    move: 'duel_anchor',
    fire: 'heavy',
    fireRate: 0.40,
    bulletSpeed: 245,

    abilities: ['target_lock', 'cluster_bomb'],

    strategy: 'It cannot chase, so distance is free. Once the lock lands, keep drifting sideways — the cluster opens over where you were standing when it fired.',
    blurb: 'A dredger with a mining charge launcher where the crane used to sit.',
    intro: 'It picks a spot, settles into it, and starts working out where you will be. '
      + 'The shells are slow enough to walk around. The problem is that it is not aiming at you.',
  },

  {
    id: 'brine_ferry',
    name: 'Brine Ferry',
    faction: 'Reach',
    band: 'low',
    squadron: 1,
    role: 'support',

    art: {
      core: 'husk', nose: 'cowl', wing: 'folded', pod: 'launch_bay',
      engine: 'stacked_trio', crest: 'antenna', pal: 'bone',
    },

    hullMul: 0.90,
    shieldMul: 0.20,
    damageMul: 0.75,
    armour: 0.06,
    speed: 132,
    contact: 8,

    move: 'duel_keepaway',
    fire: 'mine_drop',
    fireRate: 0.50,
    bulletSpeed: 260,

    abilities: ['repair_weave', 'drone_bay', 'shield_recharge'],

    strategy: 'It out-heals anything you do at range, so patience is the losing move. Push it into the right edge, eat the mines on the way, and spend everything you have in one window.',
    blurb: 'A hospital boat with the crosses painted over and the beds taken out.',
    intro: 'It runs from you and mends itself while it runs, and it is faster than it looks. '
      + 'The mines it drops are not there to kill you. They are there to make the chase cost something.',
  },

  {
    id: 'scupper_brothers',
    name: 'Scupper Brothers',
    faction: 'Reach',
    band: 'low',
    squadron: 2,
    role: 'bruiser',

    art: {
      core: 'wedge', nose: 'forked', wing: 'blade_pair', pod: 'claw_arms',
      engine: 'pulse_pods', crest: 'horns', pal: 'crimson',
    },

    hullMul: 1.00,
    shieldMul: 0,
    damageMul: 0.95,
    armour: 0.10,
    speed: 150,
    contact: 16,

    move: 'duel_flank',
    fire: 'parting_shot',
    fireRate: 0.55,
    bulletSpeed: 320,

    abilities: ['ram_charge', 'retro_burn'],

    strategy: 'They swing behind you and fire on the way out, so flying a straight line is what kills you. Turn into the charge instead of away from it and both of them overshoot.',
    blurb: 'Two salvage tugs and a family arrangement about who gets the hull.',
    intro: 'They do not come at you from the front, because nothing they own would survive that. '
      + 'They go past, and around, and the shooting happens behind your shoulder.',
  },

  {
    id: 'offcut_three',
    name: 'The Offcut Three',
    faction: 'Reach',
    band: 'low',
    squadron: 3,
    role: 'glass',

    art: {
      core: 'lattice', nose: 'split_prow', wing: 'spar_frame', pod: 'none',
      engine: 'twin_cone', crest: 'none', pal: 'rust',
    },

    hullMul: 0.70,
    shieldMul: 0,
    damageMul: 0.85,
    armour: 0.02,
    speed: 160,
    contact: 9,

    move: 'duel_escort',
    fire: 'single',
    fireRate: 0.90,
    bulletSpeed: 300,

    abilities: ['frenzy'],

    strategy: 'Each one you kill makes the survivors faster. Wear all three down together and finish them inside a few seconds of each other, or the last one is quicker than you are.',
    blurb: 'Three hulls cut from the same wreck, flying like they are still bolted together.',
    intro: 'Open framework, no plating, nothing to shoot at but the struts. '
      + 'They hold their spacing exactly, which tells you the crews have done this before.',
  },

  // ---------------------------------------------------------------------------
  // MID BAND — the ship starts asking a question you have to answer with
  // position rather than with damage.
  // ---------------------------------------------------------------------------
  {
    id: 'marrow_lathe',
    name: 'Marrow Lathe',
    faction: 'Reach',
    band: 'mid',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'hammerhead', nose: 'drill', wing: 'gull', pod: 'gatling_ring',
      engine: 'quad_block', crest: 'vent_stack', pal: 'obsidian',
    },

    hullMul: 1.10,
    shieldMul: 0.10,
    damageMul: 1.05,
    armour: 0.14,
    speed: 110,
    contact: 14,

    move: 'duel_boxer',
    fire: 'spread5',
    fireRate: 0.80,
    bulletSpeed: 300,

    abilities: ['shatter_shot', 'overload_burst', 'emp_pulse'],

    strategy: 'Do not follow it back out. It only discharges on the withdrawal, and the burst is centred on the space it just left.',
    blurb: 'A hull cutter that decided the work went faster if the ship came to it.',
    intro: 'In, out, in — an old rhythm, and it will not change it for you. '
      + 'The half of that rhythm you want to punish is the half that hurts.',
  },

  {
    id: 'bailiff_shell',
    name: "Bailiff's Shell",
    faction: 'Reach',
    band: 'mid',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'barge', nose: 'cowl', wing: 'sail', pod: 'spinal_gun',
      engine: 'hex_cluster', crest: 'dish', pal: 'gold',
    },

    hullMul: 1.05,
    shieldMul: 0.08,
    damageMul: 1.30,
    armour: 0.16,
    speed: 72,
    contact: 10,

    move: 'duel_wall',
    fire: 'siege_beam',
    fireRate: 0.36,
    bulletSpeed: 240,

    abilities: ['siege_mode', 'mine_lattice', 'beam_sweep'],

    strategy: 'It is pinned to the right edge and roots itself to cut, so it can only be answered from above or below the beam. The lattice exists to stop you crossing the middle — go round the outside of it.',
    blurb: 'A repossession barge. It does not chase debtors; it waits at the only way out.',
    intro: 'It runs the right-hand wall like a man pacing a corridor, and when it stops it stops hard. '
      + 'The beam takes a second and a half to arrive. The mines are there so that the second and a half is not enough.',
  },

  {
    id: 'hackle_jack',
    name: 'Hackle Jack',
    faction: 'Reach',
    band: 'mid',
    squadron: 1,
    role: 'skirmisher',

    art: {
      core: 'dagger', nose: 'lance_tip', wing: 'blade_pair', pod: 'twin_lasers',
      engine: 'pulse_pods', crest: 'spine_fin', pal: 'ember',
    },

    hullMul: 0.75,
    shieldMul: 0.12,
    damageMul: 1.00,
    armour: 0.02,
    speed: 182,
    contact: 10,

    move: 'duel_erratic',
    fire: 'needle_burst',
    fireRate: 0.95,
    bulletSpeed: 345,

    abilities: ['blink_strike', 'decoy_split', 'phase_out'],

    strategy: 'Punishes shooting at whatever is nearest. The copies never fire — wait for a volley and put everything into the hull that produced it.',
    blurb: 'A courier that learned it is cheaper to be four ships than to be armoured.',
    intro: 'It moves in short bursts with no pattern you can lead, and then there are three more of it. '
      + 'Every shot you spend on the wrong one is a second it spends behind you.',
  },

  {
    id: 'widow_scale',
    name: "Widow's Scale",
    faction: 'Reach',
    band: 'mid',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'beetle', nose: 'sensor_dome', wing: 'folded', pod: 'shield_emitter',
      engine: 'ring_drive', crest: 'halo', pal: 'obsidian',
    },

    hullMul: 1.35,
    // The one hull in the pack carrying a real generator, and it was stolen.
    shieldMul: 0.30,
    damageMul: 0.80,
    armour: 0.24,
    speed: 82,
    contact: 17,

    move: 'duel_stalk',
    fire: 'repulsor_field',
    fireRate: 0.45,
    bulletSpeed: 250,

    abilities: ['reflect_field', 'hardlight_shield'],

    strategy: 'Stop firing when the plate lights. Everything you send during the reflect comes back down your own line, and by then it has closed enough for that to matter.',
    blurb: 'Salvaged plate over a salvaged generator, and it gives back what it is given.',
    intro: 'It closes on you slowly and it does not flinch, because flinching is not what it is for. '
      + 'The fight is about the seconds you choose not to shoot.',
  },

  {
    id: 'dogtooth_pair',
    name: 'Dogtooth Pair',
    faction: 'Reach',
    band: 'mid',
    squadron: 2,
    role: 'skirmisher',

    art: {
      core: 'dagger', nose: 'spike', wing: 'scythe', pod: 'twin_lasers',
      engine: 'spread_rail', crest: 'blade_crest', pal: 'crimson',
    },

    hullMul: 0.95,
    shieldMul: 0.05,
    damageMul: 0.95,
    armour: 0.05,
    speed: 176,
    contact: 10,

    move: 'duel_circle',
    fire: 'burst3',
    fireRate: 1.20,
    bulletSpeed: 355,

    abilities: ['chain_lightning', 'blink_strike'],

    strategy: 'Never sit on the line between them. They orbit opposite each other, so the safe ground is outside the ring entirely, or hard up against one of them.',
    blurb: 'Two boats and one cable rig between them, which is all they have ever needed.',
    intro: 'They take opposite sides of you and start turning, and the space between them stops being space. '
      + 'Killing one is easy. Getting to one is the fight.',
  },

  {
    id: 'quarry_needles',
    name: 'The Quarry Needles',
    faction: 'Reach',
    band: 'mid',
    squadron: 4,
    role: 'glass',

    art: {
      core: 'lattice', nose: 'lance_tip', wing: 'spar_frame', pod: 'spinal_gun',
      engine: 'spread_rail', crest: 'antenna', pal: 'bone',
    },

    hullMul: 0.80,
    shieldMul: 0,
    damageMul: 1.10,
    armour: 0,
    speed: 190,
    contact: 8,

    move: 'duel_pounce',
    fire: 'needle',
    fireRate: 0.65,
    bulletSpeed: 360,

    abilities: ['railshot'],

    strategy: 'Watch the corners, not the middle. Each one fires along the line it is already parked on, so the lane is drawn for you before the shot — stand off that line and they have to reposition, which is when they die.',
    blurb: 'Four rail frames with a crew cabin bolted to each, and no plating anywhere.',
    intro: 'They lurk on the edges of the field where you are not looking, and then one of them crosses it in a second and a half. '
      + 'There is nothing to any of them but the gun and the girder holding it.',
  },

  // ---------------------------------------------------------------------------
  // HIGH BAND — assumes a levelled ship, so each of these stacks a second
  // problem on top of the first.
  // ---------------------------------------------------------------------------
  {
    id: 'slagport_dray',
    name: 'Slagport Dray',
    faction: 'Reach',
    band: 'high',
    squadron: 1,
    role: 'tank',

    art: {
      core: 'barge', nose: 'ram_plate', wing: 'long_straight', pod: 'missile_rack',
      engine: 'quad_block', crest: 'vent_stack', pal: 'rust',
    },

    hullMul: 1.45,
    shieldMul: 0.12,
    damageMul: 0.90,
    armour: 0.28,
    speed: 88,
    contact: 20,

    move: 'duel_drift_wide',
    fire: 'double_wall',
    fireRate: 0.38,
    bulletSpeed: 245,

    abilities: ['singularity', 'venom_cloud'],

    strategy: 'The gap in the wall moves because the ship does. Track the hull rather than the gap, and never dodge toward the snare — it will finish the dodge for you.',
    blurb: 'An ore dray that still sweeps its old route, and fires along it.',
    intro: 'It crosses the whole field corner to corner, dragging its firing line behind it. '
      + 'The safe lane is never where it was a moment ago, and the pull makes sure your correction is late.',
  },

  {
    id: 'ransom_note',
    name: 'Ransom Note',
    faction: 'Reach',
    band: 'high',
    squadron: 1,
    role: 'artillery',

    art: {
      core: 'husk', nose: 'sensor_dome', wing: 'canard', pod: 'spinal_gun',
      engine: 'single_bell', crest: 'antenna', pal: 'obsidian',
    },

    hullMul: 1.00,
    shieldMul: 0.18,
    damageMul: 1.45,
    armour: 0.10,
    speed: 96,
    contact: 9,

    move: 'duel_mirror',
    fire: 'orb',
    fireRate: 0.35,
    bulletSpeed: 255,

    abilities: ['target_lock', 'gravity_snare', 'mega_laser'],

    strategy: 'It copies your height exactly, so climbing achieves nothing. Break the mirror with a hard reversal during the lock — the lance fires at where the snare expects to leave you.',
    blurb: 'A wrecking hull that tells you what it is going to do, then does it.',
    intro: 'It parks at the far wall and matches your height, and it will keep matching it all day. '
      + 'Lock, then hold, then the lance. Three announcements, in order, every time.',
  },

  {
    id: 'jetty_saint',
    name: 'Jetty Saint',
    faction: 'Reach',
    band: 'high',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'wedge', nose: 'maw', wing: 'delta', pod: 'claw_arms',
      engine: 'quad_block', crest: 'horns', pal: 'crimson',
    },

    hullMul: 1.20,
    shieldMul: 0.10,
    damageMul: 1.20,
    armour: 0.18,
    speed: 140,
    contact: 19,

    move: 'duel_lunge',
    fire: 'cross',
    fireRate: 0.60,
    bulletSpeed: 330,

    abilities: ['ram_charge', 'nova_pulse'],

    strategy: 'The nova is centred on the ship, so retreating is slower than crossing. Go through its shoulder as it arrives and it discharges behind you.',
    blurb: 'A boarding tug from a port that no longer exists, still doing the only job it knows.',
    intro: 'It sits still long enough that you forget about it, and then it is on top of you. '
      + 'Backing away from the arrival is the instinct, and it is the wrong one.',
  },

  {
    id: 'verge_watch',
    name: 'The Verge Watch',
    faction: 'Reach',
    band: 'high',
    squadron: 5,
    role: 'glass',

    art: {
      core: 'lattice', nose: 'forked', wing: 'fan', pod: 'none',
      engine: 'pulse_pods', crest: 'none', pal: 'bone',
    },

    hullMul: 0.85,
    shieldMul: 0.10,
    damageMul: 0.90,
    armour: 0,
    speed: 172,
    contact: 7,

    move: 'duel_strafe',
    fire: 'spread3',
    fireRate: 0.75,
    bulletSpeed: 320,

    abilities: ['phase_out'],

    strategy: 'They take turns being untouchable, so a steady drizzle of damage is thrown away. Hold your fire until one is solid and kill that one outright before it comes round again.',
    blurb: 'Five hulls, one flight plan, and a phase rig they have never fully understood.',
    intro: 'Five thin frames run your lane in a rota, and one of them is always ghosting. '
      + 'You cannot spread damage across them. You have to spend it all on whichever one is real.',
  },

  {
    id: 'pauper_crown',
    name: "Pauper's Crown",
    faction: 'Reach',
    band: 'high',
    squadron: 2,
    role: 'support',

    art: {
      core: 'barge', nose: 'cowl', wing: 'twin_boom', pod: 'launch_bay',
      engine: 'stacked_trio', crest: 'banner', pal: 'gold',
    },

    hullMul: 1.05,
    shieldMul: 0.25,
    damageMul: 0.85,
    armour: 0.12,
    speed: 104,
    contact: 9,

    move: 'duel_escort',
    fire: 'homing2',
    fireRate: 0.42,
    bulletSpeed: 250,

    abilities: ['summon_wing', 'shield_recharge'],

    strategy: 'The wings are a finite resource and the pair knows it. Ignore the escorts, survive until the charges are spent, and what is left is two slow freighters with a missile rack.',
    blurb: 'Two flagships of a fleet that was scrapped for the metal thirty years ago.',
    intro: 'They fly abreast with banners still up, throwing out wings they cannot really afford. '
      + 'Fight the output and you will be here all day. Wait it out and they run dry.',
  },

  // ---------------------------------------------------------------------------
  // ANY BAND — one clean idea apiece, so they read the same at threat 2 and 18.
  // ---------------------------------------------------------------------------
  {
    id: 'tinder_lass',
    name: 'Tinder Lass',
    faction: 'Reach',
    band: 'any',
    squadron: 1,
    role: 'glass',

    art: {
      core: 'husk', nose: 'spike', wing: 'swept', pod: 'drum_magazine',
      engine: 'twin_cone', crest: 'lamp', pal: 'ember',
    },

    hullMul: 0.68,
    shieldMul: 0,
    damageMul: 1.25,
    armour: 0,
    speed: 178,
    contact: 8,

    move: 'duel_bob',
    fire: 'burn_zone',
    fireRate: 0.55,
    bulletSpeed: 300,

    abilities: ['split_form', 'burn_trail'],

    strategy: 'Kill it in one pass or fight two of it. It comes apart below half hull and both halves keep the burners, so a slow grind doubles the fire on the field.',
    blurb: 'Barely a ship. Mostly a drum of accelerant with a seat in front of it.',
    intro: 'It traces the same lazy figure across the right of the field and drops fire wherever you have been standing. '
      + 'Everything about it is thin, which is the trap: hurt it slowly and there are two.',
  },

  {
    id: 'roost_iron',
    name: 'Roost Iron',
    faction: 'Reach',
    band: 'any',
    squadron: 1,
    role: 'bruiser',

    art: {
      core: 'beetle', nose: 'drill', wing: 'stub', pod: 'dorsal_turret',
      engine: 'ring_drive', crest: 'antenna', pal: 'rust',
    },

    hullMul: 1.15,
    shieldMul: 0.15,
    damageMul: 1.00,
    armour: 0.15,
    speed: 126,
    contact: 13,

    move: 'duel_circle',
    fire: 'sweep',
    fireRate: 1.00,
    bulletSpeed: 300,

    abilities: ['homing_swarm', 'emp_pulse'],

    strategy: 'It takes the energy you were saving for the emergency, so spend it early rather than banking it. Turn inside the orbit — the turret traverse cannot follow a tighter circle than its own.',
    blurb: 'A breaker yard tender with a stolen turret ring and no interest in stopping.',
    intro: 'It circles at a fixed distance and grinds its turret round after you, and it is patient about it. '
      + 'The pulse is timed for the moment you were going to use the dash.',
  },

  {
    id: 'cinder_wake',
    name: 'Cinder Wake',
    faction: 'Reach',
    band: 'any',
    squadron: 3,
    role: 'support',

    art: {
      core: 'hammerhead', nose: 'blunt', wing: 'gull', pod: 'missile_rack',
      engine: 'vent_bank', crest: 'lamp', pal: 'ember',
    },

    hullMul: 0.95,
    shieldMul: 0.15,
    damageMul: 0.80,
    armour: 0.08,
    speed: 118,
    contact: 8,

    move: 'duel_flank',
    fire: 'spreading_pool',
    fireRate: 0.50,
    bulletSpeed: 265,

    abilities: ['repair_weave'],

    strategy: 'They patch each other, so killing them one at a time undoes itself. Break the trailing hull first — it is the only one with a line to both of the others.',
    blurb: 'A three-boat salvage crew. Whatever one of them loses, the other two put back.',
    intro: 'They come round your flank in file, laying gas across the ground you would have retreated onto. '
      + 'Damage done to the front of the line is paid for out of the back of it.',
  },
];
