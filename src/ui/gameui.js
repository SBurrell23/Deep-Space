/**
 * The in-game interface.
 *
 * Owns the top bar, the combat HUD, the map surface and every phase modal
 * (brief, debrief, anomaly, shop, level-up, inventory). It reads the run and
 * calls into run.js; it never mutates game state itself beyond UI-only fields.
 *
 * The phase machine in run.js is the single source of truth for what should be
 * on screen — `syncPhase` reacts to it rather than tracking its own idea of
 * where the player is, so the two can never disagree.
 */

import { $, $$, el, append, clear, show, tooltip, tipContent, hideTooltip } from './dom.js';
import { openModal, closeModal, isModalOpen, toast, showScreen } from './screens.js';
import * as render from './render.js';
import { spriteEl } from './render.js';
import { MapView, threatLabel } from './mapview.js';
import { play } from '../audio/sfx.js';
import * as music from '../audio/music.js';
import * as R from '../game/run.js';
import * as S from '../game/ship.js';
import * as U from '../game/universe.js';
import { ENCOUNTER_TYPES } from '../game/encounters/index.js';
import { ATTRIBUTES, previewPoint, xpToNext, MAX_LEVEL, ATTR_CAP } from '../game/attributes.js';
import { SLOTS, SLOTS_BY_ID, RARITY_BY_ID, describeItem, sellValue, powerScore, ABILITIES } from '../game/items.js';

export const ui = {
  effects: new render.EffectLayer(),
  map: null,
  lastPhase: null,
  autofire: true,
  hoverNode: null,
  logLines: [],
};

let game = null;
const run = () => game.run;

export function attach(ctx) {
  game = ctx;
  ui.map = new MapView($('#mapcanvas'));
  bindTopbar();
  bindMap();
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function bindTopbar() {
  $('#topbar').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'pause-menu') openPauseMenu();
    else if (action === 'settings') game.openSettings();
    else if (action === 'inventory') openInventory();
  });
  $('#point-pip').addEventListener('click', () => openLevelUp());
}

export function renderTopbar() {
  const r = run();
  if (!r) return;
  const ship = r.ship;

  const credits = $('#res-credits');
  const b = credits.querySelector('b');
  if (b.textContent !== String(ship.credits)) b.textContent = ship.credits;
  const icon = credits.querySelector('i');
  if (!icon.dataset.drawn) { icon.dataset.drawn = '1'; icon.append(spriteEl('icon_credits', 1)); }

  $('#level-num').textContent = ship.progress.level;
  const need = xpToNext(ship.progress.level);
  const frac = need === Infinity ? 1 : ship.progress.xp / need;
  $('#xp-fill').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  $('#xp-text').textContent = need === Infinity
    ? 'MAX' : `${Math.round(ship.progress.xp)} / ${need} XP`;

  const pts = ship.progress.unspentPoints;
  show($('#point-pip'), pts > 0);
  $('#point-count').textContent = pts;

  const node = r.node || U.currentNode(r.map);
  $('#node-label').textContent = node?.encounterName || 'Deep Space';
  $('#node-sub').textContent = node
    ? `Ring ${node.ring} · Threat ${node.threat} · ${ENCOUNTER_TYPES[node.type]?.label || ''}`
    : '';

  const hfrac = Math.max(0, ship.hull / ship.stats.maxHull);
  const state = hfrac <= 0.25 ? 'critical' : hfrac <= 0.55 ? 'hurt' : '';
  const readout = $('#hull-readout');
  readout.innerHTML = `HULL <b>${Math.round(ship.hull)}</b>/${ship.stats.maxHull}`;
  readout.className = `hull-readout ${state}`;
  $('#hull-fill').style.width = `${hfrac * 100}%`;
  $('#hull-bar').className = `hull-bar ${state}`;

  renderShipButton(ship, hfrac);
}

/** The loadout button on the map: the ship itself, its level and its hull. */
function renderShipButton(ship, hfrac) {
  const art = $('#sb-art');
  if (art.dataset.ship !== ship.sprite) {
    art.dataset.ship = ship.sprite;
    clear(art).append(spriteEl(ship.sprite, 2));
  }
  $('#sb-name').textContent = ship.name;
  const pending = ship.progress.unspentPoints;
  $('#sb-sub').textContent = pending
    ? `${pending} point${pending === 1 ? '' : 's'} to spend`
    : `Level ${ship.progress.level} · ${Math.round(hfrac * 100)}% hull`;
  $('#ship-button').classList.toggle('attention', pending > 0);
}

// ---------------------------------------------------------------------------
// Combat HUD
// ---------------------------------------------------------------------------

export function renderCombatHud() {
  const r = run();
  const world = r?.world;
  if (!world) return;
  const p = world.player;

  bar('#bar-hull', '#hull-num', p.hull, p.maxHull);
  bar('#bar-shield', '#shield-num', p.shield, p.maxShield);
  bar('#bar-energy', '#energy-num', p.energy, p.maxEnergy);

  // Objective.
  const obj = world.encounter.objective || { kind: 'clear' };
  let text = '';
  if (obj.kind === 'survive') {
    text = `HOLD OUT — ${Math.max(0, Math.ceil((obj.seconds || 60) - world.time))}s`;
  } else if (obj.kind === 'reach') {
    const total = obj.distance ?? ((world.corridor?.pixelLength ?? 8000) - world.w);
    text = `REACH THE END — ${Math.round(Math.min(1, world.scrollX / total) * 100)}%`;
  } else if (obj.kind === 'boss') {
    text = 'DESTROY THE CAPITAL SHIP';
  } else if (obj.kind === 'destroy') {
    const left = world.enemies.filter(e => !e.dead && e.tag === obj.tag).length;
    text = left > 1 ? `DESTROY THE FORMATION — ${left} left` : 'DESTROY THE TARGET';
  } else {
    const left = world.enemies.length + world.pendingSpawns.length;
    text = world.spawner.exhausted ? `CLEAR THE FIELD — ${left} left` : 'CLEAR THE FIELD';
  }
  $('#hud-objective').textContent = text;

  // Capital ships get their own readout. A run's climax sharing the same 3px
  // floating bar as a picket drone tells the player nothing is at stake.
  //
  // The bar must track the ship the OBJECTIVE is watching, not merely the
  // first elite in the array. On the Master Fleet flagship that distinction is
  // the whole fight: an Elite Vanguard arrives after the tagged flagship, and
  // a player who empties the bar labelled with its name has killed the wrong
  // ship and nothing ends.
  const objective = world.encounter.objective?.kind ?? 'clear';
  const tag = objective === 'destroy' ? world.encounter.objective.tag : 'boss';
  const isTarget = e => !e.dead && (e.tag === tag || (objective === 'boss' && e.isBoss));
  const boss = world.enemies.find(isTarget)
    || world.enemies.find(e => !e.dead && (e.isBoss || e.tag === 'boss' || e.elite || e.named));
  const bossBar = $('#boss-bar');
  show(bossBar, !!boss);
  if (boss) {
    if (bossBar.dataset.for !== boss.name) {
      bossBar.dataset.for = boss.name;
      $('#bb-name').textContent = boss.name.toUpperCase();
    }
    // A duel against three hulls is still one opponent. Showing the lead
    // body's health would say the fight was two thirds won when it was not,
    // and would jump back to full every time that body died.
    const squad = world.enemies.filter(isTarget);
    const frac = world.duelPool > 0 && squad.length
      ? Math.max(0, squad.reduce((n, e) => n + e.hull + e.shield, 0) / world.duelPool)
      : Math.max(0, boss.hull / boss.maxHull);
    $('#bb-fill').style.width = `${frac * 100}%`;
    bossBar.classList.toggle('critical', frac <= 0.25);
  } else {
    bossBar.dataset.for = '';
  }

  // Weapons.
  const wrap = $('#hud-weapons');
  const builtKey = `${world.encounter.id}:${p.tertiary ? 3 : S.hasSlot(r.ship, 'tertiary') ? 2.5 : 2}`;
  if (wrap.dataset.built !== builtKey) {
    wrap.dataset.built = builtKey;
    clear(wrap);
    for (const [key, label] of [['primary', 'LMB'], ['secondary', 'RMB'], ['tertiary', 'MMB']]) {
      const wep = p[key];
      // The heavy mount only appears once the hull actually has one.
      if (key === 'tertiary' && !wep && !S.hasSlot(r.ship, 'tertiary')) continue;
      wrap.append(el(`div.wslot${wep ? '' : '.wslot-empty'}${key === 'tertiary' ? '.wslot-heavy' : ''}`, { dataset: { slot: key } },
        el('span.wkey', { text: label }),
        el('span.wname', { text: wep ? wep.name : 'Empty' }),
        el('span.wcool')));
    }
  }
  for (const key of ['primary', 'secondary', 'tertiary']) {
    const node = wrap.querySelector(`[data-slot="${key}"]`);
    if (!node) continue;
    const wep = p[key];
    const timer = key === 'primary' ? p.primaryTimer : key === 'secondary' ? p.secondaryTimer : p.tertiaryTimer;
    const cool = node.querySelector('.wcool');
    if (wep && timer > 0) {
      cool.style.width = `${Math.min(1, timer / (1 / Math.max(0.05, wep.rof))) * 100}%`;
      node.classList.add('cooling');
    } else {
      cool.style.width = '0%';
      node.classList.remove('cooling');
    }
    node.classList.toggle('starved', !!wep && p.energy < wep.energy);
  }

  // Abilities.
  const abil = $('#hud-abilities');
  if (abil.dataset.built !== String(p.abilities.length)) {
    abil.dataset.built = String(p.abilities.length);
    clear(abil);
    p.abilities.forEach((a, i) => {
      abil.append(el('div.ability', { dataset: { idx: String(i) } },
        spriteEl(a.icon || 'icon_sys_battery', 1),
        el('span.akey', { text: String(i + 1) }),
        el('span.acool')));
    });
  }
  p.abilities.forEach((a, i) => {
    const node = abil.querySelector(`[data-idx="${i}"]`);
    if (!node) return;
    const ready = a.timer <= 0 && p.energy >= a.energy;
    node.classList.toggle('ready', ready);
    node.querySelector('.acool').style.height = `${Math.min(1, a.timer / a.cooldown) * 100}%`;
  });

  // Dash charges, with a recharge fill on the pip that is coming back.
  const dash = $('#hud-dash');
  if (dash.dataset.max !== String(p.dashMax)) {
    dash.dataset.max = String(p.dashMax);
    clear(dash);
    dash.append(el('span.dlabel', { text: 'DASH' }));
    const pips = el('span.dpips');
    for (let i = 0; i < p.dashMax; i++) {
      pips.append(el('span.dpip', { dataset: { i: String(i) } }, el('span.dfill')));
    }
    dash.append(pips);
  }
  const recharge = p.dashCharges < p.dashMax && p.stats.dashCooldown > 0
    ? 1 - Math.min(1, p.dashCooldown / p.stats.dashCooldown)
    : 0;
  for (let i = 0; i < p.dashMax; i++) {
    const pip = dash.querySelector(`[data-i="${i}"]`);
    if (!pip) continue;
    const full = i < p.dashCharges;
    pip.classList.toggle('on', full);
    pip.querySelector('.dfill').style.width =
      full ? '100%' : (i === p.dashCharges ? `${recharge * 100}%` : '0%');
  }
}

function bar(fillSel, numSel, value, max) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  $(fillSel).style.width = `${frac * 100}%`;
  $(numSel).textContent = `${Math.round(value)}/${Math.round(max)}`;
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function bindMap() {
  const cv = $('#mapcanvas');

  cv.addEventListener('pointerdown', e => {
    ui.map.dragging = true;
    ui.map.dragMoved = 0;
    ui.map.last = { x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
  });

  cv.addEventListener('pointermove', e => {
    if (ui.map.dragging) {
      const dx = e.clientX - ui.map.last.x, dy = e.clientY - ui.map.last.y;
      ui.map.dragMoved += Math.abs(dx) + Math.abs(dy);
      ui.map.target.x -= dx / ui.map.cam.zoom;
      ui.map.target.y -= dy / ui.map.cam.zoom;
      ui.map.cam.x = ui.map.target.x;
      ui.map.cam.y = ui.map.target.y;
      ui.map.last = { x: e.clientX, y: e.clientY };
    } else if (run()) {
      const node = ui.map.nodeAt(run().map, e.clientX, e.clientY);
      const canGo = node && (U.canJumpTo(run().map, node.id) || node.id === run().map.currentId
        || !!U.routeThroughCleared(run().map, node.id));
      cv.classList.toggle('can-jump', !!node && canGo);
      cv.classList.toggle('no-jump', !!node && !canGo);
      if (node !== ui.hoverNode) {
        ui.hoverNode = node;
        ui.map.setPath(node && !U.canJumpTo(run().map, node.id)
          ? U.routeThroughCleared(run().map, node.id) : null);
        renderNodeCard(node, ui.map.path.length ? ui.map.path : null);
        if (node) play('hover', { throttle: 90 });
      }
    }
  });

  const endDrag = e => {
    if (!ui.map.dragging) return;
    ui.map.dragging = false;
    try { cv.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    // A drag should never be mistaken for a click on whatever ended up beneath.
    if (ui.map.dragMoved < 6) {
      const node = ui.map.nodeAt(run().map, e.clientX, e.clientY);
      if (node) attemptJump(node);
    }
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // Leaving the map must retire the hover card with the pointer, or it hangs
  // over the screen describing wherever the mouse last happened to be.
  cv.addEventListener('pointerleave', () => {
    cv.classList.remove('can-jump', 'no-jump');
    if (ui.map.dragging) return;
    ui.hoverNode = null;
    ui.map.setPath([]);
    renderNodeCard(null);
  });

  cv.addEventListener('wheel', e => {
    e.preventDefault();
    ui.map.zoomBy(e.deltaY < 0 ? 1.14 : 1 / 1.14);
  }, { passive: false });

  $('#map-hud').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'inventory') openInventory();
    else if (action === 'zoom-in') ui.map.zoomBy(1.25);
    else if (action === 'zoom-out') ui.map.zoomBy(1 / 1.25);
    else if (action === 'recentre') ui.map.panTo(U.currentNode(run().map));
  });
}

function attemptJump(node) {
  const r = run();
  if (r.phase !== 'map') return;
  if (node.id === r.map.currentId) { ui.map.panTo(node); return; }

  const adjacent = U.canJumpTo(r.map, node.id);
  const route = adjacent ? null : U.routeThroughCleared(r.map, node.id);
  if (!adjacent && !route) { play('error'); return; }

  // One click, one move. The old flow asked you to confirm the jump and then
  // confirm the encounter, so you warped somewhere before you could see what
  // was there. Now the jump just happens and the brief carries the cancel.
  play('jump');
  music.duck(0.4, 1.2);
  ui.map.setPath([]);
  if (adjacent) R.jump(r, node.id);
  else R.travelPath(r, route);
  ui.map.panTo(U.currentNode(r.map));
  syncPhase(true);
}

function renderNodeCard(node, path = null) {
  const card = $('#node-card');
  if (!node) { card.hidden = true; return; }
  const r = run();
  const lab = threatLabel(node.threat, r.ship.progress.level);
  const known = node.state !== U.NODE_STATE.UNKNOWN;
  const reachable = U.canJumpTo(r.map, node.id);

  clear(card);
  card.hidden = false;
  // A trading post is not a threat, so it does not get a threat readout.
  const peaceful = !ENCOUNTER_TYPES[node.type]?.action;
  const route = node.id === r.map.currentId ? 'You are here'
    : reachable ? 'Click to jump'
      : path ? `${path.length} jumps through cleared space — click to travel`
        : 'No route from here';

  append(card,
    el('div.nc-head', null,
      spriteEl(node.cleared ? 'node_cleared' : (ENCOUNTER_TYPES[node.type]?.icon || 'node_unknown'), 2),
      el('div', null,
        el('div.nc-name', { text: node.cleared ? 'Picked clean' : (node.encounterName || 'Unknown') }),
        el('div.nc-type', { text: `${ENCOUNTER_TYPES[node.type]?.label || ''} · Ring ${node.ring}` }))),
    node.cleared || peaceful ? null : el('div.nc-threat', null,
      el('span.nc-tnum', { text: String(node.threat), style: { color: lab.colour } }),
      el('span', { text: lab.text, style: { color: lab.colour } })),
    known && !node.cleared && node.blurb ? el('p.nc-blurb', { text: node.blurb }) : null,
    el('div.nc-foot', { text: route }));

  placeNodeCard(card, node);
}

/**
 * Park the hover card next to the node it describes.
 *
 * It used to live pinned in the top-right corner, which meant reading about one
 * node while looking at another. It sits to the right of the node where there
 * is room and flips to the left where there is not, and is clamped inside the
 * play area so a node at the edge does not push it off screen.
 */
function placeNodeCard(card, node) {
  const hud = $('#map-hud');
  const box = hud.getBoundingClientRect();
  if (!box.width) return;

  const p = ui.map.project(node);
  const w = card.offsetWidth || 250;
  const h = card.offsetHeight || 130;
  const reach = 22 * ui.map.cam.zoom + 14;   // clear of the node's own disc

  let x = p.x + reach;
  if (x + w > box.width - 10) x = p.x - reach - w;
  card.style.left = `${Math.round(clampTo(x, 10, box.width - w - 10))}px`;
  card.style.top = `${Math.round(clampTo(p.y - h / 2, 10, box.height - h - 10))}px`;
}

function clampTo(v, lo, hi) { return v < lo ? lo : v > hi ? hi : Math.max(lo, v); }

export function renderMapHud() {
  const r = run();
  if (!r) return;
  const legend = $('#map-legend');
  if (!legend.dataset.built) {
    legend.dataset.built = '1';
    const item = (colour, text) => el('span.leg', null,
      el('i', { style: { background: colour } }), el('span', { text }));
    legend.append(
      item('#4fe3f5', 'You are here'),
      item('#ffcc5c', 'Can jump to'),
      item('#5a6a91', 'Picked clean'),
      item('#ff5c72', 'Master Fleet'));
  }

  // The camera keeps moving under a card that is already up — zoom, a pan, the
  // glide after a jump — so the card is re-anchored every frame it is visible.
  const card = $('#node-card');
  if (!card.hidden && ui.hoverNode) placeNodeCard(card, ui.hoverNode);
}

// ---------------------------------------------------------------------------
// Phase routing
// ---------------------------------------------------------------------------

/**
 * Bring the screen in line with the run's phase. Called every frame; only does
 * work when the phase actually changed, or when `force` is set after an action
 * that may have re-entered the same phase.
 */
export function syncPhase(force = false) {
  const r = run();
  if (!r) return;
  if (!force && r.phase === ui.lastPhase) return;
  const prev = ui.lastPhase;
  ui.lastPhase = r.phase;

  const inAction = r.phase === 'action';
  show($('#stage-wrap'), inAction);
  show($('#mapcanvas'), !inAction);
  show($('#map-hud'), !inAction);
  // The run log lives in the same corner as the hull/shield/energy bars. It
  // belongs to the map, so it goes away the moment a fight starts.
  show($('#event-log'), !inAction);
  // The hover card describes a node under the pointer; after a jump the
  // pointer is nowhere and the card is stale ("Click to jump" on a node you
  // have already cleared), so drop it on every phase change.
  ui.hoverNode = null;
  $('#node-card').hidden = true;

  if (!inAction && prev === 'action') {
    ui.effects.items.length = 0;
    // A trigger still held as the fight ends would otherwise release over the
    // debrief and press whatever button is under the cursor.
    game.releaseInput?.();
  }

  switch (r.phase) {
    case 'map':
      closeModal();
      ui.map.panTo(U.currentNode(r.map));
      pushLog(r);
      break;
    case 'brief': openBrief(); break;
    case 'debrief': openDebrief(); break;
    case 'anomaly': openAnomaly(); break;
    case 'shop': openShop(); break;
    case 'levelup': openLevelUp(); break;
    case 'action':
      closeModal();
      $('#hud-weapons').dataset.built = '';
      break;
    case 'dead': openDeath(); break;
    case 'victory': openVictory(); break;
  }
  renderTopbar();
}

function pushLog(r) {
  const log = $('#event-log');
  clear(log);
  for (const line of r.log.slice(0, 4)) {
    log.append(el('div.logline', { text: line.text }));
  }
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

function openBrief() {
  const r = run();
  const enc = r.encounter;
  const node = r.node;
  const lab = threatLabel(node?.threat ?? 1, r.ship.progress.level);

  const objective = {
    clear: 'Destroy everything that comes at you.',
    survive: `Stay alive for ${enc.objective?.seconds ?? 60} seconds.`,
    reach: 'Fly the passage end to end without breaking up.',
    boss: 'Destroy the capital ship.',
    destroy: 'Destroy the marked target.',
  }[enc.objective?.kind || 'clear'];

  openModal({
    title: enc.name,
    dismissable: false,
    body: el('div', null,
      el('div.event-head', null,
        el('div.event-scene', null,
          spriteEl(ENCOUNTER_TYPES[enc.type]?.icon || 'node_combat', 3),
          node?.prop ? spriteEl(node.prop, 1) : null),
        el('div', null,
          el('p.modal-text.flavour', { text: enc.intro || enc.blurb }),
          el('p.modal-text', { html: `<b>Objective:</b> ${objective}` }))),
      el('div.brief-stats', null,
        stat('Threat', String(node?.threat ?? 1), lab.colour),
        stat('Your level', String(r.ship.progress.level)),
        stat('Hull', `${Math.round(r.ship.hull)}/${r.ship.stats.maxHull}`),
        stat('Assessment', lab.text, lab.colour))),
    actions: [
      // The last door out. Once you engage there is no disengaging.
      { text: 'Cancel', kind: 'ghost', onClick: () => {
        closeModal();
        play('cancel');
        // Declining puts the ship back where it jumped from; the camera has to
        // follow or the map lies about where you are.
        R.declineEncounter(r);
        ui.map.panTo(U.currentNode(r.map));
        syncPhase(true);
      } },
      { text: 'Engage', kind: 'primary', onClick: () => { closeModal(); play('confirm'); R.beginEncounter(r); syncPhase(true); } },
    ],
  });
}

function stat(label, value, colour) {
  return el('div.bstat', null,
    el('span.bstat-k', { text: label }),
    el('span.bstat-v', { text: value, style: colour ? { color: colour } : null }));
}

// ---------------------------------------------------------------------------
// Debrief
// ---------------------------------------------------------------------------

function openDebrief() {
  const r = run();
  const p = r.pending;
  if (!p) { R.collectRewards(r); syncPhase(true); return; }

  if (p.fled) {
    openModal({
      title: 'Disengaged',
      dismissable: false,
      body: el('p.modal-text.flavour', { text: 'You break off and jump clear. The node is still out there, and so is whatever was in it.' }),
      actions: [{ text: 'Continue', kind: 'primary', onClick: () => { closeModal(); R.collectRewards(r); syncPhase(true); } }],
    });
    return;
  }

  const rows = el('div.reward-rows', null,
    rewardRow('icon_star', 'Experience', `+${p.xp}`),
    rewardRow('icon_credits', 'Credits', `+${p.credits}`),
    rewardRow('icon_speed', 'Time', `${p.time.toFixed(0)}s`),
    rewardRow('icon_sys_weapons', 'Accuracy', `${Math.round(p.accuracy * 100)}%`),
    rewardRow('icon_skull', 'Destroyed', String(p.world.stats.kills)),
    p.escaped ? rewardRow('icon_exit', 'Broke off and fled', String(p.escaped)) : null);

  const loot = p.items.length
    ? el('div', null,
      el('h4.section-title', { text: 'Salvage' }),
      el('div.loot-grid', null, ...p.items.map(itemCard)))
    : null;

  openModal({
    title: p.perfect ? `${p.encounter.name} — Untouched`
      : p.completion < 0.75 ? `${p.encounter.name} — Held`
        : `${p.encounter.name} — Cleared`,
    dismissable: false,
    body: el('div', null, rows, loot),
    actions: [{
      text: 'Collect', kind: 'primary',
      onClick: () => {
        closeModal();
        play('purchase');
        const res = R.collectRewards(r);
        flushToasts(r);
        if (res?.levels) play('levelup');
        syncPhase(true);
      },
    }],
  });
}

function rewardRow(icon, label, value) {
  return el('div.reward-row', null,
    spriteEl(icon, 1),
    el('span.rr-k', { text: label }),
    el('span.rr-v', { text: value }));
}

// ---------------------------------------------------------------------------
// Anomaly
// ---------------------------------------------------------------------------

function openAnomaly() {
  const r = run();
  const enc = r.encounter;

  if (r.anomalyResult) { showAnomalyResult(); return; }

  const choices = R.anomalyChoices(r);
  openModal({
    title: enc.name,
    dismissable: false,
    body: el('div', null,
      el('div.event-head', null,
        el('div.event-scene', null,
          spriteEl('node_anomaly', 3),
          r.node?.prop ? spriteEl(r.node.prop, 1) : null),
        el('p.modal-text.flavour', { text: enc.text || enc.blurb })),
      el('div.choice-list', null, ...choices.map(c =>
        el('button.btn.choice', {
          disabled: !c.ok,
          onclick: () => {
            play('event_choice');
            R.chooseAnomaly(r, c.index);
            if (r.phase === 'brief') { syncPhase(true); return; }
            showAnomalyResult();
          },
        },
        el('span', { text: c.text }),
        !c.ok && c.reason ? el('span.creq', { text: c.reason }) : null)))),
    actions: [],
  });
}

function showAnomalyResult() {
  const r = run();
  const res = r.anomalyResult;
  if (!res) return;
  const fx = res.effects || {};

  const lines = [];
  if (fx.credits) lines.push(rewardRow('icon_credits', 'Credits', `${fx.credits > 0 ? '+' : ''}${fx.credits}`));
  if (fx.xp) lines.push(rewardRow('icon_star', 'Experience', `+${fx.xp}`));
  if (fx.hull) lines.push(rewardRow('icon_hull', 'Hull', `${fx.hull > 0 ? '+' : ''}${Math.round(fx.hull)}`));
  if (fx.attributePoint) lines.push(rewardRow('icon_power', 'Attribute points', `+${fx.attributePoint}`));
  if (fx.reveal) lines.push(rewardRow('icon_sys_sensors', 'Beacons revealed', `+${fx.reveal}`));

  openModal({
    title: r.encounter.name,
    dismissable: false,
    body: el('div', null,
      el('p.modal-text.flavour', { text: res.text }),
      lines.length ? el('div.reward-rows', null, ...lines) : null,
      fx.items?.length ? el('div', null,
        el('h4.section-title', { text: 'Acquired' }),
        el('div.loot-grid', null, ...fx.items.map(itemCard))) : null),
    actions: [{
      text: 'Continue', kind: 'primary',
      onClick: () => { closeModal(); R.closeAnomaly(r); flushToasts(r); syncPhase(true); },
    }],
  });
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

function openShop() {
  const r = run();
  const stock = r.shopStock;
  if (!stock) { R.leaveShop(r); syncPhase(true); return; }
  play('store_enter');

  const rebuild = () => {
    const needsRepair = r.ship.hull < r.ship.stats.maxHull;
    const body = el('div', null,
      el('div.shop-head', null,
        el('span.shop-credits', null, spriteEl('icon_credits', 1), el('b', { text: String(r.ship.credits) })),
        el('span', { html: `Hull: <b>${Math.round(r.ship.hull)}</b>/${r.ship.stats.maxHull}` })),

      el('h4.section-title', { text: 'Repairs' }),
      el('div.shop-repair', null,
        stock.repaired
          ? el('span.shop-done', { text: 'Fully repaired.' })
          : !needsRepair
            ? el('span.shop-done', { text: 'No damage to repair.' })
            : el('button.btn.btn-small', {
              disabled: r.ship.credits < stock.repairCost,
              onclick: () => {
                const res = R.buyRepair(r);
                play(res.ok ? 'repair_done' : 'error');
                openShop();
              },
            }, spriteEl('icon_credits', 1), el('span', { text: `Full repair — ${stock.repairCost}` }))),

      el('h4.section-title', { text: 'For Sale' }),
      stock.items.length
        ? el('div.loot-grid', null, ...stock.items.map(item => itemCard(item, {
          price: item.value,
          action: 'Buy',
          disabled: r.ship.credits < item.value,
          onAction: () => {
            const res = R.buyItem(r, item.uid);
            play(res.ok ? 'purchase' : 'error');
            if (res.ok) toast({ tag: 'Bought', name: item.name, desc: 'Stowed in your hold.' });
            openShop();
          },
        })))
        : el('p.modal-text.flavour', { text: 'The racks are bare.' }),

      el('h4.section-title', { text: 'Your Hold' }),
      r.ship.inventory.length
        ? el('div.loot-grid', null, ...r.ship.inventory.map(item => itemCard(item, {
          price: sellValue(item),
          action: 'Sell',
          onAction: () => { R.sellItem(r, item.uid); play('purchase'); openShop(); },
          secondaryAction: 'Equip',
          onSecondary: () => { const res = S.equip(r.ship, item.uid); play(res.ok ? 'upgrade' : 'error'); openShop(); },
        })))
        : el('p.modal-text.flavour', { text: 'Your hold is empty.' }));

    openModal({
      title: r.encounter?.name || 'Trading Post',
      dismissable: false,
      body,
      wide: true,
      actions: [{
        text: 'Undock', kind: 'primary',
        onClick: () => { closeModal(); R.leaveShop(r); flushToasts(r); syncPhase(true); },
      }],
    });
  };
  rebuild();
}

// ---------------------------------------------------------------------------
// Level up
// ---------------------------------------------------------------------------

function openLevelUp() {
  const r = run();
  if (r.ship.progress.unspentPoints <= 0) {
    if (r.phase === 'levelup') { R.closeLevelUp(r); syncPhase(true); }
    return;
  }
  play('levelup');

  const build = () => {
    const ship = r.ship;
    const mods = {};
    for (const item of Object.values(ship.equipped)) {
      if (!item) continue;
      for (const [k, v] of Object.entries(item.mods || {})) mods[k] = (mods[k] || 0) + v;
    }

    const cards = ATTRIBUTES.map(attr => {
      const value = ship.progress.attributes[attr.id];
      const capped = value >= ATTR_CAP;
      const preview = capped ? [] : previewPoint(ship.progress.attributes, mods, attr.id);
      return el(`div.attr-card${capped ? '.capped' : ''}`, null,
        el('div.attr-head', null,
          spriteEl(attr.icon, 2),
          el('div', null,
            el('div.attr-name', { text: attr.name }),
            el('div.attr-val', { text: capped ? `${value} — maxed` : `${value} → ${value + 1}` }))),
        el('p.attr-blurb', { text: attr.blurb }),
        el('div.attr-preview', null, ...preview.slice(0, 4).map(row =>
          el('div.apreview-row', null,
            el('span', { text: row.label }),
            el('span.apv', { text: `${row.from} → ${row.to}`, style: { color: attr.accent } })))),
        el('button.btn.btn-small.btn-primary', {
          disabled: capped,
          onclick: () => {
            if (!R.spendPoint(r, attr.id)) { play('error'); return; }
            play('upgrade');
            renderTopbar();
            flushToasts(r);
            if (r.ship.progress.unspentPoints > 0) build();
            else { closeModal(); syncPhase(true); }
          },
        }, el('span', { text: capped ? 'Maxed' : 'Upgrade' })));
    });

    openModal({
      title: `Level ${r.ship.progress.level} — ${r.ship.progress.unspentPoints} point${r.ship.progress.unspentPoints === 1 ? '' : 's'} to spend`,
      dismissable: false,
      wide: true,
      body: el('div', null,
        el('p.modal-text.flavour', { text: 'Refit while you have the chance. Nothing out here gets easier.' }),
        el('div.attr-grid', null, ...cards)),
      actions: [],
    });
  };
  build();
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function openInventory() {
  const r = run();
  if (!r) return;
  play('tab');

  const build = () => {
    const ship = r.ship;
    const s = ship.stats;

    // Each slot carries its own icon, so it is obvious at a glance which part
    // goes where — the same icon appears on every item that fits it.
    const slotCard = slot => {
      const item = ship.equipped[slot.id];
      const locked = !!slot.unlockLevel && ship.progress.level < slot.unlockLevel;
      return el(`div.slot${item ? '' : '.slot-empty'}${locked ? '.slot-locked' : ''}`, null,
        el('div.slot-label', null,
          spriteEl(slot.icon, 1),
          el('span', { text: slot.name })),
        item
          ? itemCard(item, {
            compact: true,
            action: 'Unequip',
            onAction: () => { const res = S.unequip(ship, slot.id); play(res.ok ? 'toggle' : 'error'); build(); },
          })
          : el('div.slot-hollow', {
            text: locked ? `Cut into the hull at level ${slot.unlockLevel}` : 'Empty',
          }));
    };

    // Slots are read against each other, so they sit two to a row in the order
    // items.js declares them — hull beside shield, engine beside reactor, and
    // so on. The heavy mount is the odd one out and takes a row to itself.
    const slots = el('div.slot-grid', null,
      el('div.slot-guns', null, ...SLOTS.filter(x => x.kind === 'weapon').map(slotCard)),
      el('div.slot-pairs', null, ...SLOTS.filter(x => x.kind !== 'weapon').map(slotCard)));

    const hfrac = Math.max(0, ship.hull / s.maxHull);
    const statRows = [
      ['icon_sys_shields', 'Shield', `${s.maxShield}  +${s.shieldRegen.toFixed(1)}/s`],
      ['icon_power', 'Energy', `${s.maxEnergy}  +${s.energyRegen.toFixed(1)}/s`],
      ['icon_sys_weapons', 'Damage', `${Math.round(s.damageMult * 100)}%`],
      ['icon_sys_engines', 'Speed', String(Math.round(s.speed))],
      ['icon_sys_sensors', 'Cooldowns', `${Math.round(s.cooldownMult * 100)}%`],
      ['icon_star', 'Crit', `${Math.round(s.critChance * 100)}%  x${s.critMult.toFixed(2)}`],
      ['icon_dronepart', 'Pickup range', String(Math.round(s.pickupRange))],
    ];

    const body = el('div.inv-wrap', null,
      el('div.inv-left', null,
        el('h4.section-title', { text: 'Loadout' }),
        slots),
      el('div.inv-right', null,
        // Identity and hull on one line: the ship, who it is, and how it is.
        el('div.inv-head', null,
          spriteEl(ship.sprite, 2),
          el('div.inv-ident', null,
            el('div.inv-name', { text: ship.name }),
            el('div.inv-lvl', null,
              el('span', { text: `Level ${ship.progress.level}` }),
              el('span.inv-credits', null, spriteEl('icon_credits', 1), el('b', { text: String(ship.credits) })))),
          el('div.inv-hull', null,
            el('div.ih-top', null,
              spriteEl('icon_hull', 1),
              el('span', { text: 'Hull' }),
              el('b', { text: `${Math.round(ship.hull)} / ${s.maxHull}` })),
            el('div.ih-track', null, el('span', {
              style: { width: `${hfrac * 100}%` },
              class: hfrac <= 0.25 ? 'critical' : hfrac <= 0.55 ? 'hurt' : '',
            })))),

        // Attributes and systems side by side, so the hold is not pushed a
        // screen and a half down the page.
        el('div.inv-cols', null,
          el('div', null,
            el('h4.section-title', { text: 'Attributes' }),
            el('div.attr-list', null, ...ATTRIBUTES.map(a => {
              const v = ship.progress.attributes[a.id];
              return el('div.attr-row', null,
                spriteEl(a.icon, 1),
                el('span.ar-name', { text: a.name }),
                el('span.ar-track', null, el('span', {
                  style: { width: `${(v / ATTR_CAP) * 100}%`, background: a.accent },
                })),
                el('b.ar-val', { text: String(v), style: { color: a.accent } }));
            })),
            ship.progress.unspentPoints
              ? el('button.btn.btn-small.btn-primary.inv-spend', {
                onclick: () => openLevelUp(),
              }, el('span', { text: `Upgrade — ${ship.progress.unspentPoints} point${ship.progress.unspentPoints === 1 ? '' : 's'}` }))
              : null),
          el('div', null,
            el('h4.section-title', { text: 'Systems' }),
            el('div.stat-list', null, ...statRows.map(([icon, k, v]) =>
              el('div.stat-line', null,
                spriteEl(icon, 1),
                el('span', { text: k }),
                el('b', { text: v })))))),

        ship.perk ? el('div.perk-box', null,
          el('div.perk-name', { text: ship.perk.name }),
          el('div.perk-desc', { text: ship.perk.desc })) : null,
        el('h4.section-title', { text: `Hold (${ship.inventory.length}/24)` }),
        ship.inventory.length
          ? el('div.loot-grid', null, ...[...ship.inventory]
            .sort((a, b) => powerScore(b) - powerScore(a))
            .map(item => itemCard(item, {
              action: S.isUpgrade(ship, item) ? 'Equip ▲' : 'Equip',
              highlight: S.isUpgrade(ship, item),
              onAction: () => {
                const res = S.equip(ship, item.uid);
                play(res.ok ? 'upgrade' : 'error');
                if (!res.ok) toast({ tag: 'Cannot equip', name: res.reason, kind: 'bad' });
                build();
              },
              secondaryAction: 'Jettison',
              secondaryKind: 'danger',
              onSecondary: () => { R.sellItem(r, item.uid); play('cancel'); build(); },
            })))
          : el('p.modal-text.flavour', { text: 'Nothing stowed.' })));

    openModal({
      title: 'Ship',
      wide: true,
      body,
      actions: [{ text: 'Close', kind: 'primary', onClick: () => { closeModal(); renderTopbar(); syncPhase(true); } }],
    });
  };
  build();
}

/** One item, as a card. `opts.action` adds a button. */
function itemCard(item, opts = {}) {
  const rar = RARITY_BY_ID[item.rarity] || RARITY_BY_ID.salvaged;
  const lines = describeItem(item);

  // Name the slot it belongs to. Rarity and level alone do not tell the player
  // whether a part is a reactor or a nav computer.
  const slotName = SLOTS_BY_ID[item.slot]?.name
    || (item.pool === 'utility' ? 'Utility' : item.pool);
  const slotIcon = SLOTS_BY_ID[item.slot]?.icon || 'icon_sys_battery';

  return el(`div.item-card${opts.compact ? '.compact' : ''}${opts.highlight ? '.upgrade' : ''}`, {
    style: { borderColor: rar.colour },
  },
  el('div.ic-head', null,
    spriteEl(slotIcon, 1),
    el('div', null,
      el('div.ic-name', { text: item.name, style: { color: rar.colour } }),
      el('div.ic-sub', { text: `${rar.name} · ${slotName} · ilvl ${item.level}` }))),
  el('div.ic-mods', null, ...lines.slice(0, 5).map(t => el('div.ic-mod', { text: t }))),
  opts.price != null
    ? el('div.ic-price', null, spriteEl('icon_credits', 1), el('b', { text: String(opts.price) }))
    : null,
  opts.action ? el('div.ic-actions', null,
    el('button.btn.btn-small', {
      disabled: !!opts.disabled,
      onclick: opts.onAction,
    }, el('span', { text: opts.action })),
    opts.secondaryAction ? el(`button.btn.btn-small.btn-ghost${opts.secondaryKind === 'danger' ? '.btn-danger' : ''}`, {
      onclick: opts.onSecondary,
    }, el('span', { text: opts.secondaryAction })) : null) : null);
}

// ---------------------------------------------------------------------------
// Pause, death, victory
// ---------------------------------------------------------------------------

export function openPauseMenu() {
  const r = run();
  openModal({
    title: 'Paused',
    body: el('div.pause-body', null,
      el('p.modal-text.flavour', { text: `${r.ship.name} · Level ${r.ship.progress.level} · Ring ${U.currentNode(r.map).ring}` }),
      el('p.modal-text', { text: `Seed ${r.seed}` })),
    actions: [
      { text: 'Abandon Run', kind: 'danger', onClick: () => confirmAbandon() },
      { text: 'Ship', kind: 'ghost', onClick: () => openInventory() },
      { text: 'Sound & Settings', kind: 'ghost', onClick: () => game.openSettings() },
      { text: 'Resume', kind: 'primary', onClick: () => closeModal() },
    ],
  });
}

function confirmAbandon() {
  openModal({
    title: 'Abandon this run?',
    body: el('p.modal-text', { text: 'The run ends here and the ship is lost. This cannot be undone.' }),
    actions: [
      { text: 'Keep Going', kind: 'ghost', onClick: () => openPauseMenu() },
      { text: 'Abandon', kind: 'danger', onClick: () => { closeModal(); game.endRun('abandoned'); } },
    ],
  });
}

function openDeath() {
  const r = run();
  play('defeat');
  music.duck(0.3, 3);
  openModal({
    title: `${r.ship.name} — Lost`,
    dismissable: false,
    body: el('div', null,
      el('p.modal-text.flavour', { text: 'The hull gives out. Whatever is left of you keeps going in the direction you were pointed.' }),
      el('div.summary-stats', null, ...runSummaryRows(r))),
    actions: [{ text: 'Back To Title', kind: 'primary', onClick: () => { closeModal(); game.endRun('death'); } }],
  });
}

function openVictory() {
  const r = run();
  play('victory');
  openModal({
    title: 'The Master Fleet Is Broken',
    dismissable: false,
    body: el('div', null,
      el('p.modal-text.flavour', { text: 'The last of them comes apart in the dark. Nothing is hunting you now. The map is still out there, and most of it you have never seen.' }),
      el('div.summary-stats', null, ...runSummaryRows(r))),
    actions: [
      { text: 'Keep Exploring', kind: 'ghost', onClick: () => { closeModal(); game.recordVictory(); R.continueAfterVictory(r); syncPhase(true); } },
      { text: 'End The Run', kind: 'primary', onClick: () => { closeModal(); game.recordVictory(); game.endRun('victory'); } },
    ],
  });
}

function runSummaryRows(r) {
  const s = r.stats;
  const mins = Math.floor(r.elapsed / 60);
  return [
    stat('Level reached', String(r.ship.progress.level)),
    stat('Deepest ring', String(s.deepestRing)),
    stat('Nodes cleared', String(s.nodesCleared)),
    stat('Ships destroyed', String(s.kills)),
    stat('Capital ships', String(s.bossesKilled)),
    stat('Time in combat', `${mins}m`),
  ];
}

/** Surface any achievements earned since the last check. */
export function flushToasts(r) {
  for (const a of R.drainAchievements(r)) {
    toast({ tag: 'Achievement', name: a.name, desc: a.desc });
    play('achievement');
  }
}

// ---------------------------------------------------------------------------
// Per-frame
// ---------------------------------------------------------------------------

export function frame(dt, t) {
  const r = run();
  if (!r) return;

  if (r.phase === 'action' && r.world) {
    renderCombatHud();
  } else {
    ui.map.update(dt);
    ui.map.draw(r.map, {
      level: r.ship.progress.level,
      reachable: r.phase === 'map' ? U.travelable(r.map) : [],
      showAllThreat: !!r.ship.stats.alwaysRevealThreat,
    });
    renderMapHud();
  }
}
