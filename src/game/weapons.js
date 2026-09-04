/**
 * Weapons, drones and augments.
 *
 * Weapon fields
 *   power      reactor bars the weapons system must supply
 *   charge     seconds to charge at weapons level 1 (scaled by system level)
 *   shots      projectiles fired per volley
 *   damage     hull/system damage per shot
 *   pierce     shield layers ignored
 *   ion        ion charges applied (locks system power instead of damaging it)
 *   fire/breach/stun  chance per hit, 0..1
 *   sysOnly    true if the shot damages systems and crew but not the hull
 *   crewDamage extra damage dealt to crew standing in the hit room
 */

export const WEAPON_TYPES = {
  LASER: 'laser', BEAM: 'beam', MISSILE: 'missile', BOMB: 'bomb',
  ION: 'ion', FLAK: 'flak', PLASMA: 'plasma',
};

const W = WEAPON_TYPES;

export const WEAPONS = {
  // --- Lasers -------------------------------------------------------------
  laser_basic: { id: 'laser_basic', name: 'Basic Laser', type: W.LASER, power: 1, charge: 10, shots: 1, damage: 1, cost: 20, rarity: 1, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Cheap, reliable, and always available.' },
  laser_burst2: { id: 'laser_burst2', name: 'Burst Laser II', type: W.LASER, power: 2, charge: 12, shots: 3, damage: 1, cost: 80, rarity: 3, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Three shots a volley. The workhorse of any decent loadout.' },
  laser_burst1: { id: 'laser_burst1', name: 'Burst Laser I', type: W.LASER, power: 2, charge: 11, shots: 2, damage: 1, cost: 55, rarity: 2, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Two shots, quick charge.' },
  laser_burst3: { id: 'laser_burst3', name: 'Burst Laser III', type: W.LASER, power: 4, charge: 19, shots: 5, damage: 1, cost: 95, rarity: 4, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Five shots will break almost any shield, if you can spare the power.' },
  laser_heavy1: { id: 'laser_heavy1', name: 'Heavy Laser I', type: W.LASER, power: 1, charge: 9, shots: 1, damage: 2, fire: 0.1, cost: 45, rarity: 2, sfx: 'laser_heavy', sprite: 'proj_heavylaser', desc: 'Two damage from a single bar.' },
  laser_heavy2: { id: 'laser_heavy2', name: 'Heavy Laser II', type: W.LASER, power: 3, charge: 13, shots: 2, damage: 2, fire: 0.15, cost: 70, rarity: 3, sfx: 'laser_heavy', sprite: 'proj_heavylaser', desc: 'Two heavy shots, with a real chance of starting fires.' },
  laser_hull: { id: 'laser_hull', name: 'Hull Laser II', type: W.LASER, power: 3, charge: 13, shots: 2, damage: 1, hullBonus: 1, cost: 65, rarity: 3, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Deals double damage to rooms with no system in them.' },
  laser_charge: { id: 'laser_charge', name: 'Charge Laser', type: W.LASER, power: 2, charge: 8, shots: 1, maxCharges: 3, damage: 1, cost: 60, rarity: 3, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Stores up to three charges and fires them all at once.' },
  laser_vulcan: { id: 'laser_vulcan', name: 'Vulcan Repeater', type: W.LASER, power: 4, charge: 18, shots: 1, damage: 1, rampUp: true, cost: 110, rarity: 5, sfx: 'laser_light', sprite: 'proj_laser', desc: 'Fires faster the longer it keeps firing, down to a shot a second.' },

  // --- Beams --------------------------------------------------------------
  beam_mini: { id: 'beam_mini', name: 'Mini Beam', type: W.BEAM, power: 1, charge: 12, damage: 1, length: 2, cost: 20, rarity: 1, sfx: 'beam', desc: 'A short beam that cannot pierce shields, but hits every room it crosses.' },
  beam_hull: { id: 'beam_hull', name: 'Hull Beam', type: W.BEAM, power: 2, charge: 15, damage: 1, hullBonus: 1, length: 3, cost: 65, rarity: 3, sfx: 'beam', desc: 'Doubles up on empty rooms — devastating against a sparse hull.' },
  beam_pike: { id: 'beam_pike', name: 'Pike Beam', type: W.BEAM, power: 2, charge: 16, damage: 1, pierce: 1, length: 5, cost: 75, rarity: 3, sfx: 'beam', desc: 'A long lance that cuts through one shield layer.' },
  beam_halberd: { id: 'beam_halberd', name: 'Halberd Beam', type: W.BEAM, power: 3, charge: 17, damage: 2, pierce: 1, length: 3, cost: 100, rarity: 4, sfx: 'beam', desc: 'Two damage a room, straight through a shield layer.' },
  beam_glaive: { id: 'beam_glaive', name: 'Glaive Beam', type: W.BEAM, power: 4, charge: 25, damage: 3, pierce: 2, length: 3, cost: 130, rarity: 5, sfx: 'beam', desc: 'Slow, enormous, and it does not care about your shields.' },
  beam_fire: { id: 'beam_fire', name: 'Fire Beam', type: W.BEAM, power: 2, charge: 14, damage: 0, fire: 0.55, length: 4, cost: 60, rarity: 3, sfx: 'beam', desc: 'Deals no damage — it just sets everything it touches alight.' },
  beam_anti: { id: 'beam_anti', name: 'Anti-Bio Beam', type: W.BEAM, power: 2, charge: 16, damage: 0, crewDamage: 60, length: 3, cost: 70, rarity: 3, sfx: 'beam', desc: 'Harmless to hulls, lethal to anything breathing.' },

  // --- Missiles -----------------------------------------------------------
  missile_artemis: { id: 'missile_artemis', name: 'Artemis Missile', type: W.MISSILE, power: 1, charge: 11, shots: 1, damage: 2, pierce: 99, ammo: 1, breach: 0.1, cost: 25, rarity: 1, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'Ignores shields entirely. Costs a missile per shot.' },
  missile_hermes: { id: 'missile_hermes', name: 'Hermes Missile', type: W.MISSILE, power: 3, charge: 14, shots: 1, damage: 3, pierce: 99, ammo: 1, breach: 0.4, cost: 80, rarity: 3, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'Three damage and a good chance of tearing the hull open.' },
  missile_breach: { id: 'missile_breach', name: 'Breach Missile', type: W.MISSILE, power: 2, charge: 15, shots: 1, damage: 2, pierce: 99, ammo: 1, breach: 0.9, cost: 65, rarity: 3, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'Almost always punches a hull breach. Vents the room and the crew with it.' },
  missile_swarm: { id: 'missile_swarm', name: 'Swarm Missiles', type: W.MISSILE, power: 3, charge: 19, shots: 3, damage: 1, pierce: 99, ammo: 2, cost: 90, rarity: 4, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'Three shield-piercing shots for two missiles.' },
  missile_pegasus: { id: 'missile_pegasus', name: 'Pegasus Missile', type: W.MISSILE, power: 3, charge: 17, shots: 2, damage: 2, pierce: 99, ammo: 2, cost: 100, rarity: 4, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'A double-barrelled shield-ignoring salvo.' },

  // --- Bombs (teleported straight into a room) -----------------------------
  bomb_small: { id: 'bomb_small', name: 'Small Bomb', type: W.BOMB, power: 1, charge: 12, shots: 1, damage: 1, pierce: 99, ammo: 1, sysOnly: true, cost: 35, rarity: 2, sfx: 'explosion_small', desc: 'Teleports into a room. Wrecks systems and crew, never the hull.' },
  bomb_fire: { id: 'bomb_fire', name: 'Fire Bomb', type: W.BOMB, power: 2, charge: 15, shots: 1, damage: 0, pierce: 99, ammo: 1, fire: 0.95, sysOnly: true, cost: 55, rarity: 3, sfx: 'fire_start', desc: 'Drops a fire straight into the room of your choice.' },
  bomb_breach: { id: 'bomb_breach', name: 'Breach Bomb II', type: W.BOMB, power: 2, charge: 17, shots: 1, damage: 2, pierce: 99, ammo: 1, breach: 1, sysOnly: true, cost: 75, rarity: 4, sfx: 'breach', desc: 'A guaranteed breach placed exactly where it hurts.' },
  bomb_stun: { id: 'bomb_stun', name: 'Stun Bomb', type: W.BOMB, power: 1, charge: 13, shots: 1, damage: 0, pierce: 99, ammo: 1, stun: 6, sysOnly: true, cost: 45, rarity: 2, sfx: 'ion', desc: 'Freezes every crew member in the target room.' },
  bomb_healing: { id: 'bomb_healing', name: 'Repair Bomb', type: W.BOMB, power: 2, charge: 16, shots: 1, damage: 0, pierce: 99, ammo: 1, repair: 1, friendly: true, sysOnly: true, cost: 60, rarity: 3, sfx: 'nanoforge', desc: 'Fired at your own ship: instantly repairs a damaged system.' },

  // --- Ion ----------------------------------------------------------------
  ion_blast: { id: 'ion_blast', name: 'Ion Blast', type: W.ION, power: 1, charge: 8, shots: 1, damage: 0, ion: 1, cost: 30, rarity: 1, sfx: 'ion', sprite: 'proj_ion', desc: 'Locks one bar of a system for a few seconds. Ion hits always beat shields down.' },
  ion_blast2: { id: 'ion_blast2', name: 'Ion Blast II', type: W.ION, power: 3, charge: 5, shots: 1, damage: 0, ion: 1, cost: 70, rarity: 3, sfx: 'ion', sprite: 'proj_ion', desc: 'Fast enough to keep a system locked down indefinitely.' },
  ion_heavy: { id: 'ion_heavy', name: 'Heavy Ion', type: W.ION, power: 2, charge: 13, shots: 1, damage: 0, ion: 3, cost: 60, rarity: 3, sfx: 'ion', sprite: 'proj_ion', desc: 'Three ion charges at once.' },
  ion_charger: { id: 'ion_charger', name: 'Chain Ion', type: W.ION, power: 2, charge: 14, shots: 1, damage: 0, ion: 2, chain: 0.15, cost: 75, rarity: 4, sfx: 'ion', sprite: 'proj_ion', desc: 'Charges faster with every volley it lands.' },

  // --- Flak & plasma ------------------------------------------------------
  flak_1: { id: 'flak_1', name: 'Flak Cannon I', type: W.FLAK, power: 2, charge: 13, shots: 3, damage: 1, scatter: true, cost: 65, rarity: 3, sfx: 'flak', sprite: 'proj_flak', desc: 'Sprays debris across the target. Shots may stray to nearby rooms.' },
  flak_2: { id: 'flak_2', name: 'Flak Cannon II', type: W.FLAK, power: 3, charge: 17, shots: 7, damage: 1, scatter: true, cost: 100, rarity: 4, sfx: 'flak', sprite: 'proj_flak', desc: 'Seven pieces of shrapnel. Shields simply cannot keep up.' },
  plasma_lance: { id: 'plasma_lance', name: 'Plasma Lance', type: W.PLASMA, power: 3, charge: 18, shots: 1, damage: 3, fire: 0.3, cost: 105, rarity: 4, sfx: 'plasma', sprite: 'proj_plasma', desc: 'A slow bolt of contained star, and the fires it leaves behind.' },
  plasma_storm: { id: 'plasma_storm', name: 'Plasma Storm', type: W.PLASMA, power: 4, charge: 22, shots: 2, damage: 2, fire: 0.4, pierce: 1, cost: 125, rarity: 5, sfx: 'plasma', sprite: 'proj_plasma', desc: 'Two bolts through a shield layer, and the room burns after.' },

  // --- Deep Space originals ------------------------------------------------
  void_ripper: { id: 'void_ripper', name: 'Void Ripper', type: W.PLASMA, power: 3, charge: 20, shots: 1, damage: 2, breach: 0.7, pierce: 1, cost: 115, rarity: 5, original: true, sfx: 'plasma', sprite: 'proj_plasma', desc: 'Opens a pinhole to nowhere. Whatever was in that room is now elsewhere.' },
  static_web: { id: 'static_web', name: 'Static Web', type: W.ION, power: 3, charge: 16, shots: 3, damage: 0, ion: 1, stun: 3, cost: 95, rarity: 4, original: true, sfx: 'ion', sprite: 'proj_ion', desc: 'Three ion arcs that also stun anyone caught in the room.' },
  gravity_hook: { id: 'gravity_hook', name: 'Gravity Hook', type: W.MISSILE, power: 2, charge: 18, shots: 1, damage: 1, pierce: 99, ammo: 1, pullCrew: true, cost: 90, rarity: 4, original: true, sfx: 'missile_launch', sprite: 'proj_missile', desc: 'Drags enemy crew out of the targeted room and scatters them across their ship.' },
  mirror_beam: { id: 'mirror_beam', name: 'Mirror Beam', type: W.BEAM, power: 3, charge: 19, damage: 1, length: 4, reflect: true, cost: 110, rarity: 5, original: true, sfx: 'beam', desc: 'Every room it crosses also takes a second lash on the return sweep.' },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export function getWeapon(id) {
  const w = WEAPONS[id];
  if (!w) throw new Error(`unknown weapon "${id}"`);
  return w;
}

/** Missiles/bombs consume ammo; everything else is free to fire. */
export function ammoCost(w) { return w.ammo || 0; }

/**
 * Charge time in seconds at a given weapons-system level. Higher system levels
 * do not speed weapons up in FTL, but a manned station does — that multiplier
 * is applied by the combat sim, not here.
 */
export function chargeTime(w) { return w.charge; }

// ---------------------------------------------------------------------------
// Drones
// ---------------------------------------------------------------------------

export const DRONE_TYPES = {
  COMBAT: 'combat', DEFENSE: 'defense', BOARDING: 'boarding',
  REPAIR: 'repair', HULL: 'hull',
};

export const DRONES = {
  combat_1: { id: 'combat_1', name: 'Combat Drone I', type: DRONE_TYPES.COMBAT, power: 2, damage: 1, fireRate: 4.5, cost: 50, rarity: 2, sprite: 'drone_combat', desc: 'Circles the enemy and plinks away at whatever it can see.' },
  combat_2: { id: 'combat_2', name: 'Combat Drone II', type: DRONE_TYPES.COMBAT, power: 3, damage: 1, fireRate: 2.8, cost: 80, rarity: 3, sprite: 'drone_combat', desc: 'A faster-firing gun platform.' },
  beam_drone: { id: 'beam_drone', name: 'Beam Drone', type: DRONE_TYPES.COMBAT, power: 3, damage: 1, fireRate: 7, beam: true, cost: 90, rarity: 4, sprite: 'drone_combat', desc: 'Rakes a short beam across the enemy interior.' },
  defense_1: { id: 'defense_1', name: 'Defense Drone I', type: DRONE_TYPES.DEFENSE, power: 2, intercept: 0.75, cost: 55, rarity: 2, sprite: 'drone_defense', desc: 'Shoots down incoming missiles.' },
  defense_2: { id: 'defense_2', name: 'Defense Drone II', type: DRONE_TYPES.DEFENSE, power: 3, intercept: 0.6, alsoLasers: true, cost: 85, rarity: 4, sprite: 'drone_defense', desc: 'Intercepts missiles and laser fire alike, if less reliably.' },
  boarding_1: { id: 'boarding_1', name: 'Boarding Drone', type: DRONE_TYPES.BOARDING, power: 2, hp: 40, damage: 6, cost: 60, rarity: 3, sprite: 'drone_boarding', desc: 'Punches through the hull and fights whatever it lands next to.' },
  repair_1: { id: 'repair_1', name: 'System Repair Drone', type: DRONE_TYPES.REPAIR, power: 2, repairRate: 1.8, cost: 60, rarity: 3, sprite: 'drone_repair', desc: 'Roams your ship repairing damaged systems on its own.' },
  hull_1: { id: 'hull_1', name: 'Hull Repair Drone', type: DRONE_TYPES.HULL, power: 2, hullRate: 0.06, cost: 70, rarity: 3, sprite: 'drone_hull', desc: 'Patches hull plating from outside, slowly, throughout the fight.' },
  shield_drone: { id: 'shield_drone', name: 'Shield Drone', type: DRONE_TYPES.DEFENSE, power: 3, shieldBoost: 1, cost: 95, rarity: 5, original: true, sprite: 'drone_defense', desc: 'Projects one extra shield layer for as long as it survives.' },
  swarm_drone: { id: 'swarm_drone', name: 'Swarm Drone', type: DRONE_TYPES.COMBAT, power: 4, damage: 1, fireRate: 1.6, hp: 20, cost: 105, rarity: 5, original: true, sprite: 'drone_combat', desc: 'Fragile, relentless, and very hard to ignore.' },
};

export const DRONE_IDS = Object.keys(DRONES);

export function getDrone(id) {
  const d = DRONES[id];
  if (!d) throw new Error(`unknown drone "${id}"`);
  return d;
}

// ---------------------------------------------------------------------------
// Augments — passive, always-on ship modifications
// ---------------------------------------------------------------------------

export const AUGMENTS = {
  scrap_recovery: { id: 'scrap_recovery', name: 'Scrap Recovery Arm', cost: 50, rarity: 2, desc: 'Every scrap reward is 10% larger.', effect: { scrapBonus: 0.1 } },
  pre_igniter: { id: 'pre_igniter', name: 'Weapon Pre-Igniter', cost: 120, rarity: 5, desc: 'All weapons start each fight fully charged.', effect: { preIgnite: true } },
  auto_loader: { id: 'auto_loader', name: 'Auto-Loader', cost: 80, rarity: 4, desc: 'Weapons charge 15% faster.', effect: { chargeSpeed: 0.15 } },
  stealth_weapons: { id: 'stealth_weapons', name: 'Stealth Weapons', cost: 60, rarity: 3, desc: 'Firing while cloaked no longer breaks the cloak.', effect: { stealthWeapons: true } },
  titanium: { id: 'titanium', name: 'Titanium System Casing', cost: 70, rarity: 3, desc: '15% chance to shrug off any system damage entirely.', effect: { systemArmor: 0.15 } },
  defense_scrambler: { id: 'defense_scrambler', name: 'Defense Scrambler', cost: 70, rarity: 4, desc: 'Enemy defense drones cannot intercept your shots.', effect: { scrambleDefense: true } },
  zoltan_shield: { id: 'zoltan_shield', name: 'Energy Barrier', cost: 90, rarity: 4, desc: 'Start every fight behind a 2-layer barrier that never recharges.', effect: { superShield: 2 } },
  rock_plating: { id: 'rock_plating', name: 'Rock Plating', cost: 60, rarity: 3, desc: '10% chance to ignore hull damage.', effect: { hullArmor: 0.1 } },
  o2_masks: { id: 'o2_masks', name: 'Emergency Respirators', cost: 40, rarity: 2, desc: 'Crew suffocate at a quarter of the usual rate.', effect: { o2Resist: 0.75 } },
  repair_arm: { id: 'repair_arm', name: 'Repair Arm', cost: 60, rarity: 3, desc: 'Repairing hull at a store costs 40% less.', effect: { repairDiscount: 0.4 } },
  fire_suppression: { id: 'fire_suppression', name: 'Fire Suppression', cost: 55, rarity: 3, desc: 'Fires aboard your ship slowly put themselves out.', effect: { fireSuppression: 0.35 } },
  drone_recovery: { id: 'drone_recovery', name: 'Drone Reactor Booster', cost: 70, rarity: 3, desc: 'Your drones act 25% faster.', effect: { droneSpeed: 0.25 } },
  fleet_sensor: { id: 'fleet_sensor', name: 'Long-Range Scanners', cost: 45, rarity: 2, desc: 'Reveals what waits at every beacon on the map.', effect: { revealMap: true } },
  backup_dna: { id: 'backup_dna', name: 'Backup DNA Bank', cost: 60, rarity: 3, desc: 'Clone Bay revives keep all of the crew member’s skill.', effect: { perfectClone: true } },
  crystal_vengeance: { id: 'crystal_vengeance', name: 'Crystal Vengeance', cost: 70, rarity: 4, desc: '10% chance that hull damage fires a shard straight back.', effect: { vengeance: 0.1 } },
  slug_gel: { id: 'slug_gel', name: 'Slug Repair Gel', cost: 50, rarity: 3, desc: 'Hull breaches seal themselves over time.', effect: { autoSealBreach: true } },
  battery_charger: { id: 'battery_charger', name: 'Battery Charger', cost: 55, rarity: 3, desc: 'The backup battery recharges twice as fast.', effect: { batteryRecharge: 2 } },
  hacking_boost: { id: 'hacking_boost', name: 'Hacking Amplifier', cost: 65, rarity: 4, desc: 'Hacking lasts 50% longer.', effect: { hackDuration: 0.5 } },
  // Originals
  void_anchor: { id: 'void_anchor', name: 'Void Anchor', cost: 85, rarity: 4, original: true, desc: 'Enemy ships cannot flee while your weapons are charged.', effect: { blockFlee: true } },
  echo_core: { id: 'echo_core', name: 'Echo Core', cost: 100, rarity: 5, original: true, desc: 'Once per fight, the first hull damage you take is undone.', effect: { echo: 1 } },
  salvage_nets: { id: 'salvage_nets', name: 'Salvage Nets', cost: 65, rarity: 3, original: true, desc: 'Destroyed enemies also drop a fuel unit and a missile.', effect: { extraDrops: true } },
  crew_stims: { id: 'crew_stims', name: 'Combat Stims', cost: 55, rarity: 3, original: true, desc: 'Your crew fight 30% harder and move 15% faster.', effect: { crewCombat: 0.3, crewSpeed: 0.15 } },
  quantum_bulkheads: { id: 'quantum_bulkheads', name: 'Quantum Bulkheads', cost: 75, rarity: 4, original: true, desc: 'Doors cannot be forced open by boarders below level 3 strength.', effect: { doorLock: true } },
};

export const AUGMENT_IDS = Object.keys(AUGMENTS);

export function getAugment(id) {
  const a = AUGMENTS[id];
  if (!a) throw new Error(`unknown augment "${id}"`);
  return a;
}

/** Sum an augment effect across a list of owned augment ids. */
export function augmentValue(ids, key, fallback = 0) {
  let out = fallback;
  for (const id of ids || []) {
    const a = AUGMENTS[id];
    if (!a || a.effect[key] === undefined) continue;
    const v = a.effect[key];
    if (typeof v === 'boolean') { if (v) return true; }
    else out += v;
  }
  return out;
}

export function hasAugment(ids, id) { return (ids || []).includes(id); }

/**
 * Pick items appropriate to a sector. Later sectors surface rarer gear; the
 * weighting keeps common items available throughout so early ships stay viable.
 */
export function rarityWeight(rarity, sector) {
  const reach = 1 + sector * 0.35;
  if (rarity > reach + 1.5) return 0;
  return Math.max(0.05, 6 - Math.abs(rarity - Math.min(5, reach)) * 2);
}
