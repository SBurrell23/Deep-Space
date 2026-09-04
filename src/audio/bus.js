/**
 * Audio bus + persisted settings.
 *
 * Browsers refuse to start an AudioContext before a user gesture, so the
 * context is created lazily on the first `unlock()` (wired to the first click
 * or keypress anywhere in the app). Everything upstream can call into the bus
 * before then; calls are simply dropped until it exists.
 */

const STORAGE_KEY = 'deepspace.audio.v1';

const DEFAULTS = {
  master: 0.8,
  music: 0.55,
  sfx: 0.75,
  muted: false,
};

export const settings = { ...DEFAULTS };

const listeners = new Set();

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(settings, DEFAULTS, JSON.parse(raw));
  } catch { /* corrupt or unavailable storage: fall back to defaults */ }
  clampSettings();
  return settings;
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* private mode / quota: settings just won't persist */ }
}

function clampSettings() {
  for (const k of ['master', 'music', 'sfx']) {
    const v = Number(settings[k]);
    settings[k] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULTS[k];
  }
  settings.muted = !!settings.muted;
}

export function setSetting(key, value) {
  settings[key] = value;
  clampSettings();
  applyGains();
  saveSettings();
  for (const fn of listeners) fn(settings);
}

export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  applyGains();
  saveSettings();
  for (const fn of listeners) fn(settings);
}

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let compressor = null;

export function isUnlocked() { return ctx !== null && ctx.state === 'running'; }
export function context() { return ctx; }
export function musicNode() { return musicGain; }
export function sfxNode() { return sfxGain; }
export function now() { return ctx ? ctx.currentTime : 0; }

/**
 * Create (or resume) the AudioContext. Safe to call repeatedly; wire it to the
 * first user gesture. Returns the context or null if Web Audio is unavailable.
 */
export function unlock() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();

    // A gentle limiter keeps stacked explosions from clipping.
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 20;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    musicGain.connect(masterGain);
    sfxGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyGains();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function applyGains() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const m = settings.muted ? 0 : settings.master;
  // Perceptual curve: raw slider values sound top-heavy, so square them.
  const curve = v => v * v;
  masterGain.gain.setTargetAtTime(curve(m), t, 0.02);
  musicGain.gain.setTargetAtTime(curve(settings.music), t, 0.02);
  sfxGain.gain.setTargetAtTime(curve(settings.sfx), t, 0.02);
}

/** Effective loudness of a channel, used by SFX to skip work when silent. */
export function channelLevel(channel) {
  if (settings.muted) return 0;
  return settings.master * (channel === 'music' ? settings.music : settings.sfx);
}

export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

/** Test hook — lets the suite drive the bus with a fake context. */
export function __setContextForTests(fake) {
  ctx = fake;
  if (fake) {
    masterGain = fake.createGain();
    musicGain = fake.createGain();
    sfxGain = fake.createGain();
  } else {
    masterGain = musicGain = sfxGain = null;
  }
}
