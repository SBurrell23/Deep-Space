/**
 * Scrolling corridor terrain for tunnel and canyon encounters.
 *
 * The corridor is a column array: each column stores the ceiling and floor y at
 * that x. Generation walks left to right with a random-walk centre line and a
 * varying aperture, then post-processes to guarantee the run is actually
 * flyable — a procedurally generated cave that pinches shut is a softlock, so
 * the minimum aperture is enforced rather than hoped for.
 *
 * Collision is a cheap column lookup, which keeps it usable for bullets and
 * debris as well as the player.
 */

export const TILE = 16;

export const TERRAIN_STYLES = {
  rock: { mid: 'ter_rock_mid', top: 'ter_rock_top', bot: 'ter_rock_bot', decor: 'ter_crystal', tint: '#2a3550' },
  ice: { mid: 'ter_ice_mid', top: 'ter_ice_top', bot: 'ter_ice_bot', decor: 'ter_crystal', tint: '#3d4a6b' },
  metal: { mid: 'ter_metal_mid', top: 'ter_metal_top', bot: 'ter_metal_bot', decor: 'ter_vent', tint: '#2a3550' },
};

export class Corridor {
  /**
   * @param rng      seeded RNG
   * @param height   play-field height in px
   * @param length   total corridor length in px
   * @param o        { style, minAperture, maxAperture, roughness, chambers, pinches }
   */
  constructor(rng, height, length, o = {}) {
    this.style = o.style || 'rock';
    this.height = height;
    this.length = length;
    this.columnWidth = TILE;
    this.count = Math.ceil(length / TILE) + 4;
    this.minAperture = o.minAperture ?? Math.max(96, height * 0.30);
    this.maxAperture = o.maxAperture ?? height * 0.78;
    this.roughness = o.roughness ?? 1;
    this.columns = [];
    this.decor = [];
    this.generate(rng, o);
  }

  generate(rng, o) {
    const h = this.height;
    let centre = h / 2;
    let aperture = this.maxAperture * 0.85;
    let centreVel = 0;

    // Feature schedule: chambers open out, pinches squeeze down. Placing them
    // up front (rather than rolling per column) keeps spacing readable.
    const features = [];
    const nChambers = o.chambers ?? Math.floor(this.count / 90);
    const nPinches = o.pinches ?? Math.floor(this.count / 60);
    for (let i = 0; i < nChambers; i++) {
      const at = rng.int(20, this.count - 40);
      features.push({ at, len: rng.int(20, 40), kind: 'chamber' });
    }
    for (let i = 0; i < nPinches; i++) {
      const at = rng.int(20, this.count - 30);
      features.push({ at, len: rng.int(8, 16), kind: 'pinch' });
    }

    const featureAt = (i) => features.find(f => i >= f.at && i < f.at + f.len);

    for (let i = 0; i < this.count; i++) {
      const f = featureAt(i);

      // Random-walk the centre line with spring-back so it never leaves frame.
      centreVel += rng.float(-1, 1) * 2.4 * this.roughness;
      centreVel += (h / 2 - centre) * 0.004;
      centreVel = clamp(centreVel, -7, 7);
      centre = clamp(centre + centreVel, h * 0.26, h * 0.74);

      let targetAperture;
      if (f?.kind === 'chamber') targetAperture = this.maxAperture * 1.05;
      else if (f?.kind === 'pinch') targetAperture = this.minAperture * 1.06;
      else targetAperture = rng.float(this.minAperture * 1.25, this.maxAperture);

      aperture += (targetAperture - aperture) * 0.09;
      aperture = clamp(aperture, this.minAperture, this.maxAperture * 1.1);

      // The opening 12 columns are always wide, so you are never killed by the
      // terrain before you have seen it.
      const intro = i < 12 ? 1 + (12 - i) * 0.06 : 1;
      const half = (aperture * intro) / 2;

      this.columns.push({
        ceil: clamp(centre - half, 0, h - this.minAperture),
        floor: clamp(centre + half, this.minAperture, h),
      });
    }

    this.enforceAperture();
    this.placeDecor(rng);
  }

  /** Guarantee every column is passable, and smooth any cliff a fix introduced. */
  enforceAperture() {
    for (const c of this.columns) {
      const gap = c.floor - c.ceil;
      if (gap < this.minAperture) {
        const centre = (c.ceil + c.floor) / 2;
        c.ceil = centre - this.minAperture / 2;
        c.floor = centre + this.minAperture / 2;
      }
      c.ceil = clamp(c.ceil, 0, this.height - this.minAperture);
      c.floor = clamp(c.floor, c.ceil + this.minAperture, this.height);
    }
    // Two smoothing passes stop a corrected column from becoming a vertical
    // wall you cannot see coming.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < this.columns.length - 1; i++) {
        const p = this.columns[i - 1], c = this.columns[i], n = this.columns[i + 1];
        c.ceil = (p.ceil + c.ceil * 2 + n.ceil) / 4;
        c.floor = (p.floor + c.floor * 2 + n.floor) / 4;
      }
    }
  }

  placeDecor(rng) {
    for (let i = 4; i < this.columns.length - 4; i += rng.int(6, 18)) {
      const c = this.columns[i];
      const onCeiling = rng.chance(0.5);
      this.decor.push({
        x: i * TILE,
        y: onCeiling ? c.ceil + 6 : c.floor - 6,
        flip: onCeiling,
      });
    }
  }

  /** Ceiling/floor at a world x. Returns null past the end of the corridor. */
  at(x) {
    const i = Math.floor(x / TILE);
    if (i < 0) return this.columns[0];
    if (i >= this.columns.length) return null;
    return this.columns[i];
  }

  /** True if a circle at (x,y) overlaps rock. */
  collides(x, y, r = 0) {
    const c = this.at(x);
    if (!c) return false;
    return y - r < c.ceil || y + r > c.floor;
  }

  /**
   * Push a point out of the wall it is inside, returning the corrected y and
   * which surface it hit. Used to graze the player along the rock rather than
   * stopping them dead.
   */
  resolve(x, y, r = 0) {
    const c = this.at(x);
    if (!c) return { y, hit: null };
    if (y - r < c.ceil) return { y: c.ceil + r, hit: 'ceil' };
    if (y + r > c.floor) return { y: c.floor - r, hit: 'floor' };
    return { y, hit: null };
  }

  /** Centre of the passage at x — where escorts and pickups should sit. */
  centreAt(x) {
    const c = this.at(x);
    return c ? (c.ceil + c.floor) / 2 : this.height / 2;
  }

  apertureAt(x) {
    const c = this.at(x);
    return c ? c.floor - c.ceil : this.height;
  }

  get pixelLength() { return this.columns.length * TILE; }
}

/**
 * Free-floating obstacle field (asteroid belts, debris). Unlike the corridor
 * these are entities the sim can damage and destroy, so this only seeds them.
 */
export function seedObstacles(rng, world, o = {}) {
  const count = o.count ?? 18;
  const out = [];
  for (let i = 0; i < count; i++) {
    const size = o.size ?? rng.pick([16, 24, 24, 32, 40]);
    out.push({
      x: world.w + rng.float(40, world.w * (o.spreadX ?? 2.2)),
      y: rng.float(-20, world.h + 20),
      size,
      hull: Math.round(size * 1.4 * (o.toughness ?? 1)),
      vx: -(o.speed ?? rng.float(70, 150)),
      vy: rng.float(-26, 26),
      spin: rng.float(-1.6, 1.6),
      sprite: `bg_asteroid${rng.int(0, 2)}`,
      contact: (o.contact ?? 16),
    });
  }
  return out;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
