import { describe, it, assert } from './harness.js';
import * as pixel from '../src/ui/pixel.js';
import { CREW_ART } from '../src/ui/art-crew.js';
import { SHIP_ART } from '../src/ui/art-ships.js';
import { SHMUP_ART } from '../src/ui/art-shmup.js';
import { ENEMIES, ENEMY_IDS } from '../src/game/enemies.js';
import { WEAPONS, WEAPON_IDS } from '../src/game/weapons.js';
import { SHIPS, SHIP_IDS } from '../src/game/ships.js';
import { ENCOUNTER_TYPES } from '../src/game/encounters/index.js';
import { ATTRIBUTES } from '../src/game/attributes.js';
import { SLOTS } from '../src/game/items.js';
import { ACHIEVEMENTS } from '../src/game/achievements.js';
import { TERRAIN_STYLES } from '../src/game/terrain.js';

const BAGS = { 'art-crew': CREW_ART, 'art-ships': SHIP_ART, 'art-shmup': SHMUP_ART };

describe('sprite data', () => {
  it('registers a large library', () => {
    assert.greater(pixel.names().length, 200);
  });

  it('every sprite is rectangular with a complete palette', () => {
    for (const [file, bag] of Object.entries(BAGS)) {
      for (const [name, def] of Object.entries(bag)) {
        const w = def.rows[0].length;
        for (let y = 0; y < def.rows.length; y++) {
          assert.equal(def.rows[y].length, w, `${file}/${name} row ${y} is ragged`);
          for (const ch of def.rows[y]) {
            if (ch === '.' || ch === ' ') continue;
            assert.ok(def.pal[ch], `${file}/${name} uses "${ch}" with no palette entry`);
          }
        }
      }
    }
  });

  it('uses only valid hex colours', () => {
    for (const [file, bag] of Object.entries(BAGS)) {
      for (const [name, def] of Object.entries(bag)) {
        for (const [ch, colour] of Object.entries(def.pal)) {
          assert.ok(/^#[0-9a-fA-F]{6}$/.test(colour), `${file}/${name}.${ch} = "${colour}"`);
        }
      }
    }
  });

  it('has no accidentally empty sprites', () => {
    for (const [file, bag] of Object.entries(BAGS)) {
      for (const [name, def] of Object.entries(bag)) {
        const total = def.rows.length * def.rows[0].length;
        const filled = def.rows.join('').split('').filter(c => c !== '.' && c !== ' ').length;
        assert.greater(filled / total, 0.04, `${file}/${name} is ${Math.round(filled / total * 100)}% filled`);
      }
    }
  });

  it('sizes the sprite classes consistently', () => {
    const expect = (prefix, w, h) => {
      for (const name of pixel.names().filter(n => n.startsWith(prefix))) {
        const def = pixel.get(name);
        assert.equal(def.w, w, `${name} is ${def.w}px wide`);
        assert.equal(def.h, h, `${name} is ${def.h}px tall`);
      }
    };
    expect('ship_ext_', 64, 40);
    expect('sw_', 16, 16);
    expect('mid_', 32, 24);
    expect('node_', 14, 14);
    expect('ter_', 16, 16);
  });
});

describe('sprite references', () => {
  const present = (name) => !!pixel.get(name);

  it('every enemy archetype has its sprite', () => {
    for (const id of ENEMY_IDS) {
      assert.ok(present(ENEMIES[id].sprite), `${id} references missing sprite ${ENEMIES[id].sprite}`);
    }
  });

  it('every weapon has its projectile and icon', () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      assert.ok(present(w.sprite), `${id} references missing sprite ${w.sprite}`);
      if (w.icon) assert.ok(present(w.icon), `${id} references missing icon ${w.icon}`);
    }
  });

  it('every hull has its exterior', () => {
    for (const id of SHIP_IDS) {
      assert.ok(present(SHIPS[id].sprite), `${id} references missing sprite ${SHIPS[id].sprite}`);
    }
  });

  it('every encounter type has a map icon', () => {
    for (const [type, def] of Object.entries(ENCOUNTER_TYPES)) {
      assert.ok(present(def.icon), `type "${type}" references missing icon ${def.icon}`);
    }
  });

  it('every attribute, slot and achievement has an icon', () => {
    for (const a of ATTRIBUTES) assert.ok(present(a.icon), `attribute ${a.id}: ${a.icon}`);
    for (const s of SLOTS) assert.ok(present(s.icon), `slot ${s.id}: ${s.icon}`);
    for (const a of ACHIEVEMENTS) {
      if (a.icon) assert.ok(present(a.icon), `achievement ${a.id}: ${a.icon}`);
    }
  });

  it('every terrain style has its three tiles', () => {
    for (const [style, def] of Object.entries(TERRAIN_STYLES)) {
      for (const key of ['mid', 'top', 'bot']) {
        assert.ok(present(def[key]), `terrain ${style}.${key} references missing ${def[key]}`);
      }
    }
  });

  it('has the animation frames the renderer indexes by number', () => {
    for (const n of [0, 1, 2, 3, 4]) assert.ok(present(`fx_boom${n}`), `fx_boom${n}`);
    for (const n of [0, 1, 2]) assert.ok(present(`fx_hit${n}`), `fx_hit${n}`);
    for (const n of [0, 1, 2]) assert.ok(present(`fx_thrust${n}`), `fx_thrust${n}`);
    for (const n of [0, 1]) assert.ok(present(`fx_shield_hit${n}`), `fx_shield_hit${n}`);
    assert.ok(present('fx_warn') && present('fx_dash'), 'HUD effect sprites');
  });

  it('every pickup kind the sim drops has a sprite', () => {
    for (const kind of ['energy', 'repair', 'credits', 'shield', 'xp', 'crate', 'ammo']) {
      assert.ok(present(`pu_${kind}`), `pickup ${kind} has no sprite`);
    }
  });
});

describe('sprite rasterisation', () => {
  it('rasterises without throwing and caches by scale', () => {
    const names = pixel.names();
    for (const name of [names[0], names[Math.floor(names.length / 2)], names[names.length - 1]]) {
      const a = pixel.raster(name, 2);
      const b = pixel.raster(name, 2);
      assert.equal(a, b, 'the same name and scale should return the cached canvas');
      const def = pixel.get(name);
      assert.equal(a.width, def.w * 2);
      assert.equal(a.height, def.h * 2);
    }
  });

  it('throws loudly on an unknown sprite', () => {
    assert.throws(() => pixel.raster('no_such_sprite', 1));
    assert.throws(() => pixel.measure('no_such_sprite', 1));
  });

  it('rejects malformed art at registration', () => {
    assert.throws(() => pixel.normalize('ragged', { pal: { a: '#fff' }, rows: ['aa', 'a'] }));
    assert.throws(() => pixel.normalize('nopal', { pal: {}, rows: ['x'] }));
    assert.throws(() => pixel.normalize('empty', { pal: {}, rows: [] }));
  });
});
