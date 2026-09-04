/**
 * Deep Space — music player.
 *
 * The soundtrack is a looping MP3 routed through the shared music bus so the
 * settings panel controls it alongside the SFX. Playback uses a plain
 * <audio> element piped into Web Audio via MediaElementSource: streaming keeps
 * startup instant instead of waiting on a ~9MB decode.
 *
 * Fades are handled here rather than on the bus gain, so the settings slider
 * and a scene transition can't fight each other.
 */
import { unlock, context, musicNode, channelLevel } from './bus.js';

const TRACKS = {
  main: 'assets/audio/deep-space-theme.mp3',
};

let el = null;
let source = null;
let fadeGain = null;
let currentTrack = null;
let wantPlaying = false;
let ready = false;
/** Set when the browser blocks autoplay, so the UI can prompt for a click. */
let blocked = false;

export function trackNames() { return Object.keys(TRACKS); }
export function isPlaying() { return !!(el && !el.paused); }
export function isBlocked() { return blocked; }
export function currentTrackName() { return currentTrack; }

function ensureElement() {
  if (el || typeof document === 'undefined') return el;
  el = document.createElement('audio');
  el.loop = true;
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  // Kept out of the DOM flow but present so mobile browsers treat it as real.
  el.style.display = 'none';
  document.body.appendChild(el);
  el.addEventListener('canplay', () => { ready = true; });
  el.addEventListener('error', () => { ready = false; });
  return el;
}

function ensureGraph() {
  const ctx = context();
  if (!ctx || !el || source) return;
  try {
    source = ctx.createMediaElementSource(el);
    fadeGain = ctx.createGain();
    fadeGain.gain.value = 0;
    source.connect(fadeGain).connect(musicNode());
  } catch {
    // Some browsers refuse a second MediaElementSource for one element; fall
    // back to element volume so music still plays, just without bus routing.
    source = null;
  }
}

/**
 * Start (or switch to) a track. Safe to call before the audio context exists —
 * it retries on the next `unlock()`-bearing call.
 */
export function play(track = 'main', { fade = 1.5 } = {}) {
  if (!TRACKS[track]) return false;
  wantPlaying = true;
  ensureElement();
  if (!el) return false;

  if (currentTrack !== track) {
    currentTrack = track;
    el.src = TRACKS[track];
    el.load();
  }

  unlock();
  ensureGraph();

  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.then(() => { blocked = false; }).catch(() => { blocked = true; });
  }
  fadeTo(1, fade);
  return true;
}

export function pause({ fade = 0.6 } = {}) {
  wantPlaying = false;
  if (!el) return;
  fadeTo(0, fade);
  const ms = fade * 1000 + 60;
  setTimeout(() => { if (!wantPlaying && el) el.pause(); }, ms);
}

export function stop() {
  wantPlaying = false;
  if (!el) return;
  el.pause();
  el.currentTime = 0;
  if (fadeGain) fadeGain.gain.value = 0;
}

/** Duck the music under a stinger or a big explosion, then bring it back. */
export function duck(amount = 0.35, hold = 0.8) {
  if (!fadeGain || !context()) return;
  const t = context().currentTime;
  fadeGain.gain.cancelScheduledValues(t);
  fadeGain.gain.setValueAtTime(fadeGain.gain.value, t);
  fadeGain.gain.linearRampToValueAtTime(amount, t + 0.12);
  fadeGain.gain.linearRampToValueAtTime(wantPlaying ? 1 : 0, t + 0.12 + hold);
}

function fadeTo(target, seconds) {
  const ctx = context();
  if (fadeGain && ctx) {
    const t = ctx.currentTime;
    fadeGain.gain.cancelScheduledValues(t);
    fadeGain.gain.setValueAtTime(Math.max(0.0001, fadeGain.gain.value), t);
    fadeGain.gain.linearRampToValueAtTime(target, t + Math.max(0.01, seconds));
  } else if (el) {
    el.volume = target * Math.max(0, Math.min(1, channelLevel('music')));
  }
}

/**
 * Keep the element in sync when the graph isn't available (fallback path) and
 * pause playback entirely at zero volume so we aren't decoding for nothing.
 */
export function syncToSettings() {
  const level = channelLevel('music');
  if (el && !source) el.volume = Math.max(0, Math.min(1, level));
  if (!el) return;
  if (level <= 0 && !el.paused) {
    el.pause();
  } else if (level > 0 && wantPlaying && el.paused) {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => { blocked = true; });
  }
}

/** Pause while the tab is hidden; resume when it returns. */
export function bindVisibility() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (!el) return;
    if (document.hidden) {
      if (!el.paused) el.pause();
    } else if (wantPlaying && channelLevel('music') > 0) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  });
}

export function isReady() { return ready; }

/** Test hook. */
export function __reset() {
  el = null; source = null; fadeGain = null;
  currentTrack = null; wantPlaying = false; ready = false; blocked = false;
}
