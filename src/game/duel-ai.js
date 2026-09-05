/**
 * Duellist movement brains.
 *
 * These live apart from `patterns.js` because `patterns.js` folds them into
 * `MOVEMENTS`; importing anything back the other way would close the cycle, so
 * this file deliberately depends on nothing.
 *
 * A duellist is the WHOLE encounter — one named ship, or a squadron flying as
 * one opponent. That changes what a movement has to guarantee compared to the
 * wave behaviours next door:
 *
 *  - It can never leave the field. A wave enemy that sails off the left edge is
 *    one fewer target; a duellist that does it is a fight that cannot be won and
 *    a run that stalls until the timeout. Every brain ends in `settle`, which
 *    steers it home instead of clamping it — a clamped ship sits welded to the
 *    screen edge and reads as a bug rather than as a pilot.
 *  - It has to stay interesting for 40–90 seconds against one opponent who is
 *    watching it closely. Anything periodic gets its period skewed by
 *    `e.mem.phase` (seeded 0–2π), both so the loop does not land on the same
 *    beat twice and so two bodies of a squadron do not move in lockstep.
 *  - Its velocity must be finite every single frame. `sine` shipped a NaN once
 *    from reading an unseeded `mem` field, and the enemy simply ceased to exist
 *    at an unreachable coordinate. Hence `fin` on every read and a division
 *    guard on every normalisation below.
 *
 * Coordinates are the house convention: player on the LEFT, enemy from the
 * RIGHT, angle 0 points +x.
 */

const TAU = Math.PI * 2;

/** How far out the outward velocity has faded to nothing. */
const EDGE_SOFT = 70;
/** Spring pulling a ship that is already outside back in. */
const EDGE_PULL = 2.5;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Every value read out of `mem`, `world` or the player goes through this. */
function fin(v, fallback) { return Number.isFinite(v) ? v : fallback; }

function mem(e) { return e.mem || (e.mem = {}); }

function spd(e) {
  // A duellist with no speed would be a stationary punching bag rather than an
  // opponent, so the floor is well above zero.
  return Math.max(30, fin(e.speed, 110));
}

/** Frame times only ever get clamped down; a stalled tab must not teleport it. */
function dtOf(dt) { return clamp(fin(dt, 1 / 60), 0, 0.1); }

function tick(m, dt) {
  m.t = fin(m.t, 0) + dtOf(dt);
  return m.t;
}

function playerOf(world) {
  const p = (world && world.player) || null;
  const h = fin(world && world.h, 540);
  return {
    x: fin(p && p.x, 150),
    y: fin(p && p.y, h / 2),
    vx: fin(p && p.vx, 0),
    vy: fin(p && p.vy, 0),
  };
}

/** All randomness through the seeded rng; a missing one must not poison a velocity. */
function rnd(world) {
  const f = world && world.rng;
  return typeof f === 'function' ? clamp(fin(f(), 0.5), 0, 1) : 0.5;
}

/**
 * The box a duellist is allowed to fly in. The left wall is well right of the
 * player's spawn so the player always has room to work; the right wall is short
 * of the screen edge so the ship is always shootable.
 */
function bounds(world) {
  const w = fin(world && world.w, 960);
  const h = fin(world && world.h, 540);
  const minY = 40;
  return {
    minX: w * 0.30,
    maxX: w * 0.92,
    minY,
    maxY: Math.max(minY + 60, h - 40),
  };
}

/**
 * The nearer floor the three committed brains use. A lunge or a pounce that
 * stops at 0.30w never actually arrives — the player at their spawn x sits well
 * left of it — so the attack poses no question and the ship reads as timid.
 * 0.24w brings the nose inside a ship-length of a player who has not moved,
 * which is close enough to demand a sidestep and still 200px clear of the edge.
 */
function near(world) { return fin(world && world.w, 960) * 0.24; }

/**
 * Containment, applied after every brain has stated its intent.
 *
 * Outward velocity fades to zero across the last `EDGE_SOFT` pixels, so a ship
 * arrives at the wall already slow instead of stopping dead against it, and it
 * can never cross. Anything found outside anyway — a spawn off the right edge,
 * a knock-back, a huge frame — is pulled back by a spring. Position is never
 * written except to rescue a NaN, which is unrecoverable otherwise.
 */
function settle(e, world, opts) {
  const b = bounds(world);
  const o = opts || {};
  const minX = fin(o.minX, b.minX);
  const cap = spd(e) * fin(o.cap, 2.4);

  if (!Number.isFinite(e.x)) e.x = b.maxX;
  if (!Number.isFinite(e.y)) e.y = (b.minY + b.maxY) / 2;

  let vx = fin(e.vx, 0);
  let vy = fin(e.vy, 0);

  const s = Math.hypot(vx, vy);
  if (s > cap) { vx = (vx / s) * cap; vy = (vy / s) * cap; }

  if (vx > 0) vx *= clamp((b.maxX - e.x) / EDGE_SOFT, 0, 1);
  else if (vx < 0) vx *= clamp((e.x - minX) / EDGE_SOFT, 0, 1);
  if (vy > 0) vy *= clamp((b.maxY - e.y) / EDGE_SOFT, 0, 1);
  else if (vy < 0) vy *= clamp((e.y - b.minY) / EDGE_SOFT, 0, 1);

  if (e.x > b.maxX) vx -= (e.x - b.maxX) * EDGE_PULL;
  else if (e.x < minX) vx += (minX - e.x) * EDGE_PULL;
  if (e.y > b.maxY) vy -= (e.y - b.maxY) * EDGE_PULL;
  else if (e.y < b.minY) vy += (b.minY - e.y) * EDGE_PULL;

  e.vx = fin(vx, 0);
  e.vy = fin(vy, 0);
}

// ---------------------------------------------------------------------------
// The brains
// ---------------------------------------------------------------------------

export const DUEL_MOVEMENTS = {
  /**
   * Denies you a safe distance. It sits level with you at a range it shortens
   * by a few pixels a second, so waiting costs the player space: the fight has
   * to be opened before the walls close, not after.
   */
  duel_stalk(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const t = tick(m, dt);

    // 3.5 px/s of closure: over a 60s duel that is a 210px squeeze, felt rather
    // than seen. Faster and it stops being a stalk and becomes a charge.
    const start = m.range ?? (m.range = 300 + Math.sin(fin(m.phase, 0)) * 55);
    const want = Math.max(190, start - t * 3.5);
    const holdX = clamp(p.x + want, b.minX, b.maxX);

    e.vx = clamp((holdX - e.x) * 1.5, -sp, sp * 0.9);
    e.vy = clamp((p.y - e.y) * 2.0, -sp, sp);
    settle(e, world, { cap: 1.6 });
  },

  /**
   * Punishes chasing. Closing on it only pushes it further away, so the player
   * has to shoot at maximum range or force it into the corner it retreats to —
   * where the retreat turns vertical and it finally stops being safe.
   */
  duel_keepaway(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    tick(m, dt);

    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const panic = clamp((360 - d) / 260, 0, 1);
    const room = clamp((b.maxX - e.x) / 150, 0, 1);
    const flee = 0.5 + panic * 1.2;

    let vx = (dx / d) * sp * flee * room;
    let vy = (dy / d) * sp * flee;
    // Out of room to the right, the only retreat left is along the wall.
    if (room < 0.35) vy += (Math.sign(dy) || 1) * sp * panic * 1.1;
    // Nothing chasing: drift back out to maximum range and wait.
    vx += (b.maxX - 30 - e.x) * 0.6 * (1 - panic);

    e.vx = vx;
    e.vy = vy;
    settle(e, world, { cap: 1.9 });
  },

  /**
   * Never presents the same aspect twice. Leading it matters more than aiming
   * at it, and standing still means it is always arriving from a new angle.
   */
  duel_circle(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const dts = dtOf(dt);

    const radius = m.radius ?? (m.radius = 210 + Math.cos(fin(m.phase, 0)) * 45);
    if (m.dir === undefined) m.dir = Math.sin(fin(m.phase, 0)) >= 0 ? 1 : -1;
    m.flipCool = Math.max(0, fin(m.flipCool, 0) - dts);

    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx);
    const tx = -Math.sin(a) * m.dir;
    const ty = Math.cos(a) * m.dir;

    // The far half of a true orbit is off the left of the field, so the ring is
    // walked as an arc that reverses at the walls. Reversing reads as a pilot
    // choosing to come back; grinding along the edge reads as a stuck sprite.
    const outward =
      (e.x < b.minX + 40 && tx < 0) || (e.x > b.maxX - 40 && tx > 0) ||
      (e.y < b.minY + 40 && ty < 0) || (e.y > b.maxY - 40 && ty > 0);
    if (outward && m.flipCool <= 0) { m.dir = -m.dir; m.flipCool = 0.5; }

    const radial = clamp((radius - d) * 1.5, -sp * 1.5, sp * 1.5);
    e.vx = (dx / d) * radial + tx * sp;
    e.vy = (dy / d) * radial + ty * sp;
    settle(e, world, { cap: 1.9 });
  },

  /**
   * A question asked on a timer. It is a passive target most of the fight, then
   * commits to one dash on a locked heading — so the player has to keep an exit
   * lane open rather than parking in front of it and trading fire.
   */
  duel_lunge(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const dts = dtOf(dt);

    if (m.stage === undefined) { m.stage = 'hold'; m.timer = 1.2 + fin(m.phase, 0) * 0.5; }
    m.timer = fin(m.timer, 1) - dts;
    // Station is held relative to the player, not at a fixed x. Parked at the
    // back wall the dash expired 300px short of arriving and the whole move
    // read as a twitch; from 300px out it lands, which is the point of it.
    const holdX = clamp(p.x + 300, b.minX, b.maxX - 40);

    if (m.stage === 'hold') {
      e.vx = clamp((holdX - e.x) * 1.4, -sp, sp);
      e.vy = clamp((p.y - e.y) * 1.1, -sp * 0.5, sp * 0.5);
      if (m.timer <= 0) {
        m.stage = 'dash';
        m.timer = 1.1;
        m.aimX = p.x + 40;
        m.aimY = p.y;
      }
    } else if (m.stage === 'dash') {
      // The heading is taken once, at the start. A dash that steers all the way
      // in is faster than the player and therefore undodgeable; committing to
      // where you WERE is what makes it an attack instead of an attachment.
      const ax = fin(m.aimX, p.x);
      const ay = fin(m.aimY, p.y);
      const a = Math.atan2(ay - e.y, ax - e.x);
      e.vx = Math.cos(a) * sp * 2.1;
      e.vy = Math.sin(a) * sp * 2.1;
      if (m.timer <= 0 || Math.hypot(ax - e.x, ay - e.y) < 60) {
        m.stage = 'recover';
        m.timer = 1.0;
      }
    } else {
      e.vx = sp * 1.15;
      e.vy = (m.peel ?? (m.peel = Math.sign(e.y - p.y) || 1)) * sp * 0.45;
      if (m.timer <= 0) {
        m.stage = 'hold';
        m.timer = 1.6 + rnd(world) * 1.8;
        m.peel = undefined;
      }
    }
    settle(e, world, { minX: near(world), cap: 2.3 });
  },

  /**
   * Crosses your firing line instead of sitting in it. Each run comes in at a
   * different depth, so a player who finds one good lane and holds it will be
   * shooting where the ship was last time.
   */
  duel_strafe(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);
    const span = Math.max(0, b.maxX - b.minX - 60);

    if (m.dir === undefined) m.dir = Math.sin(fin(m.phase, 0)) >= 0 ? 1 : -1;
    if (m.laneX === undefined) m.laneX = clamp(fin(e.holdX, b.maxX - 120), b.minX + 30, b.maxX);

    const top = b.minY + 20;
    const bot = b.maxY - 20;
    const turned = (m.dir > 0 && e.y > bot) || (m.dir < 0 && e.y < top);
    if (turned) {
      m.dir = -m.dir;
      m.laneX = b.minX + 40 + rnd(world) * span;
    }

    e.vy = m.dir * sp * 1.15;
    e.vx = clamp((fin(m.laneX, b.maxX - 120) - e.x) * 1.6, -sp, sp);
    settle(e, world, { cap: 1.9 });
  },

  /**
   * Punishes standing still, because it never has to move to keep its aim. The
   * player cannot out-position it, only out-time it: the answer is to attack
   * from outside its firing arc, not from in front of it.
   */
  duel_anchor(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);
    const t = tick(m, dt);
    const ph = fin(m.phase, 0);

    const ax = m.ax ?? (m.ax = clamp(fin(e.holdX, fin(e.x, b.maxX)), b.minX + 60, b.maxX - 20));
    const ay = m.ay ?? (m.ay = clamp(fin(e.y, (b.minY + b.maxY) / 2), b.minY + 40, b.maxY - 40));

    // Two slow, mutually prime-ish periods: enough life that it does not look
    // frozen, not enough travel that it ever dodges anything.
    const wantX = ax + Math.sin(t * 0.31 + ph) * 16;
    const wantY = ay + Math.sin(t * 0.23 + ph * 1.7) * 22;
    e.vx = clamp((wantX - e.x) * 1.5, -sp, sp);
    e.vy = clamp((wantY - e.y) * 1.5, -sp, sp);
    settle(e, world, { cap: 1.4 });
  },

  /**
   * Removes vertical dodging from the player's vocabulary — it is always level
   * with you. Beating it means winning on x and on timing, or baiting it with a
   * hard reversal it has to chase through.
   */
  duel_mirror(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);

    const holdX = m.holdX ?? (m.holdX = clamp(fin(e.holdX, b.maxX - 40), b.minX, b.maxX));
    e.vx = clamp((holdX - e.x) * 1.3, -sp * 1.2, sp * 0.8);
    e.vy = clamp((p.y - e.y) * 3.2, -sp * 1.6, sp * 1.6);
    settle(e, world, { cap: 1.8 });
  },

  /**
   * Ignores the player entirely, which makes it a moving obstacle rather than a
   * duellist: the player has to solve where it WILL be. The crossing point of
   * the eight is the only place it is ever slow.
   */
  duel_bob(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);
    const t = tick(m, dt);
    const ph = fin(m.phase, 0);

    const cx = (b.minX + b.maxX) / 2 + (b.maxX - b.minX) * 0.12;
    const rx = (b.maxX - b.minX) * 0.34;
    const cy = (b.minY + b.maxY) / 2;
    const ry = (b.maxY - b.minY) * 0.40;
    // Period skewed by phase: a fixed one is read off in two laps, and two
    // bodies of a squadron would trace the same figure at the same instant.
    const th = t * (0.34 + (ph / TAU) * 0.16) + ph;

    const wantX = cx + Math.sin(th) * rx;
    const wantY = cy + Math.sin(th * 2) * ry;
    e.vx = clamp((wantX - e.x) * 2.2, -sp * 1.4, sp * 1.4);
    e.vy = clamp((wantY - e.y) * 2.2, -sp * 1.4, sp * 1.4);
    settle(e, world, { cap: 1.6 });
  },

  /**
   * A clock. It gives ground back never, so the player cannot kite it forever
   * and cannot farm it from range — the fight has to be finished before the
   * room runs out.
   */
  duel_pressure(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const sp = spd(e);
    const floor = near(world);
    tick(m, dt);

    // Closure eases off over the last 160px so it arrives and settles rather
    // than shoving into the player and grinding on contact damage.
    const push = clamp((e.x - floor) / 160, 0, 1);
    e.vx = -sp * (0.35 + 0.35 * push);
    e.vy = clamp((p.y - e.y) * 1.4, -sp * 0.8, sp * 0.8);
    settle(e, world, { minX: floor, cap: 1.3 });
  },

  /**
   * Attacks off the shoulder rather than head-on. A player who only strafes up
   * and down is turning into it; the answer is to face the side it swung to
   * before it arrives, and to note that the turn at the end is its slow beat.
   */
  duel_flank(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const floor = near(world);

    if (m.side === undefined) m.side = Math.cos(fin(m.phase, 0)) >= 0 ? -1 : 1;
    if (m.stage === undefined) { m.stage = 'swing'; m.timer = 0; }
    m.timer = fin(m.timer, 0) + dtOf(dt);
    const edgeY = m.side < 0 ? b.minY + 30 : b.maxY - 30;

    if (m.stage === 'swing') {
      e.vx = clamp((b.maxX - 60 - e.x) * 1.2, -sp, sp);
      e.vy = clamp((edgeY - e.y) * 2.0, -sp * 1.3, sp * 1.3);
      // The timeout matters: without it a body pinned by the player's own
      // position could sit in the swing for the whole encounter.
      if (Math.abs(edgeY - e.y) < 30 || m.timer > 4) { m.stage = 'run'; m.timer = 0; }
    } else if (m.stage === 'run') {
      const wantX = Math.max(floor, p.x + 70);
      e.vx = clamp((wantX - e.x) * 1.3, -sp * 1.5, sp * 0.8);
      e.vy = clamp((edgeY - e.y) * 1.2, -sp, sp);
      if (e.x - wantX < 40 || m.timer > 5) { m.stage = 'turn'; m.timer = 0; }
    } else {
      e.vx = clamp((p.x + 150 - e.x) * 1.0, -sp * 0.8, sp * 1.2);
      e.vy = clamp((p.y - e.y) * 1.6, -sp * 1.2, sp * 1.2);
      if (m.timer > 1.6) { m.stage = 'swing'; m.timer = 0; m.side = -m.side; }
    }
    settle(e, world, { minX: floor, cap: 2.0 });
  },

  /**
   * Trades in and out on a beat the player has to read rather than count. The
   * in-beat is the window to hit it and the window it hits you; the lengths are
   * re-rolled every swap so a memorised rhythm is worth nothing.
   */
  duel_boxer(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const t = tick(m, dt);

    if (m.beat === undefined) { m.beat = 'in'; m.timer = 0.6 + fin(m.phase, 0) * 0.2; }
    m.timer = fin(m.timer, 0.8) - dtOf(dt);
    if (m.timer <= 0) {
      m.beat = m.beat === 'in' ? 'out' : 'in';
      m.timer = m.beat === 'in' ? 0.9 + rnd(world) * 0.9 : 0.6 + rnd(world) * 0.7;
    }

    // Stations rather than raw thrust, so the rhythm cannot drift into the wall
    // over a minute of unequal beats.
    const want = clamp(p.x + (m.beat === 'in' ? 150 : 380), b.minX, b.maxX);
    e.vx = clamp((want - e.x) * 2.0, -sp * 1.5, sp * 1.5);
    e.vy = clamp((p.y - e.y) * 0.9, -sp * 0.7, sp * 0.7)
      + Math.sin(t * 1.7 + fin(m.phase, 0)) * sp * 0.35;
    settle(e, world, { cap: 1.8 });
  },

  /**
   * Uses the whole field, so there is no corner to fight it from. It is only
   * ever briefly in the player's firing line, and the player has to travel to
   * keep it there instead of holding a lane.
   */
  duel_drift_wide(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);
    tick(m, dt);

    if (m.tx === undefined || m.ty === undefined) {
      m.tx = b.maxX - 40;
      m.ty = fin(m.phase, 0) < Math.PI ? b.minY + 30 : b.maxY - 30;
    }
    if (Math.hypot(fin(m.tx, b.maxX) - e.x, fin(m.ty, b.minY) - e.y) < 45) {
      m.tx = rnd(world) < 0.5 ? b.minX + 30 : b.maxX - 30;
      m.ty = rnd(world) < 0.5 ? b.minY + 30 : b.maxY - 30;
      // Never re-pick the corner it is standing in; that stalls the sweep and
      // the ship jitters in place instead of crossing.
      if (Math.hypot(m.tx - e.x, m.ty - e.y) < 120) {
        m.tx = (b.minX + b.maxX) - m.tx;
        m.ty = (b.minY + b.maxY) - m.ty;
      }
    }

    const dx = fin(m.tx, b.maxX) - e.x;
    const dy = fin(m.ty, b.minY) - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * sp * 0.95;
    e.vy = (dy / d) * sp * 0.95;
    settle(e, world, { cap: 1.4 });
  },

  /**
   * Makes the player abandon whatever position they just built. It is harmless
   * and stationary at an edge — the temptation is to go and kill it there —
   * then it crosses the field at twice its speed on a line through you.
   */
  duel_pounce(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const floor = near(world);

    if (m.stage === undefined) {
      m.stage = 'lurk';
      m.timer = 1.5 + fin(m.phase, 0) * 0.4;
      m.side = Math.sin(fin(m.phase, 0)) >= 0 ? -1 : 1;
    }
    m.timer = fin(m.timer, 1) - dtOf(dt);
    const edgeY = m.side < 0 ? b.minY + 26 : b.maxY - 26;

    if (m.stage === 'lurk') {
      e.vx = clamp((b.maxX - 40 - e.x) * 1.2, -sp, sp);
      e.vy = clamp((edgeY - e.y) * 1.6, -sp, sp);
      if (m.timer <= 0) {
        m.stage = 'cross';
        m.timer = 1.5;
        // Side flips first, so the cross runs to the opposite edge.
        m.side = -m.side;
        m.crossX = clamp(p.x + 90, floor, b.maxX);
      }
    } else {
      const dx = fin(m.crossX, b.minX + 60) - e.x;
      const dy = edgeY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx = (dx / d) * sp * 2.0;
      e.vy = (dy / d) * sp * 2.0;
      if (d < 50 || m.timer <= 0) { m.stage = 'lurk'; m.timer = 1.6 + rnd(world) * 2.0; }
    }
    settle(e, world, { minX: floor, cap: 2.2 });
  },

  /**
   * Cannot be flanked and will not come to you. The player has to close the
   * whole field to reach it and then fight in the one place with no room to
   * retreat, or out-range it and accept the travel time on every shot.
   */
  duel_wall(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);

    if (m.dir === undefined) m.dir = Math.cos(fin(m.phase, 0)) >= 0 ? 1 : -1;
    m.pause = Math.max(0, fin(m.pause, 0) - dtOf(dt));

    const top = b.minY + 24;
    const bot = b.maxY - 24;
    if (m.dir > 0 && e.y > bot) { m.dir = -1; m.pause = 0.25 + rnd(world) * 0.6; }
    else if (m.dir < 0 && e.y < top) { m.dir = 1; m.pause = 0.25 + rnd(world) * 0.6; }

    // The only x authority is the walk back to the wall — it spawns off the
    // right edge and has to arrive somehow.
    e.vx = clamp((b.maxX - 24 - e.x) * 1.4, -sp, sp);
    // The pause at each end is what makes the sweep readable; a constant
    // shuttle at one speed is trivially led.
    e.vy = m.pause > 0 ? fin(e.vy, 0) * 0.85 : m.dir * sp;
    settle(e, world, { cap: 1.5 });
  },

  /**
   * Cannot be led, only reacted to. Short bursts on unrelated headings with a
   * near-still coast between them, so the player has to shoot on the coast and
   * accept missing on the bursts.
   */
  duel_erratic(e, world, dt) {
    const m = mem(e);
    const b = bounds(world);
    const sp = spd(e);

    m.timer = fin(m.timer, 0) - dtOf(dt);
    if (m.timer <= 0) {
      const burst = rnd(world) < 0.35;
      m.timer = burst ? 0.18 + rnd(world) * 0.28 : 0.30 + rnd(world) * 0.50;
      m.coast = !burst;
      // Headings are drawn around the direction of the box centre. Unbiased
      // ones spend most of the fight grinding on a wall, which looks broken
      // rather than unpredictable.
      const home = Math.atan2((b.minY + b.maxY) / 2 - e.y, (b.minX + b.maxX) / 2 - e.x);
      const a = fin(home, 0) + (rnd(world) - 0.5) * TAU * 0.9;
      m.ax = Math.cos(a);
      m.ay = Math.sin(a);
    }

    const gain = m.coast ? 0.25 : 1.9;
    e.vx = fin(m.ax, -1) * sp * gain;
    e.vy = fin(m.ay, 0) * sp * gain;
    settle(e, world, { cap: 2.0 });
  },

  /**
   * Squadron flying. Each body holds a loose slot on a station that advances on
   * the player, so the player is fighting a shape rather than three ships —
   * breaking the formation apart is worth more than killing any one body.
   */
  duel_escort(e, world, dt) {
    const m = mem(e);
    const p = playerOf(world);
    const b = bounds(world);
    const sp = spd(e);
    const t = tick(m, dt);

    // The centre is computed, never sampled from the squadmates. Bodies reading
    // each other's live positions feed back on themselves and the formation
    // wallows; an analytic station every body agrees on cannot. It is driven by
    // this body's own clock because a squadron spawns on the same frame, so all
    // of them agree to within a frame anyway.
    const standoff = Math.max(180, 330 - t * 4);
    const cx = clamp(p.x + standoff, b.minX + 60, b.maxX - 60);
    const cy = clamp(
      p.y * 0.35 + ((b.minY + b.maxY) / 2) * 0.65 + Math.sin(t * 0.45) * 60,
      b.minY + 50, b.maxY - 50,
    );

    // Slots may never have been assigned — a lone body flying an escort brain
    // is a legal ship, and it should simply hold the centre.
    const wobble = Math.sin(t * 0.9 + fin(m.phase, 0)) * 14;
    const wantX = clamp(cx + fin(m.slotX, 0), b.minX, b.maxX);
    const wantY = clamp(cy + fin(m.slotY, 0) + wobble, b.minY, b.maxY);

    e.vx = clamp((wantX - e.x) * 1.7, -sp * 1.4, sp * 1.4);
    e.vy = clamp((wantY - e.y) * 1.7, -sp * 1.4, sp * 1.4);
    settle(e, world, { cap: 1.6 });
  },
};

export const DUEL_MOVEMENT_IDS = Object.keys(DUEL_MOVEMENTS);
