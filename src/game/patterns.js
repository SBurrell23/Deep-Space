/**
 * Enemy movement behaviours and bullet patterns.
 *
 * Both are pure: movement mutates only the enemy's own kinematics, and fire
 * patterns RETURN bullet descriptors rather than spawning them. The simulation
 * owns all world mutation, which keeps these testable in isolation and lets the
 * headless playtester run thousands of encounters without a renderer.
 *
 * Coordinate convention: the player flies on the LEFT, enemies enter from the
 * RIGHT and travel in -x. Angle 0 points +x (right), PI points left.
 */

import { DUEL_MOVEMENTS } from './duel-ai.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Movement
//
// Each function receives (e, world, dt). `e.mem` is scratch space owned by the
// behaviour; `e.spawnX/spawnY` are where it entered; `e.holdX` is the x it wants
// to settle at for behaviours that stand off and shoot.
// ---------------------------------------------------------------------------

export const MOVEMENTS = {
  // The duel brains live in their own file — sixteen behaviours written for a
  // one-on-one fight, where staying on the field and staying readable matter
  // far more than they do for a ship that is one of twelve. They are merged in
  // here so `e.move` remains a single flat namespace.
  ...DUEL_MOVEMENTS,

  /** Straight in, no cleverness. */
  straight(e, world, dt) {
    e.vx = -e.speed;
    e.vy = 0;
  },

  /** Straight, the other way: for anything that jumped in behind you. */
  advance(e, world, dt) {
    e.vx = e.speed;
    e.vy = 0;
  },

  /** Holds a lane and shuffles along it. A wall, not a charge. */
  entrench(e, world, dt) {
    if (!Number.isFinite(e.holdX)) e.holdX = Number.isFinite(e.x) ? e.x : world.w * 0.8;
    e.vx = (e.holdX - e.x) * 1.6;
    e.vy = Math.cos((world.time || 0) * 0.7 + (Number(e.id) || 0)) * e.speed * 0.35;
  },

  /** Sine weave — the classic shmup approach. */
  sine(e, world, dt) {
    e.mem.t = (e.mem.t || 0) + dt;
    e.vx = -e.speed;
    const amp = e.mem.amp ?? (e.mem.amp = 90);
    const freq = e.mem.freq ?? (e.mem.freq = 1.8);
    e.vy = Math.cos(e.mem.t * freq + (e.mem.phase || 0)) * amp;
  },

  /** Sharp direction flips rather than a smooth curve. */
  zigzag(e, world, dt) {
    e.mem.t = (e.mem.t || 0) + dt;
    const period = e.mem.period ?? (e.mem.period = 0.7);
    e.vx = -e.speed;
    e.vy = (Math.floor(e.mem.t / period) % 2 === 0 ? 1 : -1) * e.speed * 0.8;
  },

  /** Dive toward the player's y, then level out and continue. */
  swoop(e, world, dt) {
    const p = world.player;
    e.vx = -e.speed;
    const dy = p.y - e.y;
    e.vy += clamp(dy, -1, 1) * e.speed * 2.4 * dt;
    e.vy = clamp(e.vy, -e.speed * 1.1, e.speed * 1.1);
  },

  /**
   * Fly in to a standoff x, then strafe vertically while shooting. The bread
   * and butter of anything that is meant to be shot at rather than dodged.
   */
  hover(e, world, dt) {
    const hold = e.holdX ?? (e.holdX = world.w * (0.55 + (e.mem.holdJitter || 0)));
    if (e.x > hold) {
      e.vx = -e.speed;
      e.vy *= 0.9;
    } else {
      e.vx *= 0.86;
      e.mem.t = (e.mem.t || 0) + dt;
      const amp = e.mem.amp ?? (e.mem.amp = e.speed * 0.55);
      e.vy = Math.sin(e.mem.t * (e.mem.freq || 1.1) + (e.mem.phase || 0)) * amp;
    }
  },

  /**
   * Accelerate at the player, then break off and come round again. Unlike
   * `kamikaze` it survives the pass, but it must still disengage: anything that
   * homes continuously at close range is unshakeable rather than dangerous.
   */
  charge(e, world, dt) {
    const p = world.player;
    e.mem.recover = (e.mem.recover || 0) - dt;

    if (e.mem.recover > 0) {
      // Peeling away after a pass.
      e.vx += e.speed * 2.2 * dt;
      e.vy += (e.mem.peel || 1) * e.speed * 1.2 * dt;
    } else {
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist < 80) {
        e.mem.recover = 1.4;
        e.mem.peel = Math.sign(e.y - p.y) || 1;
      }
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx += Math.cos(a) * e.speed * 3 * dt;
      e.vy += Math.sin(a) * e.speed * 3 * dt;
    }
    const sp = Math.hypot(e.vx, e.vy);
    const max = e.speed * 1.35;
    if (sp > max) { e.vx = e.vx / sp * max; e.vy = e.vy / sp * max; }
  },

  /**
   * A committed ram. It tracks hard at range, then locks its heading in once
   * close and flies THROUGH where you were.
   *
   * The commit is essential. A kamikaze that steers all the way in is faster
   * than the player and therefore undodgeable — it simply attaches and grinds
   * you down at contact damage, which killed a threat-8 ship in eleven seconds
   * without the player landing a shot. Losing steering authority at close range
   * turns it into what it should be: a telegraphed attack you sidestep.
   */
  kamikaze(e, world, dt) {
    const p = world.player;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);

    // Once it has passed the player it is spent; let it sail off the field.
    if (e.mem.spent || e.x < p.x - 70) {
      e.mem.spent = true;
      return;
    }

    // Steering authority falls off inside 180 units and is gone by 90.
    const authority = clamp((dist - 90) / 90, 0, 1);
    if (authority > 0.02) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const accel = e.speed * 4.5 * authority;
      e.vx += Math.cos(a) * accel * dt;
      e.vy += Math.sin(a) * accel * dt;
    }
    const sp = Math.hypot(e.vx, e.vy);
    const max = e.speed * 1.9;
    if (sp > max) { e.vx = e.vx / sp * max; e.vy = e.vy / sp * max; }
  },

  /** Circle the player at a set radius. */
  orbit(e, world, dt) {
    const p = world.player;
    const radius = e.mem.radius ?? (e.mem.radius = 220);
    const dir = e.mem.dir ?? (e.mem.dir = 1);
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx);
    // Radial correction toward the desired radius, plus a tangential push.
    const radial = (d - radius) * -1.6;
    const tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir;
    e.vx = (dx / d) * radial + tx * e.speed;
    e.vy = (dy / d) * radial + ty * e.speed;
  },

  /** Hold station near where it spawned, bobbing slightly. Turrets, mines. */
  guard(e, world, dt) {
    e.mem.t = (e.mem.t || 0) + dt;
    const driftX = e.mem.drift ?? (e.mem.drift = -34);
    e.vx = driftX;
    e.vy = Math.sin(e.mem.t * 0.9 + (e.mem.phase || 0)) * 26;
  },

  /** Slow, unaimed tumble. Debris and mines. */
  drift(e, world, dt) {
    e.mem.t = (e.mem.t || 0) + dt;
    e.vx = -(e.speed * 0.4);
    e.vy = Math.sin(e.mem.t * 0.5 + (e.mem.phase || 0)) * 18;
  },

  /**
   * Close to knife range, fire, then peel away and come back. Makes an enemy
   * feel like it is being flown rather than driven.
   */
  strafe_run(e, world, dt) {
    const p = world.player;
    e.mem.phaseName = e.mem.phaseName || 'in';
    e.mem.t = (e.mem.t || 0) + dt;
    if (e.mem.phaseName === 'in') {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx = Math.cos(a) * e.speed;
      e.vy = Math.sin(a) * e.speed;
      if (e.x - p.x < 190) { e.mem.phaseName = 'out'; e.mem.t = 0; }
    } else {
      e.vx = e.speed * 0.9;
      e.vy = (e.mem.outDir ?? (e.mem.outDir = Math.sign(e.y - p.y) || 1)) * e.speed * 0.5;
      if (e.mem.t > 1.6) { e.mem.phaseName = 'in'; e.mem.t = 0; e.mem.outDir = undefined; }
    }
  },

  /** Mirrors the player's vertical position from a standoff distance. */
  mirror(e, world, dt) {
    const p = world.player;
    const hold = e.holdX ?? (e.holdX = world.w * 0.72);
    e.vx = e.x > hold ? -e.speed : (hold - e.x) * 1.2;
    e.vy = clamp((p.y - e.y) * 2.2, -e.speed, e.speed);
  },

  /** Actively avoids the player, keeping its distance. Support ships. */
  skittish(e, world, dt) {
    const p = world.player;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = e.mem.keepAway ?? (e.mem.keepAway = 300);
    const push = d < want ? (want - d) * 2.2 : -20;
    e.vx = (dx / d) * push - 30;
    e.vy = (dy / d) * push;
    e.vx = clamp(e.vx, -e.speed, e.speed * 1.2);
    e.vy = clamp(e.vy, -e.speed, e.speed);
  },

  /** Holds a fixed slot in a formation that advances together. */
  formation(e, world, dt) {
    const anchorX = e.mem.anchorX ?? (e.mem.anchorX = world.w * 0.7);
    e.mem.t = (e.mem.t || 0) + dt;
    const targetX = anchorX + (e.mem.slotX || 0) - Math.min(e.mem.t * 26, world.w * 0.22);
    const targetY = (e.mem.baseY ?? (e.mem.baseY = e.y))
      + Math.sin(e.mem.t * 0.8) * 42 + (e.mem.slotY || 0);
    e.vx = clamp((targetX - e.x) * 2.4, -e.speed * 1.5, e.speed * 1.5);
    e.vy = clamp((targetY - e.y) * 2.4, -e.speed * 1.5, e.speed * 1.5);
  },

  /** Comes in fast, stops dead, then leaves the way it came. */
  hit_and_run(e, world, dt) {
    e.mem.t = (e.mem.t || 0) + dt;
    const hold = e.holdX ?? (e.holdX = world.w * 0.5);
    if (e.mem.t < 6 && e.x > hold) { e.vx = -e.speed * 1.3; e.vy *= 0.9; }
    else if (e.mem.t < 6) { e.vx *= 0.8; e.vy = Math.sin(e.mem.t * 2) * e.speed * 0.4; }
    else { e.vx = e.speed * 1.4; e.vy *= 0.95; }
  },
};

export const MOVEMENT_IDS = Object.keys(MOVEMENTS);

// ---------------------------------------------------------------------------
// Fire patterns
//
// Each returns an array of bullet descriptors:
//   { x, y, angle, speed, damage, sprite, life, homing?, radius?, ... }
// The sim converts these into live bullets and applies enemy damage scaling.
// ---------------------------------------------------------------------------

const bullet = (e, angle, o = {}) => ({
  x: e.x, y: e.y,
  angle,
  speed: o.speed ?? e.bulletSpeed ?? 280,
  damage: o.damage ?? e.bulletDamage ?? 8,
  sprite: o.sprite ?? e.bulletSprite ?? 'eb_bolt',
  life: o.life ?? 4,
  ...o,
});

/** Angle from an enemy toward the player, the basis of every aimed pattern. */
export function aimAt(e, world) {
  return Math.atan2(world.player.y - e.y, world.player.x - e.x);
}

/**
 * Which way "down the lane" points: at the player, horizontally.
 *
 * Everything that fires a wall or a screen used to assume the lane pointed
 * left, because enemies arrived from the right in a stream and the player was
 * never behind one. In a duel the player circles, and a wall fired away from
 * them is not a wall: you could sit off a Barrier Wall ship's stern and watch
 * it spend the whole fight sealing empty space.
 */
export function laneAngle(e, world) {
  return world.player.x <= e.x ? Math.PI : 0;
}

export const FIRE_PATTERNS = {
  none: () => [],

  /** One aimed shot. */
  single: (e, world) => [bullet(e, aimAt(e, world))],

  /** Straight down the lane, unaimed — cheap and readable. */
  forward: (e, world) => [bullet(e, laneAngle(e, world))],

  /** Three aimed shots in a tight fan. */
  spread3: (e, world) => {
    const a = aimAt(e, world);
    return [-0.17, 0, 0.17].map(o => bullet(e, a + o));
  },

  spread5: (e, world) => {
    const a = aimAt(e, world);
    return [-0.34, -0.17, 0, 0.17, 0.34].map(o => bullet(e, a + o));
  },

  /** A short stream of aimed shots; the sim staggers them via `delay`. */
  burst3: (e, world) => {
    const a = aimAt(e, world);
    return [0, 1, 2].map(i => bullet(e, a, { delay: i * 0.11 }));
  },

  burst5: (e, world) => {
    const a = aimAt(e, world);
    return [0, 1, 2, 3, 4].map(i => bullet(e, a, { delay: i * 0.09 }));
  },

  /** A full ring. Forces movement rather than positioning. */
  radial8: (e) => Array.from({ length: 8 }, (_, i) => bullet(e, (i / 8) * TAU)),
  radial12: (e) => Array.from({ length: 12 }, (_, i) => bullet(e, (i / 12) * TAU)),

  /** A ring that rotates a little each volley, sweeping the field over time. */
  spiral: (e) => {
    e.mem.spiralA = ((e.mem.spiralA || 0) + 0.42) % TAU;
    return Array.from({ length: 4 }, (_, i) => bullet(e, e.mem.spiralA + (i / 4) * TAU));
  },

  /** Two counter-rotating arms. */
  spiral_double: (e) => {
    e.mem.spiralA = ((e.mem.spiralA || 0) + 0.3) % TAU;
    const out = [];
    for (let i = 0; i < 3; i++) {
      out.push(bullet(e, e.mem.spiralA + (i / 3) * TAU));
      out.push(bullet(e, -e.mem.spiralA + (i / 3) * TAU));
    }
    return out;
  },

  /** A vertical wall with one gap you must find and fly through. */
  wall: (e, world) => {
    const rows = 9;
    const gap = Math.floor((e.mem.rng ? e.mem.rng() : Math.random()) * rows);
    const lane = laneAngle(e, world);
    const out = [];
    for (let i = 0; i < rows; i++) {
      if (i === gap || i === gap + 1) continue;
      out.push(bullet(e, lane, {
        y: (i + 0.5) * (world.h / rows),
        x: e.x,
        sprite: 'eb_wave',
      }));
    }
    return out;
  },

  /** A slow aimed volley of homing shots. */
  homing2: (e, world) => {
    const a = aimAt(e, world);
    return [-0.3, 0.3].map(o => bullet(e, a + o, {
      homing: true, turnRate: 2.2, speed: (e.bulletSpeed || 280) * 0.75,
      sprite: 'eb_homing', life: 5,
    }));
  },

  homing1: (e, world) => [bullet(e, aimAt(e, world), {
    homing: true, turnRate: 2.8, speed: (e.bulletSpeed || 280) * 0.8,
    sprite: 'eb_homing', life: 5,
  })],

  /** Heavy, slow, high-damage single shot. Telegraphed by its own slowness. */
  heavy: (e, world) => [bullet(e, aimAt(e, world), {
    speed: (e.bulletSpeed || 280) * 0.62,
    damage: (e.bulletDamage || 8) * 2.4,
    sprite: 'eb_heavy', radius: 40,
  })],

  /** A fast thin needle, fired straight. Punishes sitting still. */
  needle: (e, world) => [bullet(e, aimAt(e, world), {
    speed: (e.bulletSpeed || 280) * 2.1,
    sprite: 'eb_needle', damage: (e.bulletDamage || 8) * 1.3,
  })],

  /** Three needles in quick succession along the same line. */
  needle_burst: (e, world) => {
    const a = aimAt(e, world);
    return [0, 1, 2].map(i => bullet(e, a, {
      delay: i * 0.07, speed: (e.bulletSpeed || 280) * 2.1, sprite: 'eb_needle',
    }));
  },

  /** A slow purple orb that is easy to dodge but hurts badly. */
  orb: (e, world) => [bullet(e, aimAt(e, world), {
    speed: (e.bulletSpeed || 280) * 0.45,
    damage: (e.bulletDamage || 8) * 1.9,
    sprite: 'eb_orb', radius: 30, life: 8,
  })],

  /** A sweeping arc, like a turret traversing. */
  sweep: (e, world) => {
    // Re-aimed at the start of each traverse rather than on every shot: a
    // turret that tracks perfectly is not a sweep, and one bolted to the left
    // is scenery the moment the player gets behind it.
    if (e.mem.sweepA === undefined || e.mem.sweepA > (e.mem.sweepC ?? 0) + 0.6) {
      e.mem.sweepC = aimAt(e, world);
      e.mem.sweepA = e.mem.sweepC - 0.6;
    }
    e.mem.sweepA += 0.16;
    return [bullet(e, e.mem.sweepA)];
  },

  /** Drops a mine that sits and waits. */
  mine_drop: (e, world) => [bullet(e, laneAngle(e, world), {
    speed: 30, sprite: 'sw_mine', life: 14, mine: true,
    damage: (e.bulletDamage || 8) * 2, radius: 70, proximity: 54,
  })],

  /** Fires backward as it flees — awkward and memorable. */
  parting_shot: (e, world) => {
    const a = aimAt(e, world);
    return [a - 0.12, a + 0.12].map(x => bullet(e, x, { delay: 0 }));
  },

  /** A cross, forcing diagonal movement. */
  cross: (e) => [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(a => bullet(e, a)),

  // --- area denial -----------------------------------------------------------
  // Zones are space you cannot occupy. They ask a different question from a
  // bullet: not "can you dodge this" but "where are you going to stand".

  /** Drops a burning patch where the player is standing. Punishes camping. */
  burn_zone: (e, world) => [{
    x: world.player.x, y: world.player.y, angle: 0,
    zone: { r: 96, dps: 16, life: 5.5, arm: 0.9, kind: 'burn' },
  }],

  /** A growing pool of caustic gas, laid ahead of the player's drift. */
  spreading_pool: (e, world) => [{
    x: world.player.x + world.player.vx * 0.5,
    y: world.player.y + world.player.vy * 0.5,
    angle: 0,
    zone: { r: 54, maxR: 168, growth: 26, dps: 13, life: 7.5, arm: 0.8, kind: 'gas' },
  }],

  /** A field the enemy carries with it — you cannot fight it up close. */
  repulsor_field: (e) => [{
    x: e.x, y: e.y, angle: 0,
    zone: { r: 118, dps: 20, life: 5, arm: 0.4, anchored: true, kind: 'field' },
  }],

  /** Three patches across the lane, forcing a route choice. */
  minefield_zones: (e, world) => [0.25, 0.5, 0.75].map(f => ({
    x: e.x - 60, y: world.h * f, angle: 0,
    zone: { r: 82, dps: 15, life: 6.5, arm: 1.0, vx: -30, kind: 'burn' },
  })),

  // --- telegraphed beams -----------------------------------------------------
  // A wall of damage announced a beat before it lands. Read it, then move.

  /** One heavy tracking lance. */
  lance_beam: (e, world) => [{
    angle: aimAt(e, world),
    beam: { telegraph: 1.15, width: 26, damage: 3.2, length: 1300 },
  }],

  /** A wider, slower, much heavier cut. */
  siege_beam: (e, world) => [{
    angle: aimAt(e, world),
    beam: { telegraph: 1.7, width: 54, damage: 4.6, length: 1300, linger: 0.5 },
  }],

  /** Two beams bracketing the player — you must move, not stand still. */
  bracket_beams: (e, world) => {
    const a = aimAt(e, world);
    return [-0.30, 0.30].map(o => ({
      angle: a + o,
      beam: { telegraph: 1.0, width: 20, damage: 2.6, length: 1300, track: false },
    }));
  },

  /** A locked cross that does not track. Positional, not reactive. */
  cross_beams: (e) => [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(a => ({
    angle: a,
    beam: { telegraph: 1.25, width: 22, damage: 2.8, length: 1300, track: false },
  })),

  // --- walls -----------------------------------------------------------------

  /** Two walls with offset gaps: find the first, then immediately the second. */
  double_wall: (e, world) => {
    const rows = 9;
    const rnd = e.mem.rng ? e.mem.rng : Math.random;
    const gapA = Math.floor(rnd() * rows);
    let gapB = Math.floor(rnd() * rows);
    if (Math.abs(gapB - gapA) < 2) gapB = (gapA + 4) % rows;
    const lane = laneAngle(e, world);
    const out = [];
    for (let i = 0; i < rows; i++) {
      if (i !== gapA && i !== gapA + 1) {
        out.push(bullet(e, lane, { y: (i + 0.5) * (world.h / rows), x: e.x, sprite: 'eb_wave' }));
      }
      if (i !== gapB && i !== gapB + 1) {
        out.push(bullet(e, lane, {
          y: (i + 0.5) * (world.h / rows), x: e.x, sprite: 'eb_wave', delay: 0.85,
        }));
      }
    }
    return out;
  },

  /** Closes in from the top and bottom edges, leaving the middle last. */
  closing_wall: (e, world) => {
    const lane = laneAngle(e, world);
    const out = [];
    for (let i = 0; i < 5; i++) {
      const t = i * 0.14;
      out.push(bullet(e, lane, { y: 20 + i * 26, x: e.x, delay: t, sprite: 'eb_wave' }));
      out.push(bullet(e, lane, { y: world.h - 20 - i * 26, x: e.x, delay: t, sprite: 'eb_wave' }));
    }
    return out;
  },

  // --- missiles --------------------------------------------------------------

  /** Four hard-turning missiles. */
  homing4: (e, world) => {
    const a = aimAt(e, world);
    return [-0.5, -0.18, 0.18, 0.5].map(o => bullet(e, a + o, {
      homing: true, turnRate: 2.6, speed: (e.bulletSpeed || 280) * 0.7,
      sprite: 'eb_homing', life: 6,
    }));
  },

  /** A long, staggered stream of seekers. Attrition rather than a burst. */
  missile_barrage: (e, world) => {
    const a = aimAt(e, world);
    return Array.from({ length: 7 }, (_, i) => bullet(e, a + (i % 2 ? 0.35 : -0.35), {
      delay: i * 0.22, homing: true, turnRate: 2.1,
      speed: (e.bulletSpeed || 280) * 0.66, sprite: 'eb_homing', life: 6.5,
    }));
  },

  /** A dense aimed cone, short range. */
  shotgun: (e, world) => {
    const a = aimAt(e, world);
    return Array.from({ length: 7 }, (_, i) => bullet(e, a + (i - 3) * 0.11, {
      speed: (e.bulletSpeed || 280) * (0.8 + (i % 3) * 0.12), life: 1.6,
    }));
  },
};

export const FIRE_PATTERN_IDS = Object.keys(FIRE_PATTERNS);

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
