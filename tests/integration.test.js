import { describe, it, assert, beforeEach } from './harness.js';
import { loadProfile } from '../src/core/save.js';
import * as R from '../src/game/run.js';
import { reachableBeacons, atExit, beaconById } from '../src/game/sector.js';
import { allLoadouts } from '../src/game/ships.js';
import { livingCrew } from '../src/game/ship.js';
import { playRun } from './autoplay.js';

const fresh = () => loadProfile();

function newRun(shipId = 'kestrel', variant = 'A', seed = 'IT-1') {
  const profile = fresh();
  const run = R.startRun(profile, shipId, variant, seed);
  run.profile = profile;
  return run;
}

describe('run lifecycle', () => {
  beforeEach(() => localStorage.clear());

  it('starts every ship and layout without error', () => {
    for (const { shipId, variant } of allLoadouts()) {
      const run = newRun(shipId, variant, `START-${shipId}${variant}`);
      assert.equal(run.phase, R.PHASES.MAP);
      assert.greater(run.ship.weapons.length, 0, `${shipId}_${variant} has no weapons`);
      assert.greater(livingCrew(run.ship).length, 0, `${shipId}_${variant} has no crew`);
      assert.greater(run.fuel, 0);
      assert.equal(run.sectorIndex, 0);
    }
  });

  it('refuses to jump without fuel or a charged drive', () => {
    const run = newRun();
    const target = reachableBeacons(run.map)[0];
    run.ship.ftlCharge = 0;
    assert.equal(R.jump(run, target.id).ok, false, 'an uncharged drive cannot jump');
    run.ship.ftlCharge = 1;
    run.fuel = 0;
    assert.equal(R.jump(run, target.id).ok, false, 'no fuel means no jump');
    run.fuel = 5;
    assert.equal(R.jump(run, target.id).ok, true);
  });

  it('refuses to jump to a non-adjacent beacon', () => {
    const run = newRun();
    run.ship.ftlCharge = 1;
    const adjacent = new Set(reachableBeacons(run.map).map(b => b.id));
    const far = run.map.beacons.find(b => !adjacent.has(b.id) && b.id !== run.map.currentId);
    if (far) assert.equal(R.jump(run, far.id).ok, false);
  });

  it('spends fuel and advances the fleet on each jump', () => {
    const run = newRun();
    const fuel = run.fuel;
    const fleet = run.map.fleetColumn;
    run.ship.ftlCharge = 1;
    R.jump(run, reachableBeacons(run.map)[0].id);
    assert.equal(run.fuel, fuel - 1);
    assert.greater(run.map.fleetColumn, fleet);
  });

  it('clears fires, breaches and vacuum on a jump but keeps system damage', () => {
    const run = newRun();
    run.ship.rooms[0].fire = 0.8;
    run.ship.rooms[1].breaches = 2;
    run.ship.rooms[2].oxygen = 0;
    run.ship.systems.shields.damage = 2;
    run.ship.ftlCharge = 1;
    R.jump(run, reachableBeacons(run.map)[0].id);
    assert.equal(run.ship.rooms[0].fire, 0);
    assert.equal(run.ship.rooms[1].breaches, 0);
    assert.equal(run.ship.rooms[2].oxygen, 1);
    assert.equal(run.ship.systems.shields.damage, 2, 'battle damage should survive the jump');
  });

  it('always offers at least one usable choice at an event', () => {
    // Walk a run through many events and confirm none can deadlock.
    for (let seed = 0; seed < 25; seed++) {
      const run = newRun('kestrel', 'A', `EV-${seed}`);
      for (let i = 0; i < 12; i++) {
        if (run.phase !== R.PHASES.MAP) break;
        run.ship.ftlCharge = 1;
        run.fuel = Math.max(run.fuel, 3);
        const options = reachableBeacons(run.map);
        if (!options.length || atExit(run.map)) break;
        R.jump(run, options[0].id);
        if (run.phase === R.PHASES.EVENT) {
          const usable = R.eventChoices(run).filter(c => c.ok);
          assert.greater(usable.length, 0, `seed ${seed}: event ${run.pendingEvent.id} has no usable choice`);
          R.chooseEventOption(run, usable[0].index);
        }
        if (run.phase === R.PHASES.COMBAT) { run.combat.finish('fled'); }
        if (run.phase === R.PHASES.STORE) R.leaveStore(run);
      }
    }
  });

  it('never lets the player strand themselves at zero fuel', () => {
    const run = newRun();
    run.fuel = 0;
    assert.equal(R.canSendDistress(run), true);
    const res = R.sendDistressSignal(run);
    assert.equal(res.ok, true);
    assert.ok(run.fuel > 0 || run.phase === R.PHASES.COMBAT,
      'a distress call must yield fuel or a fight worth salvaging');
  });

  it('will not send a distress signal while fuel remains', () => {
    const run = newRun();
    assert.equal(R.canSendDistress(run), false);
    assert.equal(R.sendDistressSignal(run).ok, false);
  });
});

describe('store transactions', () => {
  beforeEach(() => localStorage.clear());

  function storeRun() {
    const run = newRun('kestrel', 'A', 'SHOP');
    run.store = { items: [], fuelPrice: 3, missilePrice: 6, dronePartPrice: 8, repairPrice: 2, hasRepairs: true };
    run.phase = R.PHASES.STORE;
    return run;
  }

  it('will not sell you what you cannot afford', () => {
    const run = storeRun();
    run.scrap = 5;
    run.store.items.push({ kind: 'weapon', id: 'laser_burst2', name: 'Burst Laser II', cost: 80, sold: false });
    const res = R.buyItem(run, 0);
    assert.equal(res.ok, false);
    assert.equal(run.scrap, 5, 'a failed purchase must not charge');
    assert.equal(run.store.items[0].sold, false);
  });

  it('charges exactly once for a successful purchase', () => {
    const run = storeRun();
    run.scrap = 200;
    run.store.items.push({ kind: 'weapon', id: 'laser_burst2', name: 'Burst Laser II', cost: 80, sold: false });
    const before = run.ship.weapons.length;
    assert.equal(R.buyItem(run, 0).ok, true);
    assert.equal(run.scrap, 120);
    assert.equal(run.ship.weapons.length, before + 1);
    assert.equal(R.buyItem(run, 0).ok, false, 'an item cannot be bought twice');
    assert.equal(run.scrap, 120);
  });

  it('refuses a weapon with no free hardpoint', () => {
    const run = storeRun();
    run.scrap = 500;
    while (run.ship.weapons.length < run.ship.weaponSlots) {
      run.ship.weapons.push({ slot: run.ship.weapons.length, weaponId: 'laser_basic', charge: 0, powered: false, autofire: true, targetRoom: null, charges: 0, rampHeat: 0, chainBonus: 0 });
    }
    run.store.items.push({ kind: 'weapon', id: 'laser_burst2', name: 'Burst Laser II', cost: 80, sold: false });
    assert.equal(R.buyItem(run, 0).ok, false);
    assert.equal(run.scrap, 500);
  });

  it('repairs hull for scrap and stops at full', () => {
    const run = storeRun();
    run.scrap = 100;
    run.ship.hull = 10;
    const res = R.repairAtStore(run, 5);
    assert.equal(res.ok, true);
    assert.equal(run.ship.hull, 15);
    assert.equal(run.scrap, 100 - res.cost);
    run.ship.hull = run.ship.maxHull;
    assert.equal(R.repairAtStore(run, 3).ok, false, 'cannot repair a full hull');
  });

  it('upgrades a system and charges the table price', () => {
    const run = storeRun();
    run.scrap = 500;
    const before = run.ship.systems.engines.level;
    const res = R.upgradeSystem(run, 'engines');
    assert.equal(res.ok, true);
    assert.equal(run.ship.systems.engines.level, before + 1);
    assert.equal(run.scrap, 500 - res.cost);
  });

  it('refuses to upgrade past a system maximum', () => {
    const run = storeRun();
    run.scrap = 99999;
    for (let i = 0; i < 20; i++) R.upgradeSystem(run, 'oxygen');
    assert.equal(run.ship.systems.oxygen.level, 3, 'oxygen caps at level 3');
    assert.equal(R.upgradeSystem(run, 'oxygen').ok, false);
  });

  it('sells equipment but never the last weapon', () => {
    const run = storeRun();
    const start = run.scrap;
    assert.equal(R.sellEquipment(run, 'weapon', 0).ok, true);
    assert.greater(run.scrap, start);
    assert.equal(run.ship.weapons.length, 1);
    assert.equal(R.sellEquipment(run, 'weapon', 0).ok, false, 'the last weapon cannot be sold');
  });

  it('buys resources at the listed price', () => {
    const run = storeRun();
    run.scrap = 50;
    const fuel = run.fuel;
    assert.equal(R.buyResource(run, 'fuel', 3).ok, true);
    assert.equal(run.fuel, fuel + 3);
    assert.equal(run.scrap, 50 - 9);
    run.scrap = 1;
    assert.equal(R.buyResource(run, 'fuel', 5).ok, false);
  });
});

describe('scoring and endings', () => {
  beforeEach(() => localStorage.clear());

  it('scores a win far above an equivalent loss', () => {
    const a = newRun('kestrel', 'A', 'SCORE-A');
    a.sectorIndex = 5; a.stats.shipsDestroyed = 20; a.stats.scrapEarned = 400; a.stats.beacons = 40;
    const loss = R.computeScore(a, false);
    const win = R.computeScore(a, true);
    assert.greater(win, loss * 2);
  });

  it('records the ending on the profile and clears the save', () => {
    const run = newRun();
    R.endRun(run, false, 'Your ship was destroyed.');
    assert.equal(run.phase, R.PHASES.GAME_OVER);
    assert.equal(run.profile.stats.runs, 1);
    assert.equal(run.profile.stats.deaths, 1);
    assert.equal(run.profile.history[0].won, false);
  });

  it('unlocks the next hull on a victory', () => {
    const run = newRun('kestrel', 'A', 'WIN');
    R.endRun(run, true, 'The Swarm Flagship is destroyed.');
    assert.equal(run.phase, R.PHASES.VICTORY);
    assert.ok(run.profile.unlockedShips.torus, 'winning with the Kestrel unlocks the Torus');
    assert.includes(run.profile.unlockedShips.kestrel, 'B', 'winning also unlocks layout B');
    assert.equal(run.profile.stats.wins, 1);
  });

  it('is idempotent — ending twice does not double-count', () => {
    const run = newRun();
    R.endRun(run, false, 'destroyed');
    R.endRun(run, false, 'destroyed again');
    assert.equal(run.profile.stats.runs, 1);
  });
});

describe('full-run soak', () => {
  beforeEach(() => localStorage.clear());

  it('plays complete runs for every ship without crashing', () => {
    // One run per loadout: the broadest smoke test in the suite.
    for (const { shipId, variant } of allLoadouts()) {
      const result = playRun({ seed: `SOAK-${shipId}-${variant}`, shipId, variant });
      assert.ok(result.sector >= 1, `${shipId}_${variant} did not get anywhere`);
      assert.ok(result.cause || result.won, `${shipId}_${variant} ended with no reason`);
      assert.ok(result.steps < 4000, `${shipId}_${variant} hit the step limit — possible deadlock`);
    }
  });

  it('produces varied outcomes across seeds rather than one scripted path', () => {
    const sectors = new Set();
    for (let i = 0; i < 12; i++) {
      sectors.add(playRun({ seed: `VARY-${i}` }).sector);
    }
    assert.greater(sectors.size, 2, 'different seeds should produce different runs');
  });

  it('earns achievements over the course of a run', () => {
    const result = playRun({ seed: 'ACH-1' });
    assert.greater(result.achievements, 0, 'a full run should earn something');
  });
});
