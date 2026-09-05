/**
 * Concord duelists — twenty ships, authored against docs/duelist-spec.md.
 * The faction note is at the foot of the file, next to the last ship it explains.
 */
export const PACK_CONCORD = [
  // ---------------------------------------------------------------------------
  // LOW BAND — the Concord's standing patrol work. One idea per hull, stated
  // plainly, because these are the ships that teach the vocabulary the deep
  // hulls will later stack two at a time.
  // ---------------------------------------------------------------------------
  {
    id: 'concord_vigilant',
    name: 'Vigilant',
    faction: 'Concord',
    band: 'low',
    squadron: 1,
    role: 'skirmisher',

    art: { core: 'wedge', nose: 'sensor_dome', wing: 'swept', pod: 'chin_cannon',
           engine: 'twin_cone', crest: 'antenna', pal: 'ion' },

    hullMul: 0.92,
    shieldMul: 0.3,
    damageMul: 0.95,
    armour: 0.1,
    // Fast enough to set the range, not fast enough to escape a committed
    // player: the boxer rhythm should read as a choice, not as a chase.
    speed: 148,
    contact: 10,

    move: 'duel_boxer',
    fire: 'burst3',
    fireRate: 1.0,
    bulletSpeed: 330,

    abilities: ['target_lock', 'retro_burn'],

    strategy: 'It only shoots on the way in. Do not chase the retreat — hold your ground, punish the approach, and the lock never has time to matter.',
    blurb: 'A picket cutter working a rhythm it has flown a thousand times.',
    intro: 'It comes in, fires, and is already reversing before its own bolts arrive. '
      + 'Nothing about the pattern changes for you. You are expected to learn it and be somewhere else.',
  },

  {
    id: 'concord_redoubt',
    name: 'Redoubt',
    faction: 'Concord',
    band: 'low',
    squadron: 1,
    role: 'tank',

    art: { core: 'obelisk', nose: 'blunt', wing: 'stub', pod: 'shield_emitter',
           engine: 'vent_bank', crest: 'banner', pal: 'frost' },

    hullMul: 1.3,
    shieldMul: 0.35,
    damageMul: 0.85,
    armour: 0.24,
    speed: 78,
    contact: 16,

    move: 'duel_wall',
    fire: 'wall',
    // Slow volleys because the answer is a route, not a reflex: the player needs
    // long enough to see the gap and commit to reaching it.
    fireRate: 0.5,
    bulletSpeed: 260,

    abilities: ['hardlight_shield', 'flak_curtain'],

    strategy: 'The shield and the point defence both face down the lane. Come at it from above or below the line it is holding and none of that hardware bears on you.',
    blurb: 'A blockade hull that slides up and down the lane and does not otherwise move.',
    intro: 'It holds the right edge like a door. Everything it carries points at the corridor '
      + 'between you and it, and the gap in its volley is never where you are standing.',
  },

  {
    id: 'concord_lantern',
    name: 'Lantern Flight',
    faction: 'Concord',
    band: 'low',
    squadron: 3,
    role: 'support',

    art: { core: 'wedge', nose: 'cowl', wing: 'canard', pod: 'shield_emitter',
           engine: 'pulse_pods', crest: 'lamp', pal: 'pearl' },

    hullMul: 0.95,
    // Most of a small budget delivered as shield, because shield is the thing
    // they give each other back. Hull damage on one of them has to stick.
    shieldMul: 0.45,
    damageMul: 0.75,
    armour: 0.08,
    speed: 118,
    contact: 8,

    move: 'duel_escort',
    fire: 'sweep',
    fireRate: 0.8,
    bulletSpeed: 290,

    abilities: ['shield_recharge'],

    strategy: 'They put each other back up. Take one apart in a single pass; damage spread across all three is damage you will simply do again.',
    blurb: 'Three shield tenders flying a triangle, each keeping the other two on their feet.',
    intro: 'None of the three is dangerous. Between them they can undo a minute of your work '
      + 'in nine seconds, and they will keep doing it for as long as there are three.',
  },

  {
    id: 'concord_bailiff',
    name: 'Bailiff',
    faction: 'Concord',
    band: 'low',
    squadron: 1,
    role: 'glass',

    art: { core: 'dagger', nose: 'lance_tip', wing: 'blade_pair', pod: 'twin_lasers',
           engine: 'pulse_pods', crest: 'none', pal: 'ion' },

    // Almost no hull and no armour at all: every mistake it makes should be
    // fatal, which is what buys it the right to move this fast.
    hullMul: 0.7,
    shieldMul: 0.1,
    damageMul: 1.15,
    armour: 0.02,
    speed: 182,
    contact: 9,

    move: 'duel_pounce',
    fire: 'needle_burst',
    fireRate: 1.2,
    bulletSpeed: 350,

    abilities: ['blink_strike'],

    strategy: 'It commits to one crossing at a time and cannot turn during it. Move across its line rather than along it and the whole pass lands on empty space.',
    blurb: 'A courier hull with the mail bays stripped out and guns fitted in them.',
    intro: 'It waits at the edge with its drives cold, then crosses the field in a straight line '
      + 'at a speed you cannot match. There is nothing to it. It only needs to be right once.',
  },

  {
    id: 'concord_ledger',
    name: 'Ledger',
    faction: 'Concord',
    band: 'low',
    squadron: 1,
    role: 'artillery',

    art: { core: 'dagger', nose: 'spike', wing: 'long_straight', pod: 'spinal_gun',
           engine: 'spread_rail', crest: 'dish', pal: 'frost' },

    hullMul: 0.95,
    shieldMul: 0.2,
    damageMul: 1.1,
    armour: 0.08,
    speed: 92,
    contact: 9,

    move: 'duel_mirror',
    fire: 'needle',
    // Half the fire rate of a picket, at twice the muzzle velocity. The threat
    // is the line it draws, not the volume it puts down it.
    fireRate: 0.55,
    bulletSpeed: 340,

    abilities: ['railshot', 'barrier_wall'],

    strategy: 'It copies your height, so height is the one thing you must never settle on. Keep climbing or diving and the rail always arrives where you were.',
    blurb: 'A ranging ship that has been measuring you since before you saw it.',
    intro: 'It sits at the far edge and matches your altitude exactly. The needles are ranging shots. '
      + 'What follows them goes down the same line, faster, and it does not miss twice.',
  },

  {
    id: 'concord_cairn',
    name: 'Cairn Pair',
    faction: 'Concord',
    band: 'low',
    squadron: 2,
    role: 'artillery',

    art: { core: 'mantaform', nose: 'blunt', wing: 'delta', pod: 'missile_rack',
           engine: 'twin_cone', crest: 'none', pal: 'pearl' },

    hullMul: 1.0,
    shieldMul: 0.25,
    damageMul: 0.9,
    armour: 0.1,
    speed: 106,
    contact: 10,

    move: 'duel_strafe',
    fire: 'mine_drop',
    fireRate: 0.45,
    bulletSpeed: 250,

    abilities: ['mine_lattice'],

    strategy: 'They are marking out ground, not shooting at you. Kill them early or accept that half the field will be closed by the time you reach them.',
    blurb: 'Two minelayers running crossing lanes, seeding the space you will need later.',
    intro: 'Neither of them is trying to hit you. They cross, and behind each crossing there is '
      + 'a line of ordnance that was not there before. The room shrinks while you decide.',
  },

  // ---------------------------------------------------------------------------
  // MID BAND — combined arms. Each of these is two problems held together by
  // doctrine: a movement you have to answer and a device that punishes the
  // obvious answer.
  // ---------------------------------------------------------------------------
  {
    id: 'concord_bastion',
    name: 'Bastion',
    faction: 'Concord',
    band: 'mid',
    squadron: 1,
    role: 'tank',

    art: { core: 'barge', nose: 'ram_plate', wing: 'stub', pod: 'side_barbettes',
           engine: 'quad_block', crest: 'banner', pal: 'gold' },

    hullMul: 1.38,
    shieldMul: 0.4,
    damageMul: 0.9,
    // The heaviest armour in the low and mid bands. It trades every scrap of
    // manoeuvre for it: at 82 px/s a player can always be elsewhere.
    armour: 0.26,
    speed: 82,
    contact: 18,

    move: 'duel_pressure',
    fire: 'closing_wall',
    fireRate: 0.42,
    bulletSpeed: 250,

    abilities: ['barrier_wall', 'shield_recharge', 'cluster_bomb'],

    strategy: 'Its volley closes from the top and bottom edges, so the centre is the safe ground — and the centre is where it is walking. Kill it in front of you rather than running to a corner.',
    blurb: 'A line ship that has never been given a reason to reverse.',
    intro: 'It advances at a walking pace and does not stop for anything you do. Its fire takes '
      + 'the edges of the field away first, its barriers take the retreat, and it is still coming.',
  },

  {
    id: 'concord_arbiter',
    name: 'Arbiter',
    faction: 'Concord',
    band: 'mid',
    squadron: 1,
    role: 'artillery',

    art: { core: 'trident', nose: 'lance_tip', wing: 'spar_frame', pod: 'spinal_gun',
           engine: 'spread_rail', crest: 'dish', pal: 'void' },

    hullMul: 1.0,
    shieldMul: 0.3,
    damageMul: 1.2,
    armour: 0.12,
    // Faster than a gun platform ought to be, deliberately: the fight is a
    // chase you cannot win, so the rooted window has to be the only window.
    speed: 128,
    contact: 9,

    move: 'duel_keepaway',
    fire: 'siege_beam',
    fireRate: 0.38,
    bulletSpeed: 260,

    abilities: ['siege_mode', 'beam_sweep'],

    strategy: 'It outruns you until it plants itself to fire. The moment it roots is the only opening it will ever give — spend everything then and nothing before.',
    blurb: 'A siege platform that will not fight you at any range it did not choose.',
    intro: 'It runs the instant you close, and it is quicker than a gun that size has any right to be. '
      + 'Then it stops dead, braces, and cuts a line across the field that takes a second and a half to arrive.',
  },

  {
    id: 'concord_cordon',
    name: 'Cordon Flight',
    faction: 'Concord',
    band: 'mid',
    squadron: 4,
    role: 'skirmisher',

    art: { core: 'wedge', nose: 'forked', wing: 'swept', pod: 'twin_lasers',
           engine: 'twin_cone', crest: 'antenna', pal: 'void' },

    hullMul: 1.05,
    shieldMul: 0.3,
    damageMul: 0.8,
    armour: 0.06,
    speed: 150,
    contact: 9,

    move: 'duel_circle',
    fire: 'forward',
    fireRate: 0.75,
    bulletSpeed: 300,

    abilities: ['gravity_snare'],

    strategy: 'The pull is shared between whatever is still flying. Break the ring on one side, get outside it, and what is left is an ordinary fight.',
    blurb: 'Four escorts orbiting at a set radius, dragging the middle of the ring shut.',
    intro: 'They do not close and they do not open. They turn around you at a fixed distance and '
      + 'pull you toward the centre of their own circle, which is the one place all four guns bear.',
  },

  {
    id: 'concord_harrow',
    name: 'Harrow',
    faction: 'Concord',
    band: 'mid',
    squadron: 1,
    role: 'bruiser',

    art: { core: 'hammerhead', nose: 'ram_plate', wing: 'folded', pod: 'claw_arms',
           engine: 'quad_block', crest: 'horns', pal: 'crimson' },

    hullMul: 1.2,
    shieldMul: 0.25,
    damageMul: 1.15,
    armour: 0.2,
    speed: 132,
    // The heaviest contact damage a mid-band hull carries. Getting rammed
    // should cost about as much as standing in the reflected volley.
    contact: 19,

    move: 'duel_lunge',
    fire: 'shotgun',
    fireRate: 0.6,
    bulletSpeed: 330,

    abilities: ['ram_charge', 'reflect_field'],

    strategy: 'It turns your fire back at you while the ram is winding up. Hold the trigger until the plate is past you, then put everything into the engines on its way out.',
    blurb: 'A boarding cutter with the ram plate still fitted and nothing left to board.',
    intro: 'It holds off, squares up, and comes down the line with its forward field lit. '
      + 'Everything you send into that field comes back at the same speed. The pass is easy to sidestep. The temptation is not.',
  },

  {
    id: 'concord_almoner',
    name: 'Almoner',
    faction: 'Concord',
    band: 'mid',
    squadron: 1,
    role: 'support',

    art: { core: 'barge', nose: 'sensor_dome', wing: 'gull', pod: 'launch_bay',
           engine: 'vent_bank', crest: 'dish', pal: 'pearl' },

    hullMul: 1.1,
    shieldMul: 0.42,
    damageMul: 0.8,
    armour: 0.14,
    speed: 110,
    contact: 10,

    move: 'duel_bob',
    fire: 'homing1',
    fireRate: 0.5,
    bulletSpeed: 270,

    abilities: ['repair_weave', 'drone_bay'],

    strategy: 'It mends itself on a timer and the drones exist to make you late for it. Ignore the escort, sit on the figure-eight, and hit it while the weave is still cooling.',
    blurb: 'A fleet tender flying a lazy figure-eight, patching itself as it goes.',
    intro: 'It traces the same eight over and over, so it can be led. It also puts hull back '
      + 'every time you look away, and the drones are there to make certain you look away.',
  },

  {
    id: 'concord_reprisal',
    name: 'Reprisal',
    faction: 'Concord',
    band: 'mid',
    squadron: 1,
    role: 'glass',

    art: { core: 'dagger', nose: 'spike', wing: 'scythe', pod: 'chin_cannon',
           engine: 'pulse_pods', crest: 'blade_crest', pal: 'void' },

    hullMul: 0.72,
    shieldMul: 0.15,
    damageMul: 1.3,
    armour: 0.04,
    speed: 190,
    contact: 10,

    move: 'duel_flank',
    fire: 'burst5',
    fireRate: 0.9,
    bulletSpeed: 355,

    abilities: ['blink_strike', 'overload_burst'],

    strategy: 'It works from behind you and jumps to get there. Turn into the swing early; the burst only lands on a ship that is still facing the wrong way.',
    blurb: 'A light strike hull whose entire doctrine is arriving where you are not looking.',
    intro: 'It swings wide, above or below, and is behind you before the manoeuvre reads as one. '
      + 'There is almost nothing to it. All of it is spent on being somewhere you have to turn to see.',
  },

  // ---------------------------------------------------------------------------
  // HIGH BAND — the ships of the line. These assume a levelled player and are
  // written so that competence is not enough: each one has an answer, and the
  // answer costs you something you would rather keep.
  // ---------------------------------------------------------------------------
  {
    id: 'concord_praetor',
    name: 'Praetor',
    faction: 'Concord',
    band: 'high',
    squadron: 1,
    role: 'bruiser',

    art: { core: 'mantaform', nose: 'cowl', wing: 'sail', pod: 'twin_lasers',
           engine: 'stacked_trio', crest: 'halo', pal: 'gold' },

    hullMul: 1.25,
    shieldMul: 0.38,
    damageMul: 1.25,
    armour: 0.22,
    speed: 104,
    contact: 16,

    move: 'duel_stalk',
    fire: 'bracket_beams',
    fireRate: 0.45,
    bulletSpeed: 300,

    abilities: ['chain_lightning', 'target_lock', 'hardlight_shield'],

    strategy: 'The two beams land either side of where you were. Move after they commit, not before, and never into the gap between them — the arc is what fills that.',
    blurb: 'A flag hull that closes at a walking pace and never has to hurry.',
    intro: 'It brackets you: one beam high, one low, and a gap between them that looks like the answer. '
      + 'The gap is where the arc goes. The whole sequence is drilled, and it will do it again in nine seconds exactly.',
  },

  {
    id: 'concord_warrant',
    name: 'Warrant Pair',
    faction: 'Concord',
    band: 'high',
    squadron: 2,
    role: 'bruiser',

    art: { core: 'hammerhead', nose: 'blunt', wing: 'delta', pod: 'drum_magazine',
           engine: 'hex_cluster', crest: 'spine_fin', pal: 'crimson' },

    hullMul: 1.2,
    shieldMul: 0.3,
    damageMul: 1.2,
    armour: 0.18,
    speed: 140,
    contact: 18,

    move: 'duel_pounce',
    fire: 'heavy',
    fireRate: 0.5,
    bulletSpeed: 280,

    abilities: ['nova_pulse', 'retro_burn'],

    strategy: 'They cross the middle in turn and detonate when they get there. The edge one of them has just left is the safest ground on the field.',
    blurb: 'Two assault hulls trading passes through the centre of the field.',
    intro: 'They lurk on opposite edges and take it in turns. Whichever one is moving lights off as it '
      + 'passes the middle, then burns back out to the far side. The centre belongs to them, one at a time.',
  },

  {
    id: 'concord_magistrate',
    name: 'Magistrate',
    faction: 'Concord',
    band: 'high',
    squadron: 1,
    role: 'artillery',

    art: { core: 'barge', nose: 'cowl', wing: 'twin_boom', pod: 'missile_rack',
           engine: 'quad_block', crest: 'dish', pal: 'frost' },

    hullMul: 1.15,
    shieldMul: 0.35,
    damageMul: 1.25,
    armour: 0.16,
    // Deliberately the slowest hull in the pack. Everything it owns is a
    // distance weapon, so the fight has to be winnable by closing.
    speed: 74,
    contact: 12,

    move: 'duel_anchor',
    fire: 'missile_barrage',
    fireRate: 0.4,
    bulletSpeed: 250,

    abilities: ['homing_swarm', 'flak_curtain', 'emp_pulse'],

    strategy: 'Everything it carries is built for distance. Get inside the turning circle of the seekers and stay there — up close it is a large slow hull with nothing that bears.',
    blurb: 'A missile platform anchored at the back of the field, doing arithmetic.',
    intro: 'It does not move and it does not need to. The seekers arrive in a stream, its point defence '
      + 'eats anything you fire from range, and the correct answer is the uncomfortable one.',
  },

  {
    id: 'concord_lictor',
    name: 'Lictor Flight',
    faction: 'Concord',
    band: 'high',
    squadron: 4,
    role: 'skirmisher',

    art: { core: 'wedge', nose: 'split_prow', wing: 'delta', pod: 'gatling_ring',
           engine: 'twin_cone', crest: 'spine_fin', pal: 'ion' },

    hullMul: 1.1,
    shieldMul: 0.35,
    damageMul: 0.85,
    armour: 0.1,
    speed: 155,
    contact: 10,

    move: 'duel_escort',
    fire: 'spread3',
    // Four bodies firing a three-shot fan: the rate is low because the volume
    // is already a wall. Any faster and the box has no gaps at all.
    fireRate: 0.6,
    bulletSpeed: 320,

    abilities: ['emp_pulse'],

    strategy: 'They drain in relay, so your reserve never refills. Spend energy the moment you have it instead of saving it for a burst that will not be there.',
    blurb: 'Four fighters in a rigid box, taking your power off you in shifts.',
    intro: 'The formation does not deform, whatever you do to it. One of the four is always draining, '
      + 'and the timing is a rota rather than a reaction. Nothing you bank against them survives.',
  },

  {
    id: 'concord_bannerline',
    name: 'Bannerline',
    faction: 'Concord',
    band: 'high',
    squadron: 5,
    role: 'glass',

    art: { core: 'dagger', nose: 'blunt', wing: 'swept', pod: 'chin_cannon',
           engine: 'single_bell', crest: 'banner', pal: 'gold' },

    // Five bodies out of one budget: individually a single good burst kills
    // one, which is the only reason the shields on the nose are fair.
    hullMul: 0.95,
    shieldMul: 0.3,
    damageMul: 1.0,
    armour: 0.05,
    speed: 175,
    contact: 8,

    move: 'duel_strafe',
    fire: 'parting_shot',
    fireRate: 0.7,
    bulletSpeed: 340,

    abilities: ['hardlight_shield'],

    strategy: 'Their shields face forward, so the inbound leg is wasted effort. Hold fire until they break off and hit them in the turn.',
    blurb: 'Five light hulls making rolling strafing runs, one flight at a time.',
    intro: 'They come across in a wave, fire over their shoulders as they break, and come round again. '
      + 'Head-on they are armoured glass. In the turn they are only glass.',
  },

  // ---------------------------------------------------------------------------
  // ANY BAND — hulls whose puzzle does not depend on the player's gear, so they
  // read the same at threat 2 and threat 19.
  // ---------------------------------------------------------------------------
  {
    id: 'concord_quartermaster',
    name: 'Quartermaster',
    faction: 'Concord',
    band: 'any',
    squadron: 1,
    role: 'support',

    art: { core: 'barge', nose: 'blunt', wing: 'long_straight', pod: 'launch_bay',
           engine: 'vent_bank', crest: 'vent_stack', pal: 'pearl' },

    hullMul: 1.15,
    shieldMul: 0.4,
    damageMul: 0.75,
    armour: 0.14,
    speed: 120,
    contact: 11,

    move: 'duel_drift_wide',
    fire: 'spread5',
    fireRate: 0.65,
    bulletSpeed: 280,

    abilities: ['burn_trail', 'drone_bay'],

    strategy: 'Watch the trail, not the ship. It is cutting the field into halves, and the half you want is always the one it has just left.',
    blurb: 'A supply hull venting drive plasma across the field on a corner-to-corner run.',
    intro: 'It crosses from one corner to the opposite one and leaves a burning line behind it. '
      + 'Nothing about the ship is fast. The field it is making is the problem, and it gets smaller every pass.',
  },

  {
    id: 'concord_outrider',
    name: 'Outrider Flight',
    faction: 'Concord',
    band: 'any',
    squadron: 3,
    role: 'skirmisher',

    art: { core: 'wedge', nose: 'sensor_dome', wing: 'canard', pod: 'none',
           engine: 'pulse_pods', crest: 'antenna', pal: 'frost' },

    hullMul: 0.9,
    shieldMul: 0.2,
    damageMul: 0.85,
    armour: 0.05,
    speed: 168,
    contact: 8,

    move: 'duel_flank',
    fire: 'single',
    fireRate: 0.7,
    bulletSpeed: 345,

    abilities: ['decoy_split'],

    strategy: 'The copies do not shoot. Watch for a muzzle flash, ignore everything without one, and it is three ships again.',
    blurb: 'Three scouts that become nine the moment you commit to a target.',
    intro: 'They split as soon as your fire lands anywhere near them, and the copies hold the formation '
      + 'as well as the originals do. Only three of the nine are shooting back.',
  },

  {
    id: 'concord_perseverance',
    name: 'Perseverance',
    faction: 'Concord',
    band: 'any',
    squadron: 1,
    role: 'tank',

    art: { core: 'obelisk', nose: 'ram_plate', wing: 'sail', pod: 'dorsal_turret',
           engine: 'ring_drive', crest: 'halo', pal: 'ion' },

    // The hardest hull in the pack, and the only one allowed near the armour
    // ceiling: it is slow, it telegraphs everything, and it never corners you
    // faster than you can walk out of the way.
    hullMul: 1.42,
    shieldMul: 0.45,
    damageMul: 0.95,
    armour: 0.28,
    speed: 86,
    contact: 17,

    move: 'duel_stalk',
    fire: 'radial8',
    fireRate: 0.4,
    bulletSpeed: 240,

    abilities: ['mine_lattice', 'nova_pulse', 'shield_recharge'],

    strategy: 'It seals the ground behind it, so give that ground up early rather than late. Circle wide, stay off the thin edge of its rings, and never back into space it has already crossed.',
    blurb: 'A monitor that takes the field a hundred metres at a time and keeps what it takes.',
    intro: 'It closes slowly, throwing rings that thin out with distance, and mines the space it leaves '
      + 'behind. There is no retreat lane it has not already thought about. The only room you get is the room in front of it.',
  },
];

/**
 * The Concord.
 *
 * Every other faction out here is improvising. The Concord is not: it has a
 * doctrine, a training pipeline and a supply chain, and its ships are the
 * best-equipped things in the game because somebody signed for every part of
 * them. That is the whole design brief for this pack. A Concord hull does not
 * surprise you — it does the correct thing, on time, again.
 *
 * Which is why almost nothing here is a trick. The pack's abilities are
 * coordination and denial: shields that face the threat axis, point defence,
 * barriers, locks, mines, relays. A trick asks the player "did you see that";
 * a Concord ship asks "where were you planning to stand", and then closes that
 * place. The counterplay is correspondingly positional and it is always
 * available, because a fight you cannot answer is a wall, not an opponent.
 *
 * The squadrons carry the faction's real argument. Seven of the twenty fly as
 * two, three, four or five bodies, and each formation is a job rather than a
 * quantity: tenders that hold each other up, minelayers cutting crossing lanes,
 * a ring that pulls inward, a box that drains in shifts, a line that only
 * exposes itself in the turn. They are given one ability apiece — two at the
 * outside — because an effect fires once per body, and four bodies with two
 * effects each is not a squadron, it is a weather system.
 *
 * They lose the way a professional navy loses. Nobody panics and nobody breaks
 * formation; the formation simply turns out to have a side it cannot cover, and
 * the player finds it. That is the note every strategy line here is written to:
 * not "shoot it more" but "the doctrine has a gap, and this is where".
 */
