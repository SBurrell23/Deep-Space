/**
 * Deep Space — pixel sprite engine.
 *
 * Sprites are authored as arrays of equal-length strings. Each character is a
 * key into the sprite's own `pal` map; the character `.` (and a space) is always
 * transparent. This keeps art diffable, testable and dependency-free.
 *
 *   { w: 4, h: 2, pal: { a: '#ff0000' }, rows: ['.aa.', 'a..a'] }
 *
 * Sprites are rasterised once into an offscreen canvas and cached by
 * `name@scale`, so per-frame drawing is a single drawImage call.
 */

export const TRANSPARENT = '.';

const cache = new Map();
const registry = new Map();

/** Register a bag of sprites: { name: spriteDef, ... } */
export function register(bag) {
  for (const [name, def] of Object.entries(bag)) {
    registry.set(name, normalize(name, def));
  }
}

export function get(name) {
  return registry.get(name) || null;
}

export function names() {
  return [...registry.keys()];
}

/**
 * Validate + fill in derived fields. Throws loudly on malformed art so broken
 * sprites are caught by the test suite instead of silently drawing nothing.
 */
export function normalize(name, def) {
  if (!def || !Array.isArray(def.rows) || def.rows.length === 0) {
    throw new Error(`sprite "${name}": missing rows`);
  }
  const h = def.rows.length;
  const w = def.rows[0].length;
  for (let y = 0; y < h; y++) {
    if (def.rows[y].length !== w) {
      throw new Error(`sprite "${name}": row ${y} is ${def.rows[y].length}px, expected ${w}`);
    }
  }
  const pal = def.pal || {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = def.rows[y][x];
      if (ch === TRANSPARENT || ch === ' ') continue;
      if (!pal[ch]) throw new Error(`sprite "${name}": char "${ch}" at ${x},${y} is not in the palette`);
    }
  }
  return { name, w, h, pal, rows: def.rows, anchor: def.anchor || 'topleft' };
}

/** Rasterise a sprite to an offscreen canvas at an integer scale. */
export function raster(name, scale = 1, tint = null) {
  const key = `${name}@${scale}${tint ? '~' + tint : ''}`;
  if (cache.has(key)) return cache.get(key);
  const def = registry.get(name);
  if (!def) throw new Error(`unknown sprite "${name}"`);

  const cv = makeCanvas(def.w * scale, def.h * scale);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < def.h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < def.w; x++) {
      const ch = row[x];
      if (ch === TRANSPARENT || ch === ' ') continue;
      ctx.fillStyle = def.pal[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  if (tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  cache.set(key, cv);
  return cv;
}

/**
 * Draw a sprite. `opts.center` draws around (x,y); `opts.flip` mirrors on X;
 * `opts.alpha` and `opts.tint` composite. Coordinates are rounded so pixels
 * stay on the grid.
 */
export function draw(ctx, name, x, y, scale = 1, opts = {}) {
  const cv = raster(name, scale, opts.tint || null);
  const dx = Math.round(opts.center ? x - cv.width / 2 : x);
  const dy = Math.round(opts.center ? y - cv.height / 2 : y);
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = false;
  if (opts.flip || opts.rot) {
    ctx.save();
    ctx.translate(dx + cv.width / 2, dy + cv.height / 2);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.flip) ctx.scale(-1, 1);
    ctx.drawImage(cv, -cv.width / 2, -cv.height / 2);
    ctx.restore();
  } else {
    ctx.drawImage(cv, dx, dy);
  }
  ctx.globalAlpha = prevAlpha;
}

/** Size of a sprite at a given scale, without rasterising it. */
export function measure(name, scale = 1) {
  const def = registry.get(name);
  if (!def) throw new Error(`unknown sprite "${name}"`);
  return { w: def.w * scale, h: def.h * scale };
}

export function clearCache() {
  cache.clear();
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  throw new Error('no canvas implementation available');
}
