/**
 * Minimal test harness for Deep Space.
 *
 * No dependencies: the game is vanilla JS and the tests run on bare `node`,
 * which keeps CI to a single step. Provides a describe/it runner, assertions,
 * and fakes for the browser APIs the game touches (localStorage, Web Audio,
 * canvas, and a sliver of DOM).
 */

const suites = [];
let current = null;

export function describe(name, fn) {
  const suite = { name, tests: [], before: null, after: null };
  suites.push(suite);
  const prev = current;
  current = suite;
  fn();
  current = prev;
}

export function it(name, fn) {
  if (!current) throw new Error(`it("${name}") called outside describe()`);
  current.tests.push({ name, fn });
}

export function beforeEach(fn) { if (current) current.before = fn; }
export function afterEach(fn) { if (current) current.after = fn; }

// --- assertions ------------------------------------------------------------

export class AssertionError extends Error {}

function fail(msg) { throw new AssertionError(msg); }

export const assert = {
  ok(v, msg = 'expected value to be truthy') { if (!v) fail(`${msg} (got ${fmt(v)})`); },
  notOk(v, msg = 'expected value to be falsy') { if (v) fail(`${msg} (got ${fmt(v)})`); },
  equal(a, b, msg = 'values differ') {
    if (!Object.is(a, b)) fail(`${msg}: expected ${fmt(b)}, got ${fmt(a)}`);
  },
  notEqual(a, b, msg = 'values should differ') {
    if (Object.is(a, b)) fail(`${msg}: both were ${fmt(a)}`);
  },
  deepEqual(a, b, msg = 'structures differ') {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) fail(`${msg}:\n  expected ${sb}\n  got      ${sa}`);
  },
  close(a, b, tol = 1e-6, msg = 'numbers differ') {
    if (Math.abs(a - b) > tol) fail(`${msg}: expected ${b} +/- ${tol}, got ${a}`);
  },
  between(v, lo, hi, msg = 'out of range') {
    if (!(v >= lo && v <= hi)) fail(`${msg}: expected ${lo}..${hi}, got ${fmt(v)}`);
  },
  includes(arr, v, msg = 'missing element') {
    if (!arr.includes(v)) fail(`${msg}: ${fmt(v)} not in ${fmt(arr)}`);
  },
  throws(fn, msg = 'expected a throw') {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) fail(msg);
  },
  greater(a, b, msg = 'expected greater') {
    if (!(a > b)) fail(`${msg}: ${fmt(a)} is not > ${fmt(b)}`);
  },
  lessOrEqual(a, b, msg = 'expected <=') {
    if (!(a <= b)) fail(`${msg}: ${fmt(a)} is not <= ${fmt(b)}`);
  },
};

function fmt(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'object' && v !== null) {
    try { const s = JSON.stringify(v); return s.length > 200 ? s.slice(0, 200) + '...' : s; }
    catch { return String(v); }
  }
  return String(v);
}

// --- browser fakes ---------------------------------------------------------

export function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: k => { store.delete(String(k)); },
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
    _store: store,
  };
  return globalThis.localStorage;
}

/** A Web Audio stand-in that records every node and scheduled parameter. */
export function installAudioContext() {
  const log = { nodes: [], started: 0, stopped: 0, params: [] };

  const param = (name) => ({
    value: 0,
    setValueAtTime(v, t) { log.params.push([name, 'set', v, t]); return this; },
    linearRampToValueAtTime(v, t) { log.params.push([name, 'lin', v, t]); return this; },
    exponentialRampToValueAtTime(v, t) {
      if (v === 0) throw new Error('exponential ramp to zero is invalid');
      log.params.push([name, 'exp', v, t]);
      return this;
    },
    setTargetAtTime(v, t, c) { log.params.push([name, 'target', v, t, c]); return this; },
    cancelScheduledValues() { return this; },
  });

  const node = (type, extra = {}) => {
    const n = {
      type: extra.type ?? '',
      _kind: type,
      connect(dest) { log.nodes.push([type, dest && dest._kind]); return dest; },
      disconnect() {},
      start(t) { log.started++; },
      stop(t) { log.stopped++; },
      ...extra,
    };
    log.nodes.push([type, null]);
    return n;
  };

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 48000;
      this.currentTime = 0;
      this.destination = { _kind: 'destination', connect() {}, disconnect() {} };
      this._log = log;
    }
    createGain() { return node('gain', { gain: param('gain') }); }
    createOscillator() {
      return node('osc', { frequency: param('freq'), detune: param('detune') });
    }
    createBiquadFilter() {
      return node('filter', { frequency: param('filterFreq'), Q: param('Q') });
    }
    createBufferSource() {
      return node('buffersrc', { buffer: null, loop: false, playbackRate: param('rate') });
    }
    createStereoPanner() { return node('panner', { pan: param('pan') }); }
    createDynamicsCompressor() {
      return node('comp', {
        threshold: param('thr'), knee: param('knee'), ratio: param('ratio'),
        attack: param('atk'), release: param('rel'),
      });
    }
    createMediaElementSource() { return node('mediasrc'); }
    createBuffer(ch, len) {
      const data = new Float32Array(len);
      return { sampleRate: this.sampleRate, length: len, getChannelData: () => data };
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    /** Test-only: move the audio clock forward so scheduled voices expire. */
    advance(seconds) { this.currentTime += seconds; return this.currentTime; }
  }

  globalThis.AudioContext = FakeAudioContext;
  return { FakeAudioContext, log };
}

/** Just enough DOM for modules that create elements at import time. */
export function installDOM() {
  const makeEl = (tag) => ({
    tagName: String(tag).toUpperCase(),
    style: {}, children: [], dataset: {}, classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on ?? !this._s.has(c) ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; },
    play() { return Promise.resolve(); }, pause() {}, load() {},
    paused: true, volume: 1, currentTime: 0, loop: false,
    width: 0, height: 0,
    getContext: () => makeCtx2D(),
  });

  globalThis.document = {
    hidden: false,
    body: makeEl('body'),
    createElement: makeEl,
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; },
  };
  globalThis.window = globalThis;
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  return globalThis.document;
}

function makeCtx2D() {
  const calls = [];
  const rec = name => (...args) => { calls.push([name, ...args]); };
  return {
    _calls: calls,
    canvas: { width: 1280, height: 720 },
    save: rec('save'), restore: rec('restore'), translate: rec('translate'),
    rotate: rec('rotate'), scale: rec('scale'), beginPath: rec('beginPath'),
    closePath: rec('closePath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    arc: rec('arc'), ellipse: rec('ellipse'), rect: rec('rect'),
    fill: rec('fill'), stroke: rec('stroke'), fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'), clearRect: rec('clearRect'),
    fillText: rec('fillText'), strokeText: rec('strokeText'),
    drawImage: rec('drawImage'), clip: rec('clip'), setLineDash: rec('setLineDash'),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 6 }),
    imageSmoothingEnabled: true, globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    shadowBlur: 0, shadowColor: '',
  };
}

/** Canvas for the pixel engine's offscreen rasterisation. */
export function installCanvas() {
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return makeCtx2D(); }
  };
}

export function installAll() {
  installLocalStorage();
  installAudioContext();
  installDOM();
  installCanvas();
}

// --- runner ----------------------------------------------------------------

export async function run({ filter = null, quiet = false } = {}) {
  let passed = 0, failed = 0, skipped = 0;
  const failures = [];
  const t0 = Date.now();

  for (const suite of suites) {
    const tests = filter
      ? suite.tests.filter(t => `${suite.name} ${t.name}`.toLowerCase().includes(filter.toLowerCase()))
      : suite.tests;
    if (tests.length === 0) { skipped += suite.tests.length; continue; }
    if (!quiet) console.log(`\n  ${suite.name}`);
    for (const test of tests) {
      try {
        if (suite.before) await suite.before();
        await test.fn();
        if (suite.after) await suite.after();
        passed++;
        if (!quiet) console.log(`    \x1b[32mPASS\x1b[0m ${test.name}`);
      } catch (err) {
        failed++;
        failures.push({ suite: suite.name, test: test.name, err });
        if (!quiet) console.log(`    \x1b[31mFAIL\x1b[0m ${test.name}`);
        if (!quiet) console.log(`         ${String(err.message).split('\n').join('\n         ')}`);
        if (!quiet && !(err instanceof AssertionError) && err.stack) {
          console.log(`         ${err.stack.split('\n').slice(1, 4).join('\n         ')}`);
        }
      }
    }
  }

  const ms = Date.now() - t0;
  console.log(`\n${'-'.repeat(60)}`);
  const tag = failed === 0 ? '\x1b[32mALL PASSING\x1b[0m' : `\x1b[31m${failed} FAILING\x1b[0m`;
  console.log(`${tag}  ${passed} passed, ${failed} failed${skipped ? `, ${skipped} filtered out` : ''}  (${ms}ms)`);
  return { passed, failed, skipped, failures };
}

export function reset() { suites.length = 0; current = null; }
