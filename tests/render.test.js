import { describe, it, assert } from './harness.js';
import * as render from '../src/ui/render.js';
import { createShip } from '../src/game/ship.js';
import { generateEnemy } from '../src/game/enemy.js';
import { RNG } from '../src/core/rng.js';
import '../src/ui/art-crew.js';
import '../src/ui/art-ships.js';

/** A stand-in for the backdrop canvas element. */
function fakeCanvas(w = 1280, h = 720) {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  el.getBoundingClientRect = () => ({ width: w, height: h, left: 0, top: 0 });
  return el;
}

function withViewport(w, h, fn) {
  const prevW = window.innerWidth, prevH = window.innerHeight;
  window.innerWidth = w; window.innerHeight = h;
  try { return fn(); } finally { window.innerWidth = prevW; window.innerHeight = prevH; }
}

describe('backdrop rendering', () => {
  it('draws without throwing at a normal size', () => {
    withViewport(1440, 900, () => {
      const cv = fakeCanvas(1440, 900);
      render.resizeBackdrop(cv);
      render.drawBackdrop(cv, 1.5, 'menu', null);
      render.drawBackdrop(cv, 2.5, 'combat', '#4fe3f5');
    });
  });

  it('survives booting into a zero-sized viewport', () => {
    // A background tab reports innerWidth/innerHeight of 0. Building the
    // nebula wash at that size produced a 0x0 canvas, and drawing from it threw
    // InvalidStateError on every subsequent frame — which killed the whole
    // animation loop and left the game frozen on a black screen.
    render.invalidateNebula();
    withViewport(0, 0, () => {
      const cv = fakeCanvas(0, 0);
      render.resizeBackdrop(cv);
      render.drawBackdrop(cv, 1, 'menu', null);
    });
  });

  it('recovers once the viewport gains a size', () => {
    render.invalidateNebula();
    const cv = fakeCanvas(0, 0);
    withViewport(0, 0, () => { render.resizeBackdrop(cv); render.drawBackdrop(cv, 1, 'menu', null); });

    // The starfield must regenerate for the real size rather than staying
    // stuck at the size it booted with.
    withViewport(1200, 800, () => {
      const big = fakeCanvas(1200, 800);
      render.drawBackdrop(big, 2, 'travel', null);
      const drew = big.getContext('2d')._calls.filter(c => c[0] === 'drawImage');
      assert.greater(drew.length, 0, 'the nebula should have been drawn');
      const stars = big.getContext('2d')._calls.filter(c => c[0] === 'fillRect');
      assert.greater(stars.length, 50, 'a full-size viewport should get a full starfield');
    });
  });

  it('regenerates the starfield when the window is resized', () => {
    const small = fakeCanvas(600, 400);
    const large = fakeCanvas(1600, 1000);
    const count = (cv) => cv.getContext('2d')._calls.filter(c => c[0] === 'fillRect').length;

    withViewport(600, 400, () => { render.resizeBackdrop(small); render.drawBackdrop(small, 1, 'menu', null); });
    withViewport(1600, 1000, () => { render.drawBackdrop(large, 1, 'menu', null); });

    assert.greater(count(large), count(small), 'a bigger window should hold more stars');
  });
});

describe('stage layout', () => {
  const rng = () => new RNG('RENDER');

  it('keeps both ships inside the stage during combat', () => {
    const player = createShip('kestrel', 'A', { rng: rng() });
    const enemy = generateEnemy(rng(), 3);
    for (const [w, h] of [[1440, 860], [1024, 700], [800, 560], [1920, 1080]]) {
      for (const interior of [true, false]) {
        const f = render.layoutFrames(player, enemy, w, h, interior);
        assert.ok(f.player.x >= 0, `player off the left edge at ${w}x${h}`);
        assert.lessOrEqual(f.enemy.x + f.enemy.w, w + 1, `enemy off the right edge at ${w}x${h}`);
        assert.ok(f.player.y >= 0, `player above the stage at ${w}x${h}`);
        assert.lessOrEqual(f.player.y + f.player.h, h + 1, `player below the stage at ${w}x${h}`);
        assert.ok(f.player.x + f.player.w <= f.enemy.x, 'the two ships must not overlap');
      }
    }
  });

  it('keeps the ship on screen at phone widths', () => {
    // The panels only float over the stage on wide screens. Reserving desktop
    // margins on a 375px stage pushed the whole ship off the right edge.
    const player = createShip('kestrel', 'A', { rng: rng() });
    for (const [w, h] of [[375, 700], [414, 800], [320, 600], [768, 900]]) {
      const f = render.layoutFrames(player, null, w, h, false);
      assert.ok(f.player.x >= 0, `ship starts off-screen at ${w}px`);
      assert.lessOrEqual(f.player.x + f.player.w, w + 1, `ship overflows the right edge at ${w}px`);
      assert.lessOrEqual(f.player.y + f.player.h, h + 1, `ship overflows the bottom at ${w}px`);
      // It should also still be big enough to actually play with.
      assert.greater(f.player.w, w * 0.5, `ship is uselessly small at ${w}px`);
    }
  });

  it('keeps both ships on screen at phone widths during combat', () => {
    const player = createShip('kestrel', 'A', { rng: rng() });
    const enemy = generateEnemy(rng(), 2);
    for (const [w, h] of [[375, 700], [414, 800]]) {
      const f = render.layoutFrames(player, enemy, w, h, false);
      assert.ok(f.player.x >= 0, `player off-screen at ${w}px`);
      assert.lessOrEqual(f.enemy.x + f.enemy.w, w + 1, `enemy overflows at ${w}px`);
    }
  });

  it('centres a single ship on the map screen', () => {
    const player = createShip('kestrel', 'A', { rng: rng() });
    const f = render.layoutFrames(player, null, 1440, 860, false);
    assert.equal(f.enemy, null);
    assert.greater(f.player.w, 200, 'the ship should fill a useful share of the stage');
    assert.lessOrEqual(f.player.w, 1440);
  });

  it('scales every hull to fit, including the widest', () => {
    for (const shipId of ['kestrel', 'torus', 'nomad', 'stealth']) {
      const player = createShip(shipId, 'A', { rng: rng() });
      const f = render.layoutFrames(player, null, 900, 600, false);
      assert.lessOrEqual(f.player.w, 900, `${shipId} too wide`);
      assert.lessOrEqual(f.player.h, 600, `${shipId} too tall`);
    }
  });
});

describe('sprite helpers', () => {
  it('renders a sprite into a standalone canvas', () => {
    const el = render.spriteEl('icon_scrap', 2);
    assert.equal(el.width, 24);
    assert.equal(el.height, 24);
  });

  it('returns a harmless canvas for an unknown sprite', () => {
    // A missing sprite must never break a list render.
    const el = render.spriteEl('no_such_sprite_at_all', 2);
    assert.equal(el.width, 1);
  });
});
