/**
 * The synthetic pilot used by both the balance probe and the autoplayer.
 *
 * Shared deliberately: when the two had their own copies, a gap in one (no
 * obstacle avoidance) silently skewed a whole balance sweep and looked like a
 * game-difficulty problem rather than a harness bug.
 *
 * `skill` in 0..1 governs reaction lag, aim error, threat-awareness radius and
 * how readily the pilot spends a dash. It is not meant to model a great player —
 * balance should hold for a competent one.
 */

export function createPilot(skill, rng) {
  return {
    skill,
    reaction: 0.30 - 0.22 * skill,
    aimError: (1 - skill) * 0.22,
    dodgeRadius: 70 + 70 * skill,
    rng,
    _react: 0,
    _aimJitter: 0,
  };
}

/** Write one frame of input into `world.input`. */
export function pilotInput(world, pilot, dt = 1 / 60) {
  const p = world.player;
  const inp = world.input;

  pilot._react -= dt;
  if (pilot._react <= 0) {
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

  for (const b of world.eBullets) {
    if (b.dead || b.delay > 0) continue;
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > pilot.dodgeRadius || d < 1) continue;
    // Only dodge what is actually closing on us.
    const closing = (b.vx * -dx + b.vy * -dy) / d;
    if (closing <= 0) continue;
    push(dx, dy, d, (1 - d / pilot.dodgeRadius) * (1 + closing / 400));
  }

  for (const e of world.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
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
