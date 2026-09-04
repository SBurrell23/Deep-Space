/**
 * Deterministic RNG. A run is fully reproducible from its seed, which makes
 * both the "daily seed" mode and the test suite possible.
 *
 * mulberry32 — small, fast, good enough distribution for a game.
 */
export class RNG {
  constructor(seed = Date.now()) {
    this.seed = typeof seed === 'string' ? RNG.hash(seed) : (seed >>> 0);
    this.state = this.seed >>> 0;
    this.calls = 0;
  }

  /** FNV-1a, so string seeds ("DEEP-SPACE-1") map to a stable integer. */
  static hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** Human-friendly seed like "VEGA-4817". */
  static friendlySeed(rng = Math.random) {
    const words = ['VEGA', 'ORION', 'LYRA', 'DRACO', 'CETUS', 'CORVUS', 'HYDRA', 'PAVO',
      'ARIES', 'MENSA', 'NORMA', 'OCTANS', 'PYXIS', 'VELA', 'TUCANA', 'CARINA'];
    const w = words[Math.floor(rng() * words.length)];
    return `${w}-${Math.floor(rng() * 9000 + 1000)}`;
  }

  next() {
    this.calls++;
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  float(min = 0, max = 1) { return min + this.next() * (max - min); }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return Math.floor(this.float(min, max + 1));
  }

  /** True with probability p. */
  chance(p) { return this.next() < p; }

  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick n distinct items (or all of them, if n exceeds the pool). */
  sample(arr, n) {
    const pool = [...arr];
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    return out;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Weighted pick. Accepts [{ w, ...}] or a parallel weights array.
   * Items with weight <= 0 are never chosen.
   */
  weighted(items, weightKey = 'weight') {
    const ws = items.map(it => Math.max(0, typeof it === 'object' ? (it[weightKey] ?? 1) : 1));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Roughly-normal value via the mean of 3 uniforms, clamped to [min,max]. */
  gaussian(mean, spread, min = -Infinity, max = Infinity) {
    const r = (this.next() + this.next() + this.next()) / 3;
    return Math.max(min, Math.min(max, mean + (r - 0.5) * 2 * spread));
  }

  /** Fork a child stream — lets one subsystem draw numbers without shifting another's. */
  fork(salt = '') {
    return new RNG((this.state ^ RNG.hash(String(salt))) >>> 0);
  }

  serialize() { return { seed: this.seed, state: this.state, calls: this.calls }; }

  static deserialize(data) {
    const r = new RNG(data.seed);
    r.state = data.state >>> 0;
    r.calls = data.calls || 0;
    return r;
  }
}

/** Shared instance for cosmetic, non-gameplay randomness (particles, flicker). */
export const cosmetic = new RNG(Date.now() ^ 0x9e3779b9);
