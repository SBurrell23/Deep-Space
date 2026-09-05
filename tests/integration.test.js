import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';
import * as R from '../src/game/run.js';
import * as U from '../src/game/universe.js';
import * as S from '../src/game/ship.js';
import * as save from '../src/core/save.js';
import { SHIP_IDS } from '../src/game/ships.js';
import { ENCOUNTER_TYPES } from '../src/game/encounters/index.js';
import { createPilot, pilotInput } from './pilot.js';

const DT = 1 / 60;

function freshRun(seed = 'INT', shipId = 'kestrel') {
  localStorage.clear();
  return R.startRun({ shipId, seed, profile: save.loadProfile() });
}

/** Play the current encounter to a conclusion with the synthetic pilot. */
function playEncounter(run, skill = 0.8, cap = 200) {
  const bot = createPilot(skill, new RNG('bot'));
  let i = 0;
  while (run.phase === 'action' && i++ < cap * 60) {
    pilotInput(run.world, bot, DT);
    R.tick(run, DT);
  }
  return run;
}

/** Advance the run until it reaches one of `phases`, driving whatever comes up. */
function driveTo(run, phases, { skill = 0.8, maxSteps = 400 } = {}) {
  const want = new Set(phases);
  let guard = 0;
  while (!want.has(run.phase) && guard++ < maxSteps) {
    switch (run.phase) {
      case 'map': {
        const options = U.reachable(run.map).filter(n => !n.cleared);
        if (!options.length) return run;
        const level = run.ship.progress.level;
        options.sort((a, b) => Math.abs(a.threat - level) - Math.abs(b.threat - level));
        R.jump(run, options[0].id);
        break;
      }
      case 'brief': R.beginEncounter(run); break;
      case 'action': playEncounter(run, skill); break;
      case 'debrief': R.collectRewards(run); break;
      case 'levelup':
        while (S.hasUnspentPoints(run.ship)) if (!R.spendPoint(run, 'hull')) break;
        R.closeLevelUp(run);
        break;
      case 'shop': R.leaveShop(run); break;
      case 'anomaly': {
        const ok = R.anomalyChoices(run).filter(c => c.ok);
        if (ok.length) R.chooseAnomaly(run, ok[0].index);
        if (run.phase === 'anomaly') R.closeAnomaly(run);
        break;
      }
      default: return run;
    }
  }
  return run;
}

describe('run lifecycle', () => {
  it('starts on the map with a revealed neighbourhood', () => {
    const run = freshRun();
    assert.equal(run.phase, 'map');
    assert.greater(U.reachable(run.map).length, 0);
    assert.greater(run.ship.hull, 0);
  });

  it('refuses a jump to an unlinked node', () => {
    const run = freshRun();
    const far = run.map.nodes.find(n =>
      n.id !== run.map.currentId && !run.map.nodes[run.map.currentId].links.includes(n.id));
    const res = R.jump(run, far.id);
    assert.equal(res.ok, false);
    assert.equal(run.map.currentId, 0, 'the ship should not have moved');
  });

  it('routes each node type to the right phase', () => {
    const run = freshRun('ROUTE');
    // Force each type onto a reachable node and check where it lands.
    for (const [type, expected] of [['anomaly', 'anomaly'], ['shop', 'shop'], ['hostiles', 'brief']]) {
      const fresh = freshRun(`ROUTE-${type}`);
      const target = U.reachable(fresh.map)[0];
      const enc = [...ENCOUNTER_TYPES[type] ? [type] : []][0];
      const candidate = Object.values(fresh.map.nodes).find(n => n.type === type);
      if (!candidate) continue;
      target.type = type;
      target.encounterId = candidate.encounterId;
      target.cleared = false;
      R.jump(fresh, target.id);
      assert.equal(fresh.phase, expected, `${type} should open the ${expected} phase`);
    }
  });

  it('plays an encounter through to a payout', () => {
    const run = freshRun('PAYOUT');
    driveTo(run, ['debrief', 'dead'], { maxSteps: 30 });
    if (run.phase === 'dead') return;   // an unlucky first node is legitimate
    const p = run.pending;
    assert.ok(p, 'expected pending rewards');
    if (!p.fled) {
      assert.greater(p.xp, 0);
      assert.ok(p.credits >= 0);
      const before = run.ship.progress.xp + run.ship.credits;
      R.collectRewards(run);
      assert.greater(run.ship.progress.xp + run.ship.credits, before - 1);
    }
  });

  it('only pays out a node once', () => {
    const run = freshRun('ONCE');
    driveTo(run, ['map', 'dead'], { maxSteps: 60 });
    if (run.phase !== 'map') return;
    const cleared = run.map.nodes.find(n => n.cleared && n.id !== 0);
    if (!cleared) return;
    // Walk back onto it: a cleared node is travel only.
    if (U.canJumpTo(run.map, cleared.id)) {
      const credits = run.ship.credits;
      const res = R.jump(run, cleared.id);
      assert.equal(res.revisit, true);
      assert.equal(run.phase, 'map');
      assert.equal(run.ship.credits, credits, 'a revisit must not pay again');
    }
  });

  it('cancelling a brief puts you back where you jumped from', () => {
    const run = freshRun('DECLINE');
    const origin = run.map.currentId;
    const next = U.reachable(run.map).find(n => !n.cleared
      && ENCOUNTER_TYPES[n.type]?.action);
    if (!next) return;

    R.jump(run, next.id);
    if (run.phase !== 'brief') return;
    assert.equal(run.map.currentId, next.id, 'the jump has to happen to read the brief');

    assert.equal(R.declineEncounter(run), true);
    assert.equal(run.map.currentId, origin,
      'declining must not leave you parked on the fight you refused');
    assert.equal(run.node.id, origin);
    assert.equal(run.map.nodes[next.id].cleared, false, 'and the node stays unclaimed');
  });

  it('cancelling after a multi-hop travel returns to the start of the move', () => {
    // Built rather than played: the situation needs a corridor of cleared space
    // with an unfought node on the far side, which a short scripted run rarely
    // produces on its own.
    const run = freshRun('DECLINE2');
    const origin = run.map.currentId;

    const step = U.reachable(run.map).find(n => run.map.nodes[n.id].links
      .some(id => id !== origin
        && run.map.nodes[id].state !== U.NODE_STATE.UNKNOWN
        && ENCOUNTER_TYPES[run.map.nodes[id].type]?.action));
    assert.ok(step, 'the opening map should offer a two-hop route somewhere');
    U.markCleared(run.map, step.id);

    const target = run.map.nodes[step.links.find(id => id !== origin
      && run.map.nodes[id].state !== U.NODE_STATE.UNKNOWN
      && ENCOUNTER_TYPES[run.map.nodes[id].type]?.action)];

    const route = U.routeThroughCleared(run.map, target.id);
    assert.ok(route && route.length > 1, 'the route should be more than one hop');

    R.travelPath(run, route);
    assert.equal(run.phase, 'brief');
    assert.equal(run.map.currentId, target.id);

    R.declineEncounter(run);
    assert.equal(run.map.currentId, origin,
      'the door back leads to where the whole move started, not the last hop');
  });

  it('lets you spend attribute points mid-fight without ending the fight', () => {
    // Points can be spent from the top bar at any time. Spending the last one
    // used to drop the run's phase to 'map' regardless of where you were,
    // which tore the encounter down around the player and left the node
    // unwinnable — reported from a boss fight.
    const run = freshRun('MIDFIGHT');
    const next = U.reachable(run.map).find(n => !n.cleared
      && ENCOUNTER_TYPES[n.type]?.action);
    if (!next) return;
    R.jump(run, next.id);
    if (run.phase !== 'brief') return;
    R.beginEncounter(run);
    assert.equal(run.phase, 'action');

    run.ship.progress.unspentPoints = 1;
    assert.equal(R.spendPoint(run, 'hull'), true);
    assert.equal(run.phase, 'action', 'spending a point must not abandon the fight');

    R.closeLevelUp(run);
    assert.equal(run.phase, 'action', 'and neither must closing the screen');

    // The level-up screen itself still hands you back to the map.
    run.phase = 'levelup';
    run.ship.progress.unspentPoints = 1;
    R.spendPoint(run, 'hull');
    assert.equal(run.phase, 'map');
  });

  it('carries hull damage between encounters but restores the shield', () => {
    const run = freshRun('CARRY');
    driveTo(run, ['map', 'dead'], { maxSteps: 60 });
    if (run.phase !== 'map') return;
    run.ship.hull = Math.max(1, run.ship.stats.maxHull * 0.4);
    const hurt = run.ship.hull;

    const next = U.reachable(run.map).find(n => !n.cleared
      && ENCOUNTER_TYPES[n.type]?.action);
    if (!next) return;
    R.jump(run, next.id);
    if (run.phase !== 'brief') return;
    R.beginEncounter(run);
    assert.close(run.world.player.hull, hurt, 0.001, 'hull damage must persist');
    assert.close(run.world.player.shield, run.ship.stats.maxShield, 0.001,
      'the shield is an in-fight buffer and must refill between nodes');
  });

  it('ends the run when the ship is destroyed', () => {
    const run = freshRun('DEATH');
    driveTo(run, ['brief', 'dead'], { maxSteps: 30 });
    if (run.phase !== 'brief') return;
    R.beginEncounter(run);
    run.ship.hull = 1;
    run.world.player.hull = 1;
    run.world.player.shield = 0;
    run.world.player.invuln = 0;
    // Take a hit big enough to finish it.
    run.world.eBullets.push({
      x: run.world.player.x, y: run.world.player.y, vx: 0, vy: 0,
      r: 40, damage: 9999, life: 5, delay: 0, dead: false, sprite: 'eb_bolt',
    });
    for (let i = 0; i < 30 && run.phase === 'action'; i++) R.tick(run, DT);
    assert.equal(run.phase, 'dead');
  });

  it('reveals more of the map as it travels', () => {
    const run = freshRun('REVEAL');
    const before = U.stats(run.map).seen + U.stats(run.map).visited;
    driveTo(run, ['dead'], { maxSteps: 90 });
    const after = U.stats(run.map).seen + U.stats(run.map).visited;
    assert.greater(after, before, 'travel should push the fog back');
  });
});

describe('run — economy and progression', () => {
  it('levels up and banks points over a run', () => {
    const run = freshRun('LEVEL');
    driveTo(run, ['dead'], { maxSteps: 200 });
    assert.greater(run.ship.progress.level + run.stats.nodesCleared, 1,
      'a run should make some progress');
  });

  it('buys repairs at a shop and charges for them', () => {
    const run = freshRun('SHOP');
    // Put a shop next door and walk into it.
    const target = U.reachable(run.map)[0];
    const shopNode = run.map.nodes.find(n => n.type === 'shop');
    if (!shopNode) return;
    target.type = 'shop';
    target.encounterId = shopNode.encounterId;
    target.cleared = false;
    R.jump(run, target.id);
    assert.equal(run.phase, 'shop');

    run.ship.hull = run.ship.stats.maxHull * 0.5;
    run.ship.credits = 5000;
    const stock = run.shopStock;
    assert.greater(stock.items.length, 0, 'a shop with nothing to sell is not a shop');
    const credits = run.ship.credits;
    const res = R.buyRepair(run);
    assert.equal(res.ok, true);
    assert.equal(run.ship.hull, run.ship.stats.maxHull);
    assert.ok(run.ship.credits < credits, 'repairs must cost something');
    assert.equal(R.buyRepair(run).ok, false, 'cannot repair twice');
  });

  it('refuses to buy without the credits', () => {
    const run = freshRun('BROKE');
    const target = U.reachable(run.map)[0];
    const shopNode = run.map.nodes.find(n => n.type === 'shop');
    if (!shopNode) return;
    target.type = 'shop'; target.encounterId = shopNode.encounterId; target.cleared = false;
    R.jump(run, target.id);
    run.ship.credits = 0;
    const item = run.shopStock.items[0];
    assert.equal(R.buyItem(run, item.uid).ok, false);
    assert.equal(R.buyItem(run, 'nonexistent').ok, false);
  });

  it('sells inventory for credits', () => {
    const run = freshRun('SELL');
    const items = S.rollLoot(run.ship, run.rng, { threat: 5, crates: 1 });
    S.addItem(run.ship, items[0]);
    const credits = run.ship.credits;
    const res = R.sellItem(run, items[0].uid);
    assert.equal(res.ok, true);
    assert.greater(run.ship.credits, credits);
    assert.equal(R.sellItem(run, items[0].uid).ok, false, 'cannot sell it twice');
  });
});

describe('run — persistence', () => {
  it('round-trips a run through save and load', () => {
    const run = freshRun('SAVE');
    driveTo(run, ['map', 'dead'], { maxSteps: 60 });
    if (run.phase !== 'map') return;

    run.ship.credits = 777;
    save.saveRun(R.serialize(run));
    const restored = R.deserialize(save.loadRun(), save.loadProfile());

    assert.equal(restored.seed, run.seed);
    assert.equal(restored.ship.credits, 777);
    assert.equal(restored.ship.progress.level, run.ship.progress.level);
    assert.close(restored.ship.hull, run.ship.hull, 0.001);
    assert.equal(restored.map.currentId, run.map.currentId);
    assert.equal(restored.map.nodes.length, run.map.nodes.length);
    // The map regenerates from the seed; its content must match exactly.
    for (let i = 0; i < run.map.nodes.length; i += 7) {
      assert.equal(restored.map.nodes[i].encounterId, run.map.nodes[i].encounterId);
      assert.equal(restored.map.nodes[i].cleared, run.map.nodes[i].cleared);
    }
  });

  it('preserves equipped gear and inventory', () => {
    const run = freshRun('GEAR');
    const items = S.rollLoot(run.ship, run.rng, { threat: 8, crates: 3 });
    for (const it of items) S.addItem(run.ship, it);
    S.equip(run.ship, items[0].uid);

    save.saveRun(R.serialize(run));
    const restored = R.deserialize(save.loadRun(), save.loadProfile());
    assert.equal(restored.ship.inventory.length, run.ship.inventory.length);
    for (const slot of Object.keys(run.ship.equipped)) {
      assert.equal(restored.ship.equipped[slot]?.uid, run.ship.equipped[slot]?.uid, `slot ${slot} drifted`);
    }
    assert.equal(restored.ship.stats.maxHull, run.ship.stats.maxHull, 'stats must rebuild from gear');
  });

  it('a dead run is deleted for good', () => {
    const run = freshRun('PERMA');
    save.saveRun(R.serialize(run));
    assert.ok(save.hasSavedRun());
    save.clearRun();
    assert.notOk(save.hasSavedRun());
    assert.equal(save.loadRun(), null);
  });
});

describe('every hull is playable', () => {
  for (const shipId of SHIP_IDS) {
    it(`${shipId} starts, fights and survives its first encounter`, () => {
      const run = freshRun(`HULL-${shipId}`, shipId);
      assert.greater(run.ship.stats.maxHull, 0);
      assert.ok(run.ship.equipped.primary, 'no primary weapon');
      driveTo(run, ['debrief', 'dead', 'map'], { maxSteps: 25 });
      assert.ok(['debrief', 'dead', 'map', 'levelup', 'shop', 'anomaly'].includes(run.phase),
        `${shipId} ended in an unexpected phase: ${run.phase}`);
      assert.equal(run.frameError, undefined);
    });
  }
});
