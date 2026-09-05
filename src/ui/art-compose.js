/**
 * Duelist sprite composition.
 *
 * A Hostiles node is one named ship now, and a hundred named ships is a
 * hundred sprites. Drawing a hundred 64x40 hulls by hand gets you a hundred
 * mediocre ones: the fiftieth is a traced copy of the ninth, and nobody can
 * hold that much silhouette in their head at once.
 *
 * So a duelist is assembled instead. Six slots — fuselage, nose, wing, pod,
 * engine, crest — each drawn once and well, painted over each other in that
 * order, then recoloured by one of fourteen palettes. Fourteen cores by ten
 * noses by fourteen wings by twelve pods by ten engines by ten crests is over
 * two million ships, which is considerably more than a hundred, and every one
 * of them is made of parts an artist actually drew.
 *
 * Parts are authored as the TOP HALF only — twenty rows — and mirrored here.
 * Ships are symmetric about their long axis, so half the art is half the work
 * and, more usefully, half the opportunities to draw a lopsided hull.
 *
 * Parts are written in the shared ramp (`1`-`4`, `w`, accents `o`/`a`/`A`,
 * glow `g`/`G`) rather than in colour, which is what lets one part serve a
 * rust-streaked privateer and a gilded cathedral without being redrawn.
 */

import { register } from './pixel.js';
import { CORE_PARTS, NOSE_PARTS } from './art-cores.js';
import { WING_PARTS, CREST_PARTS } from './art-wings.js';
import { ENGINE_PARTS, POD_PARTS } from './art-drive.js';

/** Half-canvas dimensions. The finished sprite is HALF_H * 2 tall. */
export const PART_W = 64;
export const PART_H = 20;
export const SPRITE_W = PART_W;
export const SPRITE_H = PART_H * 2;

/** The only characters a part may contain. */
export const PART_CHARS = new Set(['.', ' ', 'k', '1', '2', '3', '4', 'w', 'o', 'a', 'A', 'g', 'G']);

/** Outline black is not a palette choice — every hull in the game shares it. */
const OUTLINE = '#05070f';

/**
 * The fourteen liveries.
 *
 * `1`-`4` are the hull ramp dark to light and `w` its highlight; `o`/`a`/`A`
 * are the accent used for lenses, stripes and warning paint; `g`/`G` are the
 * drive glow. Keeping the accent and the glow separate is what stops every
 * ship reading as one colour with a lighter version of itself on the engines.
 */
export const DUEL_PALETTES = {
  crimson: { 1: '#2a1420', 2: '#3f1c2c', 3: '#5e2a3e', 4: '#8e4257', w: '#ffd8e0', o: '#5c1420', a: '#b3243c', A: '#ff5c72', g: '#b3243c', G: '#ff8fa0' },
  ember:   { 1: '#2e1a0a', 2: '#452714', 3: '#6b3d1c', 4: '#a4632c', w: '#ffe6c0', o: '#7a4a10', a: '#d98c1f', A: '#ffcc5c', g: '#d98c1f', G: '#ffd98a' },
  void:    { 1: '#141026', 2: '#1e1838', 3: '#2f2652', 4: '#4d3f7d', w: '#ded4ff', o: '#3a1a5c', a: '#7b3fb3', A: '#c07ef5', g: '#7b3fb3', G: '#c9a4ff' },
  verdant: { 1: '#0d2417', 2: '#153823', 3: '#215434', 4: '#3a8250', w: '#d8ffe4', o: '#145c33', a: '#22b35c', A: '#5cf59b', g: '#22b35c', G: '#8dffbd' },
  ion:     { 1: '#0a2029', 2: '#0f3240', 3: '#184c60', 4: '#2a7a94', w: '#d8fbff', o: '#0d5a6b', a: '#17a2b8', A: '#4fe3f5', g: '#17a2b8', G: '#7ff0ff' },
  bone:    { 1: '#2a2822', 2: '#413d34', 3: '#635d50', 4: '#948c79', w: '#fff6e2', o: '#6b5836', a: '#c2a468', A: '#ffe6a8', g: '#c2a468', G: '#ffeec0' },
  rust:    { 1: '#2a1a12', 2: '#3f2718', 3: '#5f3a22', 4: '#8d5a33', w: '#ffe0c2', o: '#7a3410', a: '#c26a22', A: '#ff9c4c', g: '#c26a22', G: '#ffb066' },
  abyss:   { 1: '#0a0f18', 2: '#111a28', 3: '#1c2a3e', 4: '#31465f', w: '#cfe0f0', o: '#0b3a44', a: '#128a8f', A: '#3fd6cf', g: '#128a8f', G: '#5ff0e6' },
  gold:    { 1: '#2e2410', 2: '#463618', 3: '#6b5224', 4: '#a37c33', w: '#fff2c8', o: '#7a5a10', a: '#d9a81f', A: '#ffe066', g: '#d9a81f', G: '#ffe98f' },
  frost:   { 1: '#1a2430', 2: '#283748', 3: '#3d5268', 4: '#5f7d99', w: '#f0fbff', o: '#2f5f7a', a: '#6fb2d6', A: '#bfe9ff', g: '#6fb2d6', G: '#d6f4ff' },
  plague:  { 1: '#1d2410', 2: '#2c3718', 3: '#435223', 4: '#697d33', w: '#f2ffc0', o: '#5c6b10', a: '#a8bf1f', A: '#dcf25c', g: '#a8bf1f', G: '#e8ff8f' },
  obsidian:{ 1: '#0d0d12', 2: '#16161d', 3: '#24242e', 4: '#3c3c4a', w: '#c8c8d8', o: '#4a1010', a: '#992020', A: '#e05050', g: '#992020', G: '#ff6a6a' },
  pearl:   { 1: '#26222e', 2: '#393343', 3: '#564d63', 4: '#82778f', w: '#fff4ff', o: '#4d3a6b', a: '#9a7fc4', A: '#d9c4ff', g: '#9a7fc4', G: '#eadcff' },
  magenta: { 1: '#2a0f26', 2: '#3f1738', 3: '#5f2454', 4: '#8e3a7e', w: '#ffdcf6', o: '#6b1057', a: '#c41f9c', A: '#ff6fd8', g: '#c41f9c', G: '#ff9ae4' },
};

export const PALETTE_IDS = Object.keys(DUEL_PALETTES);

/** Slot name to the bag it draws from, in paint order. */
export const PART_SETS = {
  core: CORE_PARTS,
  nose: NOSE_PARTS,
  wing: WING_PARTS,
  pod: POD_PARTS,
  engine: ENGINE_PARTS,
  crest: CREST_PARTS,
};

/** The order matters: later slots paint over earlier ones. */
export const PART_ORDER = ['core', 'nose', 'wing', 'pod', 'engine', 'crest'];

/**
 * Check one authored part. Returns an array of problems, empty when fine.
 *
 * Strict on purpose. A part one character short shifts every pixel to its
 * right by one row, which does not throw — it just quietly produces a smear,
 * and finding that by eye across fifty-six parts is not a thing anyone should
 * have to do.
 */
export function validatePart(slot, id, part) {
  const errs = [];
  const at = msg => errs.push(`${slot}/${id}: ${msg}`);
  if (!part || !Array.isArray(part.rows)) { at('missing rows'); return errs; }
  if (part.rows.length !== PART_H) at(`${part.rows.length} rows, expected ${PART_H}`);
  part.rows.forEach((row, y) => {
    if (typeof row !== 'string') { at(`row ${y} is not a string`); return; }
    if (row.length !== PART_W) at(`row ${y} is ${row.length} chars, expected ${PART_W}`);
    for (const ch of row) {
      if (!PART_CHARS.has(ch)) at(`row ${y} contains illegal character "${ch}"`);
    }
  });
  return errs;
}

export function validateAllParts() {
  const errors = [];
  for (const [slot, bag] of Object.entries(PART_SETS)) {
    for (const [id, part] of Object.entries(bag)) errors.push(...validatePart(slot, id, part));
  }
  return errors;
}

/**
 * Build the 64x40 character grid for one `art` descriptor.
 *
 * Returns rows only; the caller pairs them with a palette. Split out from
 * `composeSprite` so the bestiary can render a part-by-part breakdown without
 * registering a sprite for every intermediate stage.
 */
export function composeRows(art) {
  const top = Array.from({ length: PART_H }, () => new Array(PART_W).fill('.'));

  for (const slot of PART_ORDER) {
    const id = art[slot];
    if (id == null) continue;
    const part = PART_SETS[slot][id];
    if (!part) throw new Error(`unknown ${slot} part "${id}"`);
    for (let y = 0; y < PART_H; y++) {
      const row = part.rows[y];
      for (let x = 0; x < PART_W; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        top[y][x] = ch;
      }
    }
  }

  const rows = top.map(r => r.join(''));
  // Mirrored, not repeated: row 19 sits against the centre line and becomes
  // row 20, so the hull is continuous across the join rather than seamed.
  return [...rows, ...rows.slice().reverse()];
}

/** A sprite definition for the pixel engine: composed rows plus a livery. */
export function composeSprite(art) {
  const pal = DUEL_PALETTES[art.pal];
  if (!pal) throw new Error(`unknown palette "${art.pal}"`);
  return { pal: { ...pal, k: OUTLINE }, rows: composeRows(art) };
}

export const duelSpriteName = id => `duel_${id}`;

/**
 * Register every duelist's composed sprite under `duel_<id>`.
 *
 * Called once at start-up from art-shmup.js's side of the registry rather
 * than at module load, so a headless test can import the composer without
 * dragging in a hundred rasterisations it will never draw.
 */
export function registerDuelistArt(duelists) {
  const bag = {};
  for (const d of duelists) bag[duelSpriteName(d.id)] = composeSprite(d.duel.art);
  register(bag);
  return Object.keys(bag).length;
}
