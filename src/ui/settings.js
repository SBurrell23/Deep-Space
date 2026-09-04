/**
 * The sound & settings panel.
 *
 * Reachable from every screen — the title menu, the in-game top bar and the
 * pause menu all open this same dialog, and it applies changes live so the
 * player can hear what they are setting while a fight is running.
 */

import { $ } from './dom.js';
import * as bus from '../audio/bus.js';
import * as music from '../audio/music.js';
import { play } from '../audio/sfx.js';

let root = null;
let profile = null;
let onProfileChange = null;
let lastFocus = null;

export function initSettings(gameProfile, saveFn) {
  profile = gameProfile;
  onProfileChange = saveFn;
  root = $('#settings-root');

  bind('#vol-master', 'master', '#out-master');
  bind('#vol-music', 'music', '#out-music');
  bind('#vol-sfx', 'sfx', '#out-sfx');

  const mute = $('#opt-mute');
  mute.addEventListener('change', () => {
    bus.setSetting('muted', mute.checked);
    music.syncToSettings();
    if (!mute.checked) play('toggle');
    refresh();
  });

  bindGameOption('#opt-confirm-jump', 'confirmJump');
  bindGameOption('#opt-autofire', 'autofireDefault');

  root.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'settings-dismiss') closeSettings();
    else if (action === 'test-sound') play('confirm');
    else if (action === 'reset-audio') { bus.resetSettings(); music.syncToSettings(); refresh(); play('toggle'); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !root.hidden) { e.stopPropagation(); closeSettings(); }
  }, true);

  refresh();
}

function bind(selector, key, outputSelector) {
  const input = $(selector);
  const output = $(outputSelector);
  const apply = () => {
    const v = Number(input.value) / 100;
    bus.setSetting(key, v);
    output.textContent = `${Math.round(v * 100)}%`;
    music.syncToSettings();
  };
  input.addEventListener('input', apply);
  // A short blip on release lets you hear the level you just set.
  input.addEventListener('change', () => {
    if (key !== 'music') play(key === 'master' ? 'click' : 'weapon_ready');
  });
}

function bindGameOption(selector, key) {
  const input = $(selector);
  input.addEventListener('change', () => {
    if (!profile) return;
    profile.settings[key] = input.checked;
    if (onProfileChange) onProfileChange();
    play('toggle');
  });
}

/** Pull the current settings into the controls. */
export function refresh() {
  if (!root) return;
  const s = bus.settings;
  $('#vol-master').value = Math.round(s.master * 100);
  $('#vol-music').value = Math.round(s.music * 100);
  $('#vol-sfx').value = Math.round(s.sfx * 100);
  $('#out-master').textContent = `${Math.round(s.master * 100)}%`;
  $('#out-music').textContent = `${Math.round(s.music * 100)}%`;
  $('#out-sfx').textContent = `${Math.round(s.sfx * 100)}%`;
  $('#opt-mute').checked = s.muted;

  // Defaults matter here: a checkbox that renders false while the behaviour is
  // true means the control does nothing until you toggle it twice.
  const OPTIONS = [
    ['#opt-confirm-jump', 'confirmJump', false],
    ['#opt-autofire', 'autofireDefault', true],
  ];
  for (const [sel, key, dflt] of OPTIONS) {
    const input = $(sel);
    if (input && profile) input.checked = profile.settings[key] ?? dflt;
  }

  const note = $('#audio-note');
  if (!note) return;
  if (music.isBlocked()) {
    note.textContent = 'Your browser blocked audio until you interact with the page. Click anywhere to start the soundtrack.';
    note.className = 'setting-note warn';
  } else if (!bus.isUnlocked()) {
    note.textContent = 'Audio starts on your first click. All sound effects are generated in JavaScript — no audio files.';
    note.className = 'setting-note';
  } else {
    note.textContent = 'Every sound effect is synthesised live with the Web Audio API. Settings are saved to this browser.';
    note.className = 'setting-note';
  }
}

export function openSettings() {
  if (!root) return;
  lastFocus = document.activeElement;
  refresh();
  root.hidden = false;
  play('tab');
  const first = $('#vol-master');
  if (first) first.focus();
}

export function closeSettings() {
  if (!root || root.hidden) return;
  root.hidden = true;
  play('cancel');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

export function isSettingsOpen() { return root && !root.hidden; }
