/**
 * Deep Space — procedural sound effects.
 *
 * Every sound in the game is synthesised at runtime with Web Audio; there are
 * no sample files. Sounds are built from three primitives (`tone`, `noise`,
 * `chord`) plus a shared noise buffer, then registered in the SFX table below.
 *
 * All playback is fire-and-forget: nodes disconnect themselves when their
 * envelope finishes, so nothing accumulates.
 */
import { unlock, context, sfxNode, channelLevel } from './bus.js';

let noiseBuffer = null;
/** Voice budget — a chaotic fight can request dozens of sounds per frame. */
const MAX_VOICES = 24;
/**
 * End times (in AudioContext seconds) of the voices currently sounding.
 * Counting by scheduled end time rather than by `onended` callbacks matters:
 * background tabs throttle timers and some engines skip `onended` for very
 * short sources, and a leaked counter would silence the game permanently.
 */
let voiceEnds = [];
/** Per-sound throttle so a spammed effect doesn't turn into a buzzsaw. */
const lastPlayed = new Map();

function ensureNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 2);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  // Slightly brown-tinted noise reads as "impact" rather than "hiss".
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = w * 0.7 + last * 3;
  }
  return noiseBuffer;
}

/** Drop voices whose scheduled end has passed. Cheap; called before each play. */
function pruneVoices(ctx) {
  if (voiceEnds.length === 0) return 0;
  const now = ctx.currentTime;
  voiceEnds = voiceEnds.filter(end => end > now);
  return voiceEnds.length;
}

function trackVoice(node, stopTime, ctx) {
  voiceEnds.push(stopTime);
  const cleanup = () => {
    try { node.disconnect(); } catch { /* already torn down */ }
  };
  node.onended = cleanup;
  // Belt-and-braces: release the graph even if onended never fires.
  setTimeout(cleanup, Math.max(0, (stopTime - ctx.currentTime) * 1000) + 200);
}

/**
 * A pitched voice. Supports linear/exponential pitch sweeps, vibrato, an
 * optional filter, and an ADSR-ish envelope.
 */
function tone(o = {}) {
  const ctx = context();
  if (!ctx) return;
  const {
    freq = 440, type = 'sine', dur = 0.2, gain = 0.3,
    attack = 0.005, decay = null, sweepTo = null, sweepCurve = 'exp',
    detune = 0, delay = 0, filter = null, filterFreq = 1200, filterQ = 1,
    filterSweepTo = null, vibrato = 0, vibratoRate = 6, pan = 0,
  } = o;

  const t0 = ctx.currentTime + delay;
  const t1 = t0 + dur;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (sweepTo != null) {
    const target = Math.max(1, sweepTo);
    if (sweepCurve === 'exp') osc.frequency.exponentialRampToValueAtTime(target, t1);
    else osc.frequency.linearRampToValueAtTime(target, t1);
  }

  if (vibrato > 0) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = vibratoRate;
    lfoGain.gain.value = vibrato;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0); lfo.stop(t1);
  }

  const env = ctx.createGain();
  const peak = Math.max(0.0001, gain);
  const holdEnd = decay == null ? t1 : Math.min(t1, t0 + attack + decay);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + Math.max(0.001, attack));
  env.gain.exponentialRampToValueAtTime(0.0001, holdEnd);

  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(filterFreq, t0);
    f.Q.value = filterQ;
    if (filterSweepTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(1, filterSweepTo), t1);
    node = node.connect(f);
  }
  node = node.connect(env);
  node = applyPan(ctx, node, pan);
  node.connect(sfxNode());

  osc.start(t0);
  osc.stop(t1 + 0.02);
  trackVoice(osc, t1, ctx);
}

/** A noise voice — the backbone of explosions, fire, breaches and thrusters. */
function noise(o = {}) {
  const ctx = context();
  if (!ctx) return;
  const {
    dur = 0.3, gain = 0.3, attack = 0.004, delay = 0,
    filter = 'bandpass', filterFreq = 1000, filterQ = 1,
    filterSweepTo = null, playbackRate = 1, pan = 0, curve = 'exp',
  } = o;

  const t0 = ctx.currentTime + delay;
  const t1 = t0 + dur;
  const src = ctx.createBufferSource();
  src.buffer = ensureNoise(ctx);
  src.playbackRate.value = playbackRate;
  src.loop = true;

  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(Math.max(1, filterFreq), t0);
  f.Q.value = filterQ;
  if (filterSweepTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(1, filterSweepTo), t1);

  const env = ctx.createGain();
  const peak = Math.max(0.0001, gain);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + Math.max(0.001, attack));
  if (curve === 'linear') env.gain.linearRampToValueAtTime(0.0001, t1);
  else env.gain.exponentialRampToValueAtTime(0.0001, t1);

  let node = src.connect(f).connect(env);
  node = applyPan(ctx, node, pan);
  node.connect(sfxNode());

  src.start(t0, Math.random() * 1.5);
  src.stop(t1 + 0.02);
  trackVoice(src, t1, ctx);
}

function applyPan(ctx, node, pan) {
  if (!pan || !ctx.createStereoPanner) return node;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  return node.connect(p);
}

/** Stack of tones — used for stingers and UI chords. */
function chord(freqs, o = {}) {
  freqs.forEach((f, i) => tone({ ...o, freq: f, delay: (o.delay || 0) + i * (o.stagger || 0) }));
}

// ---------------------------------------------------------------------------
// The sound library. Each entry receives the options object passed to play().
// ---------------------------------------------------------------------------

export const SFX = {
  // --- UI -----------------------------------------------------------------
  click: () => tone({ freq: 660, type: 'square', dur: 0.05, gain: 0.14, sweepTo: 880, filter: 'lowpass', filterFreq: 2600 }),
  hover: () => tone({ freq: 440, type: 'sine', dur: 0.035, gain: 0.05, sweepTo: 520 }),
  confirm: () => chord([523, 784], { type: 'triangle', dur: 0.16, gain: 0.16, stagger: 0.045 }),
  cancel: () => tone({ freq: 320, type: 'square', dur: 0.11, gain: 0.13, sweepTo: 180, filter: 'lowpass', filterFreq: 1800 }),
  error: () => { tone({ freq: 180, type: 'sawtooth', dur: 0.16, gain: 0.16, filter: 'lowpass', filterFreq: 900 }); tone({ freq: 174, type: 'square', dur: 0.16, gain: 0.1, delay: 0.05 }); },
  tab: () => tone({ freq: 520, type: 'triangle', dur: 0.06, gain: 0.1, sweepTo: 620 }),
  toggle: () => tone({ freq: 700, type: 'square', dur: 0.045, gain: 0.1, sweepTo: 500 }),

  // --- Meta / progression -------------------------------------------------
  achievement: () => chord([659, 880, 1319], { type: 'triangle', dur: 0.6, gain: 0.17, stagger: 0.09, attack: 0.01 }),
  unlock: () => { chord([392, 523, 659, 784], { type: 'triangle', dur: 0.8, gain: 0.15, stagger: 0.1 }); noise({ dur: 0.9, gain: 0.05, filter: 'highpass', filterFreq: 3000 }); },
  purchase: () => { tone({ freq: 880, type: 'square', dur: 0.07, gain: 0.13 }); tone({ freq: 1320, type: 'square', dur: 0.1, gain: 0.11, delay: 0.06 }); },
  upgrade: () => { tone({ freq: 440, type: 'sawtooth', dur: 0.22, gain: 0.14, sweepTo: 1100, filter: 'lowpass', filterFreq: 1400, filterSweepTo: 4200 }); tone({ freq: 1320, type: 'sine', dur: 0.15, gain: 0.1, delay: 0.15 }); },
  levelup: () => chord([523, 659, 880], { type: 'sine', dur: 0.35, gain: 0.12, stagger: 0.06 }),

  // --- Weapons ------------------------------------------------------------
  laser_light: () => tone({ freq: 1400, type: 'sawtooth', dur: 0.13, gain: 0.2, sweepTo: 260, filter: 'lowpass', filterFreq: 3200, filterSweepTo: 700 }),
  laser_heavy: () => { tone({ freq: 700, type: 'sawtooth', dur: 0.26, gain: 0.26, sweepTo: 90, filter: 'lowpass', filterFreq: 2200, filterSweepTo: 320 }); noise({ dur: 0.16, gain: 0.1, filterFreq: 900, filterSweepTo: 200 }); },
  ion: () => { tone({ freq: 300, type: 'square', dur: 0.3, gain: 0.16, sweepTo: 1500, vibrato: 60, vibratoRate: 28, filter: 'bandpass', filterFreq: 1400, filterQ: 6 }); noise({ dur: 0.28, gain: 0.07, filter: 'bandpass', filterFreq: 3000, filterQ: 8 }); },
  beam: () => { tone({ freq: 180, type: 'sawtooth', dur: 0.9, gain: 0.13, vibrato: 9, vibratoRate: 22, filter: 'bandpass', filterFreq: 800, filterQ: 4 }); tone({ freq: 361, type: 'sine', dur: 0.9, gain: 0.09 }); },
  missile_launch: () => { noise({ dur: 0.5, gain: 0.2, filter: 'lowpass', filterFreq: 500, filterSweepTo: 2600 }); tone({ freq: 120, type: 'sawtooth', dur: 0.45, gain: 0.13, sweepTo: 420 }); },
  flak: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.09, gain: 0.13, delay: i * 0.035, filterFreq: 1400 + Math.random() * 1600, filterQ: 2 }); },
  plasma: () => { tone({ freq: 90, type: 'sawtooth', dur: 0.34, gain: 0.22, sweepTo: 620, filter: 'lowpass', filterFreq: 800, filterSweepTo: 2400 }); tone({ freq: 45, type: 'square', dur: 0.34, gain: 0.14, sweepTo: 300 }); },
  charge_up: (o = {}) => tone({ freq: 200, type: 'triangle', dur: o.dur || 0.7, gain: 0.09, sweepTo: 1500, filter: 'bandpass', filterFreq: 700, filterQ: 3 }),
  weapon_ready: () => tone({ freq: 1100, type: 'sine', dur: 0.09, gain: 0.11, sweepTo: 1500 }),

  // --- Impacts ------------------------------------------------------------
  shield_hit: () => { tone({ freq: 900, type: 'sine', dur: 0.22, gain: 0.17, sweepTo: 1700, vibrato: 40, vibratoRate: 30 }); noise({ dur: 0.16, gain: 0.09, filter: 'highpass', filterFreq: 2400 }); },
  shield_down: () => { tone({ freq: 700, type: 'sine', dur: 0.45, gain: 0.18, sweepTo: 120 }); noise({ dur: 0.4, gain: 0.11, filter: 'lowpass', filterFreq: 2000, filterSweepTo: 250 }); },
  shield_up: () => tone({ freq: 300, type: 'sine', dur: 0.3, gain: 0.13, sweepTo: 900, vibrato: 15, vibratoRate: 12 }),
  hull_hit: () => { noise({ dur: 0.34, gain: 0.3, filter: 'lowpass', filterFreq: 1400, filterSweepTo: 160 }); tone({ freq: 80, type: 'square', dur: 0.3, gain: 0.22, sweepTo: 34 }); },
  system_damage: () => { tone({ freq: 420, type: 'sawtooth', dur: 0.24, gain: 0.16, sweepTo: 70, filter: 'lowpass', filterFreq: 1200 }); noise({ dur: 0.2, gain: 0.12, filterFreq: 2200, filterQ: 3 }); },
  miss: () => noise({ dur: 0.22, gain: 0.07, filter: 'bandpass', filterFreq: 2600, filterSweepTo: 900, filterQ: 2 }),
  explosion_small: () => { noise({ dur: 0.5, gain: 0.3, filter: 'lowpass', filterFreq: 2200, filterSweepTo: 120 }); tone({ freq: 110, type: 'square', dur: 0.42, gain: 0.2, sweepTo: 28 }); },
  explosion_large: () => { noise({ dur: 1.3, gain: 0.42, filter: 'lowpass', filterFreq: 2800, filterSweepTo: 60 }); tone({ freq: 90, type: 'square', dur: 1.1, gain: 0.3, sweepTo: 20 }); tone({ freq: 46, type: 'sine', dur: 1.4, gain: 0.26, sweepTo: 16 }); },
  ship_destroyed: () => { SFX.explosion_large(); noise({ dur: 2.2, gain: 0.2, delay: 0.25, filter: 'lowpass', filterFreq: 1400, filterSweepTo: 40 }); tone({ freq: 200, type: 'sawtooth', dur: 1.8, gain: 0.12, delay: 0.1, sweepTo: 18 }); },

  // --- Ship systems -------------------------------------------------------
  power_up: () => tone({ freq: 220, type: 'triangle', dur: 0.14, gain: 0.13, sweepTo: 560 }),
  power_down: () => tone({ freq: 560, type: 'triangle', dur: 0.14, gain: 0.12, sweepTo: 200 }),
  power_fail: () => { tone({ freq: 240, type: 'sawtooth', dur: 0.3, gain: 0.15, sweepTo: 60 }); noise({ dur: 0.24, gain: 0.08, filterFreq: 700 }); },
  jump_charge: () => tone({ freq: 60, type: 'sawtooth', dur: 2.4, gain: 0.12, sweepTo: 700, filter: 'lowpass', filterFreq: 300, filterSweepTo: 3000, vibrato: 6, vibratoRate: 4 }),
  jump: () => { tone({ freq: 900, type: 'sine', dur: 1.1, gain: 0.24, sweepTo: 40 }); noise({ dur: 1.2, gain: 0.22, filter: 'lowpass', filterFreq: 5000, filterSweepTo: 80 }); tone({ freq: 1800, type: 'triangle', dur: 0.5, gain: 0.12, sweepTo: 200 }); },
  alarm: () => { tone({ freq: 720, type: 'square', dur: 0.28, gain: 0.14, sweepTo: 500 }); tone({ freq: 720, type: 'square', dur: 0.28, gain: 0.14, delay: 0.34, sweepTo: 500 }); },
  low_hull: () => tone({ freq: 300, type: 'sawtooth', dur: 0.5, gain: 0.16, vibrato: 30, vibratoRate: 7, filter: 'lowpass', filterFreq: 1100 }),
  oxygen_low: () => tone({ freq: 420, type: 'sine', dur: 0.9, gain: 0.1, vibrato: 22, vibratoRate: 3.5 }),
  fire_start: () => { noise({ dur: 0.7, gain: 0.2, filter: 'bandpass', filterFreq: 700, filterSweepTo: 2100, filterQ: 1.2 }); tone({ freq: 140, type: 'sawtooth', dur: 0.5, gain: 0.09, sweepTo: 300 }); },
  fire_burn: () => noise({ dur: 0.55, gain: 0.06, filter: 'bandpass', filterFreq: 1100, filterQ: 0.8, playbackRate: 0.8 }),
  breach: () => { noise({ dur: 1.4, gain: 0.22, filter: 'highpass', filterFreq: 500, filterSweepTo: 3400 }); tone({ freq: 300, type: 'sine', dur: 0.7, gain: 0.09, sweepTo: 1400 }); },
  repair: () => { for (let i = 0; i < 3; i++) tone({ freq: 620 + i * 120, type: 'square', dur: 0.06, gain: 0.09, delay: i * 0.1 }); },
  repair_done: () => chord([660, 990], { type: 'sine', dur: 0.18, gain: 0.12, stagger: 0.05 }),
  door: () => { noise({ dur: 0.16, gain: 0.11, filter: 'bandpass', filterFreq: 1600, filterSweepTo: 500, filterQ: 3 }); tone({ freq: 200, type: 'square', dur: 0.1, gain: 0.07 }); },
  vent: () => noise({ dur: 0.9, gain: 0.13, filter: 'highpass', filterFreq: 900, filterSweepTo: 2600 }),

  // --- Special systems ----------------------------------------------------
  teleport_out: () => { tone({ freq: 1200, type: 'sine', dur: 0.5, gain: 0.16, sweepTo: 120, vibrato: 50, vibratoRate: 18 }); noise({ dur: 0.4, gain: 0.08, filter: 'bandpass', filterFreq: 2400, filterQ: 5 }); },
  teleport_in: () => { tone({ freq: 120, type: 'sine', dur: 0.5, gain: 0.16, sweepTo: 1200, vibrato: 50, vibratoRate: 18 }); noise({ dur: 0.4, gain: 0.08, filter: 'bandpass', filterFreq: 1200, filterSweepTo: 3200, filterQ: 5 }); },
  drone_launch: () => { tone({ freq: 300, type: 'square', dur: 0.3, gain: 0.13, sweepTo: 900, vibrato: 25, vibratoRate: 24 }); noise({ dur: 0.22, gain: 0.08, filterFreq: 1800 }); },
  drone_destroyed: () => { tone({ freq: 800, type: 'square', dur: 0.3, gain: 0.14, sweepTo: 90 }); noise({ dur: 0.3, gain: 0.14, filter: 'lowpass', filterFreq: 1600, filterSweepTo: 200 }); },
  cloak_on: () => { tone({ freq: 800, type: 'sine', dur: 0.9, gain: 0.15, sweepTo: 60, vibrato: 20, vibratoRate: 8 }); noise({ dur: 0.9, gain: 0.07, filter: 'lowpass', filterFreq: 3000, filterSweepTo: 200 }); },
  cloak_off: () => tone({ freq: 60, type: 'sine', dur: 0.6, gain: 0.14, sweepTo: 800, vibrato: 20, vibratoRate: 8 }),
  hack: () => { for (let i = 0; i < 6; i++) tone({ freq: 400 + Math.random() * 1400, type: 'square', dur: 0.05, gain: 0.09, delay: i * 0.055 }); },
  hack_land: () => tone({ freq: 1400, type: 'square', dur: 0.24, gain: 0.14, sweepTo: 220, filter: 'bandpass', filterFreq: 1800, filterQ: 4 }),
  mindcontrol: () => { tone({ freq: 220, type: 'sine', dur: 1.0, gain: 0.13, sweepTo: 660, vibrato: 45, vibratoRate: 5 }); tone({ freq: 331, type: 'triangle', dur: 1.0, gain: 0.08, vibrato: 30, vibratoRate: 7 }); },
  overdrive: () => { tone({ freq: 140, type: 'sawtooth', dur: 0.8, gain: 0.18, sweepTo: 1400, filter: 'lowpass', filterFreq: 600, filterSweepTo: 5000 }); noise({ dur: 0.7, gain: 0.1, filter: 'bandpass', filterFreq: 2200, filterQ: 2 }); },
  siphon: () => { tone({ freq: 1500, type: 'triangle', dur: 0.6, gain: 0.14, sweepTo: 200, vibrato: 30, vibratoRate: 14 }); noise({ dur: 0.5, gain: 0.07, filter: 'bandpass', filterFreq: 2600, filterSweepTo: 600, filterQ: 4 }); },
  temporal: () => { tone({ freq: 500, type: 'sine', dur: 1.2, gain: 0.12, sweepTo: 180, vibrato: 12, vibratoRate: 2.2 }); tone({ freq: 750, type: 'sine', dur: 1.2, gain: 0.07, sweepTo: 260, delay: 0.1 }); },
  nanoforge: () => { for (let i = 0; i < 4; i++) tone({ freq: 900 + i * 200, type: 'triangle', dur: 0.08, gain: 0.07, delay: i * 0.07 }); },

  // --- Crew ---------------------------------------------------------------
  crew_select: () => tone({ freq: 780, type: 'triangle', dur: 0.06, gain: 0.09, sweepTo: 900 }),
  crew_move: () => tone({ freq: 500, type: 'sine', dur: 0.07, gain: 0.07, sweepTo: 640 }),
  crew_hurt: () => tone({ freq: 420, type: 'sawtooth', dur: 0.16, gain: 0.13, sweepTo: 190, filter: 'lowpass', filterFreq: 1500 }),
  crew_die: () => { tone({ freq: 380, type: 'sawtooth', dur: 0.7, gain: 0.17, sweepTo: 50, filter: 'lowpass', filterFreq: 1200, filterSweepTo: 200 }); noise({ dur: 0.5, gain: 0.08, filterFreq: 800 }); },
  crew_fight: () => { noise({ dur: 0.12, gain: 0.15, filter: 'bandpass', filterFreq: 2000, filterQ: 2 }); tone({ freq: 260, type: 'square', dur: 0.1, gain: 0.1, sweepTo: 140 }); },
  crew_heal: () => chord([660, 880], { type: 'sine', dur: 0.24, gain: 0.09, stagger: 0.07 }),
  zoltan_burst: () => { tone({ freq: 1600, type: 'sine', dur: 0.5, gain: 0.2, sweepTo: 200 }); noise({ dur: 0.5, gain: 0.14, filter: 'bandpass', filterFreq: 3000, filterSweepTo: 400, filterQ: 3 }); },

  // --- Map / navigation ---------------------------------------------------
  beacon_move: () => tone({ freq: 600, type: 'sine', dur: 0.12, gain: 0.1, sweepTo: 900 }),
  beacon_select: () => tone({ freq: 900, type: 'triangle', dur: 0.08, gain: 0.1, sweepTo: 1200 }),
  sector_enter: () => { chord([220, 330, 440], { type: 'sine', dur: 1.4, gain: 0.12, stagger: 0.16 }); noise({ dur: 1.6, gain: 0.05, filter: 'lowpass', filterFreq: 800 }); },
  fleet_advance: () => { tone({ freq: 90, type: 'sawtooth', dur: 1.0, gain: 0.16, sweepTo: 55, vibrato: 5, vibratoRate: 3 }); noise({ dur: 1.0, gain: 0.09, filter: 'lowpass', filterFreq: 400 }); },
  store_enter: () => chord([523, 659, 784], { type: 'triangle', dur: 0.3, gain: 0.11, stagger: 0.07 }),
  event_choice: () => tone({ freq: 700, type: 'triangle', dur: 0.1, gain: 0.1, sweepTo: 500 }),
  distress: () => { tone({ freq: 880, type: 'sine', dur: 0.2, gain: 0.11 }); tone({ freq: 880, type: 'sine', dur: 0.2, gain: 0.11, delay: 0.3 }); tone({ freq: 660, type: 'sine', dur: 0.3, gain: 0.09, delay: 0.6 }); },
  asteroid_hit: () => { noise({ dur: 0.3, gain: 0.22, filter: 'lowpass', filterFreq: 900, filterSweepTo: 120 }); tone({ freq: 70, type: 'square', dur: 0.24, gain: 0.15, sweepTo: 30 }); },
  solar_flare: () => { noise({ dur: 1.6, gain: 0.14, filter: 'bandpass', filterFreq: 500, filterSweepTo: 3200, filterQ: 1 }); tone({ freq: 100, type: 'sawtooth', dur: 1.4, gain: 0.1, sweepTo: 800 }); },

  // --- Run outcomes -------------------------------------------------------
  victory: () => { chord([392, 523, 659, 784, 1047], { type: 'triangle', dur: 1.6, gain: 0.16, stagger: 0.13 }); noise({ dur: 1.8, gain: 0.05, filter: 'highpass', filterFreq: 2600 }); },
  defeat: () => { chord([220, 208, 165], { type: 'sawtooth', dur: 2.0, gain: 0.15, stagger: 0.3, filter: 'lowpass', filterFreq: 900 }); tone({ freq: 55, type: 'sine', dur: 2.6, gain: 0.18, sweepTo: 28 }); },
};

/**
 * Play a named sound. Unknown names are ignored rather than thrown, so a typo
 * in a rarely-hit branch can never crash a run.
 */
export function play(name, opts = {}) {
  const fn = SFX[name];
  if (!fn) return false;
  if (channelLevel('sfx') <= 0) return false;

  if (!context()) unlock();
  const ctx = context();
  if (!ctx) return false;
  if (pruneVoices(ctx) >= MAX_VOICES) return false;

  const throttle = opts.throttle ?? 0;
  if (throttle > 0) {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (t - (lastPlayed.get(name) || -Infinity) < throttle) return false;
    lastPlayed.set(name, t);
  }

  try {
    fn(opts);
    return true;
  } catch {
    return false; // never let audio take down a frame
  }
}

/** Names of every registered sound — used by the tests and the sound gallery. */
export function soundNames() { return Object.keys(SFX); }

export function voiceCount() {
  const ctx = context();
  return ctx ? pruneVoices(ctx) : 0;
}

/** Test hook: forget every in-flight voice. */
export function __clearVoices() { voiceEnds = []; lastPlayed.clear(); }

export const _internals = { tone, noise, chord };
