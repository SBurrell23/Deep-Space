/**
 * Canvas rendering.
 *
 * Two surfaces:
 *  - the backdrop canvas, a parallax starfield that lives behind every screen;
 *  - the stage canvas, which draws the action simulation.
 *
 * Nothing here mutates game state. The world is drawn from whatever the sim
 * produced this frame, so the renderer can be replaced without touching the
 * simulation — which is also what lets the playtester run without one.
 *
 * The sim's play field is a fixed 960x540. This module letterboxes that into
 * whatever canvas it is given, so no screen size confers an advantage.
 */

import * as pixel from './pixel.js';
import { RNG, cosmetic } from '../core/rng.js';
import { WORLD_W, WORLD_H } from '../game/sim.js';
import { TERRAIN_STYLES, TILE as TERRAIN_TILE } from '../game/terrain.js';

export const C = {
  void: '#05070f', deep: '#0a0f1e', panel: '#121a2e',
  hull: '#2b3557', hullEdge: '#5f74ab',
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
/** Viewport size the starfield was generated for, so resizes regenerate it. */
let starfieldSize = { w: 0, h: 0 };

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
  // Never zero: drawImage() throws InvalidStateError on a 0-sized source, and
  // a page can genuinely boot at zero size (a background tab, a hidden frame).
  cv.width = Math.max(1, Math.floor(w));
  cv.height = Math.max(1, Math.floor(h));
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
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = buildStars(w, h);
  starfieldSize = { w, h };
  nebulaCanvas = null;
}

/**
 * @param mood 'menu' | 'travel' | 'combat' — changes drift speed and tint.
 */
export function drawBackdrop(canvas, t, mood = 'menu', tint = null) {
  const w = window.innerWidth, h = window.innerHeight;
  // A zero-sized viewport (a background tab, a collapsed frame) has nothing to
  // draw into, and every canvas call against it is either wasted or throws.
  if (w <= 0 || h <= 0) return;

  // Rebuild if the window changed size since the field was generated —
  // otherwise a page that booted small keeps a stale, undersized starfield.
  if (!stars || starfieldSize.w !== w || starfieldSize.h !== h) resizeBackdrop(canvas);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, w, h);

  if (!nebulaCanvas) {
    nebulaCanvas = buildNebula(w, h, tint
      ? `rgba(${hexToRgb(tint)}, ALPHA)`
      : 'rgba(40, 90, 160, ALPHA)');
  }
  ctx.drawImage(nebulaCanvas, 0, 0, w, h);

  const drift = mood === 'combat' ? 30 : mood === 'travel' ? 26 : 3;
  for (const layer of stars) {
    ctx.fillStyle = C.white;
    for (const p of layer.pts) {
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
 * How the 960x540 field maps into the canvas. Returned so input can convert a
 * mouse position back into world coordinates using exactly the same transform.
 */
export function viewport(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  const scale = Math.min(w / WORLD_W, h / WORLD_H);
  return {
    scale,
    ox: (w - WORLD_W * scale) / 2,
    oy: (h - WORLD_H * scale) / 2,
    w, h,
  };
}

export function screenToWorld(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const v = viewport(canvas);
  return {
    x: (clientX - rect.left - v.ox) / v.scale,
    y: (clientY - rect.top - v.oy) / v.scale,
  };
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const BOOM = ['fx_boom0', 'fx_boom1', 'fx_boom2', 'fx_boom3', 'fx_boom4'];
const HIT = ['fx_hit0', 'fx_hit1', 'fx_hit2'];

export class EffectLayer {
  constructor() { this.items = []; this.shake = 0; }

  add(fx) {
    this.items.push({ t: 0, dur: 0.4, ...fx });
    // Hard cap: a chaotic fight can queue hundreds of sparks, and past a point
    // they are indistinguishable anyway.
    if (this.items.length > 260) this.items.splice(0, this.items.length - 260);
  }

  boom(x, y, size = 24, big = false) {
    this.add({ kind: 'boom', x, y, dur: big ? 0.75 : 0.45, scale: Math.max(1, size / 16) });
    this.shake = Math.min(16, this.shake + (big ? 9 : 2.5));
  }

  hit(x, y, crit = false) { this.add({ kind: 'hit', x, y, dur: 0.2, crit }); }
  spark(x, y) { this.add({ kind: 'spark', x, y, dur: 0.3, vx: cosmetic.float(-60, 60), vy: cosmetic.float(-60, 60) }); }
  shieldPop(x, y) { this.add({ kind: 'shieldpop', x, y, dur: 0.3 }); }
  beam(x, y, angle, length) { this.add({ kind: 'beam', x, y, angle, length, dur: 0.09 }); }
  chain(x1, y1, x2, y2) { this.add({ kind: 'chain', x1, y1, x2, y2, dur: 0.16 }); }
  ring(x, y, radius, colour) { this.add({ kind: 'ring', x, y, radius, colour, dur: 0.42 }); }
  text(x, y, text, colour) { this.add({ kind: 'text', x, y, text, colour, dur: 0.85 }); }
  dash(x, y) { this.add({ kind: 'dash', x, y, dur: 0.22 }); }

  update(dt) {
    for (const fx of this.items) {
      fx.t += dt;
      if (fx.kind === 'spark') { fx.x += fx.vx * dt; fx.y += fx.vy * dt; }
      if (fx.kind === 'text') fx.y -= 34 * dt;
    }
    this.items = this.items.filter(fx => fx.t < fx.dur);
    this.shake = Math.max(0, this.shake - dt * 34);
  }

  draw(ctx) {
    for (const fx of this.items) {
      const p = fx.t / fx.dur;
      switch (fx.kind) {
        case 'boom': {
          const frame = BOOM[Math.min(BOOM.length - 1, Math.floor(p * BOOM.length))];
          safeSprite(ctx, frame, fx.x, fx.y, Math.max(1, Math.round(fx.scale)), { center: true, alpha: 1 - p * 0.25 });
          break;
        }
        case 'hit': {
          const frame = HIT[Math.min(HIT.length - 1, Math.floor(p * HIT.length))];
          safeSprite(ctx, frame, fx.x, fx.y, fx.crit ? 2 : 1, { center: true });
          break;
        }
        case 'spark':
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = C.amber;
          ctx.fillRect(Math.round(fx.x), Math.round(fx.y), 2, 2);
          ctx.globalAlpha = 1;
          break;
        case 'shieldpop':
          safeSprite(ctx, 'fx_shield_hit' + (p < 0.5 ? '0' : '1'), fx.x, fx.y, 1, { center: true, alpha: 1 - p });
          break;
        case 'beam': {
          ctx.save();
          ctx.globalAlpha = (1 - p) * 0.9;
          ctx.strokeStyle = C.white;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(fx.x, fx.y);
          ctx.lineTo(fx.x + Math.cos(fx.angle) * fx.length, fx.y + Math.sin(fx.angle) * fx.length);
          ctx.stroke();
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 9;
          ctx.globalAlpha = (1 - p) * 0.3;
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'chain':
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 2;
          jaggedLine(ctx, fx.x1, fx.y1, fx.x2, fx.y2);
          ctx.restore();
          break;
        case 'ring':
          ctx.save();
          ctx.globalAlpha = (1 - p) * 0.8;
          ctx.strokeStyle = fx.colour || C.cyan;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius * (0.25 + p * 0.9), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          break;
        case 'dash':
          safeSprite(ctx, 'fx_dash', fx.x, fx.y, 1, { center: true, alpha: 1 - p });
          break;
        case 'text':
          ctx.save();
          ctx.globalAlpha = 1 - p * p;
          ctx.fillStyle = fx.colour || C.white;
          ctx.font = 'bold 13px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(fx.text, fx.x, fx.y);
          ctx.restore();
          break;
      }
    }
  }
}

function jaggedLine(ctx, x1, y1, x2, y2) {
  const segs = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    ctx.lineTo(x1 + (x2 - x1) * t + cosmetic.float(-7, 7), y1 + (y2 - y1) * t + cosmetic.float(-7, 7));
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Turn one frame of simulation events into effects and sound requests.
 * Returns the sound names to play, so audio stays out of the renderer.
 */
export function consumeEvents(events, fx) {
  const sounds = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'fire': if (ev.sound) sounds.push([ev.sound, 90]); break;
      case 'enemyFire': sounds.push(['laser_light', 160]); break;
      case 'hit': fx.hit(ev.x, ev.y, ev.crit); if (ev.crit) sounds.push(['system_damage', 120]); break;
      case 'explode':
        fx.boom(ev.x, ev.y, ev.size || 24, ev.big);
        sounds.push([ev.big ? 'explosion_large' : 'explosion_small', ev.big ? 0 : 110]);
        break;
      case 'shieldHit': fx.shieldPop(ev.x, ev.y); sounds.push(['shield_hit', 140]); break;
      case 'playerShieldHit': fx.shieldPop(ev.x, ev.y); sounds.push(['shield_hit', 120]); break;
      case 'playerHit':
        fx.hit(ev.x, ev.y);
        fx.shake = Math.min(18, fx.shake + 5);
        sounds.push(['hull_hit', 120]);
        break;
      case 'terrainHit': fx.spark(ev.x, ev.y); sounds.push(['asteroid_hit', 200]); break;
      case 'heal': fx.text(ev.x, ev.y - 20, `+${Math.round(ev.amount)}`, C.green); sounds.push(['crew_heal', 200]); break;
      case 'pickup': sounds.push(['purchase', 60]); break;
      case 'dash': fx.dash(ev.x, ev.y); sounds.push(['power_up', 90]); break;
      case 'beam': fx.beam(ev.x, ev.y, ev.angle, ev.length); sounds.push(['beam', 240]); break;
      case 'chain': fx.chain(ev.x1, ev.y1, ev.x2, ev.y2); sounds.push(['ion', 160]); break;
      case 'ability': sounds.push(['overdrive', 0]); fx.ring(ev.x, ev.y, 90, C.cyan); break;
      case 'emp': fx.ring(ev.x, ev.y, ev.radius, C.cyan); sounds.push(['hack_land', 0]); break;
      case 'shieldRestored': fx.ring(ev.x, ev.y, 70, C.cyan); sounds.push(['shield_up', 0]); break;
      case 'kill': if (ev.boss || ev.elite) sounds.push(['ship_destroyed', 0]); break;
      case 'launch': sounds.push(['drone_launch', 200]); break;
      case 'playerDestroyed': fx.boom(ev.x, ev.y, 90, true); sounds.push(['ship_destroyed', 0]); break;
      case 'encounterCleared': sounds.push(['confirm', 0]); break;
      case 'dryFire': sounds.push(['power_fail', 400]); break;
    }
  }
  return sounds;
}

// ---------------------------------------------------------------------------
// World rendering
// ---------------------------------------------------------------------------

/** Draw one frame of the simulation into the stage canvas. */
export function drawWorld(canvas, world, fx, t) {
  const ctx = canvas.getContext('2d');
  const v = viewport(canvas);
  ctx.clearRect(0, 0, v.w, v.h);

  ctx.save();
  const shakeX = fx.shake ? cosmetic.float(-fx.shake, fx.shake) : 0;
  const shakeY = fx.shake ? cosmetic.float(-fx.shake, fx.shake) : 0;
  ctx.translate(v.ox + shakeX, v.oy + shakeY);
  ctx.scale(v.scale, v.scale);

  // Field edge, so the play area reads as a bounded arena.
  ctx.strokeStyle = 'rgba(79,227,245,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, WORLD_W - 1, WORLD_H - 1);

  // Clip to the field: nothing should spill into the letterbox.
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  ctx.clip();

  if (world.corridor) drawCorridor(ctx, world);
  drawObstacles(ctx, world, t);
  drawPickups(ctx, world, t);
  drawDrones(ctx, world);
  drawEnemies(ctx, world, t);
  drawPlayerBullets(ctx, world);
  drawEnemyBullets(ctx, world);
  drawPlayer(ctx, world, t);
  drawOffscreenWarnings(ctx, world, t);
  fx.draw(ctx);

  ctx.restore();
}

function drawCorridor(ctx, world) {
  const cor = world.corridor;
  const style = TERRAIN_STYLES[cor.style] || TERRAIN_STYLES.rock;
  const startCol = Math.floor(world.scrollX / TERRAIN_TILE);
  const cols = Math.ceil(WORLD_W / TERRAIN_TILE) + 2;

  ctx.fillStyle = style.tint;
  for (let i = 0; i < cols; i++) {
    const col = cor.columns[startCol + i];
    if (!col) continue;
    const x = i * TERRAIN_TILE - (world.scrollX % TERRAIN_TILE);
    // Solid fill above the ceiling and below the floor, then a lit lip tile on
    // each surface so the edge reads instead of being a flat silhouette.
    ctx.fillRect(x, 0, TERRAIN_TILE + 1, col.ceil);
    ctx.fillRect(x, col.floor, TERRAIN_TILE + 1, WORLD_H - col.floor);
    safeSprite(ctx, style.top, x, col.ceil - TERRAIN_TILE, 1);
    safeSprite(ctx, style.bot, x, col.floor, 1);
  }

  // A hazard line right on the surface, so "this is the wall" is unmissable.
  ctx.strokeStyle = 'rgba(255,92,114,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < cols; i++) {
    const col = cor.columns[startCol + i];
    if (!col) continue;
    const x = i * TERRAIN_TILE - (world.scrollX % TERRAIN_TILE);
    if (i === 0) ctx.moveTo(x, col.ceil); else ctx.lineTo(x, col.ceil);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < cols; i++) {
    const col = cor.columns[startCol + i];
    if (!col) continue;
    const x = i * TERRAIN_TILE - (world.scrollX % TERRAIN_TILE);
    if (i === 0) ctx.moveTo(x, col.floor); else ctx.lineTo(x, col.floor);
  }
  ctx.stroke();
}

function drawObstacles(ctx, world, t) {
  for (const o of world.obstacles) {
    if (o.dead) continue;
    const scale = Math.max(1, Math.round(o.size / 12));
    safeSprite(ctx, o.sprite || 'bg_asteroid0', o.x, o.y, scale, { center: true, rot: o.rot || 0 });
  }
}

function drawPickups(ctx, world, t) {
  for (const p of world.pickups) {
    if (p.dead) continue;
    // Blink out as they expire, so a fading pickup is legible as urgent.
    const expiring = p.life < 2.5;
    if (expiring && Math.floor(t * 8) % 2 === 0) continue;
    const bob = Math.sin(t * 4 + p.x * 0.05) * 2;
    safeSprite(ctx, p.sprite, p.x, p.y + bob, 1, { center: true });
  }
}

function drawDrones(ctx, world) {
  for (const d of world.drones) {
    if (d.dead) continue;
    safeSprite(ctx, d.sprite || 'drone_combat', d.x, d.y, 1, { center: true });
  }
  for (const d of world.decoys) {
    if (d.dead) continue;
    safeSprite(ctx, 'drone_defense', d.x, d.y, 1, { center: true, alpha: 0.75 });
  }
}

function drawEnemies(ctx, world, t) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    const hidden = e.cloak && e.cloak.hidden;
    const alpha = hidden ? 0.22 : 1;

    // Shield bubble.
    if (e.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28 * (e.shield / Math.max(1, e.maxShield)) * alpha;
      ctx.strokeStyle = C.cyanDim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r + 10, e.r + 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // An aura source is worth marking: it is why the rest are not dying.
    if (e.aura) {
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.04 * Math.sin(t * 3);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.aura.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    safeSprite(ctx, e.sprite, e.x, e.y, e.drawScale || 1, {
      center: true,
      alpha,
      tint: e.hitFlash > 0.35 ? '#ffffff' : null,
    });

    if (e.elite || e.isBoss) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x - e.r - 4, e.y - e.r - 4, (e.r + 4) * 2, (e.r + 4) * 2);
      ctx.restore();
      drawHealthBar(ctx, e);
    } else if (e.hull < e.maxHull) {
      drawHealthBar(ctx, e);
    }
  }
}

function drawHealthBar(ctx, e) {
  const w = Math.max(22, e.w * 0.8);
  const x = e.x - w / 2;
  const y = e.y - e.r - 11;
  const frac = Math.max(0, e.hull / e.maxHull);
  ctx.fillStyle = 'rgba(5,7,15,0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = frac > 0.5 ? C.green : frac > 0.25 ? C.amber : C.red;
  ctx.fillRect(x, y, w * frac, 3);
}

function drawPlayerBullets(ctx, world) {
  for (const b of world.bullets) {
    if (b.dead) continue;
    safeSprite(ctx, b.sprite, b.x, b.y, Math.max(1, Math.round(b.scale || 1)), {
      center: true, rot: b.angle,
    });
  }
}

function drawEnemyBullets(ctx, world) {
  for (const b of world.eBullets) {
    if (b.dead || b.delay > 0) continue;
    safeSprite(ctx, b.sprite, b.x, b.y, 1, { center: true, rot: b.angle });
  }
}

function drawPlayer(ctx, world, t) {
  const p = world.player;
  if (world.state === 'lost' && p.hull <= 0) return;

  // Shield bubble.
  if (p.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.13 + 0.22 * (p.shield / Math.max(1, p.maxShield));
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 40, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Engine flame.
  const flame = ['fx_thrust0', 'fx_thrust1', 'fx_thrust2'][Math.floor(t * 14) % 3];
  safeSprite(ctx, flame, p.x - 34, p.y - 3, 1, { center: true });

  // Invulnerability (dash i-frames, phase shift) reads as a strobe.
  const invulnBlink = p.invuln > 0 && Math.floor(t * 20) % 2 === 0;
  safeSprite(ctx, p.sprite, p.x, p.y, 1, {
    center: true,
    alpha: invulnBlink ? 0.35 : 1,
    tint: p.hitFlash > 0.4 ? '#ff5c72' : null,
  });

  // Charge indicator for charge-behaviour weapons.
  if (p.charging > 0) {
    const wep = p.chargingWhich === 'secondary' ? p.secondary : p.primary;
    const frac = Math.min(1, p.charging / (wep?.chargeTime || 1));
    ctx.save();
    ctx.strokeStyle = frac >= 1 ? C.amber : C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Chevrons for threats about to enter the field. */
function drawOffscreenWarnings(ctx, world, t) {
  for (const e of world.enemies) {
    if (e.dead || e.x <= WORLD_W) continue;
    const y = Math.max(14, Math.min(WORLD_H - 14, e.y));
    safeSprite(ctx, 'fx_warn', WORLD_W - 16, y, 1, {
      center: true,
      alpha: 0.4 + 0.4 * Math.sin(t * 8),
    });
  }
}

/**
 * Draw a sprite, tolerating a missing one.
 *
 * Art is authored in separate files by separate passes; a name that has not
 * landed yet should leave a visible placeholder rather than throwing inside the
 * frame loop and killing the whole render.
 */
export function safeSprite(ctx, name, x, y, scale = 1, opts = {}) {
  try {
    pixel.draw(ctx, name, x, y, scale, opts);
  } catch {
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.fillStyle = C.purple;
    const s = 8 * scale;
    ctx.fillRect(Math.round(x - (opts.center ? s / 2 : 0)), Math.round(y - (opts.center ? s / 2 : 0)), s, s);
    ctx.restore();
  }
}

/** A sprite as a standalone canvas, for the DOM UI. */
export function spriteEl(name, scale = 2) {
  try {
    const src = pixel.raster(name, scale);
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    return cv;
  } catch {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 12 * scale;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a1a5c';
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }
}
