/**
 * Canvas rendering.
 *
 * Two surfaces:
 *  - the backdrop canvas, a parallax starfield that lives behind every screen;
 *  - the stage canvas, which draws the ships, crew and combat effects.
 *
 * Nothing here mutates game state. Everything is drawn from a run/combat
 * snapshot, so the renderer can be dropped or replaced without touching the
 * simulation.
 */

import * as pixel from './pixel.js';
import { RNG, cosmetic } from '../core/rng.js';
import { compiledLayout, SHIPS } from '../game/ships.js';
import { SYSTEMS, effectiveLevel } from '../game/systems.js';
import { getRace } from '../game/crew.js';
import { getWeapon } from '../game/weapons.js';

export const TILE = 30;

const C = {
  void: '#05070f', deep: '#0a0f1e', panel: '#121a2e',
  hull: '#2b3557', hullEdge: '#5f74ab', room: '#212d4d', roomLit: '#2a3a60',
  grid: '#33426b',
  cyan: '#4fe3f5', cyanDim: '#17a2b8',
  amber: '#ffcc5c', amberDim: '#d98c1f',
  red: '#ff5c72', redDim: '#b3243c',
  green: '#5cf59b', greenDim: '#22b35c',
  purple: '#c07ef5',
  white: '#e8f0ff', steel: '#8494b8', dim: '#5a6a91',
};

// ---------------------------------------------------------------------------
// Backdrop starfield
// ---------------------------------------------------------------------------

let stars = null;
let nebulaCanvas = null;

function buildStars(w, h, seed = 7) {
  const rng = new RNG(seed);
  const layers = [
    { count: Math.round(w * h / 5200), speed: 0.9, size: 1, alpha: 0.42 },
    { count: Math.round(w * h / 9000), speed: 2.1, size: 1, alpha: 0.68 },
    { count: Math.round(w * h / 22000), speed: 4.0, size: 2, alpha: 0.95 },
  ];
  return layers.map(l => ({
    ...l,
    pts: Array.from({ length: Math.max(8, l.count) }, () => ({
      x: rng.float(0, w), y: rng.float(0, h),
      tw: rng.float(0, Math.PI * 2),
      tws: rng.float(0.4, 1.8),
    })),
  }));
}

/** A soft nebula wash, rendered once and reused — cheap and it sells depth. */
function buildNebula(w, h, hue) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const rng = new RNG(hue.length * 31 + w);
  for (let i = 0; i < 5; i++) {
    const x = rng.float(0, w), y = rng.float(0, h);
    const r = rng.float(w * 0.15, w * 0.42);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hue.replace('ALPHA', '0.10'));
    g.addColorStop(0.55, hue.replace('ALPHA', '0.035'));
    g.addColorStop(1, hue.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return cv;
}

export function resizeBackdrop(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = buildStars(window.innerWidth, window.innerHeight);
  nebulaCanvas = null;
}

/**
 * @param mood  'menu' | 'travel' | 'combat' — changes drift speed and tint.
 */
export function drawBackdrop(canvas, t, mood = 'menu', tint = null) {
  const ctx = canvas.getContext('2d');
  const w = window.innerWidth, h = window.innerHeight;
  if (!stars) resizeBackdrop(canvas);

  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, w, h);

  if (!nebulaCanvas) {
    nebulaCanvas = buildNebula(w, h, tint
      ? `rgba(${hexToRgb(tint)}, ALPHA)`
      : 'rgba(40, 90, 160, ALPHA)');
  }
  ctx.drawImage(nebulaCanvas, 0, 0, w, h);

  const drift = mood === 'combat' ? 7 : mood === 'travel' ? 26 : 3;
  for (const layer of stars) {
    ctx.fillStyle = C.white;
    for (const p of layer.pts) {
      // Wrap horizontally so the field scrolls forever.
      const x = (p.x - t * drift * layer.speed) % w;
      const px = x < 0 ? x + w : x;
      const twinkle = 0.62 + 0.38 * Math.sin(t * p.tws + p.tw);
      ctx.globalAlpha = layer.alpha * twinkle;
      ctx.fillRect(Math.round(px), Math.round(p.y), layer.size, layer.size);
    }
  }
  ctx.globalAlpha = 1;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ');
}

/** Force the nebula to regenerate — call when the sector changes. */
export function invalidateNebula() { nebulaCanvas = null; }

// ---------------------------------------------------------------------------
// Stage sizing
// ---------------------------------------------------------------------------

export function resizeStage(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { w: rect.width, h: rect.height };
}

/**
 * Where each ship's interior is drawn. Returned so hit-testing (clicking a
 * room) uses exactly the same geometry the renderer used.
 */
export function layoutFrames(ship, enemy, w, h, showEnemyInterior) {
  const pl = compiledLayout(ship.shipId, ship.variant);
  const pw = pl.width * TILE, ph = pl.height * TILE;

  // Panels and the weapon bar eat into the stage; keep the ships clear of them.
  const insetX = 300, insetTop = 40, insetBottom = 130;
  const availW = Math.max(240, w - insetX - 40);
  const availH = Math.max(180, h - insetTop - insetBottom);

  if (!enemy) {
    // On the map there is only one ship, so let it fill the room it has.
    const scale = clamp(Math.min(availW * 0.78 / pw, availH * 0.8 / ph), 0.7, 2.4);
    const fw = pw * scale, fh = ph * scale;
    return {
      scale,
      player: {
        x: Math.round(insetX + (availW - fw) / 2),
        y: Math.round(insetTop + (availH - fh) / 2),
        w: fw, h: fh, layout: pl, scale,
      },
      enemy: null,
    };
  }

  const el = compiledLayout(enemy.shipId, enemy.variant);
  const ew = el.width * TILE, eh = el.height * TILE;
  const gap = Math.max(40, availW * 0.05);

  // A silhouette enemy occupies only as much room as its sprite needs, which
  // leaves the player's deck — the thing you actually read during a fight —
  // considerably more space.
  const exteriorW = 64 * 4, exteriorH = 40 * 4;
  const enemyW = showEnemyInterior ? ew : exteriorW;
  const enemyH = showEnemyInterior ? eh : exteriorH;

  const scale = clamp(
    Math.min((availW - gap) / (pw + enemyW), availH * 0.82 / Math.max(ph, enemyH)),
    0.55, 1.7);

  const totalW = (pw + enemyW) * scale + gap;
  const left = Math.round(insetX + (availW - totalW) / 2);
  const midY = insetTop + availH / 2;

  return {
    scale,
    player: { x: left, y: Math.round(midY - ph * scale / 2), w: pw * scale, h: ph * scale, layout: pl, scale },
    enemy: {
      x: Math.round(left + pw * scale + gap),
      y: Math.round(midY - enemyH * scale / 2),
      w: enemyW * scale, h: enemyH * scale, layout: el, scale,
      interior: showEnemyInterior,
    },
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------------------------------------------------------------------------
// Ship interiors
// ---------------------------------------------------------------------------

/**
 * Draw a ship's interior: hull plate, rooms, systems, hazards and crew.
 * `opts.selectedCrew`, `opts.hoverRoom`, `opts.targetRooms` drive the overlays.
 */
export function drawShipInterior(ctx, ship, frame, t, opts = {}) {
  const { layout } = frame;
  const s = frame.scale || 1;
  const tile = TILE * s;

  // A soft dark plate under the whole hull. Without it the ship dissolves
  // into the starfield and nothing on the deck reads.
  ctx.save();
  const padX = tile * 0.9, padY = tile * 0.9;
  const g = ctx.createRadialGradient(
    frame.x + frame.w / 2, frame.y + frame.h / 2, Math.min(frame.w, frame.h) * 0.2,
    frame.x + frame.w / 2, frame.y + frame.h / 2, Math.max(frame.w, frame.h) * 0.75);
  g.addColorStop(0, 'rgba(4,7,16,.92)');
  g.addColorStop(1, 'rgba(4,7,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(frame.x - padX * 2, frame.y - padY * 2, frame.w + padX * 4, frame.h + padY * 4);
  ctx.restore();

  ctx.save();
  ctx.translate(frame.x, frame.y);

  // Hull plate behind the rooms.
  ctx.fillStyle = C.hull;
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 2;
  for (const room of layout.rooms) {
    roundRect(ctx, room.x * tile - 3, room.y * tile - 3, room.w * tile + 6, room.h * tile + 6, 4);
    ctx.fill();
    ctx.stroke();
  }

  for (const room of layout.rooms) {
    drawRoom(ctx, ship, room, tile, t, opts);
  }

  drawDoors(ctx, ship, tile);

  // Crew, drawn last so they sit above the deck.
  for (const c of ship.crew) {
    if (c.dead || c.onEnemyShip) continue;
    drawCrew(ctx, c, tile, t, opts.selectedCrew === c.id);
  }
  // Boarders from the other ship.
  for (const b of opts.boarders || []) {
    if (b.dead) continue;
    const room = layout.rooms[b.room];
    if (!room) continue;
    drawCrewAt(ctx, b, (room.x + room.w / 2) * tile, (room.y + room.h / 2) * tile, tile, t, false, true);
  }

  ctx.restore();

  if (opts.showShields !== false) drawShieldBubble(ctx, ship, frame, t);
}

function drawRoom(ctx, ship, room, tile, t, opts) {
  const state = ship.rooms[room.id] || { oxygen: 1, fire: 0, breaches: 0 };
  const x = room.x * tile, y = room.y * tile;
  const w = room.w * tile, h = room.h * tile;

  // Floor, tinted by how much air is left.
  const o2 = Math.max(0, Math.min(1, state.oxygen));
  ctx.fillStyle = o2 > 0.6 ? C.room : mix(C.room, '#3a1020', 1 - o2);
  ctx.fillRect(x, y, w, h);

  // Tile grid.
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < room.w; i++) { ctx.moveTo(x + i * tile, y); ctx.lineTo(x + i * tile, y + h); }
  for (let j = 1; j < room.h; j++) { ctx.moveTo(x, y + j * tile); ctx.lineTo(x + w, y + j * tile); }
  ctx.stroke();

  // Vacuum hatching, so an airless room is obvious at a glance.
  if (o2 < 0.5) {
    ctx.save();
    ctx.globalAlpha = (0.5 - o2) * 0.7;
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -h; i < w; i += 8) {
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // System icon and damage state.
  const sys = room.system ? ship.systems[room.system] : null;
  if (room.system) {
    const def = SYSTEMS[room.system];
    const cx = x + w / 2, cy = y + h / 2;
    const iconScale = Math.max(1, Math.round(tile / 16));
    const installed = !!sys;
    const dmg = sys ? sys.damage / Math.max(1, sys.level) : 0;

    ctx.save();
    ctx.globalAlpha = installed ? (dmg > 0.99 ? 0.35 : 0.95) : 0.2;
    const tint = !installed ? C.dim
      : sys.hackActive ? C.purple
        : sys.ionCharges > 0 ? C.cyan
          : dmg > 0 ? C.red
            : null;
    try {
      pixel.draw(ctx, def.icon, cx, cy, iconScale, { center: true, tint });
    } catch { /* a missing icon must never break the frame */ }
    ctx.restore();

    // Damage bar under the icon.
    if (sys && sys.damage > 0) {
      const bw = w * 0.6, bx = cx - bw / 2, by = y + h - 7;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = C.red;
      ctx.fillRect(bx, by, bw * (1 - dmg), 3);
    }
  }

  // Fire.
  if (state.fire > 0) drawFire(ctx, x, y, w, h, state.fire, t, room.id);

  // Breach.
  if (state.breaches > 0) {
    for (let i = 0; i < state.breaches; i++) {
      const bx = x + w * (0.25 + 0.5 * ((i * 7) % 3) / 3);
      const by = y + h * 0.5;
      drawBreach(ctx, bx, by, t + i);
    }
  }

  // Room outline.
  ctx.strokeStyle = opts.hoverRoom === room.id ? C.cyan : C.hullEdge;
  ctx.lineWidth = opts.hoverRoom === room.id ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Weapon target marker.
  if ((opts.targetRooms || []).includes(room.id)) {
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 2;
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.globalAlpha = pulse;
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    // Corner ticks.
    const k = 7;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2 + k); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + 2 + k, y + 2);
    ctx.moveTo(x + w - 2 - k, y + 2); ctx.lineTo(x + w - 2, y + 2); ctx.lineTo(x + w - 2, y + 2 + k);
    ctx.moveTo(x + 2, y + h - 2 - k); ctx.lineTo(x + 2, y + h - 2); ctx.lineTo(x + 2 + k, y + h - 2);
    ctx.moveTo(x + w - 2 - k, y + h - 2); ctx.lineTo(x + w - 2, y + h - 2); ctx.lineTo(x + w - 2, y + h - 2 - k);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawFire(ctx, x, y, w, h, intensity, t, seed) {
  const n = Math.ceil(intensity * 5) + 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = t * 3.4 + i * 1.9 + seed;
    const fx = x + 6 + ((i * 37 + seed * 11) % Math.max(1, w - 12));
    const fy = y + h - 6 - (Math.sin(ph) * 0.5 + 0.5) * h * 0.55 * intensity;
    const r = (3 + Math.sin(ph * 1.7) * 1.6) * (0.6 + intensity);
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 2.2);
    g.addColorStop(0, 'rgba(255,240,180,.95)');
    g.addColorStop(0.35, 'rgba(255,170,40,.72)');
    g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBreach(ctx, x, y, t) {
  ctx.save();
  const pulse = 0.7 + 0.3 * Math.sin(t * 4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
  g.addColorStop(0, `rgba(120,200,255,${0.7 * pulse})`);
  g.addColorStop(0.5, 'rgba(60,120,200,.28)');
  g.addColorStop(1, 'rgba(20,40,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  // The jagged hole itself.
  ctx.fillStyle = '#04060d';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 3.2 + ((i * 13) % 5) * 0.6;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDoors(ctx, ship, tile) {
  for (const d of ship.doors) {
    const x = d.x * tile, y = d.y * tile;
    const len = tile * 0.52;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    if (d.breached) ctx.strokeStyle = C.redDim;
    else if (d.open) ctx.strokeStyle = C.cyanDim;
    else ctx.strokeStyle = C.steel;

    ctx.beginPath();
    if (d.isAirlock) {
      // Airlocks sit on the hull edge; draw them as a short double bar.
      ctx.strokeStyle = d.open ? C.cyan : C.dim;
      ctx.moveTo(x - len / 2, y);
      ctx.lineTo(x + len / 2, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - len / 3, y - 4);
      ctx.lineTo(x + len / 3, y - 4);
    } else if (d.vertical) {
      const gap = d.open ? len * 0.42 : 0;
      ctx.moveTo(x, y - len / 2); ctx.lineTo(x, y - gap / 2);
      ctx.moveTo(x, y + gap / 2); ctx.lineTo(x, y + len / 2);
    } else {
      const gap = d.open ? len * 0.42 : 0;
      ctx.moveTo(x - len / 2, y); ctx.lineTo(x - gap / 2, y);
      ctx.moveTo(x + gap / 2, y); ctx.lineTo(x + len / 2, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawCrew(ctx, c, tile, t, selected) {
  drawCrewAt(ctx, c, c.x * tile, c.y * tile, tile, t, selected, false);
}

function drawCrewAt(ctx, c, px, py, tile, t, selected, hostile) {
  const race = getRace(c.race);
  const moving = !!(c.path && c.path.length);
  const frame = moving
    ? (Math.floor(t * 6) % 2 ? 'walk1' : 'walk0')
    : (Math.floor(t * 1.4) % 2 ? 'idle1' : 'idle0');
  const name = `${race.sprite}_${frame}`;
  const scale = Math.max(1, Math.round(tile / 15));

  // Selection ring.
  if (selected) {
    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 6);
    ctx.beginPath();
    ctx.ellipse(px, py + 6 * scale, 8 * scale, 3.6 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (hostile) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,92,114,.2)';
    ctx.beginPath();
    ctx.ellipse(px, py + 6 * scale, 8 * scale, 3.6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  try {
    pixel.draw(ctx, name, px, py, scale, { center: true });
  } catch {
    // Missing frame: fall back to a coloured dot rather than dropping a crew
    // member out of the picture entirely.
    ctx.fillStyle = hostile ? C.red : C.cyan;
    ctx.fillRect(px - 4, py - 4, 8, 8);
  }

  // Health pip under anyone who is hurt.
  if (c.hp < c.maxHp) {
    const bw = 14 * (scale / 2);
    const frac = c.hp / c.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(px - bw / 2, py + 8 * scale, bw, 2.5);
    ctx.fillStyle = frac > 0.5 ? C.green : frac > 0.25 ? C.amber : C.red;
    ctx.fillRect(px - bw / 2, py + 8 * scale, bw * frac, 2.5);
  }
  // Fighting marker.
  if (c.fighting) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 14);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 1.5;
    const r = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
    ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
    ctx.stroke();
    ctx.restore();
  }
  if (c.stunned > 0) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = C.amber;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      ctx.fillRect(px + Math.cos(a) * 9 - 1, py - 11 * scale / 2 + Math.sin(a) * 3, 2, 2);
    }
    ctx.restore();
  }
  if (c.mindControlled > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5);
    ctx.fillStyle = C.purple;
    ctx.beginPath();
    ctx.arc(px, py, 9 * scale / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Shield ellipse around a ship, one ring per remaining layer. */
export function drawShieldBubble(ctx, ship, frame, t) {
  const layers = ship.shields.layers + (ship.superShield || 0);
  if (layers <= 0 && !ship.cloakTimer) return;

  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  // Hug the hull rather than ballooning: the bubble should read as armour on
  // the ship, not as a planet it is sitting inside.
  const rx = frame.w / 2 + 22;
  const ry = frame.h / 2 + 22;

  ctx.save();
  if (ship.cloakTimer > 0) {
    ctx.strokeStyle = C.purple;
    ctx.globalAlpha = 0.28 + 0.18 * Math.sin(t * 8);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let i = 0; i < layers; i++) {
    const grow = i * 7;
    const superShield = i >= ship.shields.layers;
    ctx.strokeStyle = superShield ? C.amber : C.cyan;
    ctx.globalAlpha = (superShield ? 0.5 : 0.34) - i * 0.03 + 0.08 * Math.sin(t * 2.2 + i);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + grow, ry + grow, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Faint inner wash so the bubble reads as a volume, not just rings.
  const g = ctx.createRadialGradient(cx, cy, ry * 0.6, cx, cy, ry + layers * 7);
  g.addColorStop(0, 'rgba(79,227,245,0)');
  g.addColorStop(1, 'rgba(79,227,245,.07)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + layers * 7, ry + layers * 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** An enemy the player's sensors can't see inside: draw the hull silhouette. */
export function drawShipExterior(ctx, ship, frame, t) {
  const sprite = ship.sprite || SHIPS[ship.shipId]?.sprite || 'enemy_fighter';
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  // Cap the blow-up: past about 4x, hand-placed pixels stop reading as art and
  // start reading as coloured rectangles.
  const scale = Math.max(2, Math.min(4, Math.round(frame.w / 64)));
  const bob = Math.sin(t * 0.9) * 3;

  ctx.save();
  if (ship.cloakTimer > 0) ctx.globalAlpha = 0.32;
  try {
    pixel.draw(ctx, sprite, cx, cy + bob, scale, { center: true });
  } catch {
    ctx.fillStyle = C.steel;
    ctx.fillRect(frame.x, frame.y + frame.h / 3, frame.w, frame.h / 3);
  }
  ctx.restore();

  // Damage smoke as the hull gets chewed up.
  const hurt = 1 - ship.hull / Math.max(1, ship.maxHull);
  if (hurt > 0.3) {
    ctx.save();
    for (let i = 0; i < Math.floor(hurt * 5); i++) {
      const ph = t * 1.2 + i * 2.3;
      const sx = cx + Math.sin(ph * 0.7 + i) * frame.w * 0.3;
      const sy = cy + bob - (ph % 3) * 16;
      ctx.globalAlpha = 0.24 * (1 - (ph % 3) / 3);
      ctx.fillStyle = i % 2 ? '#5a6a91' : '#b3243c';
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + (ph % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Combat effects
// ---------------------------------------------------------------------------

export function drawProjectiles(ctx, combat, frames) {
  for (const p of combat.projectiles) {
    if (p.t < 0) continue;
    const from = p.from === 'player' ? frames.player : frames.enemy;
    const to = p.from === 'player' ? frames.enemy : frames.player;
    if (!from || !to) continue;

    const targetRoom = to.layout.rooms[p.targetRoom];
    const sx = from.x + (p.from === 'player' ? from.w + 6 : -6);
    const sy = from.y + from.h * 0.5;
    const tx = to.x + (targetRoom ? (targetRoom.x + targetRoom.w / 2) * TILE * (to.scale || 1) : to.w / 2);
    const ty = to.y + (targetRoom ? (targetRoom.y + targetRoom.h / 2) * TILE * (to.scale || 1) : to.h / 2);

    const k = Math.min(1, p.t);
    // A gentle arc reads better than a straight line.
    const x = sx + (tx - sx) * k;
    const y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 26;
    const angle = Math.atan2(ty - sy, tx - sx);

    const sprite = p.def.sprite || 'proj_laser';
    try {
      pixel.draw(ctx, sprite, x, y, 2, { center: true, rot: angle, flip: p.from === 'enemy' });
    } catch {
      ctx.fillStyle = C.amber;
      ctx.fillRect(x - 3, y - 1, 6, 2);
    }

    // Trail.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = p.def.type === 'ion' ? C.cyan : p.def.type === 'missile' ? C.amber : C.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * 22, y - Math.sin(angle) * 22);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBeams(ctx, combat, frames) {
  for (const b of combat.beams) {
    const to = b.target === combat.player ? frames.player : frames.enemy;
    const from = b.target === combat.player ? frames.enemy : frames.player;
    if (!to || !from) continue;

    const scale = to.scale || 1;
    const pts = b.rooms.map(id => {
      const r = to.layout.rooms[id];
      return r
        ? { x: to.x + (r.x + r.w / 2) * TILE * scale, y: to.y + (r.y + r.h / 2) * TILE * scale }
        : { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    });
    if (pts.length === 0) continue;

    const k = Math.min(1, b.progress);
    const idx = Math.min(pts.length - 1, Math.floor(k * pts.length));
    const head = pts[idx];
    const origin = { x: from.x + (b.target === combat.player ? -8 : from.w + 8), y: from.y + from.h / 2 };

    ctx.save();
    ctx.lineCap = 'round';
    // Outer glow, then the hot core.
    ctx.strokeStyle = 'rgba(255,92,114,.28)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,210,.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    try { pixel.draw(ctx, 'proj_beam_head', head.x, head.y, 2, { center: true }); } catch { /* optional */ }
    ctx.restore();
  }
}

/**
 * Transient visual effects (hits, explosions, floating text). The UI pushes
 * entries in; this drains them.
 */
export class EffectLayer {
  constructor() { this.items = []; }

  add(kind, x, y, opts = {}) {
    this.items.push({ kind, x, y, t: 0, life: opts.life ?? 0.6, ...opts });
  }

  update(dt) {
    for (const it of this.items) it.t += dt;
    this.items = this.items.filter(it => it.t < it.life);
  }

  draw(ctx) {
    for (const it of this.items) {
      const k = it.t / it.life;
      switch (it.kind) {
        case 'hit': {
          const frame = Math.min(2, Math.floor(k * 3));
          try { pixel.draw(ctx, `fx_hit${frame}`, it.x, it.y, 2, { center: true, alpha: 1 - k * 0.4 }); }
          catch { /* optional */ }
          break;
        }
        case 'boom': {
          const frame = Math.min(4, Math.floor(k * 5));
          try { pixel.draw(ctx, `fx_boom${frame}`, it.x, it.y, it.scale || 3, { center: true }); }
          catch { /* optional */ }
          break;
        }
        case 'shield': {
          ctx.save();
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.strokeStyle = it.color || C.cyan;
          ctx.lineWidth = 3 * (1 - k) + 1;
          ctx.beginPath();
          ctx.arc(it.x, it.y, 10 + k * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'text': {
          ctx.save();
          ctx.globalAlpha = 1 - k * k;
          ctx.font = `${it.size || 15}px ${getComputedStyle(document.body).fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = it.color || C.white;
          ctx.shadowColor = 'rgba(0,0,0,.9)';
          ctx.shadowBlur = 4;
          ctx.fillText(it.text, it.x, it.y - k * 34);
          ctx.restore();
          break;
        }
        case 'teleport': {
          const frame = Math.min(2, Math.floor(k * 3));
          try { pixel.draw(ctx, `fx_teleport${frame}`, it.x, it.y, 2, { center: true }); }
          catch { /* optional */ }
          break;
        }
        default:
          break;
      }
    }
  }

  clear() { this.items.length = 0; }
}

// ---------------------------------------------------------------------------
// Scene props
// ---------------------------------------------------------------------------

/** A planet or station parked in the background of the current beacon. */
export function drawSceneProp(ctx, prop, w, h, t) {
  if (!prop) return;
  const x = prop.x * w, y = prop.y * h;
  try {
    pixel.draw(ctx, prop.sprite, x, y + Math.sin(t * 0.35) * 4, prop.scale || 3,
      { center: true, alpha: prop.alpha ?? 0.75 });
  } catch { /* optional decoration */ }
}

export function pickSceneProp(rng, beaconType) {
  const planets = ['bg_planet_rocky', 'bg_planet_gas', 'bg_planet_ice', 'bg_planet_lava'];
  if (beaconType === 'store') return { sprite: 'bg_station', x: 0.82, y: 0.24, scale: 3, alpha: 0.85 };
  if (beaconType === 'repair') return { sprite: 'bg_station', x: 0.2, y: 0.22, scale: 2, alpha: 0.7 };
  if (rng.chance(0.55)) {
    return { sprite: rng.pick(planets), x: rng.float(0.12, 0.86), y: rng.float(0.16, 0.32), scale: rng.int(2, 4), alpha: 0.72 };
  }
  if (rng.chance(0.4)) return { sprite: 'bg_wreck', x: rng.float(0.2, 0.8), y: 0.24, scale: 2, alpha: 0.6 };
  return null;
}

// ---------------------------------------------------------------------------
// Star map
// ---------------------------------------------------------------------------

/**
 * Draw the beacon map. Returns hit boxes so the modal can map a click back to
 * a beacon without duplicating the layout maths.
 */
export function drawStarMap(canvas, map, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pad = 46;
  const iw = w - pad * 2, ih = h - pad * 2;
  const px = b => pad + b.x * iw;
  const py = b => pad + b.y * ih;

  ctx.fillStyle = '#060912';
  ctx.fillRect(0, 0, w, h);

  // Fleet front: everything left of this line is overrun.
  const fleetX = pad + ((map.fleetColumn + 0.5) / 6) * iw;
  if (fleetX > 0) {
    const g = ctx.createLinearGradient(0, 0, Math.max(1, fleetX), 0);
    g.addColorStop(0, 'rgba(179,36,60,.32)');
    g.addColorStop(1, 'rgba(179,36,60,.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Math.max(0, fleetX), h);
    ctx.strokeStyle = 'rgba(255,92,114,.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(fleetX, 0); ctx.lineTo(fleetX, h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5c72';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SWARM FLEET', Math.max(4, fleetX - 88), 15);
  }

  const current = map.beacons.find(b => b.id === map.currentId);
  const reachable = new Set(current ? current.links : []);

  // Links first, so nodes sit on top.
  ctx.lineWidth = 1;
  for (const b of map.beacons) {
    for (const l of b.links) {
      if (l < b.id) continue;
      const o = map.beacons.find(x => x.id === l);
      if (!o) continue;
      const live = (b.id === map.currentId && reachable.has(o.id))
        || (o.id === map.currentId && reachable.has(b.id));
      ctx.strokeStyle = live ? 'rgba(79,227,245,.55)' : 'rgba(90,106,145,.22)';
      ctx.lineWidth = live ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(px(b), py(b));
      ctx.lineTo(px(o), py(o));
      ctx.stroke();
    }
  }

  const boxes = [];
  for (const b of map.beacons) {
    const x = px(b), y = py(b);
    const isCurrent = b.id === map.currentId;
    const canGo = reachable.has(b.id);
    const r = isCurrent ? 13 : canGo ? 11 : 9;

    // Halo for anything you can jump to.
    if (canGo) {
      ctx.save();
      ctx.globalAlpha = 0.42 + 0.22 * Math.sin((opts.t || 0) * 3 + b.id);
      ctx.strokeStyle = '#4fe3f5';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = b.fleet ? 'rgba(90,20,32,.9)' : '#0e1526';
    ctx.strokeStyle = isCurrent ? '#4fe3f5'
      : b.isExit ? '#5cf59b'
        : b.fleet ? '#b3243c'
          : b.visited ? '#3d4a6b'
            : canGo ? '#17a2b8' : '#26304d';
    ctx.lineWidth = isCurrent ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Icon, once the beacon is explored.
    if (b.explored || b.visited || opts.revealAll) {
      const icon = b.isExit ? 'icon_exit'
        : b.type === 'store' ? 'icon_shop'
          : b.type === 'hostile' ? 'icon_skull'
            : b.type === 'distress' ? 'icon_distress'
              : b.type === 'hazard' ? 'icon_hazard'
                : b.type === 'repair' ? 'icon_repair'
                  : 'icon_star';
      try { pixel.draw(ctx, icon, x, y, 1, { center: true }); }
      catch { /* fall through to the plain node */ }
    } else {
      ctx.fillStyle = '#5a6a91';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y + 0.5);
    }

    if (isCurrent) {
      ctx.save();
      ctx.strokeStyle = '#4fe3f5';
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.75;
      const k = 5, rr = r + 5;
      ctx.beginPath();
      ctx.moveTo(x - rr, y - rr + k); ctx.lineTo(x - rr, y - rr); ctx.lineTo(x - rr + k, y - rr);
      ctx.moveTo(x + rr - k, y - rr); ctx.lineTo(x + rr, y - rr); ctx.lineTo(x + rr, y - rr + k);
      ctx.moveTo(x - rr, y + rr - k); ctx.lineTo(x - rr, y + rr); ctx.lineTo(x - rr + k, y + rr);
      ctx.moveTo(x + rr - k, y + rr); ctx.lineTo(x + rr, y + rr); ctx.lineTo(x + rr, y + rr - k);
      ctx.stroke();
      ctx.restore();
    }

    boxes.push({ id: b.id, x, y, r: r + 8, canGo, beacon: b });
  }

  return boxes;
}

// ---------------------------------------------------------------------------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(a, b, k) {
  const pa = hexToRgb(a).split(', ').map(Number);
  const pb = hexToRgb(b).split(', ').map(Number);
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))));
  return `rgb(${out.join(',')})`;
}

/** Render a sprite into a standalone <canvas> for use in DOM lists. */
export function spriteEl(name, scale = 1, tint = null) {
  const el = document.createElement('canvas');
  let def;
  try { def = pixel.get(name); } catch { def = null; }
  if (!def) { el.width = el.height = 1; return el; }
  el.width = def.w * scale;
  el.height = def.h * scale;
  const ctx = el.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  try { pixel.draw(ctx, name, 0, 0, scale, { tint }); } catch { /* leave blank */ }
  return el;
}

export { C as COLORS, cosmetic };
