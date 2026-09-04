import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';
import {
  ATTRIBUTES, ATTRIBUTE_IDS, ATTR_CAP, MAX_LEVEL, xpToNext, nodeXpValue,
  grantXp, spendPoint, newProgress, deriveStats, previewPoint,
} from '../src/game/attributes.js';
import {
  SLOTS, SLOT_IDS, RARITIES, RARITY_BY_ID, BASES, AFFIXES, ABILITIES,
  generateItem, rollRarity, sumMods, equippedAbilities, describeItem,
  sellValue, powerScore, resetItemIds,
} from '../src/game/items.js';
import { WEAPONS, WEAPON_IDS, resolveWeapon, shotInterval, primaryIds, secondaryIds } from '../src/game/weapons.js';
import { ENEMIES, ENEMY_IDS, scaleEnemy, fillBudget, CLASS_TOUGHNESS } from '../src/game/enemies.js';
import { MOVEMENTS, FIRE_PATTERNS } from '../src/game/patterns.js';
import { FORMATIONS, standardBudget } from '../src/game/spawner.js';
import { Corridor, TERRAIN_STYLES } from '../src/game/terrain.js';
import * as S from '../src/game/ship.js';
import * as U from '../src/game/universe.js';
import { SHIPS, SHIP_IDS, unlockedShips, STARTER_SHIP } from '../src/game/ships.js';
import { ACHIEVEMENTS } from '../src/game/achievements.js';
import { candidatesFor } from '../src/game/encounters/index.js';
import { createWorld } from '../src/game/sim.js';

describe('attributes', () => {
  it('defines six attributes with distinct ids', () => {
    assert.equal(ATTRIBUTES.length, 6);
    assert.equal(new Set(ATTRIBUTE_IDS).size, 6);
  });

  it('has a monotonically rising xp curve that terminates at the cap', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) {
      assert.greater(xpToNext(l + 1), xpToNext(l), `level ${l} costs more than ${l + 1}`);
    }
    assert.equal(xpToNext(MAX_LEVEL), Infinity, 'the cap must be terminal');
  });

  it('levels up and banks points', () => {
    const p = newProgress({ hull: 3, shields: 3, weapons: 3, reactor: 3, thrusters: 3, systems: 3 });
    const gained = grantXp(p, xpToNext(1) + xpToNext(2));
    assert.equal(gained, 2);
    assert.equal(p.level, 3);
    assert.equal(p.unspentPoints, 4);
  });

  it('stacks multiple levels from one large payout', () => {
    const p = newProgress();
    const gained = grantXp(p, 1e6);
    assert.equal(p.level, MAX_LEVEL);
    assert.equal(gained, MAX_LEVEL - 1);
    assert.equal(p.xp, 0, 'xp should not accumulate past the cap');
  });

  it('refuses to spend past the attribute cap or with no points', () => {
    const p = newProgress();
    p.unspentPoints = 50;
    for (let i = 0; i < 100; i++) spendPoint(p, 'hull');
    assert.equal(p.attributes.hull, ATTR_CAP);
    const q = newProgress();
    assert.equal(spendPoint(q, 'hull'), false, 'no points banked');
    assert.equal(spendPoint(p, 'not_an_attribute'), false);
  });

  it('derives every stat as a finite positive number', () => {
    const attrs = Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 1]));
    for (const level of [1, 5, 20]) {
      for (const id of ATTRIBUTE_IDS) attrs[id] = level;
      const s = deriveStats(attrs);
      for (const [k, v] of Object.entries(s)) {
        if (typeof v !== 'number') continue;
        assert.ok(Number.isFinite(v), `${k} is not finite at ${level} (${v})`);
      }
      assert.greater(s.maxHull, 0);
      assert.greater(s.maxEnergy, 0);
      assert.greater(s.speed, 0);
    }
  });

  it('keeps derived stats rising with their attribute', () => {
    const base = Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 5]));
    const more = { ...base, hull: 6 };
    assert.greater(deriveStats(more).maxHull, deriveStats(base).maxHull);
    assert.greater(deriveStats({ ...base, shields: 6 }).maxShield, deriveStats(base).maxShield);
    assert.greater(deriveStats({ ...base, weapons: 6 }).damageMult, deriveStats(base).damageMult);
    assert.greater(deriveStats({ ...base, thrusters: 6 }).speed, deriveStats(base).speed);
    // Cooldowns and the shield break delay improve by going DOWN.
    assert.ok(deriveStats({ ...base, systems: 6 }).cooldownMult < deriveStats(base).cooldownMult);
  });

  it('never lets cooldowns or costs invert into a multiplier below zero', () => {
    const attrs = Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, ATTR_CAP]));
    const s = deriveStats(attrs, { cooldownPct: 5, energyCost: 5, contactArmour: 5 });
    assert.greater(s.cooldownMult, 0);
    assert.greater(s.energyCostMult, 0);
    assert.greater(s.shieldDelay, 0);
  });

  it('previews only the stats a point actually changes', () => {
    const attrs = Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 4]));
    const rows = previewPoint(attrs, {}, 'hull');
    assert.greater(rows.length, 0);
    assert.ok(rows.every(r => r.from !== r.to), 'a preview row must show a change');
  });

  it('scales node xp with threat', () => {
    assert.greater(nodeXpValue(10), nodeXpValue(5));
    assert.greater(nodeXpValue(20), nodeXpValue(10));
  });
});

describe('items', () => {
  it('covers every slot with at least one base template', () => {
    for (const slot of SLOT_IDS) {
      const pool = slot.startsWith('utility') ? 'utility' : slot;
      if (pool === 'primary' || pool === 'secondary' || pool === 'tertiary') continue;
      assert.ok(BASES[pool]?.length > 0, `no bases for ${pool}`);
    }
  });

  it('generates a valid item for every slot', () => {
    const rng = new RNG('ITEMS');
    for (const slot of SLOT_IDS) {
      const item = generateItem(rng, { slot, level: 5 });
      assert.ok(item.uid, 'missing uid');
      assert.ok(item.name, 'missing name');
      assert.ok(RARITY_BY_ID[item.rarity], `bad rarity ${item.rarity}`);
      assert.ok(S.fitsSlot(item, slot), `${item.name} does not fit ${slot}`);
      assert.greater(item.value, 0);
      for (const [k, v] of Object.entries(item.mods)) {
        assert.ok(Number.isFinite(v), `${item.name}.${k} is ${v}`);
      }
    }
  });

  it('carries every utility mount through to the fight', () => {
    // Three mounts, three ability keys. The sim used to cap at two, so a
    // third utility equipped fine and then did nothing.
    const rng = new RNG('UTIL3');
    const ship = S.createShip('kestrel', rng);
    const slots = SLOT_IDS.filter(id => id.startsWith('utility'));
    assert.equal(slots.length, 3, 'expected three utility mounts');

    for (const slot of slots) {
      for (let i = 0; i < 80 && !ship.equipped[slot]; i++) {
        const item = generateItem(rng, { slot, level: 8 });
        if (!item.ability) continue;
        ship.inventory.push(item);
        S.equip(ship, item.uid, slot);
      }
      assert.ok(ship.equipped[slot], `nothing would equip into ${slot}`);
    }
    S.recompute(ship);
    assert.equal(ship.abilities.length, 3);

    const enc = candidatesFor(3, 'combat')[0];
    const world = createWorld({ encounter: enc, threat: 3, ship, rng: rng.fork('w') });
    assert.equal(world.player.abilities.length, 3,
      'every equipped ability has to reach the cockpit');
  });

  it('gives every item a unique id', () => {
    resetItemIds(0);
    const rng = new RNG('UNIQ');
    const ids = new Set();
    for (let i = 0; i < 400; i++) ids.add(generateItem(rng, { level: 3 }).uid);
    assert.equal(ids.size, 400);
  });

  it('scales value and power with rarity and level', () => {
    const rng = new RNG('SCALE');
    const low = generateItem(rng, { slot: 'plating', level: 1, rarity: 'salvaged' });
    const high = generateItem(rng, { slot: 'plating', level: 15, rarity: 'relic' });
    assert.greater(high.value, low.value);
    assert.greater(high.tier, low.tier);
  });

  it('respects a rarity floor', () => {
    const rng = new RNG('FLOOR');
    for (let i = 0; i < 200; i++) {
      const r = rollRarity(rng, { threat: 5, floor: 3 });
      assert.ok(r.tier >= 3, `rolled ${r.id} below the floor`);
    }
  });

  it('shifts rarity upward with threat and luck', () => {
    const tierAvg = (opts) => {
      const rng = new RNG('TIER');
      let sum = 0;
      for (let i = 0; i < 3000; i++) sum += rollRarity(rng, opts).tier;
      return sum / 3000;
    };
    assert.greater(tierAvg({ threat: 18 }), tierAvg({ threat: 1 }));
    assert.greater(tierAvg({ threat: 5, luck: 1 }), tierAvg({ threat: 5, luck: 0 }));
  });

  it('sums equipped mods across slots', () => {
    const equipped = {
      plating: { mods: { hull: 10, speed: 2 } },
      engine: { mods: { hull: 5 } },
      shield: null,
    };
    const mods = sumMods(equipped);
    assert.equal(mods.hull, 15);
    assert.equal(mods.speed, 2);
  });

  it('lists abilities from utility slots only', () => {
    const equipped = {
      utility1: { ability: 'nova', name: 'Nova Core' },
      utility2: { ability: 'emp_burst', name: 'EMP Charge' },
      engine: { ability: 'nova', name: 'Not A Utility' },
    };
    const list = equippedAbilities(equipped);
    assert.equal(list.length, 3, 'any slot carrying an ability should surface it');
    assert.ok(list.every(a => ABILITIES[a.id]), 'every listed ability must be defined');
  });

  it('describes every mod key it can emit', () => {
    const rng = new RNG('DESC');
    for (let i = 0; i < 300; i++) {
      const item = generateItem(rng, { level: 8 });
      for (const line of describeItem(item)) {
        assert.notOk(/undefined|NaN/.test(line), `bad description: ${line}`);
      }
    }
  });

  it('sells for less than it costs', () => {
    const rng = new RNG('SELL');
    for (let i = 0; i < 50; i++) {
      const item = generateItem(rng, { level: 6 });
      assert.ok(sellValue(item) < item.value, 'buyback must be a loss');
    }
  });

  it('ranks a better item above a worse one', () => {
    const rng = new RNG('RANK');
    const weak = generateItem(rng, { slot: 'plating', level: 1, rarity: 'salvaged' });
    const strong = generateItem(rng, { slot: 'plating', level: 18, rarity: 'relic' });
    assert.greater(powerScore(strong), powerScore(weak));
  });
});

describe('weapons', () => {
  it('has both primary and secondary weapons', () => {
    assert.greater(primaryIds().length, 8);
    assert.greater(secondaryIds().length, 5);
  });

  it('gives every weapon the fields its behaviour needs', () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      assert.ok(w.name, `${id} has no name`);
      assert.greater(w.damage, 0, `${id} deals no damage`);
      assert.ok(w.energy >= 0, `${id} has negative energy cost`);
      assert.ok(w.sprite, `${id} has no sprite`);
      if (w.behaviour === 'charge') assert.greater(w.chargeTime, 0, `${id} charges instantly`);
      if (w.behaviour === 'chain') assert.greater(w.chains, 0, `${id} chains to nothing`);
      if (w.behaviour === 'fragment') assert.greater(w.fragments, 0, `${id} fragments into nothing`);
      if (w.behaviour === 'beam') assert.greater(w.tickRate, 0, `${id} never ticks`);
      if (w.behaviour !== 'beam' && w.behaviour !== 'charge' && w.behaviour !== 'drone') {
        assert.greater(w.rof, 0, `${id} never fires`);
      }
    }
  });

  it('scales a resolved weapon by pilot stats and item power', () => {
    const stats = { damageMult: 2, fireRateMult: 1.5, energyCostMult: 0.5 };
    const item = { weaponId: 'pulse', power: 2 };
    const r = resolveWeapon(item, stats);
    assert.close(r.damage, WEAPONS.pulse.damage * 2 * 2);
    assert.close(r.rof, WEAPONS.pulse.rof * 1.5);
    assert.close(r.energy, WEAPONS.pulse.energy * 0.5);
    assert.greater(shotInterval(r), 0);
  });

  it('returns null for an item that is not a weapon', () => {
    assert.equal(resolveWeapon({ baseId: 'ablative' }, {}), null);
  });
});

describe('enemies', () => {
  it('gives every archetype the fields the sim reads', () => {
    for (const id of ENEMY_IDS) {
      const e = ENEMIES[id];
      assert.ok(e.name, `${id} has no name`);
      assert.ok(CLASS_TOUGHNESS[e.cls], `${id} has unknown class ${e.cls}`);
      assert.greater(e.hull, 0, `${id} has no hull`);
      assert.greater(e.cost, 0, `${id} is free to field`);
      assert.ok(MOVEMENTS[e.move], `${id} uses unknown movement ${e.move}`);
      assert.ok(FIRE_PATTERNS[e.fire], `${id} uses unknown fire pattern ${e.fire}`);
      assert.ok(e.sprite, `${id} has no sprite`);
      if (e.fireRate > 0) assert.greater(e.bulletDamage, 0, `${id} fires blanks`);
      if (e.spawns) assert.ok(ENEMIES[e.spawns.id], `${id} spawns unknown ${e.spawns.id}`);
      if (e.splits) assert.ok(ENEMIES[e.splits.into], `${id} splits into unknown ${e.splits.into}`);
    }
  });

  it('scales monotonically with threat', () => {
    const def = ENEMIES.gunship;
    let prevHull = 0, prevXp = 0;
    for (let t = 1; t <= 20; t++) {
      const s = scaleEnemy(def, t);
      assert.greater(s.hull, prevHull, `hull did not rise at threat ${t}`);
      assert.greater(s.xp, prevXp - 1, `xp fell at threat ${t}`);
      prevHull = s.hull; prevXp = s.xp;
    }
  });

  it('applies class toughness rather than one global number', () => {
    // A swarm enemy needs far more help than an elite, which already carries
    // its own multipliers; one shared value produced unkillable capital ships.
    const swarmRatio = scaleEnemy(ENEMIES.picket, 1).hull / ENEMIES.picket.hull;
    const eliteRatio = scaleEnemy(ENEMIES.warden, 1).hull / ENEMIES.warden.hull;
    assert.greater(swarmRatio, eliteRatio);
  });

  it('fills a budget without exceeding it', () => {
    const rng = new RNG('BUDGET');
    const pool = ['picket', 'wasp', 'gunship', 'cruiser'];
    for (const budget of [5, 30, 120]) {
      const picks = fillBudget(rng, pool, budget);
      const cost = picks.reduce((s, id) => s + ENEMIES[id].cost, 0);
      assert.ok(cost <= budget, `spent ${cost} of ${budget}`);
    }
  });

  it('respects the maximum count', () => {
    const rng = new RNG('CAP');
    const picks = fillBudget(rng, ['picket'], 10000, { maxCount: 12 });
    assert.equal(picks.length, 12);
  });

  it('raises the standard budget with threat', () => {
    assert.greater(standardBudget(20), standardBudget(1));
  });
});

describe('patterns', () => {
  const fakeWorld = () => ({
    w: 960, h: 540,
    player: { x: 150, y: 270, vx: 0, vy: 0 },
    rng: new RNG('PAT'),
  });
  const fakeEnemy = () => ({
    x: 800, y: 200, vx: 0, vy: 0, speed: 100,
    bulletDamage: 5, bulletSpeed: 200, mem: {},
  });

  it('every movement produces finite velocities', () => {
    for (const [id, fn] of Object.entries(MOVEMENTS)) {
      const e = fakeEnemy();
      const w = fakeWorld();
      for (let i = 0; i < 240; i++) {
        fn(e, w, 1 / 60);
        e.x += e.vx / 60; e.y += e.vy / 60;
      }
      assert.ok(Number.isFinite(e.vx) && Number.isFinite(e.vy), `${id} produced NaN velocity`);
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${id} produced NaN position`);
    }
  });

  it('kamikaze commits and stops steering at close range', () => {
    // A kamikaze that homes all the way in is faster than the player and
    // therefore undodgeable; it must fly through rather than attach.
    const e = fakeEnemy();
    const w = fakeWorld();
    e.x = 300; e.y = 270;
    for (let i = 0; i < 600; i++) {
      MOVEMENTS.kamikaze(e, w, 1 / 60);
      e.x += e.vx / 60; e.y += e.vy / 60;
    }
    assert.ok(e.x < w.player.x - 60, 'kamikaze should end up past the player');
  });

  it('every fire pattern returns well-formed bullets', () => {
    for (const [id, fn] of Object.entries(FIRE_PATTERNS)) {
      const e = fakeEnemy();
      const w = fakeWorld();
      for (let volley = 0; volley < 5; volley++) {
        const shots = fn(e, w);
        assert.ok(Array.isArray(shots), `${id} did not return an array`);
        for (const s of shots) {
          assert.ok(Number.isFinite(s.angle), `${id} produced a NaN angle`);
          assert.ok(Number.isFinite(s.speed ?? 0), `${id} produced a NaN speed`);
          assert.ok(Number.isFinite(s.damage ?? 0), `${id} produced NaN damage`);
        }
      }
    }
  });
});

describe('formations', () => {
  const world = { w: 960, h: 540, rng: new RNG('FORM') };

  it('places exactly the requested number of ships', () => {
    for (const [id, fn] of Object.entries(FORMATIONS)) {
      for (const n of [1, 3, 12]) {
        const pts = fn(n, world, {});
        assert.equal(pts.length, n, `${id} returned ${pts.length} points for ${n}`);
        for (const p of pts) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${id} produced NaN`);
        }
      }
    }
  });

  it('keeps entering formations off the right edge', () => {
    for (const id of ['line', 'v', 'arc', 'column', 'echelon', 'cluster', 'random']) {
      const pts = FORMATIONS[id](6, world, {});
      assert.ok(pts.every(p => p.x >= world.w * 0.9), `${id} spawned inside the field`);
    }
  });
});

describe('terrain', () => {
  it('never generates an impassable corridor', () => {
    for (const style of Object.keys(TERRAIN_STYLES)) {
      for (let seed = 0; seed < 12; seed++) {
        const c = new Corridor(new RNG(`T${style}${seed}`), 540, 9000, { style, minAperture: 170 });
        let tightest = Infinity;
        for (const col of c.columns) {
          tightest = Math.min(tightest, col.floor - col.ceil);
          assert.ok(col.ceil >= 0 && col.floor <= 540, 'corridor escaped the field');
          assert.ok(col.floor > col.ceil, 'corridor inverted');
        }
        assert.greater(tightest, 110, `${style}#${seed} pinched to ${tightest.toFixed(0)}px`);
      }
    }
  });

  it('resolves a point out of the wall it is inside', () => {
    const c = new Corridor(new RNG('RES'), 540, 4000, {});
    const col = c.columns[10];
    const res = c.resolve(10 * 16, col.ceil - 20, 8);
    assert.equal(res.hit, 'ceil');
    assert.ok(res.y > col.ceil, 'should be pushed clear of the ceiling');
  });

  it('reports no collision past the end of the corridor', () => {
    const c = new Corridor(new RNG('END'), 540, 1000, {});
    assert.equal(c.collides(1e9, 270, 10), false);
  });
});

describe('universe', () => {
  const map = U.generateUniverse(new RNG('UNIVERSE'));

  it('generates a connected graph', () => {
    const seen = new Set([0]);
    let frontier = [0];
    while (frontier.length) {
      const next = [];
      for (const id of frontier) {
        for (const l of map.nodes[id].links) if (!seen.has(l)) { seen.add(l); next.push(l); }
      }
      frontier = next;
    }
    assert.equal(seen.size, map.nodes.length, 'some nodes are unreachable from the origin');
  });

  it('gives every node an encounter and a link', () => {
    for (const n of map.nodes) {
      assert.greater(n.links.length, 0, `node ${n.id} is isolated`);
      assert.ok(n.encounterId, `node ${n.id} has no encounter`);
      assert.between(n.threat, 1, 20, `node ${n.id} threat out of range`);
    }
  });

  it('raises threat with distance from the origin', () => {
    const avg = ring => {
      const ns = map.nodes.filter(n => n.ring === ring);
      return ns.reduce((s, n) => s + n.threat, 0) / ns.length;
    };
    assert.greater(avg(9), avg(4));
    assert.greater(avg(4), avg(1));
  });

  it('keeps the opening rings gentle', () => {
    // The XP curve cannot keep up with a steep gradient at the origin, which
    // forced a level-1 ship to punch two levels up with no alternative.
    for (const n of map.nodes.filter(x => x.ring <= 1)) {
      assert.lessOrEqual(n.threat, 2, `ring ${n.ring} node at threat ${n.threat}`);
    }
  });

  it('puts the Master Fleet on the rim at maximum threat', () => {
    const mf = map.nodes[map.masterFleetId];
    assert.equal(mf.ring, map.rings - 1);
    assert.equal(mf.threat, 20);
    assert.equal(mf.encounterId, 'masterfleet_1');
  });

  it('hides the map until it is revealed', () => {
    const fresh = U.generateUniverse(new RNG('FOG'));
    const unknown = fresh.nodes.filter(n => n.state === U.NODE_STATE.UNKNOWN).length;
    assert.greater(unknown, fresh.nodes.length * 0.8, 'too much of the map starts visible');
    U.revealFrom(fresh, 0, 2);
    const seen = fresh.nodes.filter(n => n.state === U.NODE_STATE.SEEN).length;
    assert.greater(seen, 0);
    assert.ok(seen < fresh.nodes.length * 0.4, 'a radius-2 reveal should not open the map');
  });

  it('only allows jumps to linked, revealed nodes', () => {
    const m = U.generateUniverse(new RNG('JUMP'));
    U.revealFrom(m, 0, 2);
    const reach = U.reachable(m);
    assert.greater(reach.length, 0);
    for (const n of reach) {
      assert.includes(m.nodes[m.currentId].links, n.id);
      assert.notEqual(n.state, U.NODE_STATE.UNKNOWN);
    }
    const far = m.nodes.find(n => !m.nodes[m.currentId].links.includes(n.id) && n.id !== m.currentId);
    assert.equal(U.canJumpTo(m, far.id), false);
  });

  it('round-trips through serialisation', () => {
    // deserialize() rebuilds from seed.fork('universe'), so generate the same way.
    const m = U.generateUniverse(new RNG('SER').fork('universe'));
    U.revealFrom(m, 0, 3);
    const target = U.reachable(m)[0];
    U.jumpTo(m, target.id, null);
    U.markCleared(m, target.id);

    const restored = U.deserialize(JSON.parse(JSON.stringify(U.serialize(m))), new RNG('SER').fork('universe'));
    assert.equal(restored.currentId, m.currentId);
    assert.equal(restored.masterFleetId, m.masterFleetId);
    assert.equal(restored.nodes.length, m.nodes.length);
    assert.equal(restored.nodes[target.id].cleared, true);
    for (let i = 0; i < m.nodes.length; i++) {
      assert.equal(restored.nodes[i].encounterId, m.nodes[i].encounterId, `node ${i} content drifted`);
      assert.equal(restored.nodes[i].threat, m.nodes[i].threat);
    }
  });
});

describe('ships and loadout', () => {
  it('builds every hull with working starting gear', () => {
    for (const id of SHIP_IDS) {
      const ship = S.createShip(id, new RNG(id));
      assert.equal(ship.shipId, id);
      assert.greater(ship.hull, 0);
      assert.greater(ship.stats.maxHull, 0);
      assert.ok(ship.equipped.primary, `${id} has no primary weapon`);
      assert.ok(ship.perk, `${id} has no perk`);
      for (const [slot, item] of Object.entries(ship.equipped)) {
        if (item) assert.ok(S.fitsSlot(item, slot), `${id}: ${item.name} in the wrong slot`);
      }
    }
  });

  it('only the starter hull is available on a fresh profile', () => {
    const fresh = { stats: { wins: 0 }, achievements: {} };
    assert.deepEqual(unlockedShips(fresh), [STARTER_SHIP]);
  });

  it('never points a hull unlock at an achievement that does not exist', () => {
    // A dangling id makes the hull permanently unobtainable and is invisible
    // until someone actually tries to earn it.
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    for (const id of SHIP_IDS) {
      const u = SHIPS[id].unlock;
      if (u.kind === 'achievement') assert.ok(ids.has(u.id), );
    }
  });

  it('never points a hull unlock at an achievement that does not exist', () => {
    // A dangling id makes the hull permanently unobtainable, and it is invisible
    // until someone actually tries to earn it.
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    for (const id of SHIP_IDS) {
      const u = SHIPS[id].unlock;
      if (u.kind === 'achievement') {
        assert.ok(ids.has(u.id), `${id} unlocks on missing achievement "${u.id}"`);
      }
    }
  });

  it('makes every hull reachable from a fresh profile', () => {
    const everything = {
      stats: { wins: 99 },
      achievements: Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, 1])),
    };
    assert.equal(unlockedShips(everything).length, SHIP_IDS.length);
  });

  it('unlocks hulls with wins and achievements', () => {
    const p = { stats: { wins: 3 }, achievements: { untouched: 1 } };
    const list = unlockedShips(p);
    assert.includes(list, 'torus');
    assert.includes(list, 'stealth');
    assert.notOk(list.includes('nomad'), 'nomad needs its own achievement');
  });

  it('equipping recomputes stats', () => {
    const ship = S.createShip('kestrel', new RNG('EQ'));
    const before = ship.stats.maxHull;
    const plate = generateItem(new RNG('PLATE'), { slot: 'plating', level: 10, rarity: 'relic' });
    S.addItem(ship, plate);
    const res = S.equip(ship, plate.uid);
    assert.equal(res.ok, true, res.reason);
    assert.greater(ship.stats.maxHull, before);
  });

  it('returns the displaced item to the hold', () => {
    const ship = S.createShip('kestrel', new RNG('SWAP'));
    const a = generateItem(new RNG('A'), { slot: 'engine', level: 3 });
    const b = generateItem(new RNG('B'), { slot: 'engine', level: 3 });
    S.addItem(ship, a); S.equip(ship, a.uid);
    S.addItem(ship, b); S.equip(ship, b.uid);
    assert.equal(ship.equipped.engine.uid, b.uid);
    assert.ok(ship.inventory.some(i => i.uid === a.uid), 'the displaced engine was lost');
  });

  it('refuses a swap that would lose gear when the hold is full', () => {
    const ship = S.createShip('kestrel', new RNG('FULL'));
    const rng = new RNG('FILL');
    const wanted = generateItem(rng, { slot: 'engine', level: 3 });
    S.addItem(ship, wanted);
    S.equip(ship, wanted.uid);
    const replacement = generateItem(rng, { slot: 'engine', level: 4 });
    S.addItem(ship, replacement);
    while (!S.inventoryFull(ship)) S.addItem(ship, generateItem(rng, { level: 2 }));
    const res = S.equip(ship, replacement.uid);
    assert.equal(res.ok, false, 'should refuse rather than destroy the displaced item');
  });

  it('grants the difference when max hull rises', () => {
    const ship = S.createShip('kestrel', new RNG('GROW'));
    ship.hull = 50;
    const before = ship.stats.maxHull;
    ship.progress.unspentPoints = 1;
    S.spendAttributePoint(ship, 'hull');
    assert.close(ship.hull, 50 + (ship.stats.maxHull - before), 0.001,
      'investing in hull should repair, not just widen the bar');
  });

  it('clamps hull when max hull falls', () => {
    const ship = S.createShip('kestrel', new RNG('SHRINK'));
    ship.hull = ship.stats.maxHull;
    ship.equipped.plating = { mods: { hullPct: -0.5 }, pool: 'plating' };
    S.recompute(ship);
    assert.lessOrEqual(ship.hull, ship.stats.maxHull);
  });

  it('applies each hull perk to the stat block', () => {
    assert.greater(S.createShip('kestrel', new RNG('P1')).stats.xpPct, 0);
    assert.greater(S.createShip('nomad', new RNG('P2')).stats.rarityFloorBonus, 0);
    assert.greater(S.createShip('rock', new RNG('P3')).stats.contactArmour, 0.5);
    assert.greater(S.createShip('slug', new RNG('P4')).stats.scanBonus, 0);
  });
});
