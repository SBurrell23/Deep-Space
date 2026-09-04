import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';
import { SHIPS, SHIP_IDS, allLoadouts, compiledLayout, buildLayout, getLayout } from '../src/game/ships.js';
import { SYSTEMS, ALL_SYSTEM_IDS, upgradeCost, effectiveLevel, getSystem } from '../src/game/systems.js';
import { WEAPONS, DRONES, AUGMENTS, getWeapon, augmentValue, rarityWeight } from '../src/game/weapons.js';
import { RACES, RACE_IDS, makeCrew, grantXP, refreshSkills, damageCrew, rollRace } from '../src/game/crew.js';
import * as S from '../src/game/ship.js';
import { generateEnemy, generateBoss, ENEMY_CLASS_IDS } from '../src/game/enemy.js';
import { Combat } from '../src/game/combat.js';
import * as sector from '../src/game/sector.js';
import { EVENTS, EVENTS_BY_ID, rollEvent, checkRequirement } from '../src/game/events.js';
import { generateStore, upgradeOptions, reactorUpgradeCost } from '../src/game/store.js';
import { ACHIEVEMENTS, SHIP_ACHIEVEMENTS, totalAchievementCount } from '../src/game/achievements.js';

const rng = () => new RNG('TEST-FIXED');

describe('ship layouts', () => {
  it('compiles every layout without error', () => {
    for (const { shipId, variant } of allLoadouts()) {
      const L = compiledLayout(shipId, variant);
      assert.greater(L.rooms.length, 4, `${shipId}_${variant} has too few rooms`);
      assert.greater(L.doors.length, 3, `${shipId}_${variant} has too few doors`);
    }
  });

  it('gives every declared system a room to live in', () => {
    for (const { shipId, variant } of allLoadouts()) {
      const def = getLayout(shipId, variant);
      const rooms = compiledLayout(shipId, variant).rooms.map(r => r.system);
      for (const sysId of Object.keys(def.systems)) {
        assert.includes(rooms, sysId, `${shipId}_${variant}: ${sysId} has no room`);
      }
    }
  });

  it('never exceeds a hull weapon or drone slot count', () => {
    for (const { shipId, variant } of allLoadouts()) {
      const def = getLayout(shipId, variant);
      assert.lessOrEqual(def.weapons.length, def.weaponSlots, `${shipId}_${variant} weapons`);
      assert.lessOrEqual((def.drones || []).length, def.droneSlots, `${shipId}_${variant} drones`);
      assert.lessOrEqual(def.crew.length, def.crewSlots, `${shipId}_${variant} crew`);
    }
  });

  it('rejects a ragged deck plan', () => {
    assert.throws(() => buildLayout({
      id: 'bad', grid: ['aa', 'aaa'], map: { a: 'empty' },
    }), 'rows of different widths must throw');
  });

  it('rejects a non-rectangular room', () => {
    assert.throws(() => buildLayout({
      id: 'bad', grid: ['aa.', 'a..'], map: { a: 'empty' },
    }), 'an L-shaped room must throw');
  });

  it('rejects a room too small for its system', () => {
    assert.throws(() => buildLayout({
      id: 'bad', grid: ['a'], map: { a: 'shields' },
    }), 'a 1-tile shields room must throw');
  });

  it('rejects an unreachable compartment', () => {
    assert.throws(() => buildLayout({
      id: 'bad', grid: ['aa..bb', 'aa..bb'], map: { a: 'empty', b: 'empty' },
    }), 'disconnected rooms must throw');
  });

  it('forms a valid unlock chain from the starting ship', () => {
    const starters = SHIP_IDS.filter(id => SHIPS[id].unlockedBy === null);
    assert.equal(starters.length, 1, 'exactly one ship should be free at the start');
    assert.equal(starters[0], 'kestrel');
    for (const id of SHIP_IDS) {
      const by = SHIPS[id].unlockedBy;
      if (by) assert.includes(SHIP_IDS, by, `${id} is unlocked by an unknown ship`);
    }
    // Walk the chain and confirm it reaches every hull.
    const reached = new Set(['kestrel']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of SHIP_IDS) {
        if (!reached.has(id) && reached.has(SHIPS[id].unlockedBy)) { reached.add(id); changed = true; }
      }
    }
    assert.equal(reached.size, SHIP_IDS.length, 'every ship must be reachable by winning');
  });

  it('gives every ship two distinct layouts', () => {
    for (const id of SHIP_IDS) {
      assert.ok(SHIPS[id].layouts.A, `${id} missing layout A`);
      assert.ok(SHIPS[id].layouts.B, `${id} missing layout B`);
      assert.notEqual(SHIPS[id].layouts.A.name, SHIPS[id].layouts.B.name);
    }
  });
});

describe('content tables', () => {
  it('has a substantial weapon, drone and augment roster', () => {
    assert.greater(Object.keys(WEAPONS).length, 30);
    assert.greater(Object.keys(DRONES).length, 8);
    assert.greater(Object.keys(AUGMENTS).length, 20);
  });

  it('gives every weapon coherent stats', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      assert.equal(w.id, id, 'weapon id must match its key');
      assert.between(w.power, 1, 5, `${id} power`);
      assert.between(w.charge, 3, 30, `${id} charge time`);
      assert.between(w.cost, 10, 200, `${id} cost`);
      assert.between(w.rarity, 1, 5, `${id} rarity`);
      if (w.type !== 'beam') assert.ok(w.shots >= 1, `${id} needs at least one shot`);
    }
  });

  it('gives every system a cost table long enough for its levels', () => {
    for (const id of ALL_SYSTEM_IDS) {
      const s = SYSTEMS[id];
      assert.equal(s.upgradeCost.length, s.maxLevel - 1, `${id} upgrade table length`);
      for (let lvl = 1; lvl < s.maxLevel; lvl++) {
        assert.greater(upgradeCost(id, lvl), 0, `${id} level ${lvl} cost`);
      }
      assert.equal(upgradeCost(id, s.maxLevel), null, `${id} should have no cost at max`);
    }
  });

  it('scales item rarity with sector depth', () => {
    assert.equal(rarityWeight(5, 1), 0, 'legendary gear should not appear in sector 1');
    assert.greater(rarityWeight(5, 8), 0, 'legendary gear should appear by sector 8');
    assert.greater(rarityWeight(1, 1), 0, 'common gear is always available');
  });

  it('resolves augment effects additively and boolean effects as flags', () => {
    assert.close(augmentValue(['scrap_recovery'], 'scrapBonus'), 0.1);
    assert.equal(augmentValue(['pre_igniter'], 'preIgnite'), true);
    assert.equal(augmentValue([], 'scrapBonus', 0), 0);
    assert.equal(augmentValue(['rock_plating', 'scrap_recovery'], 'hullArmor'), 0.1);
  });
});

describe('crew', () => {
  it('defines every race consistently', () => {
    for (const id of RACE_IDS) {
      const r = RACES[id];
      assert.equal(r.id, id);
      assert.greater(r.hp, 0);
      assert.greater(r.moveSpeed, 0);
      assert.ok(r.desc.length > 20, `${id} needs a description`);
    }
  });

  it('levels skills at the documented thresholds', () => {
    const c = makeCrew('human', { rng: rng() });
    assert.equal(c.skills.repair, 0);
    grantXP(c, 'repair', 100);
    assert.equal(c.skills.repair, 2, 'plenty of XP should reach the cap');
    grantXP(c, 'repair', 1000);
    assert.equal(c.skills.repair, 2, 'skill must cap at 2');
  });

  it('never levels a skill past the cap or below zero', () => {
    const c = makeCrew('engi', { rng: rng() });
    refreshSkills(c);
    for (const v of Object.values(c.skills)) assert.between(v, 0, 2);
  });

  it('kills crew at zero health and keeps them dead', () => {
    const c = makeCrew('human', { rng: rng() });
    assert.equal(damageCrew(c, 50), false);
    assert.equal(damageCrew(c, 200), true);
    assert.equal(c.dead, true);
    assert.equal(damageCrew(c, 10), false, 'damaging a corpse is a no-op');
  });

  it('only rolls races the sector would plausibly hold', () => {
    const r = rng();
    for (let i = 0; i < 200; i++) {
      const race = rollRace(r, 1);
      assert.lessOrEqual(RACES[race].rarity, 4, 'sector 1 should not roll the rarest species');
    }
  });
});

describe('ship simulation', () => {
  it('never spends more reactor power than it has, for any ship', () => {
    for (const { shipId, variant } of allLoadouts()) {
      const ship = S.createShip(shipId, variant, { rng: rng() });
      assert.lessOrEqual(S.usedReactor(ship), S.totalReactor(ship), `${shipId}_${variant}`);
    }
  });

  it('refuses to power a system beyond its level', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    ship.reactor = 50;
    S.autoAssignPower(ship);
    const sys = ship.systems.shields;
    S.setPower(ship, 'shields', 99);
    assert.lessOrEqual(sys.power, sys.level);
  });

  it('drops power when a system is damaged', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const before = ship.systems.shields.power;
    S.applyHit(ship, ship.systems.shields.room, 2, {}, rng());
    assert.lessOrEqual(ship.systems.shields.power, before);
    assert.greater(ship.systems.shields.damage, 0);
  });

  it('converts two shield power into one shield layer', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    ship.reactor = 30;
    ship.systems.shields.level = 8;
    S.autoAssignPower(ship);
    assert.equal(ship.shields.max, 4, '8 power should give 4 layers');
  });

  it('absorbs a hit per shield layer and lets piercing shots through', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    ship.shields.layers = 2; ship.shields.max = 2;
    assert.equal(S.absorbWithShields(ship, 2, 0).shielded, true);
    assert.equal(ship.shields.layers, 1);
    assert.equal(S.absorbWithShields(ship, 2, 99).through, 2, 'missiles ignore shields');
  });

  it('gives zero evasion when nobody is at the helm', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    assert.greater(S.evasion(ship), 0);
    for (const c of ship.crew) c.dead = true;
    assert.equal(S.evasion(ship), 0);
  });

  it('routes ion damage to system lockout, never the hull', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const hull = ship.hull;
    S.applyHit(ship, ship.systems.shields.room, 3, { ion: 2 }, rng());
    assert.equal(ship.hull, hull, 'ion must not damage the hull');
    assert.greater(ship.systems.shields.ionCharges, 0);
  });

  it('vents oxygen through a breach and refills it once sealed', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    ship.rooms[0].breaches = 2;
    for (let i = 0; i < 60; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.ok(ship.rooms[0].oxygen < 0.9, 'a breached room should be losing air');
    ship.rooms[0].breaches = 0;
    for (let i = 0; i < 300; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.ok(ship.rooms[0].oxygen > 0.9, 'sealed rooms should refill');
  });

  it('starves a fire of oxygen', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const room = ship.rooms[0];
    room.fire = 0.8;
    room.oxygen = 0;
    delete ship.systems.oxygen; // no refill
    for (let i = 0; i < 40; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.equal(room.fire, 0, 'fire cannot burn in vacuum');
  });

  it('keeps system power a whole number even after a fire', () => {
    // Fires damage systems fractionally. If that fraction leaks into the power
    // cap, power becomes fractional and the system silently stops working.
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const sys = ship.systems.shields;
    ship.rooms[sys.room].fire = 0.7;
    for (let i = 0; i < 60; i++) S.updateShip(ship, 0.1, { rng: rng() });
    for (const s of Object.values(ship.systems)) {
      assert.equal(s.power, Math.round(s.power), `${s.id} power ${s.power} is not a whole number`);
    }
  });

  it('restores power to a system once it is repaired', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const sys = ship.systems.shields;
    const before = sys.power;
    assert.greater(before, 0);

    S.applyHit(ship, sys.room, 2, {}, rng());
    assert.lessOrEqual(sys.power, before - 1, 'damage should drop power');

    // Station a crew member in the room and let them work.
    S.orderCrewTo(ship, ship.crew[0].id, sys.room);
    for (let i = 0; i < 900 && sys.power < before; i++) S.updateShip(ship, 0.1, { rng: rng() });

    assert.equal(sys.damage, 0, 'the system should be repaired');
    assert.equal(sys.power, before, 'power should return to what the captain set');
    assert.greater(ship.shields.max, 0, 'shields should come back online');
  });

  it('does not restore power the captain deliberately removed', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    S.setPower(ship, 'shields', -99);
    assert.equal(ship.systems.shields.power, 0);
    for (let i = 0; i < 100; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.equal(ship.systems.shields.power, 0, 'a system switched off must stay off');
  });

  it('treats partial damage as a whole lost bar', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const sys = ship.systems.weapons;
    const cap = S.powerCap(ship, 'weapons');
    sys.damage = 0.3;
    assert.equal(S.powerCap(ship, 'weapons'), cap - 1, 'a part-damaged bar is unusable');
    assert.equal(S.powerCap(ship, 'weapons'), Math.round(S.powerCap(ship, 'weapons')));
  });

  it('finds a path between any two rooms', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    for (let i = 0; i < ship.rooms.length; i++) {
      const path = S.findPath(ship, 0, i);
      assert.ok(path !== null, `no path from room 0 to ${i}`);
    }
  });

  it('walks a crew member to an ordered room', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const c = ship.crew[0];
    const target = ship.rooms.length - 1;
    assert.equal(S.orderCrewTo(ship, c.id, target), true);
    for (let i = 0; i < 400 && c.room !== target; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.equal(c.room, target, 'crew should arrive at their ordered room');
  });

  it('repairs a damaged system when a crew member stands in it', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const sys = ship.systems.shields;
    sys.damage = 2;
    S.orderCrewTo(ship, ship.crew[0].id, sys.room);
    for (let i = 0; i < 600 && sys.damage > 0; i++) S.updateShip(ship, 0.1, { rng: rng() });
    assert.equal(sys.damage, 0, 'a crew member should repair the room they stand in');
  });

  it('serialises and restores without losing state', () => {
    const ship = S.createShip('nomad', 'B', { rng: rng() });
    ship.hull = 13;
    const copy = S.deserializeShip(JSON.parse(JSON.stringify(S.serializeShip(ship))));
    assert.equal(copy.hull, 13);
    assert.equal(copy.crew.length, ship.crew.length);
    assert.equal(S.usedReactor(copy), S.usedReactor(ship));
  });
});

describe('enemies', () => {
  it('generates a valid ship for every class in every sector', () => {
    const r = rng();
    for (const classId of ENEMY_CLASS_IDS) {
      for (let sector = 1; sector <= 8; sector++) {
        const e = generateEnemy(r, sector, { classId });
        assert.greater(e.hull, 0, `${classId} s${sector} hull`);
        assert.greater(e.weapons.length, 0, `${classId} s${sector} must be armed`);
        assert.lessOrEqual(S.usedReactor(e), S.totalReactor(e), `${classId} s${sector} power`);
        assert.greater(e.rewardScrap, 0);
      }
    }
  });

  it('scales enemy strength with sector depth', () => {
    const r = rng();
    const avg = sector => {
      let hull = 0;
      for (let i = 0; i < 40; i++) hull += generateEnemy(r, sector, { classId: 'fighter' }).hull;
      return hull / 40;
    };
    assert.greater(avg(6), avg(1) * 1.5, 'sector 6 enemies should be much tougher');
  });

  it('leaves automated hulls without crew', () => {
    const r = rng();
    const e = generateEnemy(r, 4, { classId: 'auto' });
    assert.equal(e.crew.length, 0);
    assert.equal(e.autoShip, true);
  });

  it('builds all three flagship phases, escalating', () => {
    const r = rng();
    const phases = [1, 2, 3].map(p => generateBoss(r, p));
    assert.greater(phases[1].shields.max, 0);
    assert.greater(phases[2].hull, phases[0].hull);
    assert.greater(phases[2].weapons.length, phases[0].weapons.length);
    for (const b of phases) assert.equal(b.noFlee, true, 'the flagship never runs');
  });
});

describe('combat', () => {
  it('resolves every fight to an outcome', () => {
    for (let i = 0; i < 30; i++) {
      const r = new RNG('COMBAT-' + i);
      const p = S.createShip('kestrel', 'A', { rng: r });
      const e = generateEnemy(r, 1 + (i % 8));
      const c = new Combat(p, e, r, { runState: { missiles: 20 } });
      for (const w of p.weapons) w.targetRoom = 0;
      let n = 0;
      while (!c.over && n++ < 20000) c.update(0.05);
      assert.ok(c.over, `fight ${i} never resolved`);
      assert.includes(['victory', 'defeat', 'fled', 'enemyFled'], c.outcome);
    }
  });

  it('pays out rewards only on a victory', () => {
    const r = new RNG('REWARD');
    const p = S.createShip('kestrel', 'A', { rng: r });
    const e = generateEnemy(r, 1, { classId: 'scout' });
    const c = new Combat(p, e, r, { runState: { missiles: 20 } });
    c.finish('defeat');
    assert.equal(c.rewards, null);
    const c2 = new Combat(p, e, r, { runState: { missiles: 20 } });
    c2.finish('victory');
    assert.greater(c2.rewards.scrap, 0);
  });

  it('does not fire a weapon with no ammunition left', () => {
    const r = new RNG('AMMO');
    const p = S.createShip('rock', 'A', { rng: r });
    const e = generateEnemy(r, 1, { classId: 'scout' });
    const run = { missiles: 0 };
    const c = new Combat(p, e, r, { runState: run });
    const slot = p.weapons.findIndex(w => getWeapon(w.weaponId).ammo);
    assert.greater(slot, -1, 'the Rock ship should carry a missile launcher');
    p.weapons[slot].powered = true;
    p.weapons[slot].charge = getWeapon(p.weapons[slot].weaponId).charge;
    assert.equal(c.fireWeapon(p, slot, 0), false, 'firing with no missiles must fail');
  });

  it('spends a missile when one is fired', () => {
    const r = new RNG('AMMO2');
    const p = S.createShip('rock', 'A', { rng: r });
    const e = generateEnemy(r, 1, { classId: 'scout' });
    const run = { missiles: 5 };
    const c = new Combat(p, e, r, { runState: run });
    const slot = p.weapons.findIndex(w => getWeapon(w.weaponId).ammo);
    p.weapons[slot].powered = true;
    p.weapons[slot].charge = getWeapon(p.weapons[slot].weaponId).charge;
    assert.equal(c.fireWeapon(p, slot, 0), true);
    assert.equal(run.missiles, 4);
  });

  it('pauses cleanly and stops advancing', () => {
    const r = new RNG('PAUSE');
    const p = S.createShip('kestrel', 'A', { rng: r });
    const e = generateEnemy(r, 3);
    const c = new Combat(p, e, r, { runState: { missiles: 9 } });
    c.togglePause();
    const before = c.time;
    for (let i = 0; i < 50; i++) c.update(0.05);
    assert.equal(c.time, before, 'a paused fight must not advance');
  });

  it('ends in defeat when the last crew member dies', () => {
    const r = new RNG('CREWLOSS');
    const p = S.createShip('kestrel', 'A', { rng: r });
    const e = generateEnemy(r, 1, { classId: 'scout' });
    const c = new Combat(p, e, r, { runState: { missiles: 9 } });
    for (const crew of p.crew) crew.dead = true;
    c.update(0.05);
    assert.equal(c.outcome, 'defeat');
  });
});

describe('sector generation', () => {
  it('always produces a connected map with a reachable exit', () => {
    for (let i = 0; i < 120; i++) {
      const r = new RNG('SEC-' + i);
      const tree = sector.generateSectorTree(r);
      const map = sector.generateSectorMap(r, tree.sectors[tree.startId]);
      assert.notEqual(sector.hopsBetween(map, map.startId, map.exitId), Infinity, `map ${i} has no route to the exit`);
      const seen = new Set([map.startId]);
      const queue = [map.startId];
      while (queue.length) {
        for (const l of sector.beaconById(map, queue.shift()).links) {
          if (!seen.has(l)) { seen.add(l); queue.push(l); }
        }
      }
      assert.equal(seen.size, map.beacons.length, `map ${i} has stranded beacons`);
    }
  });

  it('builds a sector tree whose final sector is the flagship', () => {
    const r = rng();
    const tree = sector.generateSectorTree(r);
    const finals = Object.values(tree.sectors).filter(s => s.isFinal);
    assert.equal(finals.length, 1);
    assert.equal(finals[0].depth, sector.TOTAL_SECTORS - 1);
    assert.deepEqual(finals[0].links, []);
  });

  it('only allows jumps to adjacent beacons', () => {
    const r = rng();
    const tree = sector.generateSectorTree(r);
    const map = sector.generateSectorMap(r, tree.sectors[tree.startId]);
    const far = map.beacons.find(b => !sector.canJumpTo(map, b.id) && b.id !== map.currentId);
    if (far) assert.equal(sector.jumpTo(map, far.id), null, 'a non-adjacent jump must be refused');
    const near = sector.reachableBeacons(map)[0];
    assert.ok(sector.jumpTo(map, near.id), 'an adjacent jump must succeed');
  });

  it('advances the fleet with every jump', () => {
    const r = rng();
    const tree = sector.generateSectorTree(r);
    const map = sector.generateSectorMap(r, tree.sectors[tree.startId]);
    const before = map.fleetColumn;
    sector.jumpTo(map, sector.reachableBeacons(map)[0].id);
    assert.greater(map.fleetColumn, before);
  });

  it('takes several jumps for the fleet to overrun the map', () => {
    const r = rng();
    const tree = sector.generateSectorTree(r);
    const map = sector.generateSectorMap(r, tree.sectors[tree.startId]);
    let jumps = 0;
    while (!map.beacons.every(b => b.fleet) && jumps < 60) { sector.advanceFleet(map); jumps++; }
    assert.between(jumps, 8, 40, 'the fleet should give the player a real window');
  });
});

describe('events', () => {
  it('has a substantial event library', () => {
    assert.greater(EVENTS.length, 20);
  });

  it('gives every event a title, text and at least two choices', () => {
    for (const e of EVENTS) {
      assert.ok(e.title && e.title.length > 2, `${e.id} needs a title`);
      assert.ok(e.text && e.text.length > 20, `${e.id} needs body text`);
      assert.greater(e.choices.length, 1, `${e.id} needs a real decision`);
      for (const c of e.choices) {
        assert.ok(c.text, `${e.id} has a choice with no text`);
        assert.greater(c.outcomes.length, 0, `${e.id} choice "${c.text}" has no outcomes`);
      }
    }
  });

  it('always leaves at least one ungated choice', () => {
    for (const e of EVENTS) {
      const free = e.choices.filter(c => !c.req);
      assert.greater(free.length, 0, `${e.id} could deadlock: every choice is gated`);
    }
  });

  it('rolls a valid event for every beacon and sector type', () => {
    const r = rng();
    for (const beaconType of ['empty', 'hostile', 'distress', 'hazard', 'repair', 'store']) {
      for (const sectorType of Object.keys(sector.SECTOR_TYPES)) {
        const e = rollEvent(r, beaconType, sectorType);
        assert.ok(e && e.id, `no event for ${beaconType}/${sectorType}`);
        assert.ok(EVENTS_BY_ID[e.id], `rolled an unregistered event for ${beaconType}`);
      }
    }
  });

  it('gates choices on resources and crew correctly', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const run = { scrap: 10, fuel: 1, missiles: 0 };
    assert.equal(checkRequirement({ scrap: 50 }, { ship, run }).ok, false);
    assert.equal(checkRequirement({ scrap: 5 }, { ship, run }).ok, true);
    assert.equal(checkRequirement({ race: 'mantis' }, { ship, run }).ok, false);
    assert.equal(checkRequirement({ race: 'human' }, { ship, run }).ok, true);
    assert.equal(checkRequirement({ system: 'shields' }, { ship, run }).ok, true);
    assert.equal(checkRequirement({ system: 'cloaking' }, { ship, run }).ok, false);
    assert.equal(checkRequirement(null, { ship, run }).ok, true);
  });

  it('explains why a gated choice is unavailable', () => {
    const ship = S.createShip('kestrel', 'A', { rng: rng() });
    const res = checkRequirement({ scrap: 999 }, { ship, run: { scrap: 0 } });
    assert.equal(res.ok, false);
    assert.ok(res.reason && res.reason.length > 3, 'a blocked choice must explain itself');
  });
});

describe('stores', () => {
  it('stocks a usable store for every sector', () => {
    const r = rng();
    const ship = S.createShip('kestrel', 'A', { rng: r });
    for (let s = 1; s <= 8; s++) {
      const store = generateStore(r, s, ship);
      assert.greater(store.items.length, 2, `sector ${s} store is too empty`);
      assert.greater(store.fuelPrice, 0);
      for (const item of store.items) {
        assert.greater(item.cost, 0, `${item.name} must cost something`);
        assert.ok(item.name, 'every item needs a name');
      }
    }
  });

  it('never offers a system the hull has no room for', () => {
    const r = rng();
    for (const { shipId, variant } of allLoadouts()) {
      const ship = S.createShip(shipId, variant, { rng: r });
      const rooms = compiledLayout(shipId, variant).rooms.map(x => x.system);
      const store = generateStore(r, 4, ship);
      for (const item of store.items.filter(i => i.kind === 'system')) {
        assert.includes(rooms, item.id, `${shipId}_${variant} cannot fit ${item.id}`);
        assert.notOk(ship.systems[item.id], `${item.id} is already installed`);
      }
    }
  });

  it('prices reactor upgrades on a rising curve, then stops', () => {
    let prev = 0;
    for (let r = 8; r < 25; r++) {
      const cost = reactorUpgradeCost(r);
      assert.greater(cost, prev, 'reactor upgrades should get more expensive');
      prev = cost;
    }
    assert.equal(reactorUpgradeCost(25), null, 'the reactor must cap out');
  });

  it('lists upgrade options for every installed system', () => {
    const ship = S.createShip('nomad', 'A', { rng: rng() });
    const opts = upgradeOptions(ship);
    assert.equal(opts.length, Object.keys(ship.systems).length);
    for (const o of opts) assert.ok(o.atMax || o.cost > 0);
  });
});

describe('achievements', () => {
  it('defines a substantial, well-formed set', () => {
    assert.greater(totalAchievementCount(), 40);
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.id && a.name && a.desc, `achievement ${a.id} is incomplete`);
      assert.equal(typeof a.check, 'function');
    }
  });

  it('gives every ship three achievements', () => {
    for (const id of SHIP_IDS) {
      const list = SHIP_ACHIEVEMENTS[id];
      assert.ok(list, `${id} has no ship achievements`);
      assert.equal(list.length, 3, `${id} should have three`);
    }
  });

  it('uses unique ids across the whole set', () => {
    const ids = [...ACHIEVEMENTS.map(a => a.id),
      ...Object.values(SHIP_ACHIEVEMENTS).flat().map(a => a.id)];
    assert.equal(new Set(ids).size, ids.length, 'achievement ids must be unique');
  });
});
