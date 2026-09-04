/**
 * The action simulation.
 *
 * Deliberately free of any DOM or canvas reference: the renderer reads the
 * world, and the headless playtester drives thousands of encounters through
 * this same code to tune pacing. All randomness flows through `world.rng`, so a
 * seed reproduces a fight exactly.
 *
 * The play field is a fixed logical size. The renderer scales it to whatever
 * canvas it has, so a wide monitor never confers extra reaction time.
 */

import { MOVEMENTS, FIRE_PATTERNS } from './patterns.js';
import { Spawner } from './spawner.js';
import { Corridor, seedObstacles } from './terrain.js';
import { resolveWeapon, shotInterval } from './weapons.js';
import { ENEMIES } from './enemies.js';
import { DEFENCE_TUNING } from './balance.js';

export const WORLD_W = 960;
export const WORLD_H = 540;

/** Bullets and enemies are culled this far outside the field. */
const CULL = 140;

/**
 * How many drones may be on your wing at once.
 *
 * Drones expire, but nothing stopped you launching more while the last batch
 * was still flying: a drone weapon held down settled at a dozen homing guns
 * that never missed and cost nothing to aim. They are an escort, not a swarm
 * you build up — past the cap the oldest is retired to make room.
 */
const MAX_DRONES = 4;

/** How many times an enemy may circle back before it is allowed to leave. */
const MAX_PASSES = 2;

// ---------------------------------------------------------------------------
// World construction
// ---------------------------------------------------------------------------

export const MIN_WORLD_W = 860;
export const MAX_WORLD_W = 1700;

export function createWorld({ encounter, threat, ship, rng, seed = 0, width = WORLD_W }) {
  const fieldW = Math.round(clamp(width || WORLD_W, MIN_WORLD_W, MAX_WORLD_W));
  const world = {
    w: fieldW, h: WORLD_H,
    rng,
    seed,
    time: 0,
    frame: 0,
    encounter,
    threat,
    state: 'playing',
    outcome: null,

    player: createPlayer(ship),
    enemies: [],
    bullets: [],      // player-owned
    eBullets: [],     // enemy-owned
    obstacles: [],
    pickups: [],
    drones: [],
    decoys: [],
    effects: [],
    // Persistent area denial and telegraphed beam attacks. Both are hazards
    // you position around rather than projectiles you dodge.
    zones: [],
    beams: [],
    mines: [],
    pendingSpawns: [],

    input: blankInput(),
    events: [],

    // Time dilation and hit-stop both scale the simulation, never the frame.
    timeScale: 1,
    slowUntil: 0,

    scrollX: 0,
    scrollSpeed: encounter.arena?.scroll ?? 0,
    corridor: null,

    stats: {
      kills: 0, shotsFired: 0, shotsHit: 0, damageDealt: 0, damageTaken: 0,
      pickupsTaken: 0, creditsEarned: 0, xpEarned: 0, timeElapsed: 0,
      abilitiesUsed: 0, dashes: 0, perfectDodges: 0, terrainHits: 0,
      // Spawned vs destroyed vs escaped: an enemy that flies off the field is
      // not a kill, and a 'clear' that pays in full for zero kills is a lie.
      spawned: 0, escaped: 0, rounded: 0, rammed: 0, bossKills: 0,
      // Per-slot trigger pulls, so "clear this without your secondary" can
      // actually be checked.
      primaryShots: 0, secondaryShots: 0, tertiaryShots: 0,
      // Where the hull came back from. Damage taken means nothing on its own
      // if it is all healed before the fight ends.
      healed: 0, healedPickup: 0, healedLifesteal: 0, healedAbility: 0,
    },
  };

  world.spawner = new Spawner(encounter, threat, rng);

  if (encounter.terrain) {
    // Passages were authored generously and played as a formality. Tightened
    // and sped up globally rather than by editing every encounter: the aperture
    // floor keeps them flyable, and the scroll multiplier is what actually
    // makes them demand attention.
    const T = encounter.terrain;
    world.corridor = new Corridor(rng, WORLD_H, T.length ?? 12000, {
      style: T.style,
      minAperture: Math.max(92, (T.minAperture ?? 200) * 0.62),
      maxAperture: (T.maxAperture ?? 400) * 0.76,
      roughness: (T.roughness ?? 1) * 1.55,
      chambers: T.chambers,
      pinches: Math.round((T.pinches ?? 4) * 1.8),
    });
    // Speed is what makes a passage a test rather than a corridor to steer
    // down at leisure, so it scales with the node's threat on top of the flat
    // multiplier.
    world.scrollSpeed = (T.scroll ?? 200) * (2.05 + Math.min(12, threat) * 0.055);
  }

  if (encounter.obstacles) {
    world.obstacles = seedObstacles(rng, world, encounter.obstacles);
  }

  return world;
}

export function blankInput() {
  return {
    moveX: 0, moveY: 0,
    aimX: WORLD_W, aimY: WORLD_H / 2,
    firePrimary: false, fireSecondary: false, fireTertiary: false,
    dash: false, abilities: [false, false, false],
  };
}

function createPlayer(ship) {
  const s = ship.stats;
  return {
    x: 150, y: WORLD_H / 2,
    vx: 0, vy: 0,
    r: 13,
    w: 64, h: 40,
    sprite: ship.sprite || 'ship_ext_kestrel',

    hull: ship.hull,
    maxHull: s.maxHull,
    // Always enter a fight with a full screen; see applyEncounterResult.
    shield: s.maxShield,
    maxShield: s.maxShield,
    shieldTimer: 0,
    energy: s.maxEnergy,
    maxEnergy: s.maxEnergy,

    stats: s,
    // Weapons live in the ship's equipment slots; resolve them against the
    // pilot's stats once, here, rather than on every trigger pull.
    primary: ship.equipped?.primary ? resolveWeapon(ship.equipped.primary, s) : null,
    secondary: ship.equipped?.secondary ? resolveWeapon(ship.equipped.secondary, s) : null,
    tertiary: ship.equipped?.tertiary ? resolveWeapon(ship.equipped.tertiary, s) : null,
    primaryTimer: 0,
    secondaryTimer: 0,
    tertiaryTimer: 0,
    // Per-slot, not shared. Both triggers are meant to work at the same time,
    // and a single `charging`/`beamTick` meant holding both made one slot
    // cancel the other's charge or steal its tick.
    charging: { primary: 0, secondary: 0, tertiary: 0 },
    beamTick: { primary: 0, secondary: 0, tertiary: 0 },

    // 0 = locked facing right. With rotate mode on, the hull turns to the
    // cursor; the ship still moves on world axes, only its heading changes.
    facing: 0,
    rotate: !!ship.rotate,

    dashCooldown: 0,
    dashCharges: Math.max(1, s.dashCharges || 1),
    dashMax: Math.max(1, s.dashCharges || 1),
    dashTime: 0,
    invuln: 0,

    abilities: (ship.abilities || []).slice(0, 3).map(a => ({
      id: a.id, name: a.name, icon: a.icon, energy: a.energy,
      cooldown: a.cooldown * (s.cooldownMult || 1),
      timer: 0,
    })),

    // Transient buffs applied by abilities.
    fireRateBuff: 1, fireRateBuffTime: 0,
    hitFlash: 0,
    // Lifesteal is rate-limited rather than uncapped. Healing a percentage of
    // damage dealt scales with DPS, and DPS compounds across a run, so an
    // unbounded 5% turned into full sustain by the mid game.
    lifestealBudget: 0,
    lifestealSpent: 0,
    negateTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

export function update(world, rawDt) {
  if (world.state !== 'playing') return world;

  // Clamp so an alt-tab or a slow frame can't teleport anything through a wall.
  const dt = Math.min(0.05, Math.max(0, rawDt)) * effectiveTimeScale(world);
  if (dt <= 0) return world;

  world.frame++;
  world.time += dt;
  world.stats.timeElapsed += dt;
  world.scrollX += world.scrollSpeed * dt;

  updatePlayer(world, dt);
  updateSpawns(world, dt);
  updateEnemies(world, dt);
  updateDrones(world, dt);
  updateBullets(world, dt);
  updateObstacles(world, dt);
  updatePickups(world, dt);
  updateMines(world, dt);
  updateZones(world, dt);
  updateBeams(world, dt);
  updateEffects(world, dt);
  resolveCollisions(world, dt);
  checkObjective(world);
  compact(world);

  return world;
}

function effectiveTimeScale(world) {
  return world.time < world.slowUntil ? world.timeScale : 1;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function updatePlayer(world, dt) {
  const p = world.player;
  const s = p.stats;
  const inp = world.input;

  // --- movement ---
  const ax = clamp(inp.moveX, -1, 1);
  const ay = clamp(inp.moveY, -1, 1);
  const mag = Math.hypot(ax, ay);
  // Normalise so diagonals aren't 41% faster than the cardinals.
  const nx = mag > 1 ? ax / mag : ax;
  const ny = mag > 1 ? ay / mag : ay;

  p.vx += nx * s.accel * dt;
  p.vy += ny * s.accel * dt;

  // Drag applies always; it is what gives each engine its feel.
  const drag = Math.pow(0.5, dt * s.drag);
  p.vx *= drag;
  p.vy *= drag;

  const speedCap = p.dashTime > 0 ? s.speed * 3.4 : s.speed;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > speedCap) { p.vx = p.vx / sp * speedCap; p.vy = p.vy / sp * speedCap; }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // --- dash ---
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.dashCooldown === 0 && p.dashCharges < p.dashMax) {
    p.dashCharges++;
    if (p.dashCharges < p.dashMax) p.dashCooldown = s.dashCooldown;
  }
  p.dashTime = Math.max(0, p.dashTime - dt);
  if (inp.dash && p.dashCharges > 0 && p.dashTime === 0) {
    const dx = mag > 0.1 ? nx : 1, dy = mag > 0.1 ? ny : 0;
    p.vx = dx * s.speed * 3.2;
    p.vy = dy * s.speed * 3.2;
    p.dashTime = 0.19;
    p.invuln = Math.max(p.invuln, 0.24);   // i-frames are the point of a dash
    p.dashCharges--;
    if (p.dashCooldown === 0) p.dashCooldown = s.dashCooldown;
    world.stats.dashes++;
    emit(world, { type: 'dash', x: p.x, y: p.y });
    if (s.dashWake) {
      // Everything the dash passes through takes a hit.
      for (const e of world.enemies) {
        if (e.dead) continue;
        if (dist2(e.x, e.y, p.x, p.y) < 120 * 120) {
          damageEnemy(world, e, 18 + world.threat * 6, { silent: true });
        }
      }
    }
  }

  if (p.rotate) {
    const want = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);
    let diff = want - p.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Eased rather than snapped, or the hull jitters with every mouse tremor.
    p.facing += diff * Math.min(1, dt * 12);
  } else {
    p.facing = 0;
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt * 4);

  // --- bounds and terrain ---
  const m = 18;
  p.x = clamp(p.x, m, world.w - m);
  p.y = clamp(p.y, m, world.h - m);

  if (world.corridor) {
    const res = world.corridor.resolve(p.x + world.scrollX, p.y, p.r);
    if (res.hit) {
      p.y = res.y;
      p.vy = 0;
      // Scraping the wall costs hull. It should hurt, not end the run.
      if (p.invuln <= 0) {
        damagePlayer(world, 9 + world.threat * 0.8, { source: 'terrain' });
        p.invuln = 0.5;
        world.stats.terrainHits++;
        emit(world, { type: 'terrainHit', x: p.x, y: p.y });
      }
    }
  }

  // Lifesteal budget: at most this fraction of max hull healed per second,
  // however much damage is dealt. At 3%/sec a forty-second fight refunded a
  // hull and a fifth, so lifesteal was not sustain, it was immunity — it paid
  // back 91-99% of everything a deep fight could do to you. At 0.8% the same
  // fight refunds about a third of a hull, which is a build, not an answer.
  const lsCap = p.maxHull * DEFENCE_TUNING.lifestealPerSecond;
  p.lifestealBudget = Math.min(lsCap, p.lifestealBudget + lsCap * dt);
  if (s.negateEvery) p.negateTimer = Math.max(0, p.negateTimer - dt);

  // --- energy and shield ---
  p.energy = Math.min(p.maxEnergy, p.energy + s.energyRegen * dt);
  p.shieldTimer = Math.max(0, p.shieldTimer - dt);
  if (p.shieldTimer === 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + s.shieldRegen * dt);
  }

  // --- buffs ---
  if (p.fireRateBuffTime > 0) {
    p.fireRateBuffTime -= dt;
    if (p.fireRateBuffTime <= 0) p.fireRateBuff = 1;
  }

  // --- weapons ---
  p.primaryTimer = Math.max(0, p.primaryTimer - dt);
  p.secondaryTimer = Math.max(0, p.secondaryTimer - dt);
  p.tertiaryTimer = Math.max(0, p.tertiaryTimer - dt);
  fireWeapons(world, dt);

  // --- abilities ---
  for (let i = 0; i < p.abilities.length; i++) {
    const ab = p.abilities[i];
    ab.timer = Math.max(0, ab.timer - dt);
    if (inp.abilities[i] && ab.timer === 0 && p.energy >= ab.energy) {
      activateAbility(world, ab);
    }
  }
}

function fireWeapons(world, dt) {
  const p = world.player;
  const inp = world.input;
  const aim = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);

  const HELD = { primary: 'firePrimary', secondary: 'fireSecondary', tertiary: 'fireTertiary' };
  const TIMER = { primary: 'primaryTimer', secondary: 'secondaryTimer', tertiary: 'tertiaryTimer' };
  for (const which of ['tertiary', 'secondary', 'primary']) {
    const wep = p[which];
    if (!wep) continue;
    const held = inp[HELD[which]];
    const timerKey = TIMER[which];
    const countShot = () => { world.stats[`${which}Shots`]++; };

    if (wep.behaviour === 'beam') {
      if (held && p.energy > 0) {
        const drain = wep.energy * dt;
        p.energy = Math.max(0, p.energy - drain);
        p.beamTick[which] -= dt;
        if (p.beamTick[which] <= 0) {
          p.beamTick[which] = 1 / (wep.tickRate || 10);
          countShot();
          fireBeam(world, wep, aim);
        }
      } else {
        p.beamTick[which] = 0;
      }
      continue;
    }

    if (wep.behaviour === 'charge') {
      if (held) {
        const cost = wep.energy * dt;
        if (p.energy >= cost) {
          p.energy -= cost;
          p.charging[which] = Math.min(wep.chargeTime, p.charging[which] + dt);
        }
      } else if (p.charging[which] > 0) {
        countShot();
        releaseCharge(world, wep, aim, p.charging[which] / wep.chargeTime);
        p.charging[which] = 0;
        p[timerKey] = shotInterval(wep);
      }
      continue;
    }

    if (!held || p[timerKey] > 0) continue;
    const cost = wep.energy;
    if (p.energy < cost) {
      // No lockout. Punishing a starved trigger with a cooldown meant the
      // cheap primary won every energy race and the expensive slots could
      // never fire at all while both were held.
      emit(world, { type: 'dryFire' });
      continue;
    }
    p.energy -= cost;
    p[timerKey] = shotInterval(wep) / (p.fireRateBuff || 1);
    countShot();

    if (wep.behaviour === 'drone') launchDrones(world, wep);
    else if (wep.behaviour === 'mine') layMine(world, wep, aim);
    else fireShot(world, wep, aim);
  }
}

/**
 * Deploy escort drones.
 *
 * This behaviour had no implementation: a drone weapon fell through to the
 * bullet path and fired three drone-shaped projectiles that flew off the
 * screen, which is why the Drone Swarm did nothing.
 */
function launchDrones(world, wep) {
  const p = world.player;
  const life = (wep.droneLife ?? 10) * (1 + (p.stats.droneLifePct || 0));
  for (let i = 0; i < (wep.count || 1); i++) {
    addDrone(world, {
      x: p.x - 30, y: p.y - 30 + i * 22, vx: 0, vy: 0, r: 8,
      life,
      fireTimer: i * 0.15,
      fireInterval: 1 / Math.max(0.2, (wep.droneRof ?? 2) * (1 + (p.stats.droneRofPct || 0))),
      damage: wep.droneDamage ?? wep.damage,
      speed: wep.droneSpeed ?? 620,
      sprite: 'drone_combat',
      dead: false,
    });
  }
  emit(world, { type: 'fire', sound: wep.sound, x: p.x, y: p.y });
  emit(world, { type: 'launch', x: p.x, y: p.y });
}

/**
 * Drop a proximity mine behind the ship. Player mines previously spawned as
 * slow bullets that nothing ever triggered.
 */
function layMine(world, wep, aim) {
  const p = world.player;
  world.mines.push({
    x: p.x - 26, y: p.y,
    vx: wep.drift ?? -60, vy: 0,
    r: 8,
    damage: wep.damage,
    radius: wep.radius ?? 96,
    proximity: wep.proximity ?? 62,
    arm: 0.35,
    life: wep.life ?? 12,
    t: 0,
    dead: false,
  });
  emit(world, { type: 'fire', sound: wep.sound, x: p.x, y: p.y });
}

function fireShot(world, wep, aim) {
  const p = world.player;
  const count = wep.count || 1;
  world.stats.shotsFired += count;
  emit(world, { type: 'fire', sound: wep.sound, x: p.x, y: p.y });

  for (let i = 0; i < count; i++) {
    const spread = (wep.spread || 0) * (count > 1 ? (i / Math.max(1, count - 1)) * 2 - 1 : world.rng.float(-1, 1));
    const lateral = wep.offsets ? wep.offsets[i % wep.offsets.length] : 0;
    const a = aim + spread;
    spawnPlayerBullet(world, {
      x: p.x + Math.cos(aim) * 22 - Math.sin(aim) * lateral,
      y: p.y + Math.sin(aim) * 22 + Math.cos(aim) * lateral,
      angle: a,
      wep,
    });
  }
}

function releaseCharge(world, wep, aim, ratio) {
  const p = world.player;
  const mult = 1 + (wep.chargeMult - 1) * ratio;
  world.stats.shotsFired++;
  emit(world, { type: 'fire', sound: wep.sound, x: p.x, y: p.y, charged: ratio });

  if (wep.selfCentred) {
    // A nova detonates on the player rather than travelling.
    explode(world, p.x, p.y, {
      radius: (wep.radius || 120) * (0.6 + 0.4 * ratio),
      damage: wep.damage * mult,
      friendly: true,
    });
    return;
  }
  spawnPlayerBullet(world, {
    x: p.x + Math.cos(aim) * 24, y: p.y + Math.sin(aim) * 24,
    angle: aim, wep, damageMult: mult, scale: 0.7 + ratio * 0.8,
  });
}

function fireBeam(world, wep, aim) {
  const p = world.player;
  const range = wep.range || 600;
  world.stats.shotsFired++;
  // Hitscan: take the nearest target along the ray, within a generous radius.
  let best = null, bestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const rel = distanceToRay(p.x, p.y, aim, e.x, e.y);
    if (rel.along < 0 || rel.along > range) continue;
    if (rel.perp > e.r + 12) continue;
    if (rel.along < bestD) { bestD = rel.along; best = e; }
  }
  emit(world, {
    type: 'beam', x: p.x, y: p.y, angle: aim,
    length: best ? bestD : range, sound: wep.sound,
  });
  if (best) {
    const dmg = wep.damage / (wep.tickRate || 10);
    damageEnemy(world, best, dmg, { weapon: wep });
  }
}

function spawnPlayerBullet(world, { x, y, angle, wep, damageMult = 1, scale = 1 }) {
  const s = world.player.stats;
  const crit = world.rng.chance(s.critChance || 0);
  const damage = wep.damage * damageMult * (crit ? s.critMult : 1);

  world.bullets.push({
    x, y,
    vx: Math.cos(angle) * (wep.speed || 700),
    vy: Math.sin(angle) * (wep.speed || 700),
    angle,
    r: wep.width ? wep.width / 2 : 6,
    damage,
    crit,
    life: wep.life ?? 2,
    sprite: wep.sprite || 'pb_pulse',
    scale,
    behaviour: wep.behaviour,
    pierce: wep.pierce || 0,
    hits: 0,
    hitSet: null,
    radius: wep.radius || 0,
    splashMult: wep.splashMult ?? 0.5,
    proximity: wep.proximity || 0,
    bounces: wep.bounces || 0,
    homing: wep.behaviour === 'homing',
    turnRate: wep.turnRate || 3,
    chains: wep.chains || 0,
    chainRange: wep.chainRange || 170,
    chainFalloff: wep.chainFalloff || 0.7,
    fragments: wep.fragments || 0,
    fragmentDamage: wep.fragmentDamage || 0,
    fragmentSpeed: wep.fragmentSpeed || 300,
    fragmentRadius: wep.fragmentRadius || 0,
    mine: wep.behaviour === 'mine',
    drift: wep.drift || 0,
    pullForce: wep.pullForce || 0,
    tickRate: wep.tickRate || 0,
    // A lingering zone needs its own per-tick number. Reusing `damage` meant
    // the impact payload was re-applied nine times a second to everything
    // inside the radius: the Singularity Bomb was landing 1,586 damage on a
    // single target and 12,233 across a cluster, against 183/1,191 for the
    // weakest weapon in the same slot.
    tickDamage: wep.tickDamage ?? 0,
    tickTimer: 0,
    shieldMult: wep.shieldMult || 1,
    lifesteal: wep.lifesteal || 0,
    dead: false,
  });
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

function activateAbility(world, ab) {
  const p = world.player;
  p.energy -= ab.energy;
  ab.timer = ab.cooldown;
  world.stats.abilitiesUsed++;
  emit(world, { type: 'ability', id: ab.id, x: p.x, y: p.y });

  switch (ab.id) {
    case 'repair_pulse':
      healPlayer(world, p.maxHull * 0.18 * (p.stats.repairPct || 1), 'ability');
      break;
    case 'emp_burst': {
      let cleared = 0;
      for (const b of world.eBullets) {
        if (dist2(b.x, b.y, p.x, p.y) < 220 * 220) { b.dead = true; cleared++; }
      }
      emit(world, { type: 'emp', x: p.x, y: p.y, radius: 220, cleared });
      break;
    }
    case 'phase_shift':
      p.invuln = Math.max(p.invuln, 2.2);
      break;
    case 'overcharge':
      p.fireRateBuff = 1.9;
      p.fireRateBuffTime = 6;
      break;
    case 'decoy':
      world.decoys.push({ x: p.x + 40, y: p.y, r: 16, life: 6, hull: 60, dead: false });
      break;
    case 'nova':
      explode(world, p.x, p.y, { radius: 240, damage: 46 + world.threat * 7, friendly: true });
      break;
    case 'escort_drone':
      addDrone(world, makeDrone(world, p));
      break;
    case 'dilate':
      world.timeScale = 0.45;
      world.slowUntil = world.time + 4;
      break;
    case 'shield_burst':
      p.shield = p.maxShield;
      p.shieldTimer = 0;
      emit(world, { type: 'shieldRestored', x: p.x, y: p.y });
      break;
  }
}

/** Add a drone, retiring the oldest if the wing is already full. */
function addDrone(world, drone) {
  const live = world.drones.filter(d => !d.dead);
  for (let i = 0; i <= live.length - MAX_DRONES; i++) {
    live[i].dead = true;
    emit(world, { type: 'droneExpire', x: live[i].x, y: live[i].y });
  }
  world.drones.push(drone);
}

function makeDrone(world, p) {
  return {
    x: p.x - 30, y: p.y - 30, vx: 0, vy: 0, r: 8,
    life: 10 * (1 + (p.stats.droneLifePct || 0)),
    fireTimer: 0,
    fireInterval: 0.62 / (1 + (p.stats.droneRofPct || 0)),
    // Scaled off the pilot, not the node. Threat-scaled drone damage meant an
    // escort that got stronger the further out of your depth you were, which
    // is exactly backwards: it let a drone clear ships the player could not.
    damage: 11 * (p.stats.damageMult || 1),
    sprite: 'drone_combat', dead: false,
  };
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function updateSpawns(world, dt) {
  const requests = world.spawner.update(dt, world);
  for (const r of requests) world.pendingSpawns.push({ ...r, timer: r.delay || 0 });

  for (const s of world.pendingSpawns) {
    s.timer -= dt;
    if (s.timer <= 0) {
      world.enemies.push(makeEnemy(world, s));
      s.done = true;
    }
  }
  world.pendingSpawns = world.pendingSpawns.filter(s => !s.done);
}

function makeEnemy(world, spec) {
  const def = spec.def;
  const elite = spec.elite;
  // Elites stack on top of class toughness and any encounter threatBonus, so
  // this stays modest — at 2.2 a flagged elite capital ship was unkillable.
  const mul = elite ? 1.7 : 1;
  const e = {
    def,
    id: def.id,
    name: elite ? `Elite ${def.name}` : def.name,
    x: spec.x, y: spec.y,
    vx: 0, vy: 0,
    drawScale: (elite || spec.def.isBoss) ? 2 : 1,
    r: Math.max(def.w, def.h) * 0.36 * ((elite || spec.def.isBoss) ? 1.8 : 1),
    w: def.w, h: def.h,
    sprite: def.sprite,
    elite,

    hull: def.hull * mul,
    maxHull: def.hull * mul,
    shield: (def.shield || 0) * mul,
    maxShield: (def.shield || 0) * mul,
    shieldTimer: 0,
    armour: def.armour || 0,

    speed: def.speed,
    move: MOVEMENTS[def.move] ? def.move : 'straight',
    fire: FIRE_PATTERNS[def.fire] ? def.fire : 'none',
    fireRate: def.fireRate || 0,
    fireTimer: world.rng.float(0.3, 1.6) / Math.max(0.1, def.fireRate || 1),
    bulletDamage: def.bulletDamage * mul,
    bulletSpeed: def.bulletSpeed || 280,
    bulletSprite: def.bulletSprite || 'eb_bolt',
    contact: def.contact * mul,

    xp: Math.round(def.xp * mul),
    credits: Math.round(def.credits * mul),

    aura: def.aura || null,
    spawns: def.spawns ? { ...def.spawns, timer: def.spawns.interval, made: 0 } : null,
    splits: def.splits || null,
    explodes: def.explodes || null,
    cloak: def.cloak ? { ...def.cloak, t: world.rng.float(0, def.cloak.period), hidden: false } : null,
    isBoss: !!spec.def.isBoss,
    tag: spec.tag,

    shieldAura: 0,
    hitFlash: 0,
    mem: {
      phase: world.rng.float(0, Math.PI * 2),
      holdJitter: world.rng.float(-0.08, 0.12),
      slotX: spec.slotX, slotY: spec.slotY,
      rng: () => world.rng.next(),
    },
    dead: false,
  };
  world.stats.spawned++;
  emit(world, { type: 'enemySpawn', x: e.x, y: e.y, cls: def.cls });
  return e;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

function updateEnemies(world, dt) {
  // Reset auras, then re-apply from live sources this frame.
  for (const e of world.enemies) e.shieldAura = 0;
  for (const src of world.enemies) {
    if (!src.aura || src.dead) continue;
    for (const e of world.enemies) {
      if (e === src || e.dead) continue;
      if (dist2(e.x, e.y, src.x, src.y) <= src.aura.radius * src.aura.radius) {
        e.shieldAura = Math.max(e.shieldAura, src.aura.amount);
      }
    }
  }

  for (const e of world.enemies) {
    if (e.dead) continue;

    (MOVEMENTS[e.move] || MOVEMENTS.straight)(e, world, dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);

    // Bounce off the vertical edges rather than sailing off them.
    if (e.y < 14 && e.vy < 0) { e.y = 14; e.vy = Math.abs(e.vy) * 0.6; }
    if (e.y > world.h - 14 && e.vy > 0) { e.y = world.h - 14; e.vy = -Math.abs(e.vy) * 0.6; }

    if (e.shieldTimer > 0) e.shieldTimer -= dt;
    else if (e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.06 * dt);

    if (e.cloak) {
      e.cloak.t += dt;
      const cycle = e.cloak.period + e.cloak.duration;
      e.cloak.hidden = (e.cloak.t % cycle) > e.cloak.period;
    }

    if (e.spawns && e.spawns.made < e.spawns.max) {
      e.spawns.timer -= dt;
      if (e.spawns.timer <= 0) {
        e.spawns.timer = e.spawns.interval;
        for (let i = 0; i < e.spawns.count && e.spawns.made < e.spawns.max; i++) {
          e.spawns.made++;
          world.pendingSpawns.push({
            def: scaleFromParent(e, e.spawns.id, world),
            x: e.x, y: e.y + (i - 0.5) * 24, timer: 0,
          });
        }
        emit(world, { type: 'launch', x: e.x, y: e.y });
      }
    }

    // Fire.
    if (e.fireRate > 0 && !(e.cloak && e.cloak.hidden)) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.x < world.w + 30 && e.x > -40) {
        e.fireTimer = 1 / e.fireRate;
        const specs = (FIRE_PATTERNS[e.fire] || FIRE_PATTERNS.none)(e, world);
        for (const spec of specs) {
          if (spec.zone) spawnZone(world, e, spec);
          else if (spec.beam) spawnBeam(world, e, spec);
          else spawnEnemyBullet(world, e, spec);
        }
        if (specs.length) emit(world, { type: 'enemyFire', x: e.x, y: e.y, count: specs.length });
      }
    }

    // Once the script is spent, surviving stragglers close in. Several
    // behaviours (hover, mirror, guard) hold station indefinitely, so a
    // "clear" objective could otherwise sit unwinnable until the timeout with
    // the last enemy parked out of reach.
    e.age = (e.age || 0) + dt;
    if (world.spawner.exhausted && e.age > 25) {
      e.x -= 26 * dt;
      if (e.holdX != null) e.holdX = Math.min(e.holdX, world.w * 0.45);
    }

    // A capital ship does not get to wander off. Culling one for leaving the
    // field resolved the boss objective as a win: `boss_famine_late_model`
    // ended in three seconds with nothing killed, because the reaper flew out
    // of the left edge and the objective saw no boss alive. Anything the
    // objective is watching gets turned around instead.
    if (e.isBoss || e.tag) {
      // Contained on BOTH sides. Clamping only the left let capital ships
      // drift away to the right instead — one was found at x=66961 on a field
      // a thousand wide — where nothing could reach it and the encounter could
      // never end. That was most of the stalled fights.
      if (e.x < world.w * 0.12) {
        e.x = world.w * 0.12;
        e.vx = Math.abs(e.vx || 0);
        if (e.holdX != null) e.holdX = Math.max(e.holdX, world.w * 0.35);
      } else if (e.x > world.w * 0.94) {
        e.x = world.w * 0.94;
        e.vx = -Math.abs(e.vx || 0);
        if (e.holdX != null) e.holdX = Math.min(e.holdX, world.w * 0.75);
      }
      e.y = clamp(e.y, 16, world.h - 16);
      continue;
    }

    if (e.x < -CULL || e.x > world.w + CULL * 4) {
      // When the objective is to kill them, they do not get to simply leave.
      //
      // This was the single biggest reason fights cost nothing: measured at
      // threat 8, encounters were routinely resolving with a handful of kills
      // out of dozens spawned — `splitter_bloom` killed 1 of 17, and
      // `outrun_the_swarm` 3 of 81 — because the rest streamed past the player
      // and off the left edge. You did not beat the fight, you outlasted it.
      // Now they come round for another pass, and a clear means a clear.
      //
      // Objectives you are running FROM rather than through are exempt: being
      // overtaken is the point of a chase.
      // Bounded, or an enemy the player cannot reach loops forever and the
      // encounter never ends: unbounded wrapping stalled 5-8% of deep fights.
      if (killObjective(world) && e.x < 0 && (e.passes || 0) < MAX_PASSES) {
        e.x = world.w + 60 + world.rng.float(0, 90);
        e.y = clamp(world.rng.float(world.h * 0.12, world.h * 0.88), 20, world.h - 20);
        e.holdX = null;
        e.passes = (e.passes || 0) + 1;
        world.stats.rounded++;
        continue;
      }
      e.dead = true;
      e.escaped = true;
      world.stats.escaped++;
    }
  }
}

/**
 * Build a spawned add (carrier drones, splitter halves) at the parent's threat.
 *
 * Adds are deliberately weaker than a naturally-spawned enemy of the same
 * threat: a carrier that endlessly produces full-strength escorts is a stalemate
 * rather than a fight.
 */
function scaleFromParent(parent, id, world) {
  const src = ENEMIES[id] || ENEMIES.picket;
  const ratio = parent.def.hull ? parent.maxHull / parent.def.hull : 1;
  return {
    ...src,
    hull: Math.round(src.hull * ratio),
    shield: Math.round((src.shield || 0) * ratio),
    bulletDamage: (src.bulletDamage || 0) * ratio * 0.6,
    contact: (src.contact || 0) * ratio * 0.6,
    xp: Math.round(src.xp * ratio * 0.6),
    credits: Math.round(src.credits * ratio * 0.6),
  };
}

function spawnZone(world, e, spec) {
  const z = spec.zone;
  world.zones.push({
    x: spec.x ?? e.x, y: spec.y ?? e.y,
    vx: z.vx ?? 0, vy: z.vy ?? 0,
    r: z.r ?? 90,
    maxR: z.maxR ?? null,
    growth: z.growth ?? 0,
    dps: (z.dps ?? 12) * (e.bulletDamage / Math.max(1, e.def.bulletDamage || 1) || 1),
    life: z.life ?? 6,
    arm: z.arm ?? 0.6,
    kind: z.kind || 'burn',
    owner: z.anchored ? e : null,
    t: 0, tick: 0, dead: false,
  });
  emit(world, { type: 'zoneSpawn', x: spec.x ?? e.x, y: spec.y ?? e.y });
}

function spawnBeam(world, e, spec) {
  const b = spec.beam;
  world.beams.push({
    x: e.x, y: e.y,
    angle: spec.angle ?? Math.PI,
    length: b.length ?? 1200,
    width: b.width ?? 22,
    damage: (b.damage ?? 3) * (e.bulletDamage || 1),
    telegraph: b.telegraph ?? 1.1,
    linger: b.linger ?? 0.35,
    track: b.track !== false,
    owner: b.anchored === false ? null : e,
    t: 0, fired: false, dead: false,
  });
  emit(world, { type: 'beamCharge', x: e.x, y: e.y });
}

function spawnEnemyBullet(world, e, spec) {
  const speed = spec.speed ?? 280;
  world.eBullets.push({
    x: spec.x ?? e.x, y: spec.y ?? e.y,
    vx: Math.cos(spec.angle) * speed,
    vy: Math.sin(spec.angle) * speed,
    angle: spec.angle,
    r: spec.mine ? 8 : 5,
    damage: spec.damage ?? e.bulletDamage,
    life: spec.life ?? 4,
    sprite: spec.sprite || 'eb_bolt',
    homing: !!spec.homing,
    turnRate: spec.turnRate || 2,
    radius: spec.radius || 0,
    mine: !!spec.mine,
    proximity: spec.proximity || 0,
    delay: spec.delay || 0,
    dead: false,
  });
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

function updateBullets(world, dt) {
  const p = world.player;

  for (const b of world.bullets) {
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) {
      if (b.fragments) fragment(world, b, true);
      b.dead = true;
      continue;
    }

    if (b.homing) steerTowards(b, nearestEnemy(world, b.x, b.y), dt);

    if (b.mine) {
      b.vx = b.drift || -40;
      b.vy *= 0.9;
    }

    // Area weapons that pull (vortex, gravity well) act while in flight.
    if (b.pullForce) {
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d > b.radius || d < 1) continue;
        const f = b.pullForce * (1 - d / b.radius) * dt;
        e.x -= ((e.x - b.x) / d) * f * dt;
        e.y -= ((e.y - b.y) / d) * f * dt;
      }
      if (b.tickRate && b.tickDamage > 0) {
        b.tickTimer -= dt;
        if (b.tickTimer <= 0) {
          b.tickTimer = 1 / b.tickRate;
          for (const e of world.enemies) {
            if (!e.dead && dist2(e.x, e.y, b.x, b.y) < b.radius * b.radius) {
              damageEnemy(world, e, b.tickDamage, { silent: true });
            }
          }
        }
      }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.bounces > 0) {
      if (b.y < 6 && b.vy < 0) { b.y = 6; b.vy = -b.vy; b.bounces--; }
      else if (b.y > world.h - 6 && b.vy > 0) { b.y = world.h - 6; b.vy = -b.vy; b.bounces--; }
    }

    if (world.corridor && !b.mine && world.corridor.collides(b.x + world.scrollX, b.y, b.r)) {
      if (b.radius) explode(world, b.x, b.y, { radius: b.radius, damage: b.damage * b.splashMult, friendly: true });
      emit(world, { type: 'hitTerrain', x: b.x, y: b.y });
      b.dead = true;
      continue;
    }

    if (b.x < -CULL || b.x > world.w + CULL || b.y < -CULL || b.y > world.h + CULL) b.dead = true;
  }

  for (const b of world.eBullets) {
    if (b.dead) continue;
    if (b.delay > 0) { b.delay -= dt; continue; }
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }

    if (b.homing) steerTowards(b, p, dt);
    if (b.mine) { b.vx *= 0.96; b.vy *= 0.96; }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (world.corridor && world.corridor.collides(b.x + world.scrollX, b.y, b.r)) { b.dead = true; continue; }
    if (b.x < -CULL || b.x > world.w + CULL || b.y < -CULL || b.y > world.h + CULL) b.dead = true;
  }
}

function steerTowards(b, target, dt) {
  if (!target || target.dead) return;
  const want = Math.atan2(target.y - b.y, target.x - b.x);
  let diff = want - b.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  b.angle += clamp(diff, -b.turnRate * dt, b.turnRate * dt);
  const sp = Math.hypot(b.vx, b.vy);
  b.vx = Math.cos(b.angle) * sp;
  b.vy = Math.sin(b.angle) * sp;
}

function fragment(world, b, expired) {
  const n = b.fragments;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + world.rng.float(0, 0.6);
    world.bullets.push({
      x: b.x, y: b.y,
      vx: Math.cos(a) * b.fragmentSpeed,
      vy: Math.sin(a) * b.fragmentSpeed,
      angle: a, r: 5,
      damage: b.fragmentDamage,
      life: 0.9,
      sprite: 'pb_scatter',
      scale: 1,
      behaviour: 'bullet',
      pierce: 0, hits: 0,
      radius: b.fragmentRadius || 0,
      splashMult: 0.6,
      dead: false,
    });
  }
  emit(world, { type: 'fragment', x: b.x, y: b.y });
}

// ---------------------------------------------------------------------------
// Drones, obstacles, pickups, effects
// ---------------------------------------------------------------------------

function updateDrones(world, dt) {
  const p = world.player;
  for (const d of world.drones) {
    if (d.dead) continue;
    d.life -= dt;
    if (d.life <= 0) { d.dead = true; emit(world, { type: 'droneExpire', x: d.x, y: d.y }); continue; }

    // Loose formation on the player's wing.
    d.slot = d.slot ?? (world.drones.indexOf(d) % 4);
    const ring = (world.time * 0.8 + d.slot * (Math.PI / 2));
    const tx = p.x - 30 + Math.cos(ring) * 26;
    const ty = p.y + Math.sin(ring) * 30;
    d.vx += (tx - d.x) * 5 * dt;
    d.vy += (ty - d.y) * 5 * dt;
    d.vx *= 0.9; d.vy *= 0.9;
    d.x += d.vx * dt; d.y += d.vy * dt;

    d.fireTimer -= dt;
    const target = nearestEnemy(world, d.x, d.y);
    if (d.fireTimer <= 0 && target) {
      d.fireTimer = d.fireInterval || 0.45;
      const a = Math.atan2(target.y - d.y, target.x - d.x);
      const ds = d.speed || 640;
      world.bullets.push({
        x: d.x, y: d.y, vx: Math.cos(a) * ds, vy: Math.sin(a) * ds, angle: a,
        r: 5, damage: d.damage, life: 1.4, sprite: 'pb_pulse', scale: 1,
        behaviour: 'bullet', pierce: 0, hits: 0, radius: 0, splashMult: 0, dead: false,
      });
    }
  }

  for (const d of world.decoys) {
    if (d.dead) continue;
    d.life -= dt;
    if (d.life <= 0 || d.hull <= 0) { d.dead = true; }
  }
}

function updateObstacles(world, dt) {
  for (const o of world.obstacles) {
    if (o.dead) continue;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.rot = (o.rot || 0) + (o.spin || 0) * dt;
    if (o.y < 10 && o.vy < 0) o.vy = -o.vy;
    if (o.y > world.h - 10 && o.vy > 0) o.vy = -o.vy;
    if (o.x < -CULL) o.dead = true;
  }
}

function updatePickups(world, dt) {
  const p = world.player;
  const range = p.stats.pickupRange;
  for (const pk of world.pickups) {
    if (pk.dead) continue;
    pk.life -= dt;
    if (pk.life <= 0) { pk.dead = true; continue; }

    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < range) {
      // Magnetised: accelerate toward the player once in range.
      const s = p.stats.magnetSpeed * dt;
      pk.x += ((p.x - pk.x) / (d || 1)) * s;
      pk.y += ((p.y - pk.y) / (d || 1)) * s;
    } else {
      pk.x += (pk.vx || -40) * dt;
      pk.y += (pk.vy || 0) * dt;
    }

    if (d < p.r + 12) {
      collect(world, pk);
      pk.dead = true;
    }
  }
}

function collect(world, pk) {
  const p = world.player;
  world.stats.pickupsTaken++;
  switch (pk.kind) {
    case 'energy': p.energy = Math.min(p.maxEnergy, p.energy + pk.amount); break;
    case 'repair': healPlayer(world, pk.amount, 'pickup'); break;
    case 'shield': p.shield = Math.min(p.maxShield, p.shield + pk.amount); break;
    case 'credits': world.stats.creditsEarned += pk.amount; break;
    case 'xp': world.stats.xpEarned += pk.amount; break;
    case 'crate': world.stats.crates = (world.stats.crates || 0) + 1; break;
  }
  emit(world, { type: 'pickup', kind: pk.kind, x: pk.x, y: pk.y, amount: pk.amount });
}

export function dropPickup(world, x, y, kind, amount, opts = {}) {
  world.pickups.push({
    x, y, kind, amount,
    vx: opts.vx ?? world.rng.float(-70, -20),
    vy: opts.vy ?? world.rng.float(-40, 40),
    life: opts.life ?? 11,
    sprite: {
      energy: 'pu_energy', repair: 'pu_repair', credits: 'pu_credits',
      shield: 'pu_shield', xp: 'pu_xp', crate: 'pu_crate', ammo: 'pu_ammo',
    }[kind] || 'pu_energy',
    dead: false,
  });
}

/**
 * Persistent area denial. A zone is space you cannot occupy rather than a
 * projectile you dodge, which forces repositioning instead of reflexes.
 */
/** Player-laid proximity mines: they arm, they wait, they detonate. */
function updateMines(world, dt) {
  for (const m of world.mines) {
    if (m.dead) continue;
    m.t += dt;
    m.life -= dt;
    if (m.life <= 0) { m.dead = true; continue; }

    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vx *= 0.985;
    if (m.x < -CULL) { m.dead = true; continue; }
    if (m.t < m.arm) continue;

    for (const e of world.enemies) {
      if (e.dead || (e.cloak && e.cloak.hidden)) continue;
      if (dist2(e.x, e.y, m.x, m.y) > m.proximity * m.proximity) continue;
      explode(world, m.x, m.y, { radius: m.radius, damage: m.damage, friendly: true });
      m.dead = true;
      break;
    }
  }
}

function updateZones(world, dt) {
  const p = world.player;
  for (const z of world.zones) {
    if (z.dead) continue;
    z.t += dt;
    z.life -= dt;
    if (z.life <= 0) { z.dead = true; continue; }

    // Zones anchored to a ship follow it; free ones drift with the field.
    if (z.owner && !z.owner.dead) { z.x = z.owner.x; z.y = z.owner.y; }
    else { z.x += (z.vx || 0) * dt; z.y += (z.vy || 0) * dt; }
    if (z.growth) z.r = Math.min(z.maxR ?? Infinity, z.r + z.growth * dt);

    // A short arming delay makes a zone a warning before it is a wall.
    if (z.t < (z.arm || 0)) continue;
    if (dist2(p.x, p.y, z.x, z.y) < z.r * z.r) {
      z.tick = (z.tick || 0) - dt;
      if (z.tick <= 0) {
        z.tick = 0.25;
        damagePlayer(world, z.dps * 0.25, { source: 'zone' });
      }
    }
  }
}

/**
 * Telegraphed beams: a warning line, then a wall of damage along it. The
 * telegraph is the whole point — it is dodged by reading, not by reacting.
 */
function updateBeams(world, dt) {
  const p = world.player;
  for (const b of world.beams) {
    if (b.dead) continue;
    b.t += dt;

    // Track the target until it fires, then lock.
    if (b.t < b.telegraph && b.track) {
      b.angle = Math.atan2(p.y - b.y, p.x - b.x);
    }
    if (b.owner && !b.owner.dead) { b.x = b.owner.x; b.y = b.owner.y; }

    if (b.t >= b.telegraph && !b.fired) {
      b.fired = true;
      emit(world, { type: 'enemyBeam', x: b.x, y: b.y, angle: b.angle, length: b.length });
      const rel = distanceToRay(b.x, b.y, b.angle, p.x, p.y);
      if (rel.along > 0 && rel.along < b.length && rel.perp < b.width / 2 + p.r) {
        damagePlayer(world, b.damage, { source: 'beam' });
      }
    }
    if (b.t > b.telegraph + (b.linger || 0.35)) b.dead = true;
  }
}

function updateEffects(world, dt) {
  for (const fx of world.effects) {
    if (fx.dead) continue;
    fx.t += dt;
    if (fx.t >= fx.dur) fx.dead = true;
  }
}

// ---------------------------------------------------------------------------
// Collision and damage
// ---------------------------------------------------------------------------

function resolveCollisions(world, dt) {
  const p = world.player;

  // Player bullets vs enemies / obstacles / decoys.
  for (const b of world.bullets) {
    if (b.dead) continue;

    for (const e of world.enemies) {
      if (e.dead || (e.cloak && e.cloak.hidden)) continue;
      const rr = (b.r + e.r);
      if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
      if (b.pierce > 0) {
        b.hitSet = b.hitSet || new Set();
        if (b.hitSet.has(e)) continue;
        b.hitSet.add(e);
      }
      hitEnemyWithBullet(world, b, e);
      if (b.dead) break;
    }
    if (b.dead) continue;

    for (const o of world.obstacles) {
      if (o.dead) continue;
      const rr = b.r + o.size * 0.45;
      if (dist2(b.x, b.y, o.x, o.y) > rr * rr) continue;
      o.hull -= b.damage;
      world.stats.shotsHit++;
      emit(world, { type: 'hit', x: b.x, y: b.y, crit: b.crit });
      if (o.hull <= 0) {
        o.dead = true;
        emit(world, { type: 'explode', x: o.x, y: o.y, size: o.size });
        if (world.rng.chance(0.25)) dropPickup(world, o.x, o.y, 'credits', 3 + world.threat);
      }
      if (b.radius) explode(world, b.x, b.y, { radius: b.radius, damage: b.damage * b.splashMult, friendly: true });
      if (b.pierce <= 0) b.dead = true;
      break;
    }
  }

  // Enemy bullets vs player and decoys.
  for (const b of world.eBullets) {
    if (b.dead || b.delay > 0) continue;

    let hitDecoy = false;
    for (const d of world.decoys) {
      if (d.dead) continue;
      const rr = b.r + d.r;
      if (dist2(b.x, b.y, d.x, d.y) <= rr * rr) {
        d.hull -= b.damage;
        b.dead = true;
        hitDecoy = true;
        emit(world, { type: 'hit', x: b.x, y: b.y });
        break;
      }
    }
    if (hitDecoy) continue;

    if (b.mine && b.proximity) {
      if (dist2(b.x, b.y, p.x, p.y) < b.proximity * b.proximity) {
        explode(world, b.x, b.y, { radius: b.radius, damage: b.damage, friendly: false });
        b.dead = true;
        continue;
      }
    }

    const rr = b.r + p.r;
    if (dist2(b.x, b.y, p.x, p.y) <= rr * rr) {
      if (b.radius) explode(world, b.x, b.y, { radius: b.radius, damage: b.damage, friendly: false });
      else damagePlayer(world, b.damage, { source: 'bullet' });
      b.dead = true;
    }
  }

  // Contact damage, as discrete hits on a per-enemy cooldown. Draining hull
  // continuously while overlapping is unreadable and lethally punishing — a
  // brush against a swarm deleted a full hull bar in under a second.
  for (const e of world.enemies) {
    if (e.dead || (e.cloak && e.cloak.hidden)) continue;
    e.contactCd = Math.max(0, (e.contactCd || 0) - dt);
    const rr = e.r + p.r;
    if (dist2(e.x, e.y, p.x, p.y) > rr * rr) continue;
    if (e.contactCd > 0) continue;
    e.contactCd = 0.6;
    const reduce = 1 - clamp(p.stats.contactArmour || 0, 0, 0.85);
    damagePlayer(world, e.contact * reduce, { source: 'contact' });
    // Ramming hulls turn a collision into an attack rather than a mistake.
    if (p.stats.ramDamage) damageEnemy(world, e, p.stats.ramDamage, { silent: true, ram: true });
    if (p.stats.thorns) damageEnemy(world, e, p.stats.thorns, { silent: true, ram: true });
  }

  for (const o of world.obstacles) {
    if (o.dead) continue;
    const rr = o.size * 0.45 + p.r;
    if (dist2(o.x, o.y, p.x, p.y) > rr * rr) continue;
    const reduce = 1 - clamp(p.stats.contactArmour || 0, 0, 0.85);
    // Rocks were authored as flat damage, so a belt that could kill a starting
    // hull was free by ring ten. Scale with the node's threat, then cap any one
    // impact at a slice of the hull so an early field cannot cascade into a
    // death from full.
    const rock = Math.min(o.contact * (1 + world.threat * 0.075), p.maxHull * 0.07);
    damagePlayer(world, rock * reduce, { source: 'obstacle' });
    o.dead = true;
    emit(world, { type: 'explode', x: o.x, y: o.y, size: o.size });
  }

  // Drone-vs-enemy contact is ignored on purpose: drones are a damage source,
  // not a body, and colliding them made them die instantly in swarms.
}

function hitEnemyWithBullet(world, b, e) {
  world.stats.shotsHit++;
  const mult = e.shield > 0 ? (b.shieldMult || 1) : 1;
  damageEnemy(world, e, b.damage * mult, { weapon: b, crit: b.crit });

  const steal = (b.lifesteal || 0) + (world.player.stats.lifesteal || 0);
  if (steal > 0) drainLifesteal(world, b.damage * steal);

  if (b.radius) {
    explode(world, b.x, b.y, { radius: b.radius, damage: b.damage * b.splashMult, friendly: true, except: e });
  }
  if (b.chains > 0) chainFrom(world, b, e);
  if (b.fragments) fragment(world, b, false);

  emit(world, { type: 'hit', x: b.x, y: b.y, crit: b.crit });

  if (b.pierce > 0) {
    b.hits++;
    if (b.hits > b.pierce) b.dead = true;
  } else {
    b.dead = true;
  }
}

function chainFrom(world, b, from) {
  let current = from;
  let damage = b.damage * b.chainFalloff;
  const hit = new Set([from]);
  for (let i = 0; i < b.chains; i++) {
    let best = null, bestD = Infinity;
    for (const e of world.enemies) {
      if (e.dead || hit.has(e)) continue;
      const d = dist2(e.x, e.y, current.x, current.y);
      if (d < bestD && d < b.chainRange * b.chainRange) { bestD = d; best = e; }
    }
    if (!best) break;
    emit(world, { type: 'chain', x1: current.x, y1: current.y, x2: best.x, y2: best.y });
    damageEnemy(world, best, damage, { silent: true });
    hit.add(best);
    current = best;
    damage *= b.chainFalloff;
  }
}

export function explode(world, x, y, { radius, damage, friendly, except = null }) {
  emit(world, { type: 'explode', x, y, size: radius });
  if (friendly) {
    for (const e of world.enemies) {
      if (e.dead || e === except) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > radius) continue;
      damageEnemy(world, e, damage * (1 - d / radius * 0.55), { silent: true });
    }
    for (const o of world.obstacles) {
      if (o.dead) continue;
      if (Math.hypot(o.x - x, o.y - y) < radius) { o.hull -= damage; if (o.hull <= 0) o.dead = true; }
    }
  } else {
    const p = world.player;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) damagePlayer(world, damage * (1 - d / radius * 0.5), { source: 'explosion' });
  }
}

export function damageEnemy(world, e, amount, opts = {}) {
  if (e.dead || amount <= 0) return 0;

  // An aura from a nearby support ship soaks a fraction before anything else.
  let dmg = amount * (1 - (e.shieldAura || 0));
  dmg *= (1 - (e.armour || 0));

  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
    e.shieldTimer = 2.5;
    if (!opts.silent) emit(world, { type: 'shieldHit', x: e.x, y: e.y });
  }

  if (dmg > 0) {
    e.hull -= dmg;
    e.hitFlash = 1;
  }
  world.stats.damageDealt += amount;

  if (e.hull <= 0) killEnemy(world, e, opts);
  return amount;
}

function killEnemy(world, e, opts = {}) {
  if (e.dead) return;
  e.dead = true;
  world.stats.kills++;
  // A collision kill is its own achievement track, and capital kills are worth
  // counting separately from the swarm around them.
  if (opts.ram) world.stats.rammed++;
  if (e.isBoss) world.stats.bossKills++;

  // Hull perks that pay out on a kill. Both are rate-limited the same way
  // lifesteal is, so a swarm encounter cannot become free healing.
  const p = world.player;
  if (p.stats.killHeal) drainLifesteal(world, p.maxHull * p.stats.killHeal);
  if (p.stats.killShield && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + p.maxShield * p.stats.killShield);
    p.shieldTimer = Math.max(0, p.shieldTimer - 0.4);
    emit(world, { type: 'shieldRestored', x: p.x, y: p.y, small: true });
  }
  world.stats.xpEarned += e.xp;
  world.stats.creditsEarned += e.credits;

  emit(world, {
    type: 'explode', x: e.x, y: e.y,
    size: Math.max(e.w, e.h) * (e.isBoss ? 3 : 1),
    big: e.cls === 'heavy' || e.elite || e.isBoss,
  });
  emit(world, { type: 'kill', id: e.id, x: e.x, y: e.y, boss: e.isBoss, elite: e.elite });

  if (e.explodes) {
    explode(world, e.x, e.y, { radius: e.explodes.radius, damage: e.explodes.damage, friendly: false });
  }

  if (e.splits) {
    for (let i = 0; i < e.splits.count; i++) {
      world.pendingSpawns.push({
        def: scaleFromParent(e, e.splits.into, world),
        x: e.x, y: e.y + (i - (e.splits.count - 1) / 2) * 22, timer: 0,
      });
    }
  }

  // Drops. Energy is common because running dry is the main failure state of a
  // long fight. Repair drops are the run's main attrition valve: hull persists
  // between nodes and shops are only ~6% of the map, so at a 7% drop rate a run
  // simply bled out around ring 5 no matter how well it was played. Amounts are
  // a fraction of max hull so they stay relevant at level 20.
  const r = world.rng;
  if (r.chance(0.30)) dropPickup(world, e.x, e.y, 'energy', 12 + world.threat);
  // Repair drops were 16% of every kill at 5% of max hull. A thirty-kill fight
  // therefore handed back a quarter of the hull bar for free, which is most of
  // the reason four fights in five cost nothing at all. Rarer and smaller: a
  // lucky reprieve rather than an income stream.
  if (r.chance(DEFENCE_TUNING.repairDropChance)) {
    dropPickup(world, e.x, e.y, 'repair', Math.round(p.maxHull * DEFENCE_TUNING.repairDropFraction));
  }
  if (r.chance(0.14)) dropPickup(world, e.x, e.y, 'shield', Math.round(p.maxShield * 0.25));
  if (r.chance(0.22)) dropPickup(world, e.x, e.y, 'credits', Math.round(e.credits * 0.5));
  if (e.elite || e.isBoss || r.chance(0.05)) dropPickup(world, e.x, e.y, 'crate', 1);
}

export function damagePlayer(world, amount, opts = {}) {
  const p = world.player;
  if (p.invuln > 0 || amount <= 0 || world.state !== 'playing') return 0;

  // Static Screen: one hit in every N seconds simply does not land.
  if (p.stats.negateEvery && p.negateTimer <= 0) {
    p.negateTimer = p.stats.negateEvery;
    emit(world, { type: 'negated', x: p.x, y: p.y });
    return 0;
  }

  let dmg = amount;
  if (p.shield > 0) {
    // A shield stops most of a hit, never all of it. Full absorption made
    // every non-lethal fight free — 80% of them cost no hull at all — so
    // damage was either nothing or death with nothing in between.
    const leak = clamp(p.stats.shieldLeak ?? 0.18, 0, 1);
    const absorbed = Math.min(p.shield, dmg * (1 - leak));
    p.shield -= absorbed;
    dmg -= absorbed;
    emit(world, { type: 'playerShieldHit', x: p.x, y: p.y });
  }
  p.shieldTimer = p.stats.shieldDelay;

  if (dmg > 0) {
    p.hull -= dmg;
    p.hitFlash = 1;
    emit(world, { type: 'playerHit', x: p.x, y: p.y, amount: dmg });
    if (p.hull <= 0) {
      p.hull = 0;
      world.state = 'lost';
      world.outcome = 'destroyed';
      emit(world, { type: 'playerDestroyed', x: p.x, y: p.y });
    }
  }
  world.stats.damageTaken += amount;
  return amount;
}

/**
 * Heal from lifesteal, spending the per-second budget.
 *
 * Lifesteal is a percentage of damage dealt, and damage compounds across a run
 * — so uncapped it stops being a trickle and becomes immortality. The budget
 * keeps it a meaningful trickle at every power level.
 */
function drainLifesteal(world, want) {
  const p = world.player;
  const left = p.maxHull * DEFENCE_TUNING.lifestealPerEncounter - p.lifestealSpent;
  const got = Math.min(want, p.lifestealBudget, Math.max(0, left));
  if (got <= 0) return 0;
  p.lifestealBudget -= got;
  const healed = healPlayer(world, got, 'lifesteal');
  p.lifestealSpent += healed;
  return healed;
}

export function healPlayer(world, amount, source = 'other') {
  const p = world.player;
  // Every source draws on the same allowance. See balance.js: capping them one
  // at a time simply moved the healing to whichever was left uncapped.
  const left = p.maxHull * DEFENCE_TUNING.healPerEncounter - (world.stats.healed || 0);
  const give = Math.min(amount, Math.max(0, left));
  if (give <= 0) return 0;
  const before = p.hull;
  p.hull = Math.min(p.maxHull, p.hull + give);
  const got = p.hull - before;
  if (got > 0) {
    world.stats.healed += got;
    const key = { pickup: 'healedPickup', lifesteal: 'healedLifesteal', ability: 'healedAbility' }[source];
    if (key) world.stats[key] += got;
    emit(world, { type: 'heal', x: p.x, y: p.y, amount: got });
  }
  return got;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

function checkObjective(world) {
  if (world.state !== 'playing') return;
  const obj = world.encounter.objective || { kind: 'clear' };

  switch (obj.kind) {
    case 'clear':
      if (world.spawner.isComplete(world)) win(world);
      break;
    case 'survive':
      if (world.time >= (obj.seconds || 60)) win(world);
      break;
    case 'reach':
      if (world.scrollX >= (obj.distance ?? (world.corridor?.pixelLength ?? 8000) - world.w)) win(world);
      break;
    // Killing the target ENDS the fight. Requiring the whole script to be
    // exhausted meant a boss that died before a later timed wave fired left you
    // mopping up escorts over its wreckage, and if no wave ever fired the
    // encounter could not be won at all.
    case 'boss':
      if (targetResolved(world, e => e.isBoss || e.tag === 'boss', 'boss')) win(world);
      break;
    case 'destroy':
      if (targetResolved(world, e => e.tag === obj.tag, obj.tag)) win(world);
      break;
    default:
      if (world.spawner.isComplete(world)) win(world);
  }

  // A timed failure, for escort/defence encounters.
  if (obj.timeLimit && world.time > obj.timeLimit) {
    world.state = 'lost';
    world.outcome = 'timeout';
  }
}

/** Objectives where leaving the field would be a way of winning by default. */
function killObjective(world) {
  const kind = world.encounter.objective?.kind ?? 'clear';
  return kind === 'clear' || kind === 'boss' || kind === 'destroy';
}

/**
 * Has the tagged target been dealt with?
 *
 * True once its wave has fired, nothing matching is alive, and nothing matching
 * is still queued to arrive. Deliberately independent of the rest of the
 * script: the objective is the target, not the crowd around it.
 */
function targetResolved(world, match, tag) {
  const fired = world.spawner.waves.some(w =>
    w.fired && (w.spawn || []).some(g => g.tag === tag));
  if (!fired) return false;
  if (world.enemies.some(e => !e.dead && match(e))) return false;
  if (world.pendingSpawns.some(s => s.tag === tag)) return false;
  return true;
}

function win(world) {
  world.state = 'won';
  world.outcome = 'cleared';
  emit(world, { type: 'encounterCleared' });
}

/** Force an outcome — used when the player chooses to disengage. */
export function retreat(world) {
  if (world.state !== 'playing') return;
  world.state = 'lost';
  world.outcome = 'fled';
  emit(world, { type: 'fled' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compact(world) {
  for (const key of ['enemies', 'bullets', 'eBullets', 'obstacles', 'pickups', 'drones', 'decoys', 'effects', 'zones', 'beams', 'mines']) {
    const arr = world[key];
    if (arr.some(x => x.dead)) world[key] = arr.filter(x => !x.dead);
  }
}

function nearestEnemy(world, x, y) {
  let best = null, bestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead || (e.cloak && e.cloak.hidden)) continue;
    const d = dist2(e.x, e.y, x, y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function distanceToRay(ox, oy, angle, px, py) {
  const dx = px - ox, dy = py - oy;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  return { along, perp };
}

function emit(world, ev) {
  world.events.push(ev);
  // The renderer drains this each frame; cap it so a headless run can't grow
  // unbounded when nothing is consuming events.
  if (world.events.length > 400) world.events.splice(0, world.events.length - 400);
}

export function drainEvents(world) {
  const out = world.events;
  world.events = [];
  return out;
}

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export { nearestEnemy };
