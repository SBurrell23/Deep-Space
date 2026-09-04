/**
 * Achievements.
 *
 * Two kinds: general achievements that persist on the profile, and per-ship
 * achievements (three per hull) that also drive the Layout B unlock.
 *
 * Each entry has a `check(ctx)` returning true when earned. `ctx` is a snapshot
 * assembled by run.js: { run, ship, profile, event, stats }. Checks must be
 * cheap and side-effect free — they run on every relevant game event.
 */

import { SHIP_IDS } from './ships.js';

export const ACHIEVEMENTS = [
  // --- Progression ---------------------------------------------------------
  {
    id: 'first_blood', name: 'First Blood', icon: 'icon_skull',
    desc: 'Destroy your first enemy ship.',
    check: c => c.event === 'shipDestroyed',
  },
  {
    id: 'sector_two', name: 'Getting Somewhere', icon: 'icon_exit',
    desc: 'Reach sector 2.',
    check: c => c.run.sectorIndex >= 1,
  },
  {
    id: 'sector_five', name: 'Deep Space', icon: 'icon_star',
    desc: 'Reach sector 5.',
    check: c => c.run.sectorIndex >= 4,
  },
  {
    id: 'the_last_stand', name: 'The Last Stand', icon: 'icon_warning',
    desc: 'Reach the final sector.',
    check: c => c.run.sectorIndex >= 7,
  },
  {
    id: 'victory', name: 'Cut The Head Off', icon: 'icon_trophy',
    desc: 'Destroy the Swarm Flagship.',
    check: c => c.event === 'bossKilled',
  },
  {
    id: 'flawless_boss', name: 'Not A Scratch', icon: 'icon_check',
    desc: 'Beat the flagship without losing a single crew member all run.',
    check: c => c.event === 'bossKilled' && c.run.stats.crewLost === 0,
  },

  // --- Combat --------------------------------------------------------------
  {
    id: 'no_shields', name: 'Who Needs Shields', icon: 'icon_sys_shields',
    desc: 'Win a fight with your shield system fully knocked out.',
    check: c => c.event === 'combatVictory' && c.ship.systems.shields
      && c.ship.systems.shields.damage >= c.ship.systems.shields.level,
  },
  {
    id: 'boarding_party', name: 'Boarding Party', icon: 'icon_sys_teleporter',
    desc: 'Win a fight by wiping out an enemy crew rather than the hull.',
    check: c => c.event === 'combatVictory' && c.captured === true,
  },
  {
    id: 'untouchable', name: 'Untouchable', icon: 'icon_evade',
    desc: 'Win a fight without taking any hull damage, from sector 4 or later.',
    check: c => c.event === 'combatVictory' && c.hullLost === 0 && c.run.sectorIndex >= 3,
  },
  {
    id: 'skin_of_teeth', name: 'Skin Of Your Teeth', icon: 'icon_hull',
    desc: 'Win a fight while sitting on 1 hull.',
    check: c => c.event === 'combatVictory' && c.ship.hull === 1,
  },
  {
    id: 'pyromaniac', name: 'Pyromaniac', icon: 'icon_fire',
    desc: 'Destroy an enemy ship that has four rooms on fire at once.',
    check: c => c.event === 'combatVictory' && (c.enemyFires || 0) >= 4,
  },
  {
    id: 'venting', name: 'Take A Deep Breath', icon: 'icon_sys_oxygen',
    desc: 'Kill four boarders by venting your own ship to vacuum.',
    check: c => (c.run.stats.ventKills || 0) >= 4,
  },
  {
    id: 'full_broadside', name: 'Full Broadside', icon: 'icon_sys_weapons',
    desc: 'Fire four weapons in a single volley.',
    check: c => c.event === 'volley' && (c.volleySize || 0) >= 4,
  },

  // --- Ship management -----------------------------------------------------
  {
    id: 'fully_crewed', name: 'All Hands', icon: 'icon_crew',
    desc: 'Fill every crew slot on your ship.',
    check: c => c.ship.crew.filter(x => !x.dead).length >= c.ship.crewSlots,
  },
  {
    id: 'diversity', name: 'Motley Crew', icon: 'icon_crew',
    desc: 'Have five different species aboard at the same time.',
    check: c => new Set(c.ship.crew.filter(x => !x.dead).map(x => x.race)).size >= 5,
  },
  {
    id: 'max_shields', name: 'Impenetrable', icon: 'icon_sys_shields',
    desc: 'Reach four shield layers.',
    check: c => c.ship.shields.max >= 4,
  },
  {
    id: 'rich', name: 'War Profiteer', icon: 'icon_scrap',
    desc: 'Hold 400 scrap at once.',
    check: c => c.run.scrap >= 400,
  },
  {
    id: 'maxed_system', name: 'Redlined', icon: 'icon_sys_overdrive',
    desc: 'Upgrade any system to its maximum level.',
    check: c => Object.values(c.ship.systems).some(s => {
      const max = c.systemMax?.[s.id];
      return max != null && s.level >= max;
    }),
  },
  {
    id: 'master_engineer', name: 'Master Engineer', icon: 'icon_repair',
    desc: 'Get a crew member to maximum skill in three disciplines.',
    check: c => c.ship.crew.some(x => !x.dead
      && Object.values(x.skills).filter(v => v >= 2).length >= 3),
  },
  {
    id: 'well_armed', name: 'Bristling', icon: 'icon_sys_weapons',
    desc: 'Carry four weapons at once.',
    check: c => c.ship.weapons.length >= 4,
  },
  {
    id: 'drone_swarm', name: 'Drone Swarm', icon: 'icon_sys_drones',
    desc: 'Have three drones deployed at the same time.',
    check: c => c.ship.drones.filter(d => d.deployed).length >= 3,
  },

  // --- Adversity -----------------------------------------------------------
  {
    id: 'survivor', name: 'Survivor', icon: 'icon_health',
    desc: 'Jump out of a fight with 3 hull or less.',
    check: c => c.event === 'jump' && c.ship.hull <= 3,
  },
  {
    id: 'firefighter', name: 'Firefighter', icon: 'icon_fire',
    desc: 'Put out four fires aboard your own ship in one fight.',
    check: c => (c.combatFiresExtinguished || 0) >= 4,
  },
  {
    id: 'no_o2', name: 'Hold Your Breath', icon: 'icon_sys_oxygen',
    desc: 'Survive a fight with your oxygen system destroyed.',
    check: c => c.event === 'combatVictory' && c.ship.systems.oxygen
      && c.ship.systems.oxygen.damage >= c.ship.systems.oxygen.level,
  },
  {
    id: 'broke', name: 'Running On Fumes', icon: 'icon_fuel',
    desc: 'Reach a store with zero fuel remaining.',
    check: c => c.event === 'store' && c.run.fuel === 0,
  },

  // --- Meta ----------------------------------------------------------------
  {
    id: 'explorer', name: 'Cartographer', icon: 'icon_star',
    desc: 'Visit 100 beacons across all your runs.',
    check: c => (c.profile.stats.beaconsVisited || 0) >= 100,
  },
  {
    id: 'persistent', name: 'Persistent', icon: 'icon_repair',
    desc: 'Start 10 runs.',
    check: c => (c.profile.stats.runs || 0) >= 10,
  },
  {
    id: 'fleet_admiral', name: 'Fleet Admiral', icon: 'icon_trophy',
    desc: 'Unlock every ship in the hangar.',
    check: c => SHIP_IDS.every(id => c.profile.unlockedShips[id]?.length),
  },
  {
    id: 'completionist', name: 'Completionist', icon: 'icon_trophy',
    desc: 'Unlock every layout of every ship.',
    check: c => SHIP_IDS.every(id => (c.profile.unlockedShips[id] || []).length >= 2),
  },
  {
    id: 'speedrun', name: 'In A Hurry', icon: 'icon_speed',
    desc: 'Win a run in under 45 minutes.',
    check: c => c.event === 'bossKilled' && c.run.elapsed < 45 * 60,
  },
  {
    id: 'high_score', name: 'Legend', icon: 'icon_trophy',
    desc: 'Finish a run with a score above 2000.',
    check: c => c.event === 'runEnd' && (c.score || 0) >= 2000,
  },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/**
 * Per-ship achievements. Earning any one of a hull's three also unlocks that
 * hull's Layout B, so there are several routes to the same unlock.
 */
export const SHIP_ACHIEVEMENTS = {
  kestrel: [
    { id: 'kestrel_1', name: 'Federation Standard', desc: 'Reach sector 5 with the Kestrel.', check: c => c.run.sectorIndex >= 4 },
    { id: 'kestrel_2', name: 'Improvise', desc: 'Win a fight with the Kestrel using only Basic Lasers.', check: c => c.event === 'combatVictory' && c.ship.weapons.every(w => w.weaponId === 'laser_basic') },
    { id: 'kestrel_3', name: 'Home Again', desc: 'Beat the flagship with the Kestrel.', check: c => c.event === 'bossKilled' },
  ],
  torus: [
    { id: 'torus_1', name: 'Tank', desc: 'Survive a run with the Torus down to 3 hull and recover to full.', check: c => c.run.stats.recoveredFromCritical },
    { id: 'torus_2', name: 'Slow And Steady', desc: 'Reach sector 6 with the Torus.', check: c => c.run.sectorIndex >= 5 },
    { id: 'torus_3', name: 'Hauler', desc: 'Beat the flagship with the Torus.', check: c => c.event === 'bossKilled' },
  ],
  mantis: [
    { id: 'mantis_1', name: 'Butcher', desc: 'Kill 15 enemy crew in boarding actions.', check: c => (c.run.stats.boardingKills || 0) >= 15 },
    { id: 'mantis_2', name: 'Prize Crew', desc: 'Capture three ships by wiping out their crews.', check: c => (c.run.stats.captures || 0) >= 3 },
    { id: 'mantis_3', name: 'Apex', desc: 'Beat the flagship with the Mantis Raider.', check: c => c.event === 'bossKilled' },
  ],
  engi: [
    { id: 'engi_1', name: 'Hands Off', desc: 'Destroy a ship using only drones.', check: c => c.event === 'combatVictory' && c.playerWeaponDamage === 0 },
    { id: 'engi_2', name: 'Systems Nominal', desc: 'Reach sector 5 with the Engi Cruiser undamaged.', check: c => c.run.sectorIndex >= 4 && c.ship.hull === c.ship.maxHull },
    { id: 'engi_3', name: 'Optimised', desc: 'Beat the flagship with the Engi Cruiser.', check: c => c.event === 'bossKilled' },
  ],
  zoltan: [
    { id: 'zoltan_1', name: 'Living Reactor', desc: 'Have four Zoltan aboard at once.', check: c => c.ship.crew.filter(x => !x.dead && x.race === 'zoltan').length >= 4 },
    { id: 'zoltan_2', name: 'Diplomatic Immunity', desc: 'Reach sector 6 with the Zoltan ship.', check: c => c.run.sectorIndex >= 5 },
    { id: 'zoltan_3', name: 'Enlightened', desc: 'Beat the flagship with the Zoltan Ambassador.', check: c => c.event === 'bossKilled' },
  ],
  stealth: [
    { id: 'stealth_1', name: 'Ghost', desc: 'Win a fight without ever being hit, in a Stealth ship.', check: c => c.event === 'combatVictory' && c.hullLost === 0 },
    { id: 'stealth_2', name: 'Now You See Me', desc: 'Reach sector 5 with no shield system installed.', check: c => c.run.sectorIndex >= 4 && !c.ship.systems.shields },
    { id: 'stealth_3', name: 'Unseen', desc: 'Beat the flagship with a Stealth ship.', check: c => c.event === 'bossKilled' },
  ],
  rock: [
    { id: 'rock_1', name: 'Bombardment', desc: 'Fire 60 missiles in one run.', check: c => (c.run.stats.missilesFired || 0) >= 60 },
    { id: 'rock_2', name: 'Unmoved', desc: 'Reach sector 5 with engines never upgraded past level 1.', check: c => c.run.sectorIndex >= 4 && (c.ship.systems.engines?.level ?? 1) <= 1 },
    { id: 'rock_3', name: 'Immovable', desc: 'Beat the flagship with a Rock ship.', check: c => c.event === 'bossKilled' },
  ],
  slug: [
    { id: 'slug_1', name: 'Mind Games', desc: 'Mind control 8 enemy crew in one run.', check: c => (c.run.stats.mindControls || 0) >= 8 },
    { id: 'slug_2', name: 'Blind Navigation', desc: 'Reach sector 5 with no sensors installed.', check: c => c.run.sectorIndex >= 4 && !c.ship.systems.sensors },
    { id: 'slug_3', name: 'Whisper', desc: 'Beat the flagship with a Slug ship.', check: c => c.event === 'bossKilled' },
  ],
  crystal: [
    { id: 'crystal_1', name: 'Lockdown', desc: 'Seal 6 rooms with Crystal lockdown in one run.', check: c => (c.run.stats.lockdowns || 0) >= 6 },
    { id: 'crystal_2', name: 'Ancient', desc: 'Reach sector 6 with a Crystal ship.', check: c => c.run.sectorIndex >= 5 },
    { id: 'crystal_3', name: 'Enduring', desc: 'Beat the flagship with a Crystal ship.', check: c => c.event === 'bossKilled' },
  ],
  nomad: [
    { id: 'nomad_1', name: 'Magpie', desc: 'Earn 600 scrap in a single run.', check: c => (c.run.stats.scrapEarned || 0) >= 600 },
    { id: 'nomad_2', name: 'Self-Repairing', desc: 'Repair 25 hull with the Nanoforge in one run.', check: c => (c.run.stats.nanoforgeRepairs || 0) >= 25 },
    { id: 'nomad_3', name: 'Scavenger King', desc: 'Beat the flagship with the Nomad.', check: c => c.event === 'bossKilled' },
  ],
};

/**
 * Evaluate every achievement against a context snapshot.
 * Returns the ids newly earned; the caller writes them to the profile.
 */
export function evaluate(ctx) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (ctx.profile.achievements[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch { ok = false; }
    if (ok) earned.push(a.id);
  }
  return earned;
}

/** Per-ship achievements for the hull currently being flown. */
export function evaluateShip(ctx) {
  const list = SHIP_ACHIEVEMENTS[ctx.run.shipId] || [];
  const owned = ctx.profile.shipAchievements[ctx.run.shipId] || {};
  const earned = [];
  for (const a of list) {
    if (owned[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch { ok = false; }
    if (ok) earned.push(a.id);
  }
  return earned;
}

export function achievementById(id) {
  if (ACHIEVEMENTS_BY_ID[id]) return ACHIEVEMENTS_BY_ID[id];
  for (const list of Object.values(SHIP_ACHIEVEMENTS)) {
    const found = list.find(a => a.id === id);
    if (found) return found;
  }
  return null;
}

export function totalAchievementCount() {
  return ACHIEVEMENTS.length + Object.values(SHIP_ACHIEVEMENTS).reduce((n, l) => n + l.length, 0);
}

export function earnedAchievementCount(profile) {
  const general = Object.keys(profile.achievements || {}).length;
  const perShip = Object.values(profile.shipAchievements || {})
    .reduce((n, m) => n + Object.keys(m).length, 0);
  return general + perShip;
}
