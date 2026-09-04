/**
 * The universe map.
 *
 * Draws the spiderweb, the fog, and everything the player needs to decide where
 * to go next. The central decision of a run is "is that node above my weight",
 * so threat is shown as a number AND colour-coded against the player's level —
 * a raw number alone makes the player do arithmetic every jump.
 *
 * Owns its own pan/zoom camera. Hit-testing uses the same transform as drawing,
 * so what you click is what you see.
 */

import { NODE_STATE } from '../game/universe.js';
import { ENCOUNTER_TYPES } from '../game/encounters/index.js';
import { safeSprite, C } from './render.js';
import PLANET_ART from './art-planets.js';
import { RNG } from '../core/rng.js';

/** Pixels per ring unit at zoom 1. */
const UNIT = 74;
const NODE_R = 15;

export class MapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.target = { x: 0, y: 0, zoom: 1 };
    this.hover = null;
    this.dragging = false;
    this.dragMoved = 0;
    this.last = { x: 0, y: 0 };
    this.t = 0;
    /** Node ids of a multi-hop route being previewed on hover. */
    this.path = [];
  }

  setPath(ids) { this.path = ids || []; }

  /** Centre on a node without animating — used when the map first opens. */
  snapTo(node) {
    this.cam.x = this.target.x = node.x * UNIT;
    this.cam.y = this.target.y = node.y * UNIT;
  }

  panTo(node) {
    this.target.x = node.x * UNIT;
    this.target.y = node.y * UNIT;
  }

  zoomBy(factor) {
    this.target.zoom = clamp(this.target.zoom * factor, 0.34, 2.2);
  }

  update(dt) {
    this.t += dt;
    // Critically damped-ish follow; snappy but never jarring.
    const k = Math.min(1, dt * 7);
    this.cam.x += (this.target.x - this.cam.x) * k;
    this.cam.y += (this.target.y - this.cam.y) * k;
    this.cam.zoom += (this.target.zoom - this.cam.zoom) * k;
  }

  size() {
    const r = this.canvas.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  /**
   * Keep the backing store in step with the CSS box. The map is hidden while a
   * fight is on, so a resize during combat never reaches it — without this the
   * map comes back stretched, or (on the frame it is first shown) 1x1.
   */
  syncSize() {
    const { w, h } = this.size();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const want = `${Math.round(w)}x${Math.round(h)}x${dpr}`;
    if (this.canvas.dataset.sized === want) return;
    this.canvas.dataset.sized = want;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** World (ring units) -> screen pixels. */
  project(node) {
    const { w, h } = this.size();
    return {
      x: w / 2 + (node.x * UNIT - this.cam.x) * this.cam.zoom,
      y: h / 2 + (node.y * UNIT - this.cam.y) * this.cam.zoom,
    };
  }

  /** Screen pixels -> the node under them, or null. */
  nodeAt(map, clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const r = (NODE_R + 6) * this.cam.zoom;
    let best = null, bestD = r * r;
    for (const n of map.nodes) {
      if (n.state === NODE_STATE.UNKNOWN) continue;
      const p = this.project(n);
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  // -------------------------------------------------------------------------

  /**
   * @param map        the universe
   * @param level      player level, for threat colouring
   * @param reachable  ids the player can jump to right now
   */
  draw(map, { level = 1, reachable = [], showAllThreat = false } = {}) {
    this.syncSize();
    const ctx = this.canvas.getContext('2d');
    const { w, h } = this.size();
    const reach = new Set(reachable.map(n => n.id));

    ctx.clearRect(0, 0, w, h);
    this.drawPlanets(ctx, map, w, h);
    this.drawNebulae(ctx, map, w, h);
    this.drawFog(ctx, w, h);

    // Ring guides, so "further out is worse" is legible at a glance. They are
    // orientation, not detail: once you are zoomed in picking a node they are
    // pure clutter, so fade them out as you close in.
    const ringAlpha = Math.max(0, Math.min(1, (0.95 - this.cam.zoom) / 0.35));
    if (ringAlpha > 0.01) {
      ctx.save();
      ctx.strokeStyle = `rgba(79,227,245,${(0.075 * ringAlpha).toFixed(3)})`;
      ctx.lineWidth = 1;
      const origin = this.project({ x: 0, y: 0 });
      for (let r = 1; r < map.rings; r++) {
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, r * UNIT * this.cam.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    this.drawLinks(ctx, map, reach);
    this.drawPath(ctx, map);

    // Nodes, far to near so the current node sits on top.
    const visible = map.nodes.filter(n => n.state !== NODE_STATE.UNKNOWN);
    for (const n of visible) this.drawNode(ctx, map, n, { level, reach, showAllThreat });

    if (map.masterFleetVisible) this.drawMasterFleetPointer(ctx, map, w, h);
  }

  /**
   * Coloured gas out past the edge of what you have charted.
   *
   * The unexplored map used to be flat black, which read as "nothing here"
   * rather than "you have not been there". Blobs are seeded from the map so
   * they hold still between frames and between sessions, and each fades out as
   * the player's frontier reaches its ring — the dark you have walked into
   * stops being mysterious.
   */
  nebulaeFor(map) {
    if (this._nebulaMap === map) return this._nebulae;
    const rng = new RNG(`${map.seed}:nebula`);
    const TINTS = [
      [92, 40, 150], [22, 86, 132], [130, 44, 96],
      [40, 96, 88], [120, 70, 30], [58, 48, 140],
    ];
    const out = [];
    for (let i = 0; i < 26; i++) {
      const ring = map.rings * (0.3 + rng.next() * 0.95);
      const angle = rng.next() * Math.PI * 2;
      const tint = TINTS[Math.floor(rng.next() * TINTS.length)];
      out.push({
        x: Math.cos(angle) * ring,
        y: Math.sin(angle) * ring,
        ring,
        radius: (1.1 + rng.next() * 2.4) * UNIT,
        tint,
        alpha: 0.2 + rng.next() * 0.26,
      });
    }
    this._nebulaMap = map;
    this._nebulae = out;
    return out;
  }

  /** How far out the player has charted, in rings. */
  frontierRing(map) {
    let far = 0;
    for (const n of map.nodes) {
      if (n.state !== NODE_STATE.UNKNOWN && n.ring > far) far = n.ring;
    }
    return far;
  }

  drawNebulae(ctx, map, w, h) {
    const frontier = this.frontierRing(map);
    const z = this.cam.zoom;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.nebulaeFor(map)) {
      // Fully lit two rings beyond the frontier, gone one ring inside it.
      const fade = Math.max(0, Math.min(1, (b.ring - frontier + 1) / 2.5));
      if (fade <= 0.02) continue;
      const p = this.project(b);
      const rad = b.radius * z;
      if (p.x < -rad || p.x > w + rad || p.y < -rad || p.y > h + rad) continue;

      const a = b.alpha * fade;
      const [cr, cg, cb] = b.tint;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(a * 0.42).toFixed(3)})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Background worlds.
   *
   * Scattered on a coarse jittered grid — one cell every eight ring units —
   * so panning turns one up every so often rather than a wall of them, and
   * drawn at a fraction of the camera's motion so they sit visibly far behind
   * the web. Dim on purpose: this is depth, not decoration to read.
   */
  planetsFor(map) {
    if (this._planetMap === map) return this._planets;
    const rng = new RNG(`${map.seed}:planets`);
    const names = Object.keys(PLANET_ART);
    const span = Math.ceil(map.rings * 1.3);
    // One candidate cell every four ring units, a third of them taken: about a
    // planet per screen at default zoom, which is the "one or two at a time"
    // the background wants.
    const CELL = 4;
    const out = [];

    for (let gx = -span; gx <= span; gx += CELL) {
      for (let gy = -span; gy <= span; gy += CELL) {
        if (rng.next() > 0.32) continue;
        out.push({
          x: gx + (rng.next() - 0.5) * CELL * 0.85,
          y: gy + (rng.next() - 0.5) * CELL * 0.85,
          name: names[Math.floor(rng.next() * names.length)],
          scale: 3 + Math.floor(rng.next() * 3),   // 3-5x on a 64px sprite
          alpha: 0.26 + rng.next() * 0.22,
          depth: 0.16 + rng.next() * 0.14,         // fraction of camera motion
        });
      }
    }
    this._planetMap = map;
    this._planets = out;
    return out;
  }

  drawPlanets(ctx, map, w, h) {
    if (!PLANET_ART) return;
    const z = this.cam.zoom;
    ctx.save();
    for (const pl of this.planetsFor(map)) {
      // Parallax: the further back it is, the less the camera moves it.
      const x = w / 2 + (pl.x * UNIT - this.cam.x * pl.depth) * z;
      const y = h / 2 + (pl.y * UNIT - this.cam.y * pl.depth) * z;
      const rad = 64 * pl.scale * z * 0.5;
      if (x < -rad || x > w + rad || y < -rad || y > h + rad) continue;
      safeSprite(ctx, pl.name, x, y, Math.max(1, Math.round(pl.scale * z)), {
        center: true,
        alpha: pl.alpha,
      });
    }
    ctx.restore();
  }

  /** A vignette that reads as "you cannot see out there". */
  drawFog(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(5,7,15,0)');
    g.addColorStop(0.65, 'rgba(5,7,15,0.35)');
    g.addColorStop(1, 'rgba(5,7,15,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawLinks(ctx, map, reach) {
    ctx.save();
    ctx.lineWidth = Math.max(1, 1.4 * this.cam.zoom);
    for (const n of map.nodes) {
      if (n.state === NODE_STATE.UNKNOWN) continue;
      const a = this.project(n);
      for (const id of n.links) {
        if (id < n.id) continue;            // draw each edge once
        const m = map.nodes[id];
        if (!m || m.state === NODE_STATE.UNKNOWN) continue;
        const b = this.project(m);

        const live = n.id === map.currentId || m.id === map.currentId;
        const jumpable = live && (reach.has(n.id) || reach.has(m.id));
        ctx.strokeStyle = jumpable ? 'rgba(255,204,92,0.6)'
          : live ? 'rgba(79,227,245,0.35)'
            : 'rgba(90,106,145,0.20)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The previewed multi-hop route, drawn as a marching dashed line. */
  drawPath(ctx, map) {
    if (this.path.length === 0) return;
    const pts = [map.nodes[map.currentId], ...this.path.map(id => map.nodes[id])]
      .filter(Boolean)
      .map(n => this.project(n));
    if (pts.length < 2) return;

    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = Math.max(2, 2.6 * this.cam.zoom);
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -this.t * 26;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Number the hops so the length of the trip is obvious.
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.cyan;
    ctx.font = `bold ${Math.round(10 * Math.max(0.85, this.cam.zoom))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i < pts.length; i++) {
      const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      ctx.fillStyle = 'rgba(5,7,15,0.9)';
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, 8 * Math.max(0.8, this.cam.zoom), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.cyan;
      ctx.fillText(String(i), mid.x, mid.y + 0.5);
    }
    ctx.restore();
  }

  drawNode(ctx, map, n, { level, reach, showAllThreat }) {
    const p = this.project(n);
    const { w, h } = this.size();
    // Cull generously: at low zoom the whole map is on screen anyway.
    if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) return;

    const z = this.cam.zoom;
    const r = NODE_R * z;
    const isCurrent = n.id === map.currentId;
    const canGo = reach.has(n.id);
    const seenOnly = n.state === NODE_STATE.SEEN;
    const def = ENCOUNTER_TYPES[n.type] || {};

    // Body.
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = n.cleared ? 'rgba(18,26,46,0.9)'
      : seenOnly ? 'rgba(10,15,30,0.92)' : 'rgba(24,34,60,0.95)';
    ctx.fill();
    ctx.lineWidth = isCurrent ? 2.5 : 1.4;
    ctx.strokeStyle = n.isMasterFleet ? C.red
      : isCurrent ? C.cyan
        : canGo ? C.amber
          : n.cleared ? 'rgba(90,106,145,0.5)' : 'rgba(132,148,184,0.45)';
    ctx.stroke();
    ctx.restore();

    // Icon.
    if (z > 0.5) {
      const icon = n.cleared ? 'node_cleared' : (def.icon || 'node_unknown');
      safeSprite(ctx, icon, p.x, p.y, Math.max(1, Math.round(z)), {
        center: true,
        alpha: n.cleared ? 0.5 : seenOnly ? 0.85 : 1,
      });
    }

    // Threat badge. This is the single most important number on the map, so it
    // is coloured against the player's level rather than shown raw.
    if (!n.cleared && n.threat > 0 && (z > 0.62 || canGo || showAllThreat)) {
      const delta = n.threat - level;
      const colour = delta <= -3 ? C.dim : delta <= 1 ? C.green
        : delta <= 3 ? C.amber : C.red;
      const bx = p.x + r * 0.8, by = p.y - r * 0.8;
      ctx.save();
      // Solid, not translucent: the threat number is read against whatever
      // happens to be behind it, and a see-through disc made it mush.
      ctx.fillStyle = '#05070f';
      ctx.beginPath();
      ctx.arc(bx, by, 7.4 * Math.max(0.85, z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.font = `bold ${Math.round(9 * Math.max(0.9, z))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n.threat), bx, by + 0.5);
      ctx.restore();
    }

    // Current-position brackets.
    if (isCurrent) {
      ctx.save();
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      const b = r + 7 + Math.sin(this.t * 3) * 1.5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(p.x + sx * b, p.y + sy * b - sy * 6);
        ctx.lineTo(p.x + sx * b, p.y + sy * b);
        ctx.lineTo(p.x + sx * b - sx * 6, p.y + sy * b);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Jumpable pulse.
    if (canGo && !isCurrent) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(this.t * 4 + n.id);
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // The Master Fleet gets a permanent, unmissable marker.
    if (n.isMasterFleet && map.masterFleetVisible) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(this.t * 2);
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 12 + Math.sin(this.t * 2) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * When the fleet is off screen, a compass on the screen edge. Without it the
   * player has no way to steer toward the thing the run is about.
   */
  drawMasterFleetPointer(ctx, map, w, h) {
    const mf = map.nodes[map.masterFleetId];
    const p = this.project(mf);
    if (p.x > 40 && p.x < w - 40 && p.y > 40 && p.y < h - 40) return;

    const cx = w / 2, cy = h / 2;
    const a = Math.atan2(p.y - cy, p.x - cx);
    const rad = Math.min(w, h) * 0.42;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 3);
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = C.red;
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MASTER FLEET', x, y + (Math.sin(a) > 0 ? 26 : -18));
    ctx.restore();
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Threat wording for tooltips — plainer than a bare number. */
export function threatLabel(threat, level) {
  const d = threat - level;
  if (d <= -3) return { text: 'Trivial', colour: C.dim };
  if (d <= 1) return { text: 'Even odds', colour: C.green };
  if (d <= 3) return { text: 'Dangerous', colour: C.amber };
  if (d <= 6) return { text: 'Severe', colour: C.red };
  return { text: 'Suicidal', colour: C.red };
}
