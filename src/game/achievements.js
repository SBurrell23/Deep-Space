/**
 * Achievements.
 *
 * Each has a `check(ctx)` run on relevant events. `ctx` is a snapshot assembled
 * by `checkAchievements`; checks must be cheap and side-effect free. Earned
 * achievements are written to the profile, which persists across runs, and some
 * of them unlock hulls (see ships.js).
 */

import { SHIP_IDS, SHIPS, unlockedShips } from './ships.js';
import { RARITY_BY_ID } from './items.js';

export const CATEGORIES = ['Progress', 'Combat', 'Exploration', 'Command', 'Trials', 'Hulls'];

export const ACHIEVEMENTS = [
  // --- Progress ------------------------------------------------------------
  { id: 'first_blood', cat: 'Progress', name: 'First Blood', icon: 'icon_skull',
    desc: 'Destroy your first hostile ship.',
    check: c => c.run.stats.kills >= 1 },
  { id: 'first_clear', cat: 'Progress', name: 'Opening Move', icon: 'icon_check',
    desc: 'Clear your first node.',
    check: c => c.run.stats.nodesCleared >= 1 },
  { id: 'level_5', cat: 'Progress', name: 'Finding Your Feet', icon: 'icon_star',
    desc: 'Reach level 5.',
    check: c => c.ship.progress.level >= 5 },
  { id: 'level_10', cat: 'Progress', name: 'Veteran', icon: 'icon_star',
    desc: 'Reach level 10.',
    check: c => c.ship.progress.level >= 10 },
  { id: 'level_15', cat: 'Progress', name: 'Hardened', icon: 'icon_star',
    desc: 'Reach level 15.',
    check: c => c.ship.progress.level >= 15 },
  { id: 'level_20', cat: 'Progress', name: 'Nothing Left To Learn', icon: 'icon_trophy',
    desc: 'Reach level 20, the cap.',
    check: c => c.ship.progress.level >= 20 },
  { id: 'ring_3', cat: 'Progress', name: 'Out Of The Shallows', icon: 'icon_exit',
    desc: 'Reach the third ring of the map.',
    check: c => c.run.stats.deepestRing >= 3 },
  { id: 'ring_6', cat: 'Progress', name: 'Deep Water', icon: 'icon_exit',
    desc: 'Reach the sixth ring.',
    check: c => c.run.stats.deepestRing >= 6 },
  { id: 'ring_9', cat: 'Progress', name: 'The Far Dark', icon: 'icon_warning',
    desc: 'Reach the ninth ring.',
    check: c => c.run.stats.deepestRing >= 9 },
  { id: 'the_rim', cat: 'Progress', name: 'The Rim', icon: 'icon_hazard',
    desc: 'Reach the outermost ring of the universe.',
    check: c => c.run.stats.deepestRing >= c.map.rings - 1 },
  { id: 'sighted', cat: 'Progress', name: 'It Sees You Too', icon: 'icon_masterfleet',
    desc: 'Sight the Master Fleet on the map.',
    check: c => c.map.masterFleetVisible },
  { id: 'victory', cat: 'Progress', name: 'Cut The Head Off', icon: 'icon_trophy',
    desc: 'Destroy the Master Fleet.',
    check: c => c.event === 'victory' },

  // --- Combat --------------------------------------------------------------
  { id: 'kills_50', cat: 'Combat', name: 'Blooded', icon: 'icon_skull',
    desc: 'Destroy 50 ships in one run.',
    check: c => c.run.stats.kills >= 50 },
  { id: 'kills_250', cat: 'Combat', name: 'Attrition', icon: 'icon_skull',
    desc: 'Destroy 250 ships in one run.',
    check: c => c.run.stats.kills >= 250 },
  { id: 'kills_1000', cat: 'Combat', name: 'Industrial', icon: 'icon_skull',
    desc: 'Destroy 1000 ships across all runs.',
    check: c => (c.profile.stats.totalKills || 0) >= 1000 },
  { id: 'first_boss', cat: 'Combat', name: 'Giant Killer', icon: 'icon_boss',
    desc: 'Destroy a capital ship.',
    check: c => c.run.stats.bossesKilled >= 1 },
  { id: 'five_bosses', cat: 'Combat', name: 'Kingslayer', icon: 'icon_boss',
    desc: 'Destroy five capital ships in one run.',
    check: c => c.run.stats.bossesKilled >= 5 },
  { id: 'perfect_clear', cat: 'Combat', name: 'Not A Scratch', icon: 'icon_check',
    desc: 'Clear an encounter without taking any damage.',
    check: c => c.run.stats.perfectClears >= 1 },
  { id: 'perfect_ten', cat: 'Combat', name: 'Untouchable', icon: 'icon_evade',
    desc: 'Clear ten encounters without taking damage, in one run.',
    check: c => c.run.stats.perfectClears >= 10 },
  { id: 'untouched', cat: 'Combat', name: 'Never Laid A Finger', icon: 'icon_evade',
    desc: 'Clear a threat-10 or higher encounter without taking damage.',
    check: c => c.event === 'encounterWon' && c.run.pending?.perfect
      && (c.run.node?.threat || 0) >= 10 },
  { id: 'marksman', cat: 'Combat', name: 'Marksman', icon: 'icon_sys_weapons',
    desc: 'Finish an encounter with 90% accuracy or better.',
    check: c => c.event === 'encounterWon' && (c.run.pending?.accuracy || 0) >= 0.9
      && (c.run.pending?.world?.stats.shotsFired || 0) >= 40 },
  { id: 'sharpshooter', cat: 'Combat', name: 'Every Round Counts', icon: 'icon_sys_weapons',
    desc: 'Finish a run with 75% lifetime accuracy over 1000 shots.',
    check: c => c.run.stats.shotsFired >= 1000
      && c.run.stats.shotsHit / c.run.stats.shotsFired >= 0.75 },
  { id: 'skin_of_teeth', cat: 'Combat', name: 'Skin Of Your Teeth', icon: 'icon_hull',
    desc: 'Win an encounter on 5% hull or less.',
    check: c => c.event === 'encounterWon' && c.ship.hull / c.ship.stats.maxHull <= 0.05 },
  { id: 'ramming_speed', cat: 'Combat', name: 'Ramming Speed', icon: 'icon_hull',
    desc: 'Destroy 20 ships by collision in one run.',
    check: c => (c.run.stats.rammed || 0) >= 20 },
  { id: 'swarm_breaker', cat: 'Combat', name: 'Swarm Breaker', icon: 'icon_sys_weapons',
    desc: 'Destroy 30 ships in a single encounter.',
    check: c => (c.run.pending?.world?.stats.kills || 0) >= 30 },
  { id: 'no_secondary', cat: 'Combat', name: 'One Gun Is Enough', icon: 'icon_sys_weapons',
    desc: 'Clear a capital ship without firing your secondary.',
    check: c => c.event === 'encounterWon' && c.run.encounter?.type === 'boss'
      && (c.run.pending?.world?.stats.secondaryShots || 0) === 0 },

  // --- Exploration ---------------------------------------------------------
  { id: 'nodes_25', cat: 'Exploration', name: 'Surveyor', icon: 'icon_star',
    desc: 'Clear 25 nodes in one run.',
    check: c => c.run.stats.nodesCleared >= 25 },
  { id: 'nodes_60', cat: 'Exploration', name: 'Cartographer', icon: 'icon_star',
    desc: 'Clear 60 nodes in one run.',
    check: c => c.run.stats.nodesCleared >= 60 },
  { id: 'nodes_100', cat: 'Exploration', name: 'Every Last Rock', icon: 'icon_trophy',
    desc: 'Clear 100 nodes in one run.',
    check: c => c.run.stats.nodesCleared >= 100 },
  { id: 'tunnel_clean', cat: 'Exploration', name: 'Threaded The Needle', icon: 'node_tunnel',
    desc: 'Complete a passage without touching the walls.',
    check: c => c.event === 'encounterWon' && c.run.encounter?.type === 'tunnel'
      && (c.run.pending?.world?.stats.terrainHits || 0) === 0 },
  { id: 'anomalies_10', cat: 'Exploration', name: 'Curious', icon: 'node_anomaly',
    desc: 'Resolve 10 anomalies in one run.',
    check: c => c.run.stats.anomaliesResolved >= 10 },
  { id: 'anomalies_25', cat: 'Exploration', name: 'Incurable', icon: 'node_anomaly',
    desc: 'Resolve 25 anomalies in one run.',
    check: c => c.run.stats.anomaliesResolved >= 25 },
  { id: 'derelict_diver', cat: 'Exploration', name: 'Grave Robber', icon: 'node_derelict',
    desc: 'Clear 8 derelicts in one run.',
    check: c => (c.run.stats.derelictsCleared || 0) >= 8 },
  { id: 'lifetime_nodes', cat: 'Exploration', name: 'Well Travelled', icon: 'icon_star',
    desc: 'Clear 500 nodes across all runs.',
    check: c => (c.profile.stats.totalNodes || 0) >= 500 },

  // --- Command (gear, builds, economy) -------------------------------------
  { id: 'first_relic', cat: 'Command', name: 'Older Than The Fleet', icon: 'icon_trophy',
    desc: 'Find a Relic-tier item.',
    check: c => c.ship.inventory.concat(Object.values(c.ship.equipped))
      .some(i => i && i.rarity === 'relic') },
  { id: 'full_military', cat: 'Command', name: 'Properly Equipped', icon: 'icon_check',
    desc: 'Have every slot filled with Military tier or better.',
    check: c => Object.values(c.ship.equipped).every(i => i && (RARITY_BY_ID[i.rarity]?.tier || 0) >= 3) },
  { id: 'full_prototype', cat: 'Command', name: 'Bleeding Edge', icon: 'icon_trophy',
    desc: 'Have every slot filled with Prototype tier or better.',
    check: c => Object.values(c.ship.equipped).every(i => i && (RARITY_BY_ID[i.rarity]?.tier || 0) >= 4) },
  { id: 'rich', cat: 'Command', name: 'War Profiteer', icon: 'icon_scrap',
    desc: 'Hold 2000 credits at once.',
    check: c => c.ship.credits >= 2000 },
  { id: 'spender', cat: 'Command', name: 'Money Is For Spending', icon: 'icon_shop',
    desc: 'Spend 3000 credits in one run.',
    check: c => c.run.stats.creditsSpent >= 3000 },
  { id: 'specialist', cat: 'Command', name: 'Specialist', icon: 'icon_power',
    desc: 'Take one attribute to 15.',
    check: c => Object.values(c.ship.progress.attributes).some(v => v >= 15) },
  { id: 'maxed_attr', cat: 'Command', name: 'As Far As It Goes', icon: 'icon_sys_overdrive',
    desc: 'Take one attribute to its cap of 20.',
    check: c => Object.values(c.ship.progress.attributes).some(v => v >= 20) },
  { id: 'generalist', cat: 'Command', name: 'Generalist', icon: 'icon_crew',
    desc: 'Have every attribute at 7 or higher.',
    check: c => Object.values(c.ship.progress.attributes).every(v => v >= 7) },
  { id: 'drone_master', cat: 'Command', name: 'Not Alone Out Here', icon: 'icon_sys_drones',
    desc: 'Equip two ability items at once.',
    check: c => !!(c.ship.equipped.utility1?.ability && c.ship.equipped.utility2?.ability) },
  { id: 'hoarder', cat: 'Command', name: 'Hoarder', icon: 'icon_dronepart',
    desc: 'Fill your inventory completely.',
    check: c => c.ship.inventory.length >= 24 },
  { id: 'unbroken', cat: 'Command', name: 'Unbroken', icon: 'icon_sys_shields',
    desc: 'Reach 200 maximum shield.',
    check: c => c.ship.stats.maxShield >= 200 },
  { id: 'juggernaut', cat: 'Command', name: 'Juggernaut', icon: 'icon_hull',
    desc: 'Reach 600 maximum hull.',
    check: c => c.ship.stats.maxHull >= 600 },
  { id: 'overclocked', cat: 'Command', name: 'Overclocked', icon: 'icon_power',
    desc: 'Reach 400 maximum energy.',
    check: c => c.ship.stats.maxEnergy >= 400 },

  // --- Trials (deliberate challenge) ---------------------------------------
  { id: 'no_shop_run', cat: 'Trials', name: 'Self Sufficient', icon: 'icon_cross',
    desc: 'Beat the Master Fleet having spent nothing at a trading post.',
    check: c => c.event === 'victory' && c.run.stats.creditsSpent === 0 },
  { id: 'speedrun', cat: 'Trials', name: 'In A Hurry', icon: 'icon_speed',
    desc: 'Beat the Master Fleet in under 90 minutes.',
    check: c => c.event === 'victory' && c.run.elapsed < 90 * 60 },
  { id: 'speedrun_hard', cat: 'Trials', name: 'Blistering', icon: 'icon_speed',
    desc: 'Beat the Master Fleet in under 60 minutes.',
    check: c => c.event === 'victory' && c.run.elapsed < 60 * 60 },
  { id: 'low_level_win', cat: 'Trials', name: 'Punching Up', icon: 'icon_warning',
    desc: 'Beat the Master Fleet at level 16 or below.',
    check: c => c.event === 'victory' && c.ship.progress.level <= 16 },
  { id: 'pacifist_ish', cat: 'Trials', name: 'The Long Way Round', icon: 'node_tunnel',
    desc: 'Beat the Master Fleet having cleared 12 or more non-combat nodes.',
    check: c => c.event === 'victory' && (c.run.stats.anomaliesResolved || 0) >= 12 },
  { id: 'no_deaths_deep', cat: 'Trials', name: 'Steady Hands', icon: 'icon_check',
    desc: 'Reach ring 8 having never dropped below 25% hull.',
    check: c => c.run.stats.deepestRing >= 8 && !c.run.stats.everCritical },
  { id: 'flawless_fleet', cat: 'Trials', name: 'Overwhelming', icon: 'icon_trophy',
    desc: 'Beat a Master Fleet stage without taking damage.',
    check: c => c.event === 'encounterWon' && c.run.encounter?.type === 'masterfleet'
      && c.run.pending?.perfect },
  { id: 'no_flee', cat: 'Trials', name: 'No Retreat', icon: 'icon_warning',
    desc: 'Beat the Master Fleet without ever disengaging from a fight.',
    check: c => c.event === 'victory' && c.run.stats.encountersFled === 0 },

  // --- Meta ----------------------------------------------------------------
  { id: 'two_wins', cat: 'Progress', name: 'Again', icon: 'icon_trophy',
    desc: 'Beat the Master Fleet twice.',
    check: c => (c.profile.stats.wins || 0) >= 2 },
  { id: 'five_wins', cat: 'Progress', name: 'Habitual', icon: 'icon_trophy',
    desc: 'Beat the Master Fleet five times.',
    check: c => (c.profile.stats.wins || 0) >= 5 },
  { id: 'all_hulls', cat: 'Hulls', name: 'Full Hangar', icon: 'icon_trophy',
    desc: 'Unlock every hull.',
    check: c => SHIP_IDS.every(id => c.unlocked.includes(id)) },
  { id: 'persistent', cat: 'Progress', name: 'Persistent', icon: 'icon_repair',
    desc: 'Start 10 runs.',
    check: c => (c.profile.stats.runs || 0) >= 10 },
  { id: 'graveyard', cat: 'Progress', name: 'It Happens', icon: 'icon_skull',
    desc: 'Lose 10 ships.',
    check: c => (c.profile.stats.losses || 0) >= 10 },
];

// One per hull: beat the Master Fleet flying it.
for (const id of SHIP_IDS) {
  ACHIEVEMENTS.push({
    id: `win_${id}`, cat: 'Hulls', name: `${SHIPS[id].name}`, icon: 'icon_trophy',
    desc: `Beat the Master Fleet flying the ${SHIPS[id].name}.`,
    check: c => c.event === 'victory' && c.ship.shipId === id,
  });
}

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/**
 * Evaluate every achievement against the current run, returning the ones newly
 * earned. Writes straight to the profile so a crash mid-run can't lose one.
 */
export function checkAchievements(run, event, extra = {}) {
  const profile = run.profile;
  if (!profile) return [];
  profile.achievements = profile.achievements || {};

  const ctx = {
    run, ship: run.ship, map: run.map, profile, event, extra,
    // Derived, not stored: the unlock rules live in ships.js.
    unlocked: unlockedShips(profile),
  };

  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (profile.achievements[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch { ok = false; }
    if (ok) {
      profile.achievements[a.id] = Date.now();
      earned.push(a);
    }
  }
  return earned;
}

export function earnedCount(profile) {
  return Object.keys(profile?.achievements || {}).length;
}

export function byCategory() {
  const out = {};
  for (const cat of CATEGORIES) out[cat] = ACHIEVEMENTS.filter(a => a.cat === cat);
  return out;
}
