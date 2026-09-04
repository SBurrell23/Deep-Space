/**
 * The in-game interface: resource bar, system power panel, crew list, weapon
 * bar, canvas input, and the map / event / store / summary modals.
 *
 * This module reads the run and calls into run.js; it never mutates game state
 * directly beyond UI-only fields (selection, targeting).
 */

import { $, $$, el, clear, show, duration, tooltip, tipContent, hideTooltip } from './dom.js';
import { openModal, closeModal, isModalOpen, toast, flushAchievements, showScreen } from './screens.js';
import * as render from './render.js';
import { spriteEl, TILE } from './render.js';
import { play } from '../audio/sfx.js';
import * as music from '../audio/music.js';
import * as R from '../game/run.js';
import * as S from '../game/ship.js';
import { SYSTEMS, effectiveLevel, getSystem } from '../game/systems.js';
import { getWeapon, getDrone, getAugment } from '../game/weapons.js';
import { RACES, getRace } from '../game/crew.js';
import { SECTOR_TYPES, beaconById, reachableBeacons, atExit } from '../game/sector.js';
import { upgradeOptions, reactorUpgradeCost, itemDetails } from '../game/store.js';
import { RNG } from '../core/rng.js';

/** UI-only state that doesn't belong in the run. */
export const ui = {
  selectedCrew: null,
  selectedWeapon: null,
  hoverRoom: null,
  hoverShip: null,
  frames: null,
  effects: new render.EffectLayer(),
  sceneProp: null,
  shake: 0,
  logLines: [],
};

let game = null;   // { run, profile, save } supplied by main.js

export function attach(ctx) {
  game = ctx;
  bindTopbar();
  bindCanvas();
  bindControls();
}

const run = () => game.run;

// ---------------------------------------------------------------------------
// Top bar and panels
// ---------------------------------------------------------------------------

const lastResources = {};

function bindTopbar() {
  $('#topbar').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'pause-menu') openPauseMenu();
    else if (action === 'settings') game.openSettings();
  });
}

export function renderTopbar() {
  const r = run();
  if (!r) return;

  setRes('#res-scrap', r.scrap, 'scrap');
  setRes('#res-fuel', r.fuel, 'fuel', r.fuel <= 0 ? 'critical' : r.fuel <= 3 ? 'low' : '');
  setRes('#res-missiles', r.missiles, 'missiles');
  setRes('#res-drones', r.droneParts, 'droneParts');

  const sectorDef = SECTOR_TYPES[r.map.sectorType];
  $('#sector-label').textContent = `Sector ${r.sectorIndex + 1} / 8`;
  $('#sector-type').textContent = sectorDef ? sectorDef.name : '';

  const ship = r.ship;
  const frac = ship.hull / ship.maxHull;
  const readout = $('#hull-readout');
  readout.innerHTML = `HULL <b>${ship.hull}</b>/${ship.maxHull}`;
  readout.className = `hull-readout ${frac <= 0.25 ? 'critical' : frac <= 0.55 ? 'hurt' : ''}`;
}

function setRes(sel, value, key, cls = '') {
  const node = $(sel);
  const b = node.querySelector('b');
  if (b.textContent !== String(value)) {
    b.textContent = value;
    if (lastResources[key] !== undefined && value !== lastResources[key]) {
      node.classList.remove('bump');
      void node.offsetWidth;   // restart the animation
      node.classList.add('bump');
    }
    lastResources[key] = value;
  }
  node.className = `res ${cls}`;
  const icon = node.querySelector('i');
  if (!icon.dataset.drawn) {
    icon.dataset.drawn = '1';
    icon.append(spriteEl(icon.dataset.icon, 1));
  }
}

// --- systems ---------------------------------------------------------------

export function renderSystems() {
  const r = run();
  const ship = r.ship;
  const list = clear($('#system-list'));

  $('#reactor-readout').textContent = `${S.usedReactor(ship)}/${S.totalReactor(ship)}`;

  for (const sys of S.systemList(ship)) {
    const def = getSystem(sys.id);
    const isReactor = def.kind === 'reactor';
    const zoltan = S.zoltanPower(ship, sys.id);

    const row = el('div.sysrow', {
      dataset: { system: sys.id },
      class: `sysrow ${sys.damage > 0 ? 'damaged' : ''} ${sys.ionCharges > 0 ? 'ionised' : ''} ${sys.hackActive ? 'hacked' : ''}`,
    },
    spriteEl(def.icon, 1),
    el('span.sname', { text: def.name }),
    buildPips(sys, def, zoltan, isReactor));

    if (isReactor) {
      row.addEventListener('click', () => adjustPower(sys.id, +1));
      row.addEventListener('contextmenu', e => { e.preventDefault(); adjustPower(sys.id, -1); });
    } else {
      row.addEventListener('click', () => play('tab'));
    }

    tooltip(row, () => {
      const stats = [`Level ${sys.level}${sys.damage ? ` · ${sys.damage} damaged` : ''}`];
      if (isReactor) stats.push(`Power ${sys.power}/${S.powerCap(ship, sys.id)}`);
      if (zoltan) stats.push(`${zoltan} free power from Zoltan crew`);
      if (sys.ionCharges) stats.push(`Ionised: ${sys.ionCharges} bars locked`);
      if (sys.hackActive) stats.push('HACKED — disabled');
      if (def.mannedBonus) stats.push(`Manned: ${def.mannedBonus}`);
      if (isReactor) stats.push('Click to add power · right-click to remove');
      return tipContent(def.name, def.desc, stats);
    });

    list.append(row);
  }
}

function buildPips(sys, def, zoltan, isReactor) {
  const wrap = el('span.pips');
  if (!isReactor) {
    // Subsystems show level rather than power.
    for (let i = 0; i < sys.level; i++) {
      wrap.append(el(`span.pip${i < sys.level - sys.damage ? '.on' : '.damaged'}`));
    }
    return wrap;
  }
  for (let i = 0; i < sys.level; i++) {
    const damaged = i >= sys.level - sys.damage;
    const ionised = !damaged && i >= sys.level - sys.damage - sys.ionCharges;
    const on = !damaged && !ionised && i < sys.power;
    const free = on && i < zoltan;
    wrap.append(el(`span.pip${damaged ? '.damaged' : ionised ? '.ion' : free ? '.zoltan' : on ? '.on' : ''}`));
  }
  return wrap;
}

function adjustPower(sysId, delta) {
  const moved = S.setPower(run().ship, sysId, delta);
  if (moved === 0) { play('power_fail', { throttle: 200 }); return; }
  play(delta > 0 ? 'power_up' : 'power_down');
  renderSystems();
  renderWeapons();
}

// --- crew ------------------------------------------------------------------

export function renderCrew() {
  const r = run();
  const list = clear($('#crew-list'));

  for (const c of r.ship.crew) {
    const frac = c.hp / c.maxHp;
    const row = el('div.crewrow', {
      dataset: { crew: c.id },
      class: `crewrow ${c.dead ? 'dead' : ''} ${ui.selectedCrew === c.id ? 'selected' : ''} ${frac < 0.3 ? 'dying' : frac < 0.7 ? 'hurt' : ''}`,
    },
    spriteEl(c.dead ? `crew_${c.race}_dead` : `crew_${c.race}_idle0`, 1),
    el('div', null,
      el('div.cname', { text: c.name + (c.onEnemyShip ? ' ⇢' : '') }),
      el('div.chp', null, el('span', { style: { width: `${Math.max(0, frac * 100)}%` } }))));

    if (!c.dead) {
      row.addEventListener('click', () => {
        ui.selectedCrew = ui.selectedCrew === c.id ? null : c.id;
        play('crew_select');
        renderCrew();
      });
    }

    tooltip(row, () => {
      const race = getRace(c.race);
      const skills = Object.entries(c.skills).filter(([, v]) => v > 0)
        .map(([k, v]) => `${k} ${'★'.repeat(v)}`).join('  ');
      return tipContent(`${c.name} — ${race.name}`, race.desc, [
        `Health ${Math.round(c.hp)}/${c.maxHp}`,
        c.manning ? `Manning ${SYSTEMS[c.manning].name}` : null,
        skills || 'No skills trained yet',
        c.dead ? 'Dead' : 'Click to select, then click a room to send them there',
      ]);
    });

    list.append(row);
  }
}

// --- weapons ---------------------------------------------------------------

export function renderWeapons() {
  const r = run();
  const ship = r.ship;
  const bar = clear($('#weapon-bar'));

  ship.weapons.forEach((w, i) => {
    const def = getWeapon(w.weaponId);
    const ready = S.isWeaponReady(ship, i);
    const progress = S.weaponProgress(ship, i);
    const noAmmo = def.ammo && r.missiles < def.ammo;

    const slot = el('div.wslot', {
      class: `wslot ${w.powered ? 'powered' : 'unpowered'} ${ready ? 'ready' : ''} ${ui.selectedWeapon === i ? 'selected' : ''}`,
      dataset: { slot: String(i) },
    },
    el('span.wkey', { text: String(i + 1) }),
    el('div.wname', { text: def.name }),
    el('div.wmeta', null,
      el('span', { text: `${def.power}⚡` }),
      el('span', { text: def.type }),
      noAmmo ? el('span', { text: 'NO AMMO', style: { color: '#ff5c72' } }) : null),
    el('div.wtarget', {
      text: w.targetRoom != null ? `→ room ${w.targetRoom}` : (w.autofire ? 'no target' : 'manual'),
    }),
    el('div.wbar', null, el('span', { style: { width: `${progress * 100}%` } })));

    slot.addEventListener('click', () => {
      if (!w.powered) { play('error'); return; }
      ui.selectedWeapon = ui.selectedWeapon === i ? null : i;
      play('beacon_select');
      renderWeapons();
    });
    slot.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (S.toggleWeapon(ship, i)) { play(w.powered ? 'power_down' : 'power_up'); }
      else play('power_fail');
      renderSystems();
      renderWeapons();
    });

    tooltip(slot, () => tipContent(def.name, def.desc, [
      `${def.power} power · ${def.charge}s charge`,
      def.type === 'beam' ? `Beam · ${def.damage} damage across ${def.length} rooms`
        : `${def.shots || 1} shot(s) · ${def.damage} damage`,
      def.pierce ? (def.pierce >= 99 ? 'Ignores shields entirely' : `Pierces ${def.pierce} shield layer(s)`) : null,
      def.ion ? `${def.ion} ion charge(s)` : null,
      def.ammo ? `Uses ${def.ammo} missile(s) per volley` : null,
      def.fire ? `${Math.round(def.fire * 100)}% chance of fire` : null,
      def.breach ? `${Math.round(def.breach * 100)}% chance of breach` : null,
      'Click to aim · right-click to power on/off',
    ]));

    bar.append(slot);
  });

  ship.drones.forEach((d, i) => {
    const def = getDrone(d.droneId);
    const slot = el('div.wslot', {
      class: `wslot ${d.powered ? 'powered' : 'unpowered'} ${d.deployed ? 'ready' : ''}`,
    },
    el('div.wname', { text: def.name }),
    el('div.wmeta', null, el('span', { text: `${def.power}⚡` }), el('span', { text: 'drone' })),
    el('div.wtarget', { text: d.deployed ? 'deployed' : d.powered ? 'launching' : 'offline' }),
    el('div.wbar', null, el('span', { style: { width: d.deployed ? '100%' : '0%' } })));

    slot.addEventListener('click', () => {
      if (!d.powered && r.droneParts <= 0) { play('error'); logLine('No drone parts left.', 'bad'); return; }
      if (S.toggleDrone(ship, i)) {
        if (ship.drones[i].powered) { r.droneParts = Math.max(0, r.droneParts - 1); play('drone_launch'); }
        else play('power_down');
      } else play('power_fail');
      renderTopbar(); renderSystems(); renderWeapons();
    });
    tooltip(slot, () => tipContent(def.name, def.desc, [`${def.power} power`, 'Costs one drone part to launch']));
    bar.append(slot);
  });

  for (let i = ship.weapons.length; i < ship.weaponSlots; i++) {
    bar.append(el('div.wslot-empty', { text: 'Empty' }));
  }
}

// ---------------------------------------------------------------------------
// Canvas input
// ---------------------------------------------------------------------------

function bindCanvas() {
  const canvas = $('#stage');

  canvas.addEventListener('pointermove', e => {
    const hit = hitTest(e);
    ui.hoverRoom = hit ? hit.room : null;
    ui.hoverShip = hit ? hit.side : null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerleave', () => { ui.hoverRoom = null; ui.hoverShip = null; });

  canvas.addEventListener('click', e => {
    const hit = hitTest(e);
    if (!hit) { ui.selectedCrew = null; ui.selectedWeapon = null; renderCrew(); renderWeapons(); return; }
    if (hit.side === 'player') onPlayerRoomClick(hit.room);
    else onEnemyRoomClick(hit.room);
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const hit = hitTest(e);
    if (hit && hit.side === 'player') ventRoom(hit.room);
  });
}

/** Map a pointer event to { side, room } using the frames the renderer used. */
function hitTest(e) {
  const frames = ui.frames;
  if (!frames) return null;
  const rect = $('#stage').getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (const [side, frame] of [['player', frames.player], ['enemy', frames.enemy]]) {
    if (!frame) continue;
    if (side === 'enemy' && !frame.interior) {
      // Silhouette enemies are still targetable as a whole.
      if (x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h) {
        return { side, room: 0, whole: true };
      }
      continue;
    }
    const scale = frame.scale || 1;
    const lx = (x - frame.x) / (TILE * scale);
    const ly = (y - frame.y) / (TILE * scale);
    for (const room of frame.layout.rooms) {
      if (lx >= room.x && lx < room.x + room.w && ly >= room.y && ly < room.y + room.h) {
        return { side, room: room.id };
      }
    }
  }
  return null;
}

function onPlayerRoomClick(roomId) {
  const r = run();
  if (ui.selectedCrew) {
    if (S.orderCrewTo(r.ship, ui.selectedCrew, roomId)) play('crew_move');
    else play('error');
    return;
  }
  // With no crew selected, clicking a system room selects whoever is in it.
  const occupants = S.crewInRoom(r.ship, roomId);
  if (occupants.length) {
    ui.selectedCrew = occupants[0].id;
    play('crew_select');
    renderCrew();
  }
}

function onEnemyRoomClick(roomId) {
  const r = run();
  if (!r.combat) return;
  if (ui.selectedWeapon == null) {
    // No weapon picked: aim every powered weapon that has no target yet.
    let aimed = 0;
    r.ship.weapons.forEach((w, i) => {
      if (w.powered && w.targetRoom == null) { w.targetRoom = roomId; aimed++; }
    });
    if (aimed === 0) r.ship.weapons.forEach(w => { if (w.powered) w.targetRoom = roomId; });
    play('beacon_select');
  } else {
    const w = r.ship.weapons[ui.selectedWeapon];
    if (w && w.powered) { w.targetRoom = roomId; play('beacon_select'); }
    ui.selectedWeapon = null;
  }
  renderWeapons();
}

function ventRoom(roomId) {
  const r = run();
  if (S.ventRoom(r.ship, roomId, true)) {
    play('vent');
    logLine('Airlock opened — venting compartment.');
    setTimeout(() => S.ventRoom(r.ship, roomId, false), 6000);
  } else {
    play('error');
    logLine('That compartment has no airlock.', 'bad');
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function bindControls() {
  $('#combat-controls').addEventListener('click', e => {
    const btn = e.target.closest('[data-action],[data-speed]');
    if (!btn) return;
    if (btn.dataset.speed) {
      const s = Number(btn.dataset.speed);
      run().combat?.setSpeed(s);
      if (run().combat) run().combat.paused = false;
      play('tab');
      renderCombatControls();
    } else if (btn.dataset.action === 'toggle-pause') {
      togglePause();
    } else if (btn.dataset.action === 'flee') {
      attemptFlee();
    }
  });

  $('#map-controls').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'open-map') openStarMap();
    else if (action === 'distress') doDistress();
  });
}

export function togglePause() {
  const c = run().combat;
  if (!c) return;
  const paused = c.togglePause();
  play(paused ? 'cancel' : 'confirm');
  renderCombatControls();
}

function attemptFlee() {
  const r = run();
  const c = r.combat;
  if (!c) return;
  if (r.ship.ftlCharge < 1) {
    play('error');
    logLine('FTL drive is still charging.', 'bad');
    return;
  }
  play('jump');
  c.playerFlee();
}

export function renderCombatControls() {
  const r = run();
  const inCombat = !!r.combat && !r.combat.over;
  show($('#combat-controls'), inCombat);
  show($('#map-controls'), !inCombat);

  if (inCombat) {
    const c = r.combat;
    $('#btn-pause').innerHTML = c.paused ? 'Resume <kbd>Space</kbd>' : 'Pause <kbd>Space</kbd>';
    for (const b of $$('#combat-controls .speed')) {
      b.classList.toggle('active', !c.paused && Number(b.dataset.speed) === c.speed);
    }
    const flee = $('#btn-flee');
    flee.disabled = r.ship.ftlCharge < 1 || c.combatMustKill;
    flee.textContent = r.ship.ftlCharge >= 1 ? 'Jump Out' : `FTL ${Math.round(r.ship.ftlCharge * 100)}%`;
  } else {
    show($('#btn-distress'), r.fuel <= 0);
    const meter = $('#ftl-meter');
    meter.style.setProperty('--ftl', `${Math.round(r.ship.ftlCharge * 100)}%`);
    meter.classList.toggle('ready', r.ship.ftlCharge >= 1);
  }
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export function logLine(text, kind = '') {
  const node = el(`div.logline${kind ? '.' + kind : ''}`, { text });
  const log = $('#event-log');
  log.append(node);
  ui.logLines.push(node);
  while (ui.logLines.length > 6) ui.logLines.shift().remove();
  setTimeout(() => {
    node.classList.add('fade');
    setTimeout(() => { node.remove(); ui.logLines = ui.logLines.filter(n => n !== node); }, 800);
  }, 5200);
}

// ---------------------------------------------------------------------------
// Star map
// ---------------------------------------------------------------------------

let mapAnim = null;

export function openStarMap() {
  const r = run();
  if (r.combat && !r.combat.over) { play('error'); return; }
  play('tab');

  const wrap = el('div.starmap-wrap');
  const canvas = el('canvas', { id: 'starmap', width: '900', height: '480' });
  wrap.append(canvas);

  const legend = el('div.map-legend', null,
    legendItem('#4fe3f5', 'You are here'),
    legendItem('#17a2b8', 'Can jump to'),
    legendItem('#5cf59b', 'Sector exit'),
    legendItem('#b3243c', 'Fleet has arrived'),
    legendItem('#3d4a6b', 'Already visited'));

  const hint = el('p.map-hint', {
    text: r.fuel > 0
      ? 'Click a highlighted beacon to jump. Each jump costs 1 fuel and lets the fleet advance.'
      : 'No fuel. Close the map and send a distress signal.',
  });

  const body = el('div', null, wrap, hint, legend);

  const modal = openModal({
    title: `Sector ${r.sectorIndex + 1} — ${SECTOR_TYPES[r.map.sectorType].name}`,
    body, wide: true,
    actions: [
      atExit(r.map) ? {
        label: 'Leave Sector', kind: 'primary',
        onClick: () => { closeModal(); openSectorChoice(); },
      } : null,
      { label: 'Close', kind: 'ghost', onClick: () => { stopMapAnim(); closeModal(); } },
    ].filter(Boolean),
    onDismiss: () => { stopMapAnim(); closeModal(); },
  });
  modal.querySelector('.modal-body').classList.add('map-modal-body');

  let boxes = [];
  let t = 0;
  const frame = () => {
    t += 1 / 60;
    boxes = render.drawStarMap(canvas, r.map, { t });
    mapAnim = requestAnimationFrame(frame);
  };
  frame();

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = boxes.find(b => Math.hypot(b.x - x, b.y - y) <= b.r);
    if (!hit) return;
    if (!hit.canGo) { play('error'); return; }
    stopMapAnim();
    closeModal();
    doJump(hit.id);
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = boxes.find(b => Math.hypot(b.x - x, b.y - y) <= b.r);
    canvas.style.cursor = hit && hit.canGo ? 'pointer' : 'default';
  });
}

function stopMapAnim() {
  if (mapAnim) cancelAnimationFrame(mapAnim);
  mapAnim = null;
}

function legendItem(color, label) {
  return el('span', null, el('i', { style: { background: color } }), label);
}

function doJump(beaconId) {
  const r = run();
  const confirmJump = game.profile.settings.confirmJump;
  const beacon = beaconById(r.map, beaconId);

  const go = () => {
    play('jump');
    music.duck(0.4, 1.2);
    const res = R.jump(r, beaconId);
    if (!res.ok) { play('error'); logLine(res.reason, 'bad'); return; }
    ui.sceneProp = render.pickSceneProp(new RNG(`${r.seed}-${beaconId}`), beacon.type);
    render.invalidateNebula();
    ui.selectedWeapon = null;
    for (const w of r.ship.weapons) w.targetRoom = null;
    afterPhaseChange();
  };

  if (confirmJump && beacon.fleet) {
    openModal({
      title: 'Jump Into The Fleet?',
      body: 'The Swarm fleet has already reached that beacon. Arriving there means an immediate fight with one of their warships.',
      actions: [
        { label: 'Jump Anyway', kind: 'primary', onClick: () => { closeModal(); go(); } },
        { label: 'Cancel', kind: 'ghost', onClick: () => { closeModal(); openStarMap(); } },
      ],
    });
    return;
  }
  go();
}

function doDistress() {
  const r = run();
  const res = R.sendDistressSignal(r);
  if (!res.ok) { play('error'); return; }
  play('distress');
  showOutcome('Distress Signal', res.outcome, () => {
    if (r.phase === R.PHASES.COMBAT) enterCombat();
    else afterPhaseChange();
  });
}

// ---------------------------------------------------------------------------
// Phase routing
// ---------------------------------------------------------------------------

/** Called after any run.js call that may have changed phase. */
export function afterPhaseChange() {
  const r = run();
  flushAchievements(r);
  renderTopbar(); renderSystems(); renderCrew(); renderWeapons(); renderCombatControls();

  switch (r.phase) {
    case R.PHASES.EVENT: openEvent(); break;
    case R.PHASES.COMBAT: enterCombat(); break;
    case R.PHASES.STORE: openStore(); break;
    case R.PHASES.SECTOR_CHOICE: openSectorChoice(); break;
    case R.PHASES.GAME_OVER:
    case R.PHASES.VICTORY: openSummary(); break;
    default:
      // On the map: prompt the boss fight in the final sector.
      if (r.sectorTree.sectors[r.currentSectorId].isFinal) offerBossFight();
      break;
  }
  game.save();
}

// --- events ----------------------------------------------------------------

function openEvent() {
  const r = run();
  const event = R.currentEvent(r);
  if (!event) { r.phase = R.PHASES.MAP; return; }
  play('event_choice');

  const body = el('div', null,
    el('p.modal-text.flavour', { text: event.text }),
    el('div.choice-list', null,
      ...R.eventChoices(r).map(c =>
        el('button.btn.choice', {
          disabled: !c.ok,
          onclick: () => chooseEvent(c.index),
        },
        el('span', { text: c.text }),
        !c.ok && c.reason ? el('span.creq', { text: c.reason }) : null))));

  openModal({ title: event.title, body, dismissable: false, actions: [] });
}

function chooseEvent(index) {
  const r = run();
  const res = R.chooseEventOption(r, index);
  if (!res.ok) { play('error'); return; }
  play('confirm');
  closeModal();
  showOutcome(R.currentEvent(r)?.title || 'Outcome', res.outcome, () => {
    if (r.phase === R.PHASES.COMBAT) enterCombat();
    else afterPhaseChange();
  });
}

/** Present an outcome's text and its list of effects. */
function showOutcome(title, outcome, next) {
  if (!outcome || (!outcome.text && !outcome.effects?.length)) { next(); return; }
  const body = el('div', null,
    outcome.text ? el('p.modal-text', { text: outcome.text }) : null,
    outcome.effects?.length
      ? el('div.effects', null, ...outcome.effects.map(e =>
        el(`div.effect.${e.kind || 'neutral'}`, { text: e.text })))
      : null);

  for (const e of outcome.effects || []) {
    if (e.kind === 'good') play('purchase', { throttle: 120 });
    if (e.kind === 'bad') play('system_damage', { throttle: 120 });
  }

  openModal({
    title, body,
    actions: [{ label: 'Continue', kind: 'primary', onClick: () => { closeModal(); next(); } }],
    onDismiss: () => { closeModal(); next(); },
  });
  renderTopbar();
}

// --- combat ----------------------------------------------------------------

function enterCombat() {
  const r = run();
  closeModal();
  play('alarm');
  music.duck(0.5, 1.6);
  ui.effects.clear();
  ui.selectedWeapon = null;

  const c = r.combat;
  if (!c) { afterPhaseChange(); return; }
  c.combatMustKill = !!r.combatMeta?.mustKill;

  // Aim everything at their weapons by default so a new player isn't stuck.
  const target = c.enemy.systems.weapons?.room ?? c.enemy.systems.shields?.room ?? 0;
  for (const w of r.ship.weapons) {
    w.autofire = game.profile.settings.autofireDefault !== false;
    if (w.targetRoom == null) w.targetRoom = target;
  }

  r.onCombatEvent = handleCombatPresentation;
  logLine(`${c.enemy.name} — ${c.enemy.className}`, 'bad');
  renderCombatControls();
  renderWeapons();
}

/** Turn combat events into sound, shake and floating numbers. */
function handleCombatPresentation(type, payload) {
  const r = run();
  const frames = ui.frames;
  const frameFor = side => (side === 'player' ? frames?.player : frames?.enemy);

  const roomCentre = (side, roomId) => {
    const f = frameFor(side);
    if (!f) return null;
    if (!f.layout || (side === 'enemy' && !f.interior)) {
      return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    }
    const room = f.layout.rooms[roomId];
    if (!room) return { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    const s = f.scale || 1;
    return {
      x: f.x + (room.x + room.w / 2) * TILE * s,
      y: f.y + (room.y + room.h / 2) * TILE * s,
    };
  };

  switch (type) {
    case 'weaponFired':
      play(payload.sfx || 'laser_light', { throttle: 60 });
      break;
    case 'hullHit': {
      play('hull_hit', { throttle: 90 });
      const p = roomCentre(payload.side, payload.room);
      if (p) {
        ui.effects.add('boom', p.x, p.y, { life: 0.5, scale: 2 });
        ui.effects.add('text', p.x, p.y, { text: `-${payload.damage}`, color: '#ff5c72', life: 1 });
      }
      if (payload.side === 'player') ui.shake = Math.min(14, ui.shake + 5 + payload.damage * 2);
      break;
    }
    case 'systemHit': {
      play('system_damage', { throttle: 90 });
      const p = roomCentre(payload.side, payload.room);
      if (p) ui.effects.add('hit', p.x, p.y, { life: 0.4 });
      break;
    }
    case 'shieldHit': {
      play(payload.superShield ? 'shield_down' : 'shield_hit', { throttle: 70 });
      const f = frameFor(payload.side);
      if (f) ui.effects.add('shield', f.x + f.w / 2, f.y + f.h / 2, { life: 0.5, color: payload.superShield ? '#ffcc5c' : '#4fe3f5' });
      break;
    }
    case 'miss': {
      const p = roomCentre(payload.side, payload.room);
      if (p) ui.effects.add('text', p.x, p.y, { text: 'MISS', color: '#8494b8', size: 12, life: 0.9 });
      play('miss', { throttle: 140 });
      break;
    }
    case 'armorBlocked': {
      const p = roomCentre(payload.side, payload.room);
      if (p) ui.effects.add('text', p.x, p.y, { text: 'BLOCKED', color: '#5cf59b', size: 12, life: 0.9 });
      break;
    }
    case 'fire':
      play('fire_start', { throttle: 400 });
      if (payload.side === 'player') logLine('Fire aboard!', 'bad');
      break;
    case 'breach':
      play('breach', { throttle: 400 });
      if (payload.side === 'player') logLine('Hull breach!', 'bad');
      break;
    case 'crewDied':
      play('crew_die');
      logLine(`${payload.crew?.name || 'Someone'} died — ${payload.cause}.`,
        payload.side === 'player' ? 'bad' : 'good');
      break;
    case 'intercepted':
      play('drone_destroyed', { throttle: 200 });
      break;
    case 'teleportOut': case 'teleportIn':
      play(type === 'teleportOut' ? 'teleport_out' : 'teleport_in');
      break;
    case 'cloakOn': play('cloak_on'); break;
    case 'cloakOff': play('cloak_off'); break;
    case 'hack': case 'hackLand': play('hack_land'); break;
    case 'siphon': play('siphon'); break;
    case 'melee': play('crew_fight', { throttle: payload.throttle || 400 }); break;
    case 'sabotage': play('system_damage', { throttle: payload.throttle || 600 }); break;
    case 'asteroidHit': play('asteroid_hit', { throttle: 200 }); break;
    case 'solarFlare': play('solar_flare', { throttle: 1000 }); break;
    case 'pulsar': play('ion', { throttle: 900 }); break;
    case 'enemyFleeing': logLine(`${r.combat.enemy.name} is charging its FTL drive!`, 'bad'); break;
    case 'shipDestroyed': {
      const f = frameFor(payload.side);
      if (f) {
        for (let i = 0; i < 9; i++) {
          setTimeout(() => ui.effects.add('boom',
            f.x + Math.random() * f.w, f.y + Math.random() * f.h,
            { life: 0.6, scale: 3 }), i * 110);
        }
      }
      play('ship_destroyed');
      ui.shake = 20;
      break;
    }
    case 'combatEnd':
      setTimeout(() => onCombatEnd(payload), 900);
      break;
    default:
      break;
  }
}

function onCombatEnd(payload) {
  const r = run();
  r.onCombatEvent = null;
  renderCombatControls();

  if (payload.outcome === 'victory') {
    play('victory');
    const rewards = r.combatRewards || {};
    const effects = [];
    if (rewards.scrap) effects.push({ text: `+${rewards.scrap} scrap`, kind: 'good' });
    if (rewards.fuel) effects.push({ text: `+${rewards.fuel} fuel`, kind: 'good' });
    if (rewards.missiles) effects.push({ text: `+${rewards.missiles} missiles`, kind: 'good' });
    if (rewards.droneParts) effects.push({ text: `+${rewards.droneParts} drone parts`, kind: 'good' });
    if (rewards.weapon) effects.push({ text: `Salvaged ${getWeapon(rewards.weapon).name}`, kind: 'good' });
    if (rewards.drone) effects.push({ text: `Salvaged ${getDrone(rewards.drone).name}`, kind: 'good' });
    if (rewards.augment) effects.push({ text: `Salvaged ${getAugment(rewards.augment).name}`, kind: 'good' });

    if (r.phase === R.PHASES.VICTORY || r.phase === R.PHASES.GAME_OVER) { afterPhaseChange(); return; }

    showOutcome(payload.captured ? 'Ship Captured' : 'Enemy Destroyed', {
      text: payload.captured
        ? 'Their crew are gone and the hull is intact. You strip it for everything worth taking.'
        : 'The enemy ship breaks apart. Your crew set about collecting what is left.',
      effects,
    }, afterPhaseChange);
  } else if (payload.outcome === 'defeat') {
    play('defeat');
    afterPhaseChange();
  } else {
    logLine(payload.outcome === 'fled' ? 'Jumped clear.' : 'The enemy escaped.');
    afterPhaseChange();
  }
}

function offerBossFight() {
  const r = run();
  if (isModalOpen()) return;
  const phase = r.bossPhase || 1;
  openModal({
    title: 'The Swarm Flagship',
    body: el('div', null,
      el('p.modal-text.flavour', {
        text: phase === 1
          ? 'It fills the viewport. Every scan you run comes back worse than the last. There is no route around it and nowhere left to run.'
          : `The flagship is bringing another weapon array online. Phase ${phase} of 3.`,
      }),
      el('p.modal-text', { text: 'Repair what you can. When you engage, it does not end until one of you is gone.' })),
    dismissable: false,
    actions: [{ label: `Engage — Phase ${phase}`, kind: 'primary', onClick: () => { closeModal(); R.engageBoss(r); enterCombat(); } }],
  });
}

// --- store -----------------------------------------------------------------

function openStore() {
  const r = run();
  play('store_enter');
  openModal({
    title: 'Trading Post',
    body: buildStoreBody(),
    wide: true,
    dismissable: false,
    actions: [{ label: 'Depart', kind: 'primary', onClick: () => { closeModal(); R.leaveStore(r); afterPhaseChange(); } }],
  });
}

function refreshStore() {
  const body = $('#modal-body');
  clear(body).append(buildStoreBody());
  renderTopbar(); renderSystems(); renderWeapons(); renderCrew();
}

function buildStoreBody() {
  const r = run();
  const store = r.store;
  if (!store) return el('p.modal-text', { text: 'The dock is empty.' });

  const items = el('div.store-items');
  store.items.forEach((item, i) => {
    const details = itemDetails(item);
    const affordable = r.scrap >= item.cost;
    const blocked = storeBlockReason(item);
    const cls = item.sold ? 'sold' : (!affordable || blocked) ? 'cant' : '';

    const row = el(`div.sitem.${cls}`, null,
      spriteEl(storeIcon(item), 1),
      el('div', null,
        el('div.sn', { text: item.name }),
        el('div.sd', { text: item.sold ? 'Sold' : (blocked || details?.desc || '') })),
      el('div.sc', { text: `${item.cost}` }));

    if (!item.sold) {
      row.addEventListener('click', () => {
        const res = R.buyItem(r, i);
        if (!res.ok) { play('error'); logLine(res.reason, 'bad'); return; }
        play('purchase');
        flushAchievements(r);
        refreshStore();
      });
    }
    if (details?.desc) tooltip(row, () => tipContent(item.name, details.desc, [`${item.cost} scrap`]));
    items.append(row);
  });

  // --- side panel: resources, repairs, upgrades
  const side = el('div.store-side');

  side.append(el('h4', { text: 'Repairs' }));
  const missing = r.ship.maxHull - r.ship.hull;
  side.append(el('div.buyrow', null,
    el('span.bname', { text: `Hull ${r.ship.hull}/${r.ship.maxHull}` }),
    el('span.bcost', { text: `${store.repairPrice}/pt` })));
  side.append(el('div', { style: { display: 'flex', gap: '6px' } },
    el('button.btn.btn-small', {
      text: 'Repair 1', disabled: missing <= 0,
      onclick: () => doRepair(1),
    }),
    el('button.btn.btn-small', {
      text: 'Repair All', disabled: missing <= 0,
      onclick: () => doRepair(missing),
    })));

  side.append(el('h4', { text: 'Supplies' }));
  for (const [kind, label, price] of [
    ['fuel', 'Fuel', store.fuelPrice],
    ['missiles', 'Missiles', store.missilePrice],
    ['droneParts', 'Drone parts', store.dronePartPrice],
  ]) {
    side.append(el('div.buyrow', null,
      el('span.bname', { text: label }),
      el('span.bcost', { text: String(price) }),
      el('button.btn.btn-small', {
        text: '+1', disabled: r.scrap < price,
        onclick: () => { const res = R.buyResource(r, kind, 1); play(res.ok ? 'purchase' : 'error'); refreshStore(); },
      }),
      el('button.btn.btn-small', {
        text: '+5', disabled: r.scrap < price * 5,
        onclick: () => { const res = R.buyResource(r, kind, 5); play(res.ok ? 'purchase' : 'error'); refreshStore(); },
      })));
  }

  side.append(el('h4', { text: 'Reactor' }));
  const reactorCost = reactorUpgradeCost(r.ship.reactor);
  side.append(el('div.buyrow', null,
    el('span.bname', { text: `${r.ship.reactor} bars` }),
    reactorCost == null
      ? el('span.bcost', { text: 'MAX' })
      : el('button.btn.btn-small', {
        text: `+1 · ${reactorCost}`, disabled: r.scrap < reactorCost,
        onclick: () => {
          const res = R.upgradeReactor(r);
          play(res.ok ? 'upgrade' : 'error');
          refreshStore();
        },
      })));

  const upgrades = el('div.upgrade-list');
  for (const opt of upgradeOptions(r.ship)) {
    const cant = !opt.atMax && r.scrap < opt.cost;
    const row = el(`div.uprow.${opt.atMax ? 'maxed' : cant ? 'cant' : ''}`, null,
      spriteEl(opt.icon, 1),
      el('span', { text: opt.name }),
      el('span.ulvl', { text: `L${opt.level}` }),
      el('span.ucost', { text: opt.atMax ? 'MAX' : String(opt.cost) }));
    if (!opt.atMax) {
      row.addEventListener('click', () => {
        const res = R.upgradeSystem(r, opt.id);
        if (!res.ok) { play('error'); logLine(res.reason, 'bad'); return; }
        play('upgrade');
        flushAchievements(r);
        refreshStore();
      });
    }
    tooltip(row, () => tipContent(opt.name, opt.desc, [`Level ${opt.level}/${opt.maxLevel}`]));
    upgrades.append(row);
  }

  return el('div', null,
    el('p.modal-text', { text: `You have ${r.scrap} scrap.` }),
    el('div.store-grid', null,
      el('div', null, el('h4', { text: 'For Sale', style: { marginBottom: '9px' } }), items),
      side),
    el('h4', { text: 'Upgrades', style: { margin: '22px 0 9px' } }),
    upgrades);
}

function doRepair(points) {
  const r = run();
  const res = R.repairAtStore(r, points);
  if (!res.ok) { play('error'); logLine(res.reason, 'bad'); return; }
  play('repair_done');
  refreshStore();
}

function storeIcon(item) {
  switch (item.kind) {
    case 'weapon': return 'icon_sys_weapons';
    case 'drone': return 'icon_sys_drones';
    case 'augment': return 'icon_star';
    case 'crew': return `crew_${item.id}_idle0`;
    case 'system': return SYSTEMS[item.id]?.icon || 'icon_power';
    default: return 'icon_scrap';
  }
}

function storeBlockReason(item) {
  const r = run();
  const ship = r.ship;
  if (item.kind === 'weapon' && ship.weapons.length >= ship.weaponSlots) return 'No free weapon slot';
  if (item.kind === 'drone' && ship.drones.length >= ship.droneSlots) return 'No free drone slot';
  if (item.kind === 'crew' && S.livingCrew(ship).length >= ship.crewSlots) return 'No room for more crew';
  if (item.kind === 'augment' && ship.augments.includes(item.id)) return 'Already installed';
  return null;
}

// --- sector choice ---------------------------------------------------------

function openSectorChoice() {
  const r = run();
  const res = R.openSectorChoice(r);
  if (!res.ok) { play('error'); logLine(res.reason, 'bad'); return; }
  play('sector_enter');

  const body = el('div', null,
    el('p.modal-text', { text: 'Set a course. The fleet will follow either way.' }),
    el('div.choice-list', null,
      ...res.choices.map(c => el('button.btn.choice', {
        onclick: () => {
          const enter = R.enterSector(r, c.id);
          if (!enter.ok) { play('error'); logLine(enter.reason, 'bad'); return; }
          play('jump');
          render.invalidateNebula();
          closeModal();
          afterPhaseChange();
        },
      },
      el('span', { text: `${c.name}${c.isFinal ? ' — THE LAST STAND' : ''}` }),
      el('span.creq', { text: c.blurb, style: { color: '#8494b8' } })))));

  openModal({ title: 'Choose Your Route', body, dismissable: false, actions: [] });
}

// --- pause / summary -------------------------------------------------------

export function openPauseMenu() {
  const r = run();
  if (r.combat && !r.combat.over && !r.combat.paused) r.combat.togglePause();
  play('tab');

  openModal({
    title: 'Paused',
    body: el('div', null,
      el('p.modal-text', { text: `${r.shipName} · Sector ${r.sectorIndex + 1} · ${duration(r.elapsed)} elapsed` }),
      el('p.modal-text.flavour', { text: `Seed ${r.seed}` })),
    actions: [
      { label: 'Resume', kind: 'primary', onClick: () => { closeModal(); renderCombatControls(); } },
      { label: 'Sound & Settings', kind: 'ghost', onClick: () => { closeModal(); game.openSettings(); } },
      { label: 'How To Play', kind: 'ghost', onClick: () => { closeModal(); game.showHelp(); } },
      { label: 'Abandon Run', kind: 'danger', onClick: confirmAbandon },
    ],
  });
}

function confirmAbandon() {
  openModal({
    title: 'Abandon This Run?',
    body: 'Your ship, crew and cargo will be lost. Unlocks and achievements are kept.',
    actions: [
      {
        label: 'Abandon', kind: 'danger',
        onClick: () => {
          const r = run();
          R.endRun(r, false, 'You abandoned the run.');
          closeModal();
          afterPhaseChange();
        },
      },
      { label: 'Keep Going', kind: 'primary', onClick: () => { closeModal(); openPauseMenu(); } },
    ],
  });
}

function openSummary() {
  const r = run();
  const won = !!r.won;
  play(won ? 'victory' : 'defeat');
  music.duck(0.3, 3);

  const stats = [
    ['Sector', `${r.sectorIndex + 1}/8`],
    ['Ships destroyed', r.stats.shipsDestroyed],
    ['Beacons', r.stats.beacons],
    ['Scrap earned', r.stats.scrapEarned],
    ['Crew lost', r.stats.crewLost],
    ['Time', duration(r.elapsed)],
  ];

  const body = el('div', null,
    el(`div.summary-hero.${won ? 'win' : 'loss'}`, null,
      el('div.verdict', { text: won ? 'Victory' : 'Run Over' }),
      el('div.cause', { text: r.cause || '' }),
      el('div.score', { text: String(r.score) }),
      el('div.score-label', { text: 'Final score' })),
    el('div.summary-stats', null,
      ...stats.map(([label, value]) =>
        el('div.s', null, el('div.sv', { text: String(value) }), el('div.sl', { text: label })))));

  openModal({
    title: won ? 'The Swarm Is Broken' : 'End Of The Line',
    body, dismissable: false,
    actions: [
      { label: 'To The Hangar', kind: 'primary', onClick: () => { closeModal(); game.toHangar(); } },
      { label: 'Main Menu', kind: 'ghost', onClick: () => { closeModal(); game.toTitle(); } },
    ],
  });

  flushAchievements(r);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

let lastPanelRefresh = 0;

/** Called every animation frame by main.js. */
export function frame(dt, t) {
  const r = run();
  if (!r) return;

  const canvas = $('#stage');
  const size = render.resizeStage(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size.w, size.h);

  const combat = r.combat && !r.combat.over ? r.combat : null;
  const enemy = combat ? combat.enemy : null;
  const sensors = r.ship.systems.sensors;
  const seeInside = !!enemy && (
    enemy.isBoss
    || (sensors && effectiveLevel(sensors) >= 2 && !r.map.nebula)
    || r.ship.crew.some(c => !c.dead && getRace(c.race).traits.telepathy)
  );

  ui.frames = render.layoutFrames(r.ship, enemy, size.w, size.h, seeInside);

  ctx.save();
  if (ui.shake > 0) {
    ctx.translate((Math.random() - 0.5) * ui.shake, (Math.random() - 0.5) * ui.shake);
    ui.shake = Math.max(0, ui.shake - dt * 34);
  }

  render.drawSceneProp(ctx, ui.sceneProp, size.w, size.h, t);

  const targetRooms = r.ship.weapons.filter(w => w.powered && w.targetRoom != null).map(w => w.targetRoom);

  render.drawShipInterior(ctx, r.ship, ui.frames.player, t, {
    selectedCrew: ui.selectedCrew,
    hoverRoom: ui.hoverShip === 'player' ? ui.hoverRoom : null,
    boarders: combat ? combat.enemyBoarders : [],
  });
  drawShipLabel(ctx, r.ship, ui.frames.player, r.shipName);

  if (enemy && ui.frames.enemy) {
    if (seeInside) {
      render.drawShipInterior(ctx, enemy, ui.frames.enemy, t, {
        hoverRoom: ui.hoverShip === 'enemy' ? ui.hoverRoom : null,
        targetRooms,
        boarders: combat ? combat.boarders : [],
      });
    } else {
      render.drawShipExterior(ctx, enemy, ui.frames.enemy, t);
      render.drawShieldBubble(ctx, enemy, ui.frames.enemy, t);
    }
    drawShipLabel(ctx, enemy, ui.frames.enemy, `${enemy.name}`);
  }

  if (combat) {
    render.drawProjectiles(ctx, combat, ui.frames);
    render.drawBeams(ctx, combat, ui.frames);
  }

  ui.effects.update(dt);
  ui.effects.draw(ctx);
  ctx.restore();

  // Panels don't need 60fps; refreshing them a few times a second is plenty
  // and keeps the DOM churn off the frame budget.
  if (t - lastPanelRefresh > 0.2) {
    lastPanelRefresh = t;
    renderTopbar();
    renderSystems();
    renderCrew();
    renderWeapons();
    renderCombatControls();
  }
}

function drawShipLabel(ctx, ship, frame, name) {
  ctx.save();
  ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center';
  ctx.fillStyle = ship.isEnemy ? '#ff5c72' : '#4fe3f5';
  ctx.fillText(name.toUpperCase(), frame.x + frame.w / 2, frame.y - 22);

  // Hull bar.
  const bw = Math.min(frame.w, 190);
  const bx = frame.x + frame.w / 2 - bw / 2;
  const by = frame.y - 15;
  const frac = Math.max(0, ship.hull / ship.maxHull);
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(bx, by, bw, 5);
  ctx.fillStyle = frac > 0.5 ? '#22b35c' : frac > 0.25 ? '#d98c1f' : '#b3243c';
  ctx.fillRect(bx, by, bw * frac, 5);
  ctx.strokeStyle = 'rgba(132,148,184,.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 4);
  ctx.restore();
}

export function resetForNewRun() {
  ui.selectedCrew = null;
  ui.selectedWeapon = null;
  ui.effects.clear();
  ui.shake = 0;
  ui.sceneProp = null;
  for (const n of ui.logLines) n.remove();
  ui.logLines = [];
  render.invalidateNebula();
}
