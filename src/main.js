/**
 * Boot, the frame loop, and input.
 *
 * Owns the single requestAnimationFrame loop for the whole app and routes
 * keyboard/mouse into the simulation's input struct. Everything else is called
 * from here; no other module schedules frames.
 */

import { $, $$, el, show, relativeTime } from './ui/dom.js';
import * as screens from './ui/screens.js';
import * as gameui from './ui/gameui.js';
import * as render from './ui/render.js';
import { initSettings, openSettings } from './ui/settings.js';
import * as bus from './audio/bus.js';
import * as music from './audio/music.js';
import { play } from './audio/sfx.js';
import * as save from './core/save.js';
import * as R from './game/run.js';
import * as U from './game/universe.js';
import { SHIPS, unlockedShips, STARTER_SHIP } from './game/ships.js';
import { blankInput } from './game/sim.js';
import { checkAchievements } from './game/achievements.js';

// Art registers itself on import.
import './ui/art-crew.js';
import './ui/art-ships.js';
import './ui/art-shmup.js';

const state = {
  profile: null,
  run: null,
  running: false,
  lastT: 0,
  time: 0,
  frameErrors: 0,
};

const keys = new Set();
const mouse = { x: 0, y: 0, left: false, right: false, inStage: false };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  state.profile = save.loadProfile();
  state.profile.settings = state.profile.settings || {};
  save.purgeLegacy();

  bus.loadSettings();
  screens.initModal();
  initSettings(state.profile, () => save.saveProfile(state.profile));

  gameui.attach({
    get run() { return state.run; },
    get profile() { return state.profile; },
    openSettings,
    endRun,
    recordVictory,
  });

  bindGlobalInput();
  bindMenus();
  sizeCanvases();

  window.addEventListener('resize', sizeCanvases);

  // Audio can only start from a gesture; the first one anywhere unlocks it.
  const unlock = () => {
    bus.unlock();
    music.play('main');
    music.bindVisibility();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  screens.renderTitle(save.savedRunSummary());
  screens.showScreen('title');

  state.running = true;
  requestAnimationFrame(loop);
}

function sizeCanvases() {
  render.resizeBackdrop($('#backdrop'));
  const stage = $('#stage');
  if (!$('#stage-wrap').hidden) render.resizeStage(stage);
  const map = $('#mapcanvas');
  if (!map.hidden) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = map.getBoundingClientRect();
    map.width = Math.max(1, Math.floor(rect.width * dpr));
    map.height = Math.max(1, Math.floor(rect.height * dpr));
    map.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

function bindMenus() {
  $('#app').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    switch (action) {
      case 'new-run': play('click'); openHangar(); break;
      case 'continue': play('confirm'); continueRun(); break;
      case 'hangar': play('click'); openHangar(); break;
      case 'achievements': play('click'); screens.renderAchievements(state.profile); screens.showScreen('achievements'); break;
      case 'stats': play('click'); screens.renderStats(state.profile); screens.showScreen('stats'); break;
      case 'help': play('click'); screens.renderHelp(); screens.showScreen('help'); break;
      case 'settings': play('click'); openSettings(); break;
      case 'back': play('cancel'); screens.goBack('title'); break;
      case 'wipe': confirmWipe(); break;
    }
  });
}

function openHangar() {
  screens.renderHangar(state.profile, startRun);
  screens.showScreen('hangar');
}

function confirmWipe() {
  screens.openModal({
    title: 'Erase all data?',
    body: el('p.modal-text', { text: 'Every achievement, unlocked hull and record is deleted, along with any run in progress. This cannot be undone.' }),
    actions: [
      { text: 'Cancel', kind: 'ghost', onClick: () => screens.closeModal() },
      {
        text: 'Erase Everything', kind: 'danger',
        onClick: () => {
          state.profile = save.resetProfile();
          state.profile.settings = {};
          screens.closeModal();
          screens.renderStats(state.profile);
          screens.renderTitle(null);
          play('error');
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

function startRun(shipId = STARTER_SHIP, seed = null) {
  if (!unlockedShips(state.profile).includes(shipId)) return;
  state.profile.stats.runs++;
  save.saveProfile(state.profile);

  state.run = R.startRun({ shipId, seed, profile: state.profile });
  state.profile.lastShip = shipId;

  gameui.ui.lastPhase = null;
  screens.showScreen('game');
  sizeCanvases();
  gameui.ui.map.snapTo(U.currentNode(state.run.map));
  gameui.syncPhase(true);
  autosave();
  play('jump');
}

function continueRun() {
  const data = save.loadRun();
  if (!data) return;
  try {
    state.run = R.deserialize(data, state.profile);
  } catch {
    // A save from an incompatible build should not brick the title screen.
    save.clearRun();
    screens.renderTitle(null);
    return;
  }
  gameui.ui.lastPhase = null;
  screens.showScreen('game');
  sizeCanvases();
  gameui.ui.map.snapTo(U.currentNode(state.run.map));
  gameui.syncPhase(true);
}

function recordVictory() {
  const r = state.run;
  if (!r || r.recordedVictory) return;
  r.recordedVictory = true;
  save.recordRunResult(state.profile, r, 'victory');
  const earned = checkAchievements(r, 'victory');
  for (const a of earned) screens.toast({ tag: 'Achievement', name: a.name, desc: a.desc });
  save.saveProfile(state.profile);
}

function endRun(outcome) {
  const r = state.run;
  if (r && !r.recordedVictory) save.recordRunResult(state.profile, r, outcome);
  // A dead run is gone for good — that is the whole point of the format.
  save.clearRun();
  state.run = null;
  gameui.ui.lastPhase = null;
  screens.renderTitle(null);
  screens.showScreen('title');
  music.play('main', { fade: 2 });
}

let autosaveTimer = 0;
function autosave() {
  if (!state.run || state.run.phase === 'dead') return;
  try { save.saveRun(R.serialize(state.run)); } catch { /* quota; nothing to do */ }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function bindGlobalInput() {
  const stage = $('#stage');

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);

    // Let the settings dialog and modals own Escape when they are open.
    if (e.code === 'Escape') {
      if (screens.isModalOpen()) return;
      if (state.run && screens.currentScreen() === 'game') { e.preventDefault(); gameui.openPauseMenu(); }
      return;
    }
    if (screens.isModalOpen()) return;

    if (screens.currentScreen() === 'game' && state.run) {
      if (e.code === 'KeyI') { e.preventDefault(); gameui.openInventory(); }
      if (e.code === 'KeyM' && state.run.phase === 'map') gameui.ui.map.panTo(U.currentNode(state.run.map));
      if (e.code === 'Space') e.preventDefault();   // never scroll the page
    }
  });

  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });

  stage.addEventListener('pointermove', e => {
    const w = render.screenToWorld(stage, e.clientX, e.clientY);
    mouse.x = w.x; mouse.y = w.y;
    mouse.inStage = true;
  });
  stage.addEventListener('pointerdown', e => {
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    const w = render.screenToWorld(stage, e.clientX, e.clientY);
    mouse.x = w.x; mouse.y = w.y;
  });
  window.addEventListener('pointerup', e => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  stage.addEventListener('contextmenu', e => e.preventDefault());
}

/** Translate held keys and the mouse into the sim's input struct. */
function applyInput(world) {
  const inp = world.input;
  if (screens.isModalOpen()) {
    // Freeze the controls while a dialog is up rather than flying blind.
    Object.assign(inp, blankInput());
    return;
  }

  const down = c => keys.has(c);
  inp.moveX = (down('KeyD') || down('ArrowRight') ? 1 : 0) - (down('KeyA') || down('ArrowLeft') ? 1 : 0);
  inp.moveY = (down('KeyS') || down('ArrowDown') ? 1 : 0) - (down('KeyW') || down('ArrowUp') ? 1 : 0);

  inp.aimX = mouse.x;
  inp.aimY = mouse.y;

  const holdToFire = state.profile.settings.autofireDefault !== false;
  inp.firePrimary = holdToFire ? mouse.left : true;
  inp.fireSecondary = mouse.right;

  inp.dash = down('Space') || down('ShiftLeft') || down('ShiftRight');
  inp.abilities[0] = down('Digit1') || down('KeyQ');
  inp.abilities[1] = down('Digit2') || down('KeyE');
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

function loop(now) {
  if (!state.running) return;
  requestAnimationFrame(loop);

  const dt = Math.min(0.05, (now - state.lastT) / 1000 || 0);
  state.lastT = now;
  state.time += dt;

  try {
    frame(dt);
  } catch (err) {
    // One bad frame must never end the session: log it, keep the loop alive.
    state.frameErrors++;
    if (state.frameErrors < 6) console.error('frame error', err);
    state.lastError = String(err && err.stack || err);
  }
}

function frame(dt) {
  const screen = screens.currentScreen();
  const r = state.run;

  const mood = screen === 'game'
    ? (r?.phase === 'action' ? 'combat' : 'travel')
    : 'menu';
  render.drawBackdrop($('#backdrop'), state.time, mood);

  if (screen !== 'game' || !r) return;

  if (r.phase === 'action' && r.world) {
    applyInput(r.world);
    R.tick(r, dt);

    const events = r.world ? drain(r.world) : [];
    for (const [name, throttle] of render.consumeEvents(events, gameui.ui.effects)) {
      play(name, { throttle });
    }
    gameui.ui.effects.update(dt);

    const stage = $('#stage');
    if (stage.width === 0 || stage.dataset.sized !== `${stage.clientWidth}x${stage.clientHeight}`) {
      render.resizeStage(stage);
      stage.dataset.sized = `${stage.clientWidth}x${stage.clientHeight}`;
    }
    render.drawWorld(stage, r.world, gameui.ui.effects, state.time);
  } else {
    r.elapsed += dt * 0;   // non-combat time is not scored
  }

  gameui.frame(dt, state.time);
  gameui.syncPhase();
  gameui.renderTopbar();
  gameui.flushToasts(r);

  autosaveTimer += dt;
  if (autosaveTimer > 8) { autosaveTimer = 0; autosave(); }
}

function drain(world) {
  const out = world.events;
  world.events = [];
  return out;
}

// Expose a small surface for the browser-based smoke tests.
window.DeepSpace = { state, screens, gameui, render, R, U, save, SHIPS, startRun };

boot();
