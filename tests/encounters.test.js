import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';
import {
  ALL_ENCOUNTERS, ENCOUNTERS_BY_ID, ENCOUNTER_TYPES, validateAll,
  candidatesFor, pickEncounter, coverage, getEncounter,
} from '../src/game/encounters/index.js';
import { MASTER_FLEET_STAGES } from '../src/game/run.js';
import { Corridor } from '../src/game/terrain.js';
import { SLOT_IDS } from '../src/game/items.js';
import { ENEMIES } from '../src/game/enemies.js';
import { ATTRIBUTE_IDS } from '../src/game/attributes.js';

const EFFECT_KEYS = new Set([
  'credits', 'xp', 'hull', 'hullPct', 'crates', 'item',
  'attributePoint', 'combat', 'reveal', 'heal',
]);

describe('encounter content', () => {
  it('passes the schema validator', () => {
    const r = validateAll();
    assert.deepEqual(r.errors.slice(0, 12), [], 'validation errors');
    assert.equal(r.ok, true);
  });

  it('has a substantial library', () => {
    assert.greater(ALL_ENCOUNTERS.length, 100);
  });

  it('has unique ids', () => {
    const ids = ALL_ENCOUNTERS.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('offers choice at every threat level', () => {
    for (const row of coverage()) {
      assert.greater(row.total, 3, `threat ${row.threat} has only ${row.total} encounters`);
    }
  });

  it('offers action encounters at every threat level', () => {
    for (let t = 1; t <= 20; t++) {
      const action = candidatesFor(t).filter(e => ENCOUNTER_TYPES[e.type]?.action);
      assert.greater(action.length, 2, `threat ${t} has too few playable encounters`);
    }
  });

  it('gives every enemy archetype somewhere to appear', () => {
    // An archetype no encounter references is dead content: it exists, it is
    // balanced, it is tested, and no player will ever see it.
    const used = new Set();
    for (const e of ALL_ENCOUNTERS) {
      for (const w of e.waves || []) {
        for (const g of w.spawn || []) {
          if (g.id) used.add(g.id);
          for (const id of g.ids || []) used.add(id);
          for (const id of g.pool || []) used.add(id);
        }
      }
    }
    // Enemies only ever summoned by another enemy count as reachable too.
    for (const id of Object.keys(ENEMIES)) {
      const def = ENEMIES[id];
      if (def.spawns?.id) used.add(def.spawns.id);
      if (def.splits?.into) used.add(def.splits.into);
    }
    const orphans = Object.keys(ENEMIES).filter(id => !used.has(id));
    assert.deepEqual(orphans, [], 'enemies that can never spawn');
  });

  it('covers every declared type with content', () => {
    for (const [type, def] of Object.entries(ENCOUNTER_TYPES)) {
      const n = ALL_ENCOUNTERS.filter(e => e.type === type).length;
      assert.greater(n, 0, `type "${type}" has no encounters`);
    }
  });

  it('keeps the Master Fleet out of the random pool', () => {
    for (const id of MASTER_FLEET_STAGES) {
      const enc = getEncounter(id);
      assert.ok(enc, `${id} is missing — the run's finale summons it directly`);
      assert.equal(enc.excludeFromPool, true, `${id} must never appear as a random node`);
    }
    for (let t = 1; t <= 20; t++) {
      assert.notOk(candidatesFor(t).some(e => e.type === 'masterfleet'),
        `a masterfleet stage leaked into the threat ${t} pool`);
    }
  });

  it('avoids repeating the same encounter back to back', () => {
    const rng = new RNG('PICK');
    const recent = [];
    for (let i = 0; i < 200; i++) {
      const e = pickEncounter(rng, 8, null, recent);
      assert.notOk(recent.includes(e.id), `${e.id} repeated inside the avoid window`);
      recent.push(e.id);
      if (recent.length > 6) recent.shift();
    }
  });

  it('always returns something, even for an unsupported type', () => {
    const rng = new RNG('FALLBACK');
    assert.ok(pickEncounter(rng, 1, 'no_such_type'));
    assert.ok(pickEncounter(rng, 99, 'hostiles'));
  });
});

describe('encounter tunnels', () => {
  it('generates a flyable corridor for every tunnel, across seeds', () => {
    const tunnels = ALL_ENCOUNTERS.filter(e => e.terrain);
    assert.greater(tunnels.length, 3, 'expected several terrain encounters');
    for (const enc of tunnels) {
      let tightest = Infinity;
      for (let seed = 0; seed < 8; seed++) {
        const t = enc.terrain;
        const c = new Corridor(new RNG(`${enc.id}${seed}`), 540, t.length ?? 12000, t);
        for (const col of c.columns) {
          tightest = Math.min(tightest, col.floor - col.ceil);
          assert.ok(col.ceil >= 0 && col.floor <= 540, `${enc.id} escaped the field`);
        }
      }
      assert.greater(tightest, 105, `${enc.id} pinches to ${tightest.toFixed(0)}px`);
    }
  });
});

describe('anomaly content', () => {
  const anomalies = ALL_ENCOUNTERS.filter(e => e.type === 'anomaly');

  it('has a body of text encounters', () => {
    assert.greater(anomalies.length, 20);
  });

  it('gives every anomaly text and workable choices', () => {
    for (const a of anomalies) {
      assert.ok(a.text, `${a.id} has no text`);
      assert.between(a.choices?.length ?? 0, 2, 4, `${a.id} has a bad choice count`);
      for (const c of a.choices) {
        assert.ok(c.text, `${a.id} has a choice with no text`);
        assert.greater(c.outcomes?.length ?? 0, 0, `${a.id}: "${c.text}" has no outcomes`);
        for (const o of c.outcomes) assert.ok(o.text, `${a.id}: an outcome has no text`);
      }
    }
  });

  it('always leaves at least one ungated choice', () => {
    // Every gate failing would leave the player staring at a dead modal.
    for (const a of anomalies) {
      assert.ok(a.choices.some(c => !c.requires), `${a.id} gates every choice`);
    }
  });

  it('only gates on things that exist', () => {
    for (const a of anomalies) {
      for (const c of a.choices) {
        if (!c.requires) continue;
        for (const key of Object.keys(c.requires)) {
          assert.includes(['attr', 'credits', 'level', 'slotItem'], key, `${a.id}: unknown gate "${key}"`);
        }
        for (const attr of Object.keys(c.requires.attr || {})) {
          assert.includes(ATTRIBUTE_IDS, attr, `${a.id}: gates on unknown attribute "${attr}"`);
        }
        if (c.requires.slotItem) {
          assert.includes(SLOT_IDS, c.requires.slotItem, `${a.id}: gates on unknown slot`);
        }
      }
    }
  });

  it('only uses effect keys the run actually applies', () => {
    // A typo'd effect key silently does nothing, which reads as a bug to the
    // player and is invisible to everyone else.
    for (const a of anomalies) {
      for (const c of a.choices) {
        for (const o of c.outcomes) {
          for (const key of Object.keys(o.effects || {})) {
            assert.ok(EFFECT_KEYS.has(key), `${a.id}: unknown effect "${key}"`);
          }
        }
      }
    }
  });

  it('never points a choice at an encounter that does not exist', () => {
    for (const a of anomalies) {
      for (const c of a.choices) {
        for (const o of c.outcomes) {
          const target = o.effects?.combat;
          if (!target) continue;
          assert.ok(ENCOUNTERS_BY_ID[target], `${a.id} launches missing encounter "${target}"`);
        }
      }
    }
  });

  it('grants attribute points only very rarely', () => {
    const granting = anomalies.filter(a =>
      a.choices.some(c => c.outcomes.some(o => o.effects?.attributePoint)));
    assert.lessOrEqual(granting.length, 3, 'attribute points should stay precious');
  });
});

describe('boss content', () => {
  const bosses = ALL_ENCOUNTERS.filter(e => e.type === 'boss');

  it('has bosses spread across the threat range', () => {
    assert.greater(bosses.length, 8);
    assert.greater(bosses.filter(b => (b.minThreat ?? 1) < 8).length, 2, 'no early bosses');
    assert.greater(bosses.filter(b => (b.maxThreat ?? 99) >= 15).length, 2, 'no late bosses');
  });

  it('gives every boss a tagged capital ship and more than one beat', () => {
    for (const b of bosses) {
      const tagged = b.waves.some(w => w.spawn.some(g => g.tag === 'boss'));
      assert.ok(tagged, `${b.id} has no group tagged "boss"`);
      assert.greater(b.waves.length, 1, `${b.id} is a single wave, not a fight with phases`);
    }
  });

  it('pays out more than a routine encounter', () => {
    for (const b of bosses) {
      const r = b.rewards || {};
      assert.ok((r.xpMult ?? 1) > 1 || (r.creditsMult ?? 1) > 1 || (r.crates ?? 0) > 0,
        `${b.id} pays no premium for being a boss`);
    }
  });
});
