/**
 * Crew: races, skills, and the per-person runtime state.
 *
 * A crew member is a plain serialisable object (so a run saves cleanly to
 * localStorage); all behaviour lives in the functions below.
 */

export const SKILLS = ['piloting', 'engines', 'shields', 'weapons', 'repair', 'combat'];

/** XP needed to reach skill level 1 and 2. Level 2 is the cap, as in FTL. */
export const SKILL_THRESHOLDS = {
  piloting: [15, 45], engines: [15, 45], shields: [55, 110],
  weapons: [65, 130], repair: [18, 55], combat: [8, 20],
};

/** Multipliers applied at skill level 0 / 1 / 2. */
export const SKILL_BONUS = {
  piloting: [1, 1.05, 1.1],   // evasion multiplier
  engines: [1, 1.05, 1.1],    // evasion multiplier
  shields: [1, 1.1, 1.2],     // shield recharge speed
  weapons: [1, 1.08, 1.15],   // weapon charge speed
  repair: [1, 1.2, 1.5],      // repair speed
  combat: [1, 1.2, 1.5],      // melee damage
};

export const RACES = {
  human: {
    id: 'human', name: 'Human', sprite: 'crew_human', hp: 100, moveSpeed: 1, repairSpeed: 1, combat: 1,
    hireCost: [25, 45], rarity: 1,
    desc: 'Learns faster than anyone else. Nothing special, and good at everything.',
    traits: { xpRate: 1.15 },
  },
  engi: {
    id: 'engi', name: 'Engi', sprite: 'crew_engi', hp: 100, moveSpeed: 1, repairSpeed: 2, combat: 0.5,
    hireCost: [30, 55], rarity: 2,
    desc: 'Repairs at double speed and fights at half. Keep them away from boarders.',
    traits: {},
  },
  mantis: {
    id: 'mantis', name: 'Mantis', sprite: 'crew_mantis', hp: 100, moveSpeed: 1.2, repairSpeed: 0.5, combat: 2,
    hireCost: [35, 60], rarity: 2,
    desc: 'Devastating in a boarding action, hopeless with a wrench.',
    traits: {},
  },
  rockman: {
    id: 'rockman', name: 'Rockman', sprite: 'crew_rockman', hp: 150, moveSpeed: 0.5, repairSpeed: 1, combat: 1,
    hireCost: [40, 65], rarity: 2,
    desc: 'Immune to fire and hard to kill, but slow to cross a ship.',
    traits: { fireproof: true },
  },
  zoltan: {
    id: 'zoltan', name: 'Zoltan', sprite: 'crew_zoltan', hp: 70, moveSpeed: 1, repairSpeed: 1, combat: 0.5,
    hireCost: [35, 60], rarity: 3,
    desc: 'Supplies one bar of power to whatever room they stand in, and detonates when killed.',
    traits: { powerBonus: 1, deathBurst: 15 },
  },
  slug: {
    id: 'slug', name: 'Slug', sprite: 'crew_slug', hp: 100, moveSpeed: 1, repairSpeed: 1, combat: 1.2,
    hireCost: [35, 60], rarity: 3,
    desc: 'Senses crew through hulls without sensors, and cannot be mind controlled.',
    traits: { telepathy: true, mindImmune: true, noHealBonus: true },
  },
  crystal: {
    id: 'crystal', name: 'Crystal', sprite: 'crew_crystal', hp: 125, moveSpeed: 0.8, repairSpeed: 1, combat: 1.5,
    hireCost: [45, 75], rarity: 5,
    desc: 'Can seal a room in crystal, locking everyone inside. Resists suffocation.',
    traits: { lockdown: true, o2Resist: 0.5 },
  },
  synth: {
    id: 'synth', name: 'Synth', sprite: 'crew_synth', hp: 110, moveSpeed: 1, repairSpeed: 1.3, combat: 1.1,
    hireCost: [45, 70], rarity: 4, original: true,
    desc: 'Needs no air at all, but a medbay cannot heal them — only repairs will.',
    traits: { noOxygen: true, noMedbay: true, selfRepair: 1.5 },
  },
  vex: {
    id: 'vex', name: 'Vex', sprite: 'crew_vex', hp: 80, moveSpeed: 1.8, repairSpeed: 0.9, combat: 1.3,
    hireCost: [40, 65], rarity: 4, original: true,
    desc: 'Crosses a ship before anyone else has stood up, and dodges half of what is thrown at them.',
    traits: { dodge: 0.5 },
  },
};

export const RACE_IDS = Object.keys(RACES);

export function getRace(id) {
  const r = RACES[id];
  if (!r) throw new Error(`unknown race "${id}"`);
  return r;
}

const FIRST_NAMES = [
  'Ada', 'Boz', 'Cyra', 'Dax', 'Enna', 'Ferro', 'Gale', 'Hux', 'Iris', 'Jax',
  'Kess', 'Lyra', 'Mox', 'Nadia', 'Orin', 'Pell', 'Quill', 'Rhea', 'Sten', 'Tarn',
  'Ulla', 'Vek', 'Wren', 'Xen', 'Yara', 'Zeb', 'Corvin', 'Delta', 'Esk', 'Fen',
  'Grix', 'Halo', 'Ivo', 'Juno', 'Kyre', 'Lom', 'Mira', 'Nyx', 'Ozz', 'Prax',
  'Ryn', 'Sable', 'Tove', 'Umber', 'Vail', 'Wisp', 'Yost', 'Zia', 'Bram', 'Cade',
];

const SURNAMES = [
  'Ward', 'Voss', 'Kade', 'Renn', 'Solt', 'Brek', 'Vane', 'Hollow', 'Marsh', 'Quint',
  'Ashen', 'Drexl', 'Fane', 'Grell', 'Harrow', 'Ives', 'Krell', 'Lune', 'Morrow', 'Nash',
];

export function randomName(rng, race) {
  // Non-humanoid races get a single designation rather than a family name.
  const first = rng.pick(FIRST_NAMES);
  if (race === 'engi' || race === 'synth') return `${first}-${rng.int(10, 99)}`;
  if (race === 'crystal' || race === 'zoltan') return first;
  return rng.chance(0.55) ? `${first} ${rng.pick(SURNAMES)}` : first;
}

let nextId = 1;
export function resetCrewIds(n = 1) { nextId = n; }

/** Create a crew member. `room` is the room index they start in. */
export function makeCrew(raceId, { rng = null, name = null, room = 0, skills = null } = {}) {
  const race = getRace(raceId);
  const base = { piloting: 0, engines: 0, shields: 0, weapons: 0, repair: 0, combat: 0 };
  return {
    id: `c${nextId++}`,
    name: name || (rng ? randomName(rng, raceId) : `${race.name} ${nextId}`),
    race: raceId,
    hp: race.hp, maxHp: race.hp,
    room, x: 0, y: 0,          // position in room-local tile coords
    targetRoom: null, path: null,
    onEnemyShip: false,
    skills: { ...base },
    xp: { ...base, ...(skills || {}) },
    stunned: 0, mindControlled: 0, fighting: null, dead: false,
    manning: null,
    cloneProgress: 0,
  };
}

/** Recompute skill levels from XP. Call after granting XP. */
export function refreshSkills(crew) {
  for (const s of SKILLS) {
    const [t1, t2] = SKILL_THRESHOLDS[s];
    const xp = crew.xp[s] || 0;
    crew.skills[s] = xp >= t2 ? 2 : xp >= t1 ? 1 : 0;
  }
  return crew;
}

/**
 * Grant skill XP. Returns true if the crew member levelled up, so the caller
 * can play a sting.
 */
export function grantXP(crew, skill, amount) {
  if (crew.dead || !SKILLS.includes(skill)) return false;
  const race = getRace(crew.race);
  const before = crew.skills[skill];
  crew.xp[skill] = (crew.xp[skill] || 0) + amount * (race.traits.xpRate || 1);
  refreshSkills(crew);
  return crew.skills[skill] > before;
}

export function skillBonus(crew, skill) {
  if (!crew) return 1;
  return SKILL_BONUS[skill][crew.skills[skill] || 0];
}

export function moveSpeed(crew, augmentBonus = 0) {
  const race = getRace(crew.race);
  return race.moveSpeed * (1 + augmentBonus) * (crew.stunned > 0 ? 0 : 1);
}

export function repairSpeed(crew) {
  return getRace(crew.race).repairSpeed * skillBonus(crew, 'repair');
}

export function combatPower(crew, augmentBonus = 0) {
  return getRace(crew.race).combat * skillBonus(crew, 'combat') * (1 + augmentBonus);
}

/** Damage a crew member; returns true if this killed them. */
export function damageCrew(crew, amount) {
  if (crew.dead) return false;
  const race = getRace(crew.race);
  if (race.traits.dodge && Math.random() < race.traits.dodge * 0.35) return false;
  crew.hp = Math.max(0, crew.hp - amount);
  if (crew.hp <= 0) { crew.dead = true; crew.manning = null; crew.fighting = null; return true; }
  return false;
}

export function healCrew(crew, amount) {
  if (crew.dead) return;
  crew.hp = Math.min(crew.maxHp, crew.hp + amount);
}

export function isAlive(c) { return c && !c.dead; }

/** How fast this race loses health in vacuum (0 = immune). */
export function suffocationRate(crew, augResist = 0) {
  const t = getRace(crew.race).traits;
  if (t.noOxygen) return 0;
  const resist = Math.max(t.o2Resist || 0, augResist);
  return 6.4 * (1 - resist);
}

/** Hire price for a race in a given sector. */
export function hireCost(raceId, rng, sector = 1) {
  const [lo, hi] = getRace(raceId).hireCost;
  return Math.round(rng.int(lo, hi) * (1 + sector * 0.02));
}

/** Weight for rolling a random race — rarer species show up deeper in. */
export function raceWeight(raceId, sector) {
  const r = getRace(raceId);
  const reach = 1 + sector * 0.4;
  if (r.rarity > reach + 1.5) return 0;
  return Math.max(0.1, 6 - Math.abs(r.rarity - Math.min(5, reach)) * 1.6);
}

export function rollRace(rng, sector = 1) {
  const pool = RACE_IDS.map(id => ({ id, weight: raceWeight(id, sector) })).filter(p => p.weight > 0);
  return rng.weighted(pool).id;
}
