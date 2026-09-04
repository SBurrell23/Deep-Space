/**
 * Wave scheduling and spawn formations.
 *
 * An encounter's `waves` array is a script. Each wave has a trigger (a time, or
 * a condition on the live enemy count) and a list of spawn groups. A group is
 * either explicit (`id` + `count`) or procedural (`budget` + `pool`), which lets
 * an encounter fix the shape of a fight while leaving its exact composition to
 * the run's seed.
 *
 * The spawner produces spawn REQUESTS; sim.js turns them into live enemies.
 */

import { ENEMIES, fillBudget, scaleEnemy } from './enemies.js';
import { ENCOUNTER_TUNING as ENC } from './balance.js';

/**
 * Standard enemy budget for a node at the given threat.
 *
 * Kept deliberately low: every enemy fires, so damage in the air scales with
 * COUNT, not with toughness. Doubling the budget doubles the bullets and turns
 * a threat-1 skirmish into an undodgeable wall. Fight length comes from the
 * per-class toughness in enemies.js instead. Encounters multiply this by their
 * own `budget` factor, so retuning difficulty globally is a one-line change
 * here rather than an edit to every encounter.
 */
/** How long a capital ship waits behind its escort screen. */
export const BOSS_ARRIVAL_DELAY = 7;

export function standardBudget(threat) {
  return ENC.budgetBase + ENC.budgetPerThreat * Math.max(0, threat - 1);
}

// ---------------------------------------------------------------------------
// Formations — where a group of N enemies enters the field.
//
// Each returns N positions in world coordinates. Enemies enter from beyond the
// right edge; `spawnX` is where the formation's leading edge sits.
// ---------------------------------------------------------------------------

export const FORMATIONS = {
  line(n, world, o = {}) {
    const x = o.x ?? world.w + 40;
    const top = world.h * 0.15, bot = world.h * 0.85;
    return Array.from({ length: n }, (_, i) => ({
      x, y: n === 1 ? world.h / 2 : top + (bot - top) * (i / (n - 1)),
    }));
  },

  column(n, world, o = {}) {
    const x = o.x ?? world.w + 40;
    const gap = o.gap ?? 46;
    return Array.from({ length: n }, (_, i) => ({ x: x + i * gap, y: o.y ?? world.h / 2 }));
  },

  /** A chevron, point-first toward the player. */
  v(n, world, o = {}) {
    const x = o.x ?? world.w + 40;
    const cy = o.y ?? world.h / 2;
    const gap = o.gap ?? 44;
    return Array.from({ length: n }, (_, i) => {
      const arm = Math.ceil(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      return { x: x + arm * gap, y: cy + side * arm * gap * 0.8 };
    });
  },

  /** A staggered diagonal. */
  echelon(n, world, o = {}) {
    const x = o.x ?? world.w + 40;
    const gap = o.gap ?? 42;
    const dir = o.dir ?? 1;
    const cy = o.y ?? world.h * 0.35;
    return Array.from({ length: n }, (_, i) => ({ x: x + i * gap, y: cy + i * gap * 0.7 * dir }));
  },

  /** A curved wall, concave toward the player. */
  arc(n, world, o = {}) {
    const x = o.x ?? world.w + 40;
    const cy = world.h / 2;
    const spanY = world.h * 0.34;
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;   // -1..1
      return { x: x + (1 - Math.abs(t)) * 70, y: cy + t * spanY };
    });
  },

  /** A tight blob. */
  cluster(n, world, o = {}) {
    const x = o.x ?? world.w + 60;
    const cy = o.y ?? world.h / 2;
    const r = o.radius ?? 60;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const rr = r * (0.4 + 0.6 * ((i % 3) / 2));
      return { x: x + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
    });
  },

  /** Scattered across the right edge. */
  random(n, world, o = {}) {
    const rng = world.rng;
    const x = o.x ?? world.w + 40;
    return Array.from({ length: n }, () => ({
      x: x + rng.float(0, 200),
      y: rng.float(world.h * 0.1, world.h * 0.9),
    }));
  },

  /** Enters from the top and bottom edges instead of the right. */
  pincer(n, world, o = {}) {
    return Array.from({ length: n }, (_, i) => ({
      x: world.w * (0.5 + 0.4 * ((i % 3) / 2)),
      y: i % 2 === 0 ? -30 : world.h + 30,
      enterFrom: i % 2 === 0 ? 'top' : 'bottom',
    }));
  },

  /** Already on the field when the encounter starts — ambushes. */
  ambush(n, world, o = {}) {
    const rng = world.rng;
    return Array.from({ length: n }, () => ({
      x: rng.float(world.w * 0.45, world.w * 0.95),
      y: rng.float(world.h * 0.12, world.h * 0.88),
    }));
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS);

// ---------------------------------------------------------------------------
// Wave scheduling
// ---------------------------------------------------------------------------

export class Spawner {
  /**
   * @param encounter  the encounter definition
   * @param threat     node threat level, used to scale enemies and budgets
   */
  constructor(encounter, threat, rng) {
    this.encounter = encounter;
    this.threat = threat;
    this.rng = rng;
    this.waves = (encounter.waves || []).map((w, i) => ({ ...w, index: i, fired: false }));
    this.addBossArrival();
    this.waves.forEach((w, i) => { w.index = i; });
    this.time = 0;
    /** Set once every wave has fired, so the sim knows "clear" is achievable. */
    this.exhausted = this.waves.length === 0;
    this.spawnedTotal = 0;
  }

  /**
   * Give a capital ship an arrival.
   *
   * A boss that is simply present at t=0 has no entrance — you are fighting it
   * before you have registered that it is there. Where a boss-tagged group
   * would open the encounter alone, a screen of escorts goes in front of it and
   * the capital ship follows a few seconds later, out of the same fight.
   */
  addBossArrival() {
    const first = this.waves[0];
    if (!first) return;
    const bossGroups = (first.spawn || []).filter(g => g.tag === 'boss');
    if (bossGroups.length === 0) return;
    // Only when the boss IS the opening — an encounter that already leads with
    // escorts is staged the way its author intended.
    if (bossGroups.length !== (first.spawn || []).length) return;

    for (const g of bossGroups) g.wait = Math.max(g.wait || 0, BOSS_ARRIVAL_DELAY);
    this.waves.unshift({
      at: 0,
      fired: false,
      synthetic: true,
      spawn: [{
        budget: 0.5,
        pool: ['picket', 'wasp', 'interceptor', 'gunship', 'seeker'],
        formation: 'v',
        delay: 0.3,
      }],
    });
  }

  /** Advance the schedule, returning spawn requests to realise this frame. */
  update(dt, world) {
    this.time += dt;
    const requests = [];
    let anyPending = false;

    for (const wave of this.waves) {
      if (wave.fired) continue;
      anyPending = true;
      if (this.triggered(wave, world)) {
        wave.fired = true;
        requests.push(...this.realise(wave, world));
      }
    }

    this.exhausted = !anyPending || this.waves.every(w => w.fired);
    return requests;
  }

  triggered(wave, world) {
    // Explicit time trigger.
    if (wave.at != null) return this.time >= wave.at;
    // Trigger on the field thinning out.
    if (wave.after === 'cleared') return world.enemies.length === 0 && this.previousFired(wave);
    if (typeof wave.whenRemaining === 'number') {
      return world.enemies.length <= wave.whenRemaining && this.previousFired(wave);
    }
    // Default: fire immediately.
    return true;
  }

  previousFired(wave) {
    return this.waves.slice(0, wave.index).every(w => w.fired);
  }

  /** Expand a wave's groups into concrete spawn requests. */
  realise(wave, world) {
    const out = [];
    for (const group of wave.spawn || []) {
      const ids = this.resolveIds(group);
      if (ids.length === 0) continue;
      const formation = FORMATIONS[group.formation] || FORMATIONS.line;
      const points = formation(ids.length, world, group);
      ids.forEach((id, i) => {
        const def = ENEMIES[id];
        if (!def) return;
        out.push({
          def: scaleEnemy(def, this.threat + (group.threatBonus || 0)),
          x: points[i]?.x ?? world.w + 40,
          y: points[i]?.y ?? world.h / 2,
          enterFrom: points[i]?.enterFrom || 'right',
          delay: (group.delay || 0) * i + (group.wait || 0),
          elite: !!group.elite,
          slotX: (points[i]?.x ?? 0) - world.w,
          slotY: (points[i]?.y ?? 0) - world.h / 2,
          tag: group.tag || null,
        });
        this.spawnedTotal++;
      });
    }
    return out;
  }

  resolveIds(group) {
    if (group.id) return Array(Math.max(1, group.count || 1)).fill(group.id);
    if (group.ids) return [...group.ids];
    if (group.budget) {
      const objective = this.encounter.objective?.kind;
      const sustained = objective === 'survive' || objective === 'reach' ? 0.72 : 1;
      const budget = standardBudget(this.threat) * group.budget * sustained;
      return fillBudget(this.rng, group.pool || Object.keys(ENEMIES), budget, {
        maxCount: group.maxCount || 90,
      });
    }
    return [];
  }

  /** True when the script is finished and nothing is left alive. */
  isComplete(world) {
    // Ignore corpses: compact() does not run until the end of the frame.
    return this.exhausted
      && !world.enemies.some(e => !e.dead)
      && world.pendingSpawns.length === 0;
  }
}
