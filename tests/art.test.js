import { describe, it, assert } from './harness.js';
import * as pixel from '../src/ui/pixel.js';
import { CREW_ART } from '../src/ui/art-crew.js';
import { SHIP_ART } from '../src/ui/art-ships.js';
import { RACE_IDS } from '../src/game/crew.js';
import { ALL_SYSTEM_IDS, SYSTEMS } from '../src/game/systems.js';
import { SHIP_IDS, SHIPS } from '../src/game/ships.js';
import { ENEMY_CLASSES } from '../src/game/enemy.js';
import { BEACON_TYPES } from '../src/game/sector.js';

/** Fraction of a sprite's pixels that aren't transparent. */
function fill(name) {
  const d = pixel.get(name);
  let n = 0;
  for (const row of d.rows) for (const ch of row) if (ch !== '.' && ch !== ' ') n++;
  return n / (d.w * d.h);
}

function shades(name) {
  const d = pixel.get(name);
  const used = new Set();
  for (const row of d.rows) for (const ch of row) if (ch !== '.' && ch !== ' ') used.add(ch);
  return used.size;
}

describe('pixel engine', () => {
  it('validates row lengths', () => {
    assert.throws(() => pixel.normalize('t', { pal: { a: '#fff' }, rows: ['aa', 'a'] }));
  });

  it('validates palette coverage', () => {
    assert.throws(() => pixel.normalize('t', { pal: {}, rows: ['a'] }));
  });

  it('accepts well-formed art and derives its size', () => {
    const d = pixel.normalize('t', { pal: { a: '#fff' }, rows: ['.a.', 'aaa'] });
    assert.equal(d.w, 3);
    assert.equal(d.h, 2);
  });

  it('measures a registered sprite at scale', () => {
    const m = pixel.measure('ship_ext_kestrel', 3);
    assert.equal(m.w, 192);
    assert.equal(m.h, 120);
  });
});

describe('art coverage', () => {
  it('registers a large sprite library', () => {
    assert.greater(pixel.names().length, 130);
  });

  it('has four animation frames and a death pose for every race', () => {
    for (const race of RACE_IDS) {
      for (const frame of ['idle0', 'idle1', 'walk0', 'walk1', 'dead']) {
        const name = `crew_${race}_${frame}`;
        assert.ok(pixel.get(name), `missing sprite ${name}`);
        assert.deepEqual(
          [pixel.get(name).w, pixel.get(name).h], [12, 12],
          `${name} should be 12x12`,
        );
      }
    }
  });

  it('has an icon for every system', () => {
    for (const id of ALL_SYSTEM_IDS) {
      const name = SYSTEMS[id].icon;
      assert.ok(pixel.get(name), `system ${id} references missing icon ${name}`);
    }
  });

  it('has an icon for every beacon type', () => {
    for (const b of Object.values(BEACON_TYPES)) {
      assert.ok(pixel.get(b.icon), `beacon ${b.id} references missing icon ${b.icon}`);
    }
  });

  it('has an exterior for every player hull', () => {
    for (const id of SHIP_IDS) {
      const name = SHIPS[id].sprite;
      assert.ok(pixel.get(name), `ship ${id} references missing sprite ${name}`);
      const d = pixel.get(name);
      assert.deepEqual([d.w, d.h], [64, 40], `${name} should be 64x40`);
    }
  });

  it('has an exterior for every enemy class, plus the flagship', () => {
    for (const cls of Object.values(ENEMY_CLASSES)) {
      assert.ok(pixel.get(cls.sprite), `enemy ${cls.id} references missing sprite ${cls.sprite}`);
    }
    assert.ok(pixel.get('enemy_boss'));
  });

  it('has the full explosion and impact animations', () => {
    for (let i = 0; i < 5; i++) assert.ok(pixel.get(`fx_boom${i}`), `missing fx_boom${i}`);
    for (let i = 0; i < 3; i++) assert.ok(pixel.get(`fx_hit${i}`), `missing fx_hit${i}`);
    for (let i = 0; i < 3; i++) assert.ok(pixel.get(`fx_teleport${i}`), `missing fx_teleport${i}`);
  });
});

describe('art quality', () => {
  it('draws real art, not flat blobs', () => {
    // Every ship should use several shades; a 2-colour hull reads as a
    // placeholder rather than a shaded model.
    const flat = SHIP_IDS
      .map(id => SHIPS[id].sprite)
      .filter(name => shades(name) < 4);
    assert.deepEqual(flat, [], 'every hull needs at least 4 shades');
  });

  it('leaves no sprite accidentally empty', () => {
    const empty = pixel.names().filter(n => fill(n) < 0.05);
    assert.deepEqual(empty, [], 'these sprites are almost entirely transparent');
  });

  it('fills icons enough to read at small sizes', () => {
    const thin = pixel.names()
      .filter(n => n.startsWith('icon_'))
      .filter(n => fill(n) < 0.2);
    assert.deepEqual(thin, [], 'these icons are too sparse to read');
  });

  it('gives each ship a distinct silhouette', () => {
    // Compare transparency masks: two hulls sharing an outline would be a
    // copy-paste, not a design.
    const mask = name => pixel.get(name).rows.map(r => r.replace(/[^.]/g, '#')).join('\n');
    const seen = new Map();
    for (const id of SHIP_IDS) {
      const m = mask(SHIPS[id].sprite);
      assert.notOk(seen.has(m), `${id} shares a silhouette with ${seen.get(m)}`);
      seen.set(m, id);
    }
  });

  it('progresses the explosion frames rather than repeating one', () => {
    const fills = [0, 1, 2, 3, 4].map(i => fill(`fx_boom${i}`));
    assert.greater(Math.max(...fills), Math.min(...fills) * 1.5,
      'explosion frames should visibly change');
    assert.greater(fills[2], fills[0], 'the blast should grow before it fades');
  });

  it('uses only valid hex colours', () => {
    for (const name of pixel.names()) {
      for (const [ch, hex] of Object.entries(pixel.get(name).pal)) {
        assert.ok(/^#[0-9a-fA-F]{6}$/.test(hex), `${name} palette "${ch}" is not a hex colour: ${hex}`);
      }
    }
  });

  it('exports what it registers', () => {
    for (const name of Object.keys(CREW_ART)) assert.ok(pixel.get(name), `${name} exported but not registered`);
    for (const name of Object.keys(SHIP_ART)) assert.ok(pixel.get(name), `${name} exported but not registered`);
  });
});
