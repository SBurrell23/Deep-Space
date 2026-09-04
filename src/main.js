/**
 * Deep Space — entry point.
 *
 * Owns the profile, the active run, the animation loop and the global key
 * bindings, and hands everything else off to the ui/ modules.
 */

import { $, $$, show } from './ui/dom.js';
import * as screens from './ui/screens.js';
import * as gameui from './ui/gameui.js';
import * as render from './ui/render.js';
import { initSettings, openSettings, closeSettings, isSettingsOpen, refresh as refreshSettings } from './ui/settings.js';

import * as bus from './audio/bus.js';
import * as music from './audio/music.js';
import { play } from './audio/sfx.js';

import * as save from './core/save.js';
import * as R from './game/run.js';
import * as S from './game/ship.js';
import { SECTOR_TYPES } from './game/sector.js';

// Registering the art bags has the side effect of populating the sprite
// registry, so these imports must happen before anything draws.
import './ui/art-crew.js';
import './ui/art-ships.js';

const state = {
  profile: null,
  run: null,
  lastFrame: 0,
  t: 0,
  started: false,
  errors: [],
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  state.profile = save.loadProfile();
  bus.loadSettings();

  screens.initModal();
  initSettings(state.profile, () => save.saveProfile(state.profile));
  gameui.attach({
    get run() { return state.run; },
    get profile() { return state.profile; },
    save: saveGame,
    openSettings,
    showHelp: () => { screens.renderHelp(); screens.showScreen('help'); },
    toHangar: () => { state.run = null; openHangar(); },
    toTitle: () => { state.run = null; goTitle(); },
  });

  bindTitleMenu();
  bindGlobalKeys();
  bindAudioUnlock();
  bindResize();

  render.resizeBackdrop($('#backdrop'));
  goTitle();
  requestAnimationFrame(loop);

  if (!save.canPersist()) {
    screens.toast({
      tag: 'Warning',
      name: 'Progress will not be saved',
      desc: 'This browser is blocking local storage.',
      kind: 'unlock',
    });
  }
}

function bindTitleMenu() {
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'new-run': play('click'); openHangar(); break;
      case 'continue': play('confirm'); continueRun(); break;
      case 'hangar': play('click'); openHangar(); break;
      case 'achievements': play('click'); screens.renderAchievements(state.profile); screens.showScreen('achievements'); break;
      case 'stats': play('click'); screens.renderStats(state.profile); screens.showScreen('stats'); break;
      case 'help': play('click'); screens.renderHelp(); screens.showScreen('help'); break;
      case 'settings': openSettings(); break;
      case 'back': play('cancel'); goTitle(); break;
      case 'wipe': confirmWipe(); break;
      default: break;
    }
  });
}

function goTitle() {
  screens.renderTitle(save.savedRunSummary());
  screens.showScreen('title');
}

function openHangar() {
  screens.renderHangar(state.profile, startNewRun);
  screens.showScreen('hangar');
}

function confirmWipe() {
  play('cancel');
  screens.openModal({
    title: 'Erase All Data?',
    body: 'This permanently deletes every unlock, achievement, record and saved run stored in this browser. It cannot be undone.',
    actions: [
      {
        label: 'Erase Everything', kind: 'danger',
        onClick: () => {
          state.profile = save.resetProfile();
          save.clearRun();
          save.saveProfile(state.profile);
          screens.closeModal();
          screens.renderStats(state.profile);
          refreshSettings();
          play('error');
        },
      },
      { label: 'Cancel', kind: 'primary', onClick: () => screens.closeModal() },
    ],
  });
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

function startNewRun(shipId, variant, seed) {
  state.run = R.startRun(state.profile, shipId, variant, seed);
  state.run.profile = state.profile;
  enterGame();
}

function continueRun() {
  const loaded = save.loadRun();
  if (!loaded) { play('error'); goTitle(); return; }
  state.run = loaded;
  state.run.profile = state.profile;
  // A run saved mid-combat resumes on the map: the fight is not serialisable
  // and re-rolling it would be worse than letting the player off.
  if (state.run.phase === R.PHASES.COMBAT) {
    state.run.combat = null;
    state.run.phase = R.PHASES.MAP;
  }
  enterGame();
}

function enterGame() {
  gameui.resetForNewRun();
  screens.showScreen('game');
  music.play('main');
  gameui.afterPhaseChange();
}

function saveGame() {
  save.saveProfile(state.profile);
  if (state.run) R.autosave(state.run);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let loopErrors = 0;

/**
 * The animation loop.
 *
 * The whole body is guarded and the next frame is always scheduled: one bad
 * frame — a missing sprite, an odd layout — must never freeze the game. The
 * first few failures are reported so they don't pass silently in development.
 */
function loop(now) {
  try {
    step(now);
  } catch (err) {
    loopErrors++;
    // Keep the first few for inspection: a frame error that only reproduces
    // on a deployed build is otherwise very hard to chase.
    if (state.errors.length < 5) {
      state.errors.push({ message: err.message, stack: String(err.stack || '').split('\n').slice(0, 5) });
    }
    if (loopErrors <= 3) {
      console.error('Deep Space: frame error', err);
      if (loopErrors === 1) {
        screens.toast({ tag: 'Error', name: 'Rendering hiccup', desc: 'The game recovered; check the console.' });
      }
    }
  }
  requestAnimationFrame(loop);
}

function step(now) {
  const dt = Math.min(0.1, (now - state.lastFrame) / 1000 || 0);
  state.lastFrame = now;
  state.t += dt;

  const inGame = screens.currentScreen() === 'game' && state.run;
  const combat = inGame && state.run.combat && !state.run.combat.over ? state.run.combat : null;

  const mood = combat ? 'combat' : inGame ? 'travel' : 'menu';
  const tint = inGame ? SECTOR_TYPES[state.run.map.sectorType]?.color : null;
  render.drawBackdrop($('#backdrop'), state.t, mood, tint);

  if (!inGame) return;

  const modalBlocking = screens.isModalOpen() || isSettingsOpen();
  if (combat) {
    if (!modalBlocking) combat.update(dt);
  } else if (!modalBlocking) {
    R.tick(state.run, dt);
    // A run can end out of combat (suffocation, a fire nobody fought).
    if (state.run.phase === R.PHASES.GAME_OVER && !screens.isModalOpen()) {
      gameui.afterPhaseChange();
    }
  }
  gameui.frame(dt, state.t);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function bindGlobalKeys() {
  document.addEventListener('keydown', e => {
    // Never hijack typing in the seed box.
    if (e.target.matches('input, textarea')) return;

    if (e.key === 'Escape') {
      if (isSettingsOpen()) { closeSettings(); return; }
      if (screens.isModalOpen()) { screens.closeModal(); return; }
      if (screens.currentScreen() === 'game') { gameui.openPauseMenu(); return; }
      if (screens.currentScreen() !== 'title') { play('cancel'); goTitle(); }
      return;
    }

    if (screens.currentScreen() !== 'game' || !state.run) return;
    if (screens.isModalOpen() || isSettingsOpen()) return;

    const r = state.run;
    const combat = r.combat && !r.combat.over ? r.combat : null;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        if (combat) gameui.togglePause();
        break;
      case 'm':
        if (!combat) gameui.openStarMap();
        break;
      case 'a':
        for (const w of r.ship.weapons) w.autofire = !w.autofire;
        play('toggle');
        gameui.renderWeapons();
        break;
      case 'o':
        S.setAllDoors(r.ship, true);
        play('door');
        break;
      case 'c':
        S.setAllDoors(r.ship, false);
        play('door');
        break;
      case 'tab': {
        e.preventDefault();
        const alive = r.ship.crew.filter(c => !c.dead);
        if (!alive.length) break;
        const idx = alive.findIndex(c => c.id === gameui.ui.selectedCrew);
        gameui.ui.selectedCrew = alive[(idx + 1) % alive.length].id;
        play('crew_select');
        gameui.renderCrew();
        break;
      }
      case '1': case '2': case '3': case '4': {
        const n = Number(e.key) - 1;
        if (combat) {
          // In a fight the number row is speed control unless shift is held.
          if (e.shiftKey) selectWeapon(n);
          else { combat.setSpeed([1, 2, 4, 4][n] ?? 1); combat.paused = false; gameui.renderCombatControls(); play('tab'); }
        } else {
          selectWeapon(n);
        }
        break;
      }
      default:
        break;
    }
  });

  function selectWeapon(n) {
    const r = state.run;
    if (!r.ship.weapons[n]) return;
    gameui.ui.selectedWeapon = gameui.ui.selectedWeapon === n ? null : n;
    play('beacon_select');
    gameui.renderWeapons();
  }
}

/**
 * Browsers block audio until a gesture. The first click anywhere starts the
 * context and, on the game screen, the soundtrack.
 */
function bindAudioUnlock() {
  const start = () => {
    bus.unlock();
    bus.applyGains();
    if (!state.started) {
      state.started = true;
      music.bindVisibility();
      music.play('main');
      refreshSettings();
    }
  };
  document.addEventListener('pointerdown', start, { once: false });
  document.addEventListener('keydown', start, { once: false });
}

function bindResize() {
  let pending = null;
  window.addEventListener('resize', () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      render.resizeBackdrop($('#backdrop'));
      render.invalidateNebula();
    }, 120);
  });
}

// Autosave when the tab goes away, so a closed laptop doesn't cost a run.
window.addEventListener('visibilitychange', () => {
  if (document.hidden && state.run) saveGame();
});
window.addEventListener('pagehide', () => { if (state.run) saveGame(); });

// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Expose a small surface for debugging from the console.
globalThis.DeepSpace = { state, R, S, save, screens, gameui, render, bus, music, step };
