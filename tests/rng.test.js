import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';

describe('RNG', () => {
  it('is deterministic for a given seed', () => {
    const a = new RNG('SEED-A'), b = new RNG('SEED-A');
    for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  });

  it('produces different streams for different seeds', () => {
    const a = new RNG('SEED-A'), b = new RNG('SEED-B');
    let same = 0;
    for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++;
    assert.lessOrEqual(same, 1);
  });

  it('stays inside [0,1)', () => {
    const r = new RNG(42);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
    }
  });

  it('int() is inclusive on both ends and never escapes', () => {
    const r = new RNG(7);
    const seen = new Set();
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 6);
      assert.between(v, 3, 6);
      assert.equal(v, Math.floor(v), 'must be an integer');
      seen.add(v);
    }
    assert.equal(seen.size, 4, 'all four values should appear');
  });

  it('int() with one argument spans 0..n', () => {
    const r = new RNG(11);
    for (let i = 0; i < 500; i++) assert.between(r.int(4), 0, 4);
  });

  it('distributes weighted picks proportionally', () => {
    const r = new RNG(99);
    const counts = { a: 0, b: 0, c: 0 };
    const items = [{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }, { id: 'c', weight: 7 }];
    for (let i = 0; i < 20000; i++) counts[r.weighted(items).id]++;
    assert.between(counts.a / 20000, 0.07, 0.13);
    assert.between(counts.b / 20000, 0.17, 0.23);
    assert.between(counts.c / 20000, 0.65, 0.75);
  });

  it('never picks a zero-weight item', () => {
    const r = new RNG(5);
    const items = [{ id: 'yes', weight: 1 }, { id: 'no', weight: 0 }];
    for (let i = 0; i < 2000; i++) assert.equal(r.weighted(items).id, 'yes');
  });

  it('sample() returns distinct elements and caps at pool size', () => {
    const r = new RNG(3);
    const pool = [1, 2, 3, 4, 5];
    const s = r.sample(pool, 3);
    assert.equal(s.length, 3);
    assert.equal(new Set(s).size, 3);
    assert.equal(r.sample(pool, 99).length, 5, 'cannot draw more than the pool holds');
  });

  it('shuffle() keeps every element exactly once and does not mutate', () => {
    const r = new RNG(8);
    const pool = Array.from({ length: 30 }, (_, i) => i);
    const sh = r.shuffle(pool);
    assert.equal(sh.length, 30);
    assert.deepEqual([...sh].sort((a, b) => a - b), pool);
    assert.deepEqual(pool, Array.from({ length: 30 }, (_, i) => i), 'input must not be mutated');
  });

  it('round-trips through serialize/deserialize', () => {
    const a = new RNG('ROUNDTRIP');
    for (let i = 0; i < 25; i++) a.next();
    const b = RNG.deserialize(JSON.parse(JSON.stringify(a.serialize())));
    for (let i = 0; i < 25; i++) assert.equal(a.next(), b.next());
  });

  it('fork() yields an independent stream that does not disturb the parent', () => {
    const a = new RNG('FORK');
    const snapshot = a.serialize();
    a.fork('sector');
    assert.deepEqual(a.serialize(), snapshot, 'forking must not advance the parent');
    const f1 = new RNG('FORK').fork('x');
    const f2 = new RNG('FORK').fork('x');
    assert.equal(f1.next(), f2.next(), 'same salt should reproduce');
    const f3 = new RNG('FORK').fork('y');
    assert.notEqual(f1.next(), f3.next());
  });

  it('gaussian() respects its clamps', () => {
    const r = new RNG(21);
    for (let i = 0; i < 2000; i++) assert.between(r.gaussian(10, 20, 0, 15), 0, 15);
  });

  it('handles empty inputs gracefully', () => {
    const r = new RNG(1);
    assert.equal(r.pick([]), undefined);
    assert.deepEqual(r.sample([], 3), []);
  });

  it('generates readable seed names', () => {
    const s = RNG.friendlySeed();
    assert.ok(/^[A-Z]+-\d{4}$/.test(s), `unexpected seed format: ${s}`);
  });
});
