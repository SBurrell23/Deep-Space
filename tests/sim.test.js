import { describe, it, assert } from './harness.js';
import { RNG } from '../src/core/rng.js';
import * as S from '../src/game/ship.js';
import {
  createWorld, update, drainEvents, blankInput, retreat,
  damagePlayer, healPlayer, damageEnemy, explode, dropPickup,
  WORLD_W, WORLD_H,
} from '../src/game/sim.js';

const DT = 1 / 60;

function makeWorld(encounter, { threat = 3, shipId = 'kestrel', seed = 'SIM' } = {}) {
  const rng = new RNG(seed);
  const ship = S.createShip(shipId, rng.fork('ship'));
  return { world: createWorld({ encounter, threat, ship, rng: rng.fork('world') }), ship };
}

/** Run the sim forward, optionally driving input each frame. */
function run(world, seconds, drive = null) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames && world.state === 'playing'; i++) {
    if (drive) drive(world, i);
    update(world, DT);
    drainEvents(world);
  }
  return world;
}

const SKIRMISH = {
  id: 'test_skirmish', name: 'Test', type: 'combat',
  objective: { kind: 'clear' },
  waves: [{ at: 0, spawn: [{ id: 'picket', count: 4, formation: 'line' }] }],
};

describe('simulation — world', () => {
  it('builds a world with the player in the field', () => {
    const { world } = makeWorld(SKIRMISH);
    assert.equal(world.state, 'playing');
    assert.between(world.player.x, 0, WORLD_W);
    assert.between(world.player.y, 0, WORLD_H);
    assert.greater(world.player.maxHull, 0);
    assert.ok(world.player.primary, 'the player should start armed');
  });

  it('is deterministic for a seed', () => {
    const a = makeWorld(SKIRMISH, { seed: 'DET' }).world;
    const b = makeWorld(SKIRMISH, { seed: 'DET' }).world;
    const drive = (w) => { w.input.firePrimary = true; w.input.moveY = 0.4; };
    run(a, 6, drive);
    run(b, 6, drive);
    assert.equal(a.stats.kills, b.stats.kills);
    assert.close(a.player.hull, b.player.hull, 1e-9);
    assert.close(a.time, b.time, 1e-9);
  });

  it('ignores a zero or negative timestep', () => {
    const { world } = makeWorld(SKIRMISH);
    const t = world.time;
    update(world, 0);
    update(world, -1);
    assert.equal(world.time, t);
  });

  it('clamps a huge timestep so nothing tunnels', () => {
    const { world } = makeWorld(SKIRMISH);
    update(world, 100);
    assert.lessOrEqual(world.time, 0.05, 'a long stall must not advance the world by 100s');
  });

  it('stops updating once resolved', () => {
    const { world } = makeWorld(SKIRMISH);
    world.state = 'won';
    const t = world.time;
    update(world, DT);
    assert.equal(world.time, t);
  });
});

describe('simulation — player', () => {
  it('moves under input and stays inside the field', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 4, w => { w.input.moveX = 1; w.input.moveY = 1; });
    assert.between(world.player.x, 0, WORLD_W);
    assert.between(world.player.y, 0, WORLD_H);
    assert.greater(world.player.x, 150, 'should have moved right');
  });

  it('does not move faster diagonally than along an axis', () => {
    const straight = makeWorld(SKIRMISH).world;
    run(straight, 3, w => { w.input.moveX = 1; });
    const diagonal = makeWorld(SKIRMISH).world;
    run(diagonal, 3, w => { w.input.moveX = 1; w.input.moveY = 1; });
    const sx = straight.player.x - 150;
    const dx = Math.hypot(diagonal.player.x - 150, diagonal.player.y - WORLD_H / 2);
    assert.ok(dx <= sx * 1.08, `diagonal travelled ${dx.toFixed(0)} vs ${sx.toFixed(0)}`);
  });

  it('fires, and firing costs energy relative to holding fire', () => {
    const firing = makeWorld(SKIRMISH).world;
    run(firing, 2, w => { w.input.firePrimary = true; });
    const idle = makeWorld(SKIRMISH).world;
    run(idle, 2);
    assert.greater(firing.stats.shotsFired, 0);
    assert.ok(firing.player.energy < idle.player.energy, 'firing should cost energy');
  });

  it('stops firing when energy runs out', () => {
    const { world } = makeWorld(SKIRMISH);
    world.player.energy = 0;
    world.player.stats.energyRegen = 0;
    run(world, 1, w => { w.input.firePrimary = true; });
    assert.equal(world.stats.shotsFired, 0);
  });

  it('regenerates energy when not firing', () => {
    const { world } = makeWorld(SKIRMISH);
    world.player.energy = 1;
    run(world, 3);
    assert.greater(world.player.energy, 1);
  });

  it('dashes, spends a charge, and grants invulnerability', () => {
    const { world } = makeWorld(SKIRMISH);
    const charges = world.player.dashCharges;
    update(world, DT);
    world.input.dash = true;
    update(world, DT);
    assert.equal(world.player.dashCharges, charges - 1);
    assert.greater(world.player.invuln, 0);
    assert.greater(world.stats.dashes, 0);
  });

  it('recovers dash charges over time', () => {
    const { world } = makeWorld(SKIRMISH);
    world.input.dash = true;
    update(world, DT);
    world.input.dash = false;
    assert.equal(world.player.dashCharges, 0);
    run(world, 10);
    assert.equal(world.player.dashCharges, world.player.dashMax);
  });
});

describe('simulation — damage', () => {
  it('spends the shield before the hull', () => {
    const { world } = makeWorld(SKIRMISH);
    const p = world.player;
    p.shield = 40;
    const hull = p.hull;
    damagePlayer(world, 25);
    assert.close(p.shield, 15);
    assert.equal(p.hull, hull, 'hull should be untouched while the shield holds');
  });

  it('overflows into the hull once the shield breaks', () => {
    const { world } = makeWorld(SKIRMISH);
    const p = world.player;
    p.shield = 10;
    const hull = p.hull;
    damagePlayer(world, 30);
    assert.equal(p.shield, 0);
    assert.close(p.hull, hull - 20);
  });

  it('ignores damage while invulnerable', () => {
    const { world } = makeWorld(SKIRMISH);
    const p = world.player;
    p.invuln = 1;
    p.shield = 0;
    const hull = p.hull;
    damagePlayer(world, 100);
    assert.equal(p.hull, hull);
  });

  it('ends the encounter when the hull reaches zero', () => {
    const { world } = makeWorld(SKIRMISH);
    world.player.shield = 0;
    damagePlayer(world, 1e6);
    assert.equal(world.state, 'lost');
    assert.equal(world.outcome, 'destroyed');
    assert.equal(world.player.hull, 0, 'hull should floor at zero, not go negative');
  });

  it('never heals above maximum', () => {
    const { world } = makeWorld(SKIRMISH);
    world.player.hull = 10;
    healPlayer(world, 1e6);
    assert.equal(world.player.hull, world.player.maxHull);
  });

  it('applies enemy armour and support auras', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 1);
    const e = world.enemies[0];
    assert.ok(e, 'expected an enemy on the field');

    e.armour = 0.5; e.shield = 0; e.shieldAura = 0;
    const before = e.hull;
    damageEnemy(world, e, 100, { silent: true });
    assert.close(before - e.hull, 50, 0.01, 'armour should halve the hit');

    e.hull = before; e.armour = 0; e.shieldAura = 0.5;
    damageEnemy(world, e, 100, { silent: true });
    assert.close(before - e.hull, 50, 0.01, 'an aura should halve the hit');
  });

  it('kills an enemy and pays out', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 1);
    const e = world.enemies[0];
    const xp = world.stats.xpEarned;
    damageEnemy(world, e, 1e6, { silent: true });
    assert.equal(e.dead, true);
    assert.equal(world.stats.kills, 1);
    assert.greater(world.stats.xpEarned, xp);
  });

  it('falls off an explosion with distance', () => {
    const { world } = makeWorld(SKIRMISH);
    const p = world.player;
    p.shield = 0;
    const hull = p.hull;
    explode(world, p.x + 200, p.y, { radius: 220, damage: 100, friendly: false });
    const far = hull - p.hull;
    p.hull = hull; p.invuln = 0;
    explode(world, p.x, p.y, { radius: 220, damage: 100, friendly: false });
    const near = hull - p.hull;
    assert.greater(near, far, 'a direct hit should hurt more than a graze');
  });
});

describe('simulation — objectives', () => {
  it('wins a clear objective once the script is spent and the field is empty', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 2);
    for (const e of world.enemies) damageEnemy(world, e, 1e6, { silent: true });
    update(world, DT);
    assert.equal(world.state, 'won');
    assert.equal(world.outcome, 'cleared');
  });

  it('wins a survive objective on the clock', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'survival',
      objective: { kind: 'survive', seconds: 3 },
      waves: [{ at: 0, spawn: [{ id: 'picket', count: 2 }] }],
    });
    run(world, 2);
    assert.equal(world.state, 'playing');
    run(world, 2);
    assert.equal(world.state, 'won');
  });

  it('wins a reach objective by distance', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'tunnel',
      objective: { kind: 'reach', distance: 400 },
      terrain: { style: 'rock', length: 4000, scroll: 300 },
      waves: [],
    });
    assert.ok(world.corridor, 'terrain encounters need a corridor');
    run(world, 3);
    assert.equal(world.state, 'won');
  });

  it('loses on a time limit', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'combat',
      objective: { kind: 'clear', timeLimit: 2 },
      waves: [{ at: 0, spawn: [{ id: 'bulwark', count: 3 }] }],
    });
    run(world, 4);
    assert.equal(world.state, 'lost');
    assert.equal(world.outcome, 'timeout');
  });

  it('records a retreat as a loss without destroying the ship', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 1);
    retreat(world);
    assert.equal(world.state, 'lost');
    assert.equal(world.outcome, 'fled');
    assert.greater(world.player.hull, 0);
  });

  it('always terminates — no encounter can stall indefinitely', () => {
    // hover/mirror/guard movers hold station forever; without stragglers
    // closing in, a "clear" objective could sit unwinnable until the timeout.
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'combat',
      objective: { kind: 'clear' },
      waves: [{ at: 0, spawn: [{ id: 'artillery', count: 2, formation: 'line' }] }],
    });
    run(world, 200, w => { w.input.firePrimary = true; w.input.aimX = 900; w.input.aimY = w.player.y; });
    assert.notEqual(world.state, 'playing', 'the encounter never resolved');
  });
});

describe('simulation — entities', () => {
  it('culls bullets that leave the field', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 1, w => { w.input.firePrimary = true; w.input.aimX = 5000; });
    run(world, 6);
    assert.lessOrEqual(world.bullets.length, 40, 'bullets are accumulating');
  });

  it('holds the drone wing to a fixed size and lets it expire', () => {
    // Drones expired, but nothing stopped you launching more over the top of
    // the last batch: held down, a drone weapon settled into a dozen homing
    // guns that never missed.
    const { world, ship } = makeWorld({
      id: 'drone_test', name: 'Drone Test', type: 'combat',
      objective: { kind: 'survive', seconds: 90 },
      waves: [{ at: 0, spawn: [{ id: 'picket', count: 3, formation: 'line' }] }],
    }, { threat: 6 });

    world.player.secondary = {
      name: 'Drone Swarm', behaviour: 'drone', damage: 7, rof: 0.22, energy: 0,
      count: 3, droneLife: 9, droneRof: 2, droneSpeed: 660,
    };

    let peak = 0;
    run(world, 45, w => {
      w.input.fireSecondary = true;
      peak = Math.max(peak, w.drones.filter(d => !d.dead).length);
    });
    assert.lessOrEqual(peak, 4, `the drone wing reached ${peak}`);
    assert.greater(peak, 0, 'drones should actually launch');

    // And they are temporary: stop launching and the wing empties.
    world.input.fireSecondary = false;
    run(world, 14);
    assert.equal(world.drones.filter(d => !d.dead).length, 0,
      'drones must expire rather than escort you for the rest of the fight');
    assert.ok(ship);
  });

  it('does not leak entities over a long fight', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'combat',
      objective: { kind: 'survive', seconds: 40 },
      waves: [
        { at: 0, spawn: [{ budget: 1, pool: ['picket', 'wasp', 'gunship'], formation: 'random' }] },
        { at: 15, spawn: [{ budget: 1, pool: ['interceptor', 'lancer'], formation: 'arc' }] },
      ],
    });
    run(world, 40, w => { w.input.firePrimary = true; });
    const total = world.enemies.length + world.bullets.length + world.eBullets.length
      + world.pickups.length + world.obstacles.length + world.effects.length;
    assert.lessOrEqual(total, 700, `entity count ran away: ${total}`);
  });

  it('collects a pickup that reaches the player', () => {
    const { world } = makeWorld(SKIRMISH);
    world.player.hull = 10;
    dropPickup(world, world.player.x + 5, world.player.y, 'repair', 40);
    run(world, 1);
    assert.greater(world.player.hull, 10);
  });

  it('spawns obstacles for an asteroid encounter', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'asteroid',
      objective: { kind: 'survive', seconds: 5 },
      obstacles: { count: 14, speed: 120 },
      waves: [],
    });
    assert.equal(world.obstacles.length, 14);
    run(world, 3);
    assert.ok(world.obstacles.every(o => Number.isFinite(o.x)), 'obstacle position went NaN');
  });

  it('scales spawned adds down from their parent', () => {
    const { world } = makeWorld({
      id: 't', name: 'T', type: 'combat',
      objective: { kind: 'clear' },
      waves: [{ at: 0, spawn: [{ id: 'drone_carrier', count: 1 }] }],
    }, { threat: 8 });
    run(world, 14);
    const adds = world.enemies.filter(e => e.id === 'picket');
    assert.greater(adds.length, 0, 'the tender never launched anything');
    // An add at full strength turns a carrier fight into a stalemate.
    assert.ok(adds[0].maxHull < world.enemies.find(e => e.id === 'drone_carrier').maxHull);
  });

  it('emits events the renderer can consume', () => {
    const { world } = makeWorld(SKIRMISH);
    for (let i = 0; i < 120; i++) {
      world.input.firePrimary = true;
      world.input.aimX = 900; world.input.aimY = world.player.y;
      update(world, DT);
    }
    const events = drainEvents(world);
    assert.greater(events.length, 0);
    assert.ok(events.every(e => typeof e.type === 'string'), 'every event needs a type');
    assert.equal(drainEvents(world).length, 0, 'draining twice should yield nothing');
  });

  it('caps the event queue when nothing is draining it', () => {
    const { world } = makeWorld(SKIRMISH);
    run(world, 20, w => { w.input.firePrimary = true; });
    assert.lessOrEqual(world.events.length, 400);
  });
});

describe('simulation — abilities', () => {
  const withAbility = (abilityId) => {
    const rng = new RNG('ABIL');
    const ship = S.createShip('kestrel', rng);
    ship.abilities = [{ id: abilityId, name: abilityId, icon: 'icon_star', energy: 0, cooldown: 5 }];
    return createWorld({ encounter: SKIRMISH, threat: 3, ship, rng: rng.fork('w') });
  };

  it('repairs hull', () => {
    const world = withAbility('repair_pulse');
    world.player.hull = 20;
    world.input.abilities[0] = true;
    update(world, DT);
    assert.greater(world.player.hull, 20);
  });

  it('clears nearby enemy fire', () => {
    const world = withAbility('emp_burst');
    run(world, 4, w => { w.input.moveX = 0.6; });
    world.eBullets.push({
      x: world.player.x + 10, y: world.player.y, vx: 0, vy: 0,
      r: 4, damage: 5, life: 5, delay: 0, dead: false, sprite: 'eb_bolt',
    });
    const target = world.eBullets[world.eBullets.length - 1];
    world.input.abilities[0] = true;
    update(world, DT);
    assert.equal(target.dead, true, 'a bullet inside the blast should be cleared');
  });

  it('grants invulnerability', () => {
    const world = withAbility('phase_shift');
    world.input.abilities[0] = true;
    update(world, DT);
    assert.greater(world.player.invuln, 1);
  });

  it('goes on cooldown after use', () => {
    const world = withAbility('nova');
    world.input.abilities[0] = true;
    update(world, DT);
    assert.greater(world.player.abilities[0].timer, 0);
    assert.equal(world.stats.abilitiesUsed, 1);
    update(world, DT);
    assert.equal(world.stats.abilitiesUsed, 1, 'should not re-fire while cooling down');
  });
});
