/**
 * Weapon definitions for the action game.
 *
 * A weapon is pure data. `behaviour` names the firing routine the combat sim
 * implements, and the remaining fields parameterise it. Anything the sim needs
 * to know at fire time lives here so weapons can be added without touching the
 * simulation.
 *
 * Damage numbers are the base at power 1.0; an item's rarity/level `power`
 * multiplier and the pilot's Weapons attribute both scale them at fire time.
 */

export const BEHAVIOURS = [
  'bullet',    // straight-line projectile
  'pierce',    // passes through everything it hits
  'homing',    // steers toward the nearest target
  'beam',      // continuous hitscan while held
  'chain',     // arcs from target to target
  'aoe',       // explodes on impact
  'fragment',  // splits into smaller shots on impact or expiry
  'mine',      // stationary, detonates on proximity
  'drone',     // spawns a temporary autonomous attacker
  'charge',    // hold to charge, release for a scaled shot
];

export const WEAPONS = {
  // -------------------------------------------------------------------------
  // PRIMARY — cheap, continuous, energy-fed. Your default trigger.
  // -------------------------------------------------------------------------
  pulse: {
    id: 'pulse', kind: 'primary', name: 'Pulse Cannon',
    desc: 'A dependable repeating cannon. Nothing clever.',
    behaviour: 'bullet', damage: 9, rof: 6.5, energy: 2.2,
    speed: 760, life: 1.5, count: 1, spread: 0.012,
    sprite: 'pb_pulse', sound: 'laser_light', icon: 'icon_sys_weapons',
  },
  twin_pulse: {
    id: 'twin_pulse', kind: 'primary', name: 'Twin Pulse Array',
    desc: 'Two barrels, fired in parallel. More metal downrange.',
    behaviour: 'bullet', damage: 6.5, rof: 6.0, energy: 3.0,
    speed: 780, life: 1.5, count: 2, spread: 0.01, offsets: [-7, 7],
    sprite: 'pb_pulse', sound: 'laser_light', icon: 'icon_sys_weapons',
  },
  needler: {
    id: 'needler', kind: 'primary', name: 'Needle Array',
    desc: 'A blur of tiny rounds. Shreds unarmoured hulls.',
    behaviour: 'bullet', damage: 3.6, rof: 15, energy: 1.3,
    speed: 900, life: 1.2, count: 1, spread: 0.055,
    sprite: 'pb_pulse', sound: 'laser_light', icon: 'icon_sys_weapons',
  },
  scatter: {
    id: 'scatter', kind: 'primary', name: 'Scatter Gun',
    desc: 'Seven pellets in a cone. Devastating up close, useless far away.',
    behaviour: 'bullet', damage: 5.5, rof: 2.4, energy: 6.5,
    speed: 620, life: 0.42, count: 7, spread: 0.30,
    sprite: 'pb_scatter', sound: 'flak', icon: 'icon_sys_weapons',
  },
  rail: {
    id: 'rail', kind: 'primary', name: 'Rail Lance',
    desc: 'A hypervelocity slug that goes through everything in the lane.',
    behaviour: 'pierce', damage: 30, rof: 1.5, energy: 12,
    speed: 1500, life: 1.2, count: 1, spread: 0, pierce: 99,
    sprite: 'pb_rail', sound: 'laser_heavy', icon: 'icon_sys_weapons',
  },
  arc: {
    id: 'arc', kind: 'primary', name: 'Arc Emitter',
    desc: 'Lightning that leaps between targets. Loves a crowd.',
    behaviour: 'chain', damage: 11, rof: 2.6, energy: 7.5,
    speed: 1000, life: 0.9, count: 1, chains: 3, chainRange: 190, chainFalloff: 0.72,
    sprite: 'pb_arc', sound: 'ion', icon: 'icon_sys_weapons',
  },
  plasma: {
    id: 'plasma', kind: 'primary', name: 'Plasma Repeater',
    desc: 'Slow, fat bolts that burst on impact.',
    behaviour: 'aoe', damage: 16, rof: 2.2, energy: 8,
    speed: 430, life: 2.0, count: 1, radius: 62, splashMult: 0.6,
    sprite: 'pb_plasma', sound: 'plasma', icon: 'icon_sys_weapons',
  },
  beam: {
    id: 'beam', kind: 'primary', name: 'Beam Projector',
    desc: 'A continuous cutting beam. Drains energy while held.',
    behaviour: 'beam', damage: 34, rof: 1, energy: 26,
    range: 620, tickRate: 12, sprite: 'pb_beam', sound: 'beam', icon: 'icon_sys_weapons',
  },
  shard: {
    id: 'shard', kind: 'primary', name: 'Shard Driver',
    desc: 'Crystal splinters that shatter into more splinters.',
    behaviour: 'fragment', damage: 8, rof: 3.0, energy: 5.5,
    speed: 680, life: 1.4, count: 1, fragments: 4, fragmentDamage: 3.4, fragmentSpeed: 420,
    sprite: 'pb_shard', sound: 'laser_light', icon: 'icon_sys_weapons',
  },
  flak_primary: {
    id: 'flak_primary', kind: 'primary', name: 'Flak Repeater',
    desc: 'Proximity-fused shells that burst near anything hostile.',
    behaviour: 'aoe', damage: 7, rof: 4.5, energy: 4,
    speed: 700, life: 1.3, count: 1, radius: 46, splashMult: 0.85, proximity: 34,
    sprite: 'pb_scatter', sound: 'flak', icon: 'icon_sys_weapons',
  },
  sidewinder: {
    id: 'sidewinder', kind: 'primary', name: 'Sidewinder Battery',
    desc: 'Small self-guiding rockets. Fire and forget.',
    behaviour: 'homing', damage: 7.5, rof: 3.2, energy: 5,
    speed: 520, life: 2.6, count: 2, turnRate: 4.2, spread: 0.5,
    sprite: 'pb_missile', sound: 'missile_launch', icon: 'icon_missile',
  },
  wave: {
    id: 'wave', kind: 'primary', name: 'Wave Motion Gun',
    desc: 'Hold to charge. Release a piercing wall of light.',
    behaviour: 'charge', damage: 22, rof: 1, energy: 9,
    chargeTime: 1.5, chargeMult: 3.4, speed: 900, life: 1.4, pierce: 99, width: 26,
    sprite: 'pb_beam', sound: 'laser_heavy', icon: 'icon_sys_weapons',
  },
  ricochet: {
    id: 'ricochet', kind: 'primary', name: 'Ricochet Gun',
    desc: 'Rounds that bounce off the field edges. Chaotic in tunnels.',
    behaviour: 'bullet', damage: 10, rof: 3.6, energy: 4.2,
    speed: 640, life: 3.0, count: 1, bounces: 3,
    sprite: 'pb_scatter', sound: 'laser_light', icon: 'icon_sys_weapons',
  },
  vortex: {
    id: 'vortex', kind: 'primary', name: 'Vortex Launcher',
    desc: 'A slow singularity that drags enemies into its centre.',
    behaviour: 'aoe', damage: 5, rof: 0.85, energy: 14,
    speed: 210, life: 3.4, count: 1, radius: 130, splashMult: 1, pullForce: 320, tickRate: 6,
    sprite: 'pb_plasma', sound: 'siphon', icon: 'icon_sys_siphon',
  },

  // -------------------------------------------------------------------------
  // SECONDARY — expensive, punchy, on a cooldown. Your answer to a problem.
  // -------------------------------------------------------------------------
  missiles: {
    id: 'missiles', kind: 'secondary', name: 'Missile Pod',
    desc: 'A salvo of guided missiles.',
    behaviour: 'homing', damage: 26, rof: 0.9, energy: 16,
    speed: 470, life: 3.4, count: 3, turnRate: 3.2, spread: 0.6, radius: 44, splashMult: 0.5,
    sprite: 'pb_missile', sound: 'missile_launch', icon: 'icon_missile',
  },
  torpedo: {
    id: 'torpedo', kind: 'secondary', name: 'Heavy Torpedo',
    desc: 'One enormous warhead. Slow, and worth the wait.',
    behaviour: 'aoe', damage: 95, rof: 0.4, energy: 26,
    speed: 300, life: 4, count: 1, radius: 120, splashMult: 0.75,
    sprite: 'pb_missile', sound: 'explosion_large', icon: 'icon_missile',
  },
  cluster: {
    id: 'cluster', kind: 'secondary', name: 'Cluster Bomb',
    desc: 'Breaks into six bomblets over the target.',
    behaviour: 'fragment', damage: 22, rof: 0.7, energy: 20,
    speed: 420, life: 1.5, count: 1, fragments: 6, fragmentDamage: 13, fragmentSpeed: 330,
    fragmentRadius: 52, radius: 60, splashMult: 0.6,
    sprite: 'pb_plasma', sound: 'flak', icon: 'icon_missile',
  },
  minelayer: {
    id: 'minelayer', kind: 'secondary', name: 'Mine Layer',
    desc: 'Drops proximity mines in your wake.',
    behaviour: 'mine', damage: 55, rof: 1.1, energy: 12,
    life: 12, count: 1, radius: 96, splashMult: 1, proximity: 62, drift: -60,
    sprite: 'eb_flak', sound: 'explosion_small', icon: 'icon_missile',
  },
  gravity_well: {
    id: 'gravity_well', kind: 'secondary', name: 'Gravity Well',
    desc: 'A collapsing well that holds a formation in place and crushes it.',
    behaviour: 'aoe', damage: 9, rof: 0.35, energy: 30,
    speed: 190, life: 4.5, count: 1, radius: 175, splashMult: 1, pullForce: 620, tickRate: 8,
    sprite: 'pb_plasma', sound: 'temporal', icon: 'icon_sys_temporal',
  },
  lance: {
    id: 'lance', kind: 'secondary', name: 'Piercing Lance',
    desc: 'A focused spear of energy that spits an entire column.',
    behaviour: 'pierce', damage: 62, rof: 0.6, energy: 24,
    speed: 1150, life: 1.5, count: 1, pierce: 99, width: 16,
    sprite: 'pb_rail', sound: 'laser_heavy', icon: 'icon_sys_weapons',
  },
  drone_swarm: {
    id: 'drone_swarm', kind: 'secondary', name: 'Drone Swarm',
    desc: 'Releases three attack drones that fight alongside you.',
    behaviour: 'drone', damage: 7, rof: 0.25, energy: 28,
    count: 3, droneLife: 16, droneRof: 2.2, droneSpeed: 300,
    sprite: 'drone_combat', sound: 'drone_launch', icon: 'icon_sys_drones',
  },
  shield_breaker: {
    id: 'shield_breaker', kind: 'secondary', name: 'Shield Breaker',
    desc: 'Tuned to collapse energy screens. Triple damage to shields.',
    behaviour: 'bullet', damage: 20, rof: 1.6, energy: 14,
    speed: 820, life: 1.6, count: 1, shieldMult: 3,
    sprite: 'pb_arc', sound: 'ion', icon: 'icon_sys_shields',
  },
  nova_charge: {
    id: 'nova_charge', kind: 'secondary', name: 'Nova Charge',
    desc: 'Detonates on release, clearing everything close by.',
    behaviour: 'charge', damage: 40, rof: 1, energy: 22,
    chargeTime: 1.1, chargeMult: 2.4, speed: 0, radius: 210, splashMult: 1, selfCentred: true,
    sprite: 'pb_plasma', sound: 'explosion_large', icon: 'icon_sys_overdrive',
  },
  repair_lance: {
    id: 'repair_lance', kind: 'secondary', name: 'Nanite Lance',
    desc: 'Converts a fraction of the damage it deals into hull repair.',
    behaviour: 'bullet', damage: 18, rof: 2.0, energy: 11,
    speed: 700, life: 1.6, count: 1, lifesteal: 0.35,
    sprite: 'pb_beam', sound: 'nanoforge', icon: 'icon_repair',
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);
export function weaponIds() { return WEAPON_IDS; }
export function getWeapon(id) { return WEAPONS[id] || null; }

export function primaryIds() { return WEAPON_IDS.filter(id => WEAPONS[id].kind === 'primary'); }
export function secondaryIds() { return WEAPON_IDS.filter(id => WEAPONS[id].kind === 'secondary'); }

/**
 * Effective firing stats for an equipped weapon, once the pilot's stats and the
 * item's rarity roll are applied. The sim calls this rather than reading the
 * definition directly.
 */
export function resolveWeapon(item, stats) {
  const def = WEAPONS[item?.weaponId];
  if (!def) return null;
  const power = item.power || 1;
  return {
    ...def,
    damage: def.damage * power * (stats.damageMult || 1),
    rof: def.rof * (stats.fireRateMult || 1),
    energy: def.energy * (stats.energyCostMult || 1),
    fragmentDamage: (def.fragmentDamage || 0) * power * (stats.damageMult || 1),
    droneDamage: (def.damage || 0) * power * (stats.damageMult || 1),
    item,
  };
}

/** Seconds between shots, guarding against a zero/negative rate of fire. */
export function shotInterval(resolved) {
  return 1 / Math.max(0.05, resolved.rof);
}
