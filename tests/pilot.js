/**
 * The synthetic pilot used by both the balance probe and the autoplayer.
 *
 * Shared deliberately: when the two had their own copies, a gap in one (no
 * obstacle avoidance) silently skewed a whole balance sweep and looked like a
 * game-difficulty problem rather than a harness bug.
 *
 * `skill` in 0..1 governs reaction lag, aim error, how far ahead the pilot
 * reads incoming fire, and how readily it spends a dash. It is not meant to
 * model a great player — balance should hold for a competent one.
 *
 * Dodging is PREDICTIVE, not reactive. It used to be a repulsion field with a
 * 70-140px radius, which meant the pilot only moved once a shot was already
 * about to land: at 300px/sec that is a third of a second of warning against a
 * reaction lag of up to 0.3s. Raising `skill` barely helped, so the harness
 * reported a dodge-based design as simply lethal at every skill level and could
 * not be used to tune one. It now projects each shot forward and steps out of
 * the ones that are actually going to hit, which is what a person does.
 */

export function createPilot(skill, rng) {
  return {
    skill,
    reaction: 0.30 - 0.22 * skill,
    aimError: (1 - skill) * 0.22,
    dodgeRadius: 70 + 70 * skill,
    /** Seconds of incoming fire the pilot reads ahead. */
    lookahead: 0.22 + 0.70 * skill,
    /**
     * How many incoming shots the pilot can track at once.
     *
     * This is what makes skill mean something in a bullet-heavy fight. With no
     * limit a predictive dodger simply avoids everything and the harness
     * reports any amount of enemy fire as survivable; with one, a screen with
     * more shots on it than the pilot can hold gets through, which is exactly
     * the pressure the fight is supposed to apply.
     */
    attention: Math.round(1 + 7 * skill),
    rng,
    _react: 0,
    _aimJitter: 0,
    _dodgeX: 0,
    _dodgeY: 0,
  };
}

/** Write one frame of input into `world.input`. */
export function pilotInput(world, pilot, dt = 1 / 60) {
  const p = world.player;
  const inp = world.input;

  pilot._react -= dt;
  const reread = pilot._react <= 0;
  if (reread) {
    pilot._react = pilot.reaction;
    pilot._aimJitter = pilot.rng.float(-pilot.aimError, pilot.aimError);
  }

  // --- aim at the nearest live target ---
  let target = null, bestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead || (e.cloak && e.cloak.hidden)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; target = e; }
  }
  if (target) {
    const lead = 0.10 + 0.20 * pilot.skill;
    const tx = target.x + target.vx * lead;
    const ty = target.y + target.vy * lead;
    const a = Math.atan2(ty - p.y, tx - p.x) + pilot._aimJitter;
    inp.aimX = p.x + Math.cos(a) * 400;
    inp.aimY = p.y + Math.sin(a) * 400;
  } else {
    inp.aimX = world.w;
    inp.aimY = p.y;
  }

  // --- threat repulsion ---
  let ax = 0, ay = 0, danger = 0;
  const push = (dx, dy, d, weight) => {
    ax += (dx / d) * weight; ay += (dy / d) * weight; danger += weight;
  };

  // Incoming fire, read forward rather than reacted to, and only re-read every
  // `reaction` seconds — a sluggish pilot keeps steering off a picture that has
  // already moved on.
  const hitBox = p.r + 12;
  if (reread) {
    const threats = [];
    for (const b of world.eBullets) {
      if (b.dead || b.delay > 0) continue;
      const rx = p.x - b.x, ry = p.y - b.y;
      const speed2 = b.vx * b.vx + b.vy * b.vy;
      if (speed2 < 1) continue;

      // Time of closest approach, clamped to the window we are willing to read.
      const t = Math.max(0, Math.min(pilot.lookahead, (rx * b.vx + ry * b.vy) / speed2));
      const missX = rx - b.vx * t, missY = ry - b.vy * t;
      const miss = Math.hypot(missX, missY);
      if (miss > hitBox + pilot.dodgeRadius) continue;

      const urgency = (1 - t / (pilot.lookahead + 0.001))
        * (1 - miss / (hitBox + pilot.dodgeRadius));
      if (urgency > 0) threats.push({ b, urgency, missX, missY, speed2 });
    }

    // Only the most pressing few: nobody tracks a whole screen at once.
    threats.sort((x, y) => y.urgency - x.urgency);
    let dx = 0, dy = 0;
    for (const th of threats.slice(0, pilot.attention)) {
      const inv = 1 / Math.sqrt(th.speed2);
      let px = -th.b.vy * inv, py = th.b.vx * inv;
      if (px * th.missX + py * th.missY < 0) { px = -px; py = -py; }
      dx += px * th.urgency * 3.2;
      dy += py * th.urgency * 3.2;
    }
    pilot._dodgeX = dx;
    pilot._dodgeY = dy;
    pilot._danger = threats.slice(0, pilot.attention).reduce((a, t) => a + t.urgency, 0);
  }
  ax += pilot._dodgeX;
  ay += pilot._dodgeY;
  danger += pilot._danger || 0;

  for (const e of world.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);

    // A ship winding up is about to put a shot where we are standing. Step off
    // the line it is drawing rather than waiting for the bullet — this is the
    // whole point of a telegraph, and a pilot that ignores it measures a
    // readable game as an unfair one.
    if (e.windup > 0 && d > 1) {
      const readable = Math.min(1, pilot.lookahead / Math.max(0.05, e.windup));
      if (readable > 0.25) {
        let px = -dy / d, py = dx / d;          // perpendicular to its line of fire
        if (px * p.vx + py * p.vy < 0) { px = -px; py = -py; }
        const urgency = readable * (1 - Math.min(1, d / 620));
        ax += px * urgency * 2.6;
        ay += py * urgency * 2.6;
        danger += urgency * 0.5;
      }
    }

    const keep = e.r + p.r + 46;
    if (d > keep || d < 1) continue;
    push(dx, dy, d, (1 - d / keep) * 1.8);
  }

  // Asteroids and debris. Without this the pilot flies straight through a rock
  // field and every hazard encounter reads as impossibly lethal.
  for (const o of world.obstacles) {
    if (o.dead) continue;
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    const keep = o.size * 0.45 + p.r + 54;
    if (d > keep || d < 1) continue;
    const closing = (o.vx * -dx + o.vy * -dy) / d;
    push(dx, dy, d, (1 - d / keep) * (2.2 + Math.max(0, closing) / 160));
  }

  // --- station keeping ---
  ax += (world.w * 0.22 - p.x) / 300;
  ay += ((world.h / 2) - p.y) / 600;

  // Terrain dominates everything else: hitting a wall is never worth it.
  if (world.corridor) {
    const ahead = world.corridor.centreAt(p.x + world.scrollX + 120);
    ay += (ahead - p.y) / 70;
  }

  // Collect pickups when the sky is clear.
  if (danger < 0.4) {
    let best = null, bd = Infinity;
    for (const pk of world.pickups) {
      if (pk.dead) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < bd && d < 260) { bd = d; best = pk; }
    }
    if (best) { ax += (best.x - p.x) / 220; ay += (best.y - p.y) / 220; }
  }

  const mag = Math.hypot(ax, ay) || 1;
  inp.moveX = clamp(ax / mag, -1, 1);
  inp.moveY = clamp(ay / mag, -1, 1);

  // --- triggers ---
  inp.firePrimary = !!target && p.energy > p.maxEnergy * 0.08;
  inp.fireSecondary = !!target && bestD < 520 && p.energy > p.maxEnergy * 0.45;
  inp.dash = danger > 1.5 && p.dashCharges > 0 && pilot.rng.chance(0.25 * pilot.skill);

  inp.abilities[0] = !!p.abilities[0] && p.abilities[0].timer <= 0
    && (danger > 1.2 || p.hull < p.maxHull * 0.6 || world.enemies.length >= 4);
  inp.abilities[1] = !!p.abilities[1] && p.abilities[1].timer <= 0
    && (danger > 1.6 || world.enemies.length >= 6);

  return danger;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
