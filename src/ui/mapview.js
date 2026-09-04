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
import { cosmetic } from '../core/rng.js';

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
      const bx = p.x + r * 0.78, by = p.y - r * 0.78;
      ctx.save();
      ctx.fillStyle = 'rgba(5,7,15,0.92)';
      ctx.beginPath();
      ctx.arc(bx, by, 9 * Math.max(0.8, z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = colour;
      ctx.font = `bold ${Math.round(10 * Math.max(0.85, z))}px ui-monospace, monospace`;
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
