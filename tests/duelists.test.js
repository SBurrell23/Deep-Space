import { describe, it, assert } from './harness.js';
import { DUELISTS, DUELIST_SOURCES, DUEL_BANDS, DUEL_ROLES } from '../src/game/duelists/index.js';
import { DUEL_ABILITIES, DUEL_ABILITY_IDS } from '../src/game/duel-abilities.js';
import { DUEL_MOVEMENTS, DUEL_MOVEMENT_IDS } from '../src/game/duel-ai.js';
import { MOVEMENTS, FIRE_PATTERNS } from '../src/game/patterns.js';
import { PART_SETS, PALETTE_IDS, PART_ORDER } from '../src/ui/art-compose.js';
import { DUEL_ENCOUNTERS } from '../src/game/encounters/duels.js';
import { ENEMIES } from '../src/game/enemies.js';
import { createWorld, update, damageEnemy } from '../src/game/sim.js';
import { RNG } from '../src/core/rng.js';
import { createShip } from '../src/game/ship.js';
import { DUEL_TUNING } from '../src/game/balance.js';

const DT = 1 / 60;

/** A fight that runs for `seconds` with nobody at the controls. */
function runFight(encounter, threat, seconds, seed = 'T') {
  const rng = new RNG(`${encounter.id}-${seed}`);
  const ship = createShip('kestrel', rng.fork('ship'));
  const world = createWorld({ encounter, threat, ship, rng: rng.fork('world') });
  // The pilot is not the subject here: an immortal, motionless target keeps a
  // ship's own behaviour — where it flies, what it fires, what it casts — from
  // being masked by whether a bot happened to survive it.
  for (let i = 0; i < seconds * 60; i++) {
    world.player.hull = world.player.maxHull;
    world.player.shield = world.player.maxShield;
    world.player.energy = world.player.maxEnergy;
    update(world, DT);
    world.events.length = 0;
    if (world.state !== 'playing') break;
  }
  return world;
}

describe('duelists — the roster', () => {
  it('has a hundred of them, with unique ids', () => {
    assert.equal(DUELISTS.length, 100);
    assert.equal(new Set(DUELISTS.map(d => d.id)).size, 100);
  });

  it('registers every one as an enemy archetype', () => {
    for (const d of DUELISTS) assert.equal(ENEMIES[d.id], d, `${d.id} is not in the enemy table`);
  });

  it('is two thirds single ships, as designed', () => {
    const single = DUELISTS.filter(d => d.duel.squadron === 1).length;
    assert.ok(single >= 60 && single <= 72, `${single} of 100 are a single ship`);
    for (const d of DUELISTS) {
      assert.ok(d.duel.squadron >= 1 && d.duel.squadron <= 5, `${d.id} flies ${d.duel.squadron} bodies`);
    }
  });

  it('covers every threat level with something to fight', () => {
    for (let t = 1; t <= 20; t++) {
      const n = DUELISTS.filter(d => t >= d.duel.minThreat && t <= d.duel.maxThreat).length;
      assert.greater(n, 20, `threat ${t} has only ${n} opponents`);
    }
  });

  it('names a real brain, fire pattern and band for each', () => {
    for (const d of DUELISTS) {
      assert.ok(MOVEMENTS[d.move], `${d.id} has unknown brain "${d.move}"`);
      assert.ok(FIRE_PATTERNS[d.fire], `${d.id} has unknown fire pattern "${d.fire}"`);
      assert.ok(DUEL_BANDS[d.duel.band], `${d.id} has unknown band "${d.duel.band}"`);
      assert.ok(DUEL_ROLES.includes(d.duel.role), `${d.id} has unknown role "${d.duel.role}"`);
    }
  });

  it('carries between one and four real abilities', () => {
    for (const d of DUELISTS) {
      const ab = d.duel.abilities;
      assert.ok(ab.length >= 1 && ab.length <= 4, `${d.id} carries ${ab.length} abilities`);
      assert.equal(new Set(ab).size, ab.length, `${d.id} lists an ability twice`);
      for (const id of ab) assert.ok(DUEL_ABILITIES[id], `${d.id} has unknown ability "${id}"`);
      // Several bodies each running four moves is unreadable, whatever the
      // numbers say.
      if (d.duel.squadron > 1) assert.ok(ab.length <= 2, `${d.id} flies ${d.duel.squadron} bodies with ${ab.length} abilities`);
    }
  });

  it('names a real part in every art slot', () => {
    for (const d of DUELISTS) {
      for (const slot of PART_ORDER) {
        const id = d.duel.art[slot];
        assert.ok(PART_SETS[slot][id], `${d.id} has unknown ${slot} "${id}"`);
      }
      assert.ok(PALETTE_IDS.includes(d.duel.art.pal), `${d.id} has unknown palette "${d.duel.art.pal}"`);
    }
  });

  it('writes the bestiary text every ship needs', () => {
    for (const src of DUELIST_SOURCES) {
      for (const field of ['name', 'faction', 'strategy', 'blurb', 'intro']) {
        assert.ok(src[field] && src[field].length > 3, `${src.id} has no ${field}`);
      }
      assert.ok(src.strategy.length > 25, `${src.id}'s strategy line says nothing useful`);
      for (const field of ['blurb', 'intro', 'strategy']) {
        assert.ok(!src[field].includes('!'), `${src.id}'s ${field} shouts`);
      }
    }
  });

  it('never writes a number the loader is supposed to compute', () => {
    for (const src of DUELIST_SOURCES) {
      for (const field of ['hull', 'shield', 'xp', 'credits', 'cost']) {
        assert.equal(src[field], undefined, `${src.id} hardcodes ${field}`);
      }
    }
  });

  it('gives every one a hull pool inside a factor of two of the others', () => {
    const pools = DUELISTS.map(d => d.duel.pool);
    const lo = Math.min(...pools), hi = Math.max(...pools);
    // A hundred fights that should each take about the same time cannot have
    // one opponent three times another's size; that is not variety, it is one
    // node that takes three minutes.
    assert.ok(hi / lo < 2, `pools run from ${lo} to ${hi}`);
  });
});

describe('duelists — the abilities', () => {
  it('implements the whole vocabulary and nothing else', () => {
    assert.equal(DUEL_ABILITY_IDS.length, 32);
    for (const [id, ab] of Object.entries(DUEL_ABILITIES)) {
      assert.equal(ab.id, id, `${id} disagrees with its own id`);
      assert.ok(typeof ab.use === 'function', `${id} has no effect`);
      assert.ok(ab.name && ab.desc && ab.tell, `${id} has no bestiary text`);
    }
  });

  it('telegraphs everything, on a cooldown a player can learn', () => {
    for (const ab of Object.values(DUEL_ABILITIES)) {
      // The whole design rests on this: the player is meant to dodge every
      // attack, which is only fair if every attack is announced.
      assert.ok(ab.windup >= 0.5, `${ab.id} winds up for only ${ab.windup}s`);
      assert.ok(ab.cooldown >= 5 && ab.cooldown <= 16, `${ab.id} cools down in ${ab.cooldown}s`);
    }
  });

  it('limits anything that adds bodies to the field', () => {
    for (const ab of Object.values(DUEL_ABILITIES)) {
      if (!ab.tags.includes('summon')) continue;
      assert.ok(Number.isFinite(ab.charges), `${ab.id} can summon forever`);
    }
  });

  it('is used at least once across the roster', () => {
    const used = new Set(DUELISTS.flatMap(d => d.duel.abilities));
    const unused = DUEL_ABILITY_IDS.filter(id => !used.has(id));
    assert.equal(unused.length, 0, `never used by anyone: ${unused.join(', ')}`);
  });

  it('casts every one of the thirty-two without throwing', () => {
    // Each ability is put on a real ship in a real world and actually fired,
    // rather than checked against a stub. Half of these reach into zones,
    // beams, summons and the player's own state; a stub would agree with
    // whatever the ability did.
    const probe = DUELISTS[0];
    for (const id of DUEL_ABILITY_IDS) {
      const encounter = {
        ...DUEL_ENCOUNTERS.find(e => e.duelist === probe.id),
        id: `probe_${id}`,
      };
      const rng = new RNG(`ability-${id}`);
      const ship = createShip('kestrel', rng.fork('ship'));
      const world = createWorld({ encounter, threat: 8, ship, rng: rng.fork('w') });
      update(world, DT);
      for (let i = 0; i < 60; i++) update(world, DT);
      const e = world.enemies[0];
      assert.ok(e, `${id}: nothing spawned to cast it`);
      e.abilities = [{ def: DUEL_ABILITIES[id], timer: 0, uses: 9, casting: 0, castFor: 0 }];
      e.abilityLock = 0;
      // Long enough for the wind-up to elapse and the effect to resolve.
      for (let i = 0; i < 300 && world.state === 'playing'; i++) {
        world.player.hull = world.player.maxHull;
        update(world, DT);
      }
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${id} left the caster at ${e.x},${e.y}`);
    }
  });
});

describe('duelists — the brains', () => {
  it('implements sixteen, all reachable from the movement table', () => {
    assert.equal(DUEL_MOVEMENT_IDS.length, 16);
    for (const id of DUEL_MOVEMENT_IDS) {
      assert.equal(MOVEMENTS[id], DUEL_MOVEMENTS[id], `${id} is not merged into MOVEMENTS`);
    }
  });

  it('is used at least once across the roster', () => {
    const used = new Set(DUELISTS.map(d => d.move));
    const unused = DUEL_MOVEMENT_IDS.filter(id => !used.has(id));
    assert.equal(unused.length, 0, `never used by anyone: ${unused.join(', ')}`);
  });
});

describe('duelists — every one is a working fight', () => {
  const encounters = DUEL_ENCOUNTERS;

  it('generates one encounter per ship', () => {
    assert.equal(encounters.length, 100);
    for (const e of encounters) {
      assert.equal(e.type, 'hostiles');
      assert.equal(e.objective.kind, 'destroy');
      assert.equal(e.objective.tag, 'duelist');
    }
  });

  it('spawns, stays on the field and shoots — all hundred of them', () => {
    for (const enc of encounters) {
      const d = DUELISTS.find(x => x.id === enc.duelist);
      const threat = Math.round((d.duel.minThreat + d.duel.maxThreat) / 2);
      const world = runFight(enc, threat, 14);

      const tagged = world.enemies.filter(e => e.tag === 'duelist' && !e.dead);
      assert.equal(tagged.length, d.duel.squadron,
        `${d.id} put ${tagged.length} bodies on the field, expected ${d.duel.squadron}`);

      for (const e of tagged) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${d.id} has a NaN position`);
        assert.ok(Number.isFinite(e.vx) && Number.isFinite(e.vy), `${d.id} has a NaN velocity`);
        // Off the field is the one unrecoverable outcome: the objective is to
        // destroy it, and a ship the player cannot reach ends the run.
        assert.ok(e.x > -80 && e.x < world.w + 80, `${d.id} flew to x=${Math.round(e.x)}`);
        assert.ok(e.y > -80 && e.y < world.h + 80, `${d.id} flew to y=${Math.round(e.y)}`);
        assert.ok(e.hull > 0, `${d.id} died to nothing`);
      }
      assert.ok(world.state === 'playing', `${d.id} resolved itself in 14 seconds`);
    }
  });

  it('can be killed, and killing it wins the node — all hundred', () => {
    for (const enc of encounters) {
      const d = DUELISTS.find(x => x.id === enc.duelist);
      const rng = new RNG(`kill-${enc.id}`);
      const ship = createShip('kestrel', rng.fork('ship'));
      const world = createWorld({ encounter: enc, threat: 5, ship, rng: rng.fork('w') });
      // Let the whole squadron arrive before shooting at it.
      for (let i = 0; i < 120; i++) update(world, DT);

      // Killed through the real damage path rather than by zeroing `hull`, so
      // the objective, the payout, the drops and anything that fires on death
      // all run. Phasing and reflecting are cleared first: this asks whether
      // the node CAN be finished, not whether it is easy.
      for (let i = 0; i < 1200 && world.state === 'playing'; i++) {
        world.player.hull = world.player.maxHull;
        for (const e of world.enemies) {
          if (e.dead || e.tag !== 'duelist') continue;
          e.invulnTimer = 0;
          e.reflectTimer = 0;
          damageEnemy(world, e, 1e9);
        }
        update(world, DT);
      }
      assert.equal(world.state, 'won', `${d.id} could not be finished`);
      assert.ok(world.stats.xpEarned > 0, `${d.id} paid nothing`);
    }
  });

  it('pays a comparable amount whatever shape the opponent is', () => {
    const totals = DUELISTS.map(d => d.xp * d.duel.squadron);
    const lo = Math.min(...totals), hi = Math.max(...totals);
    assert.ok(hi - lo <= 3, `a duel pays between ${lo} and ${hi} xp`);
    assert.ok(lo >= DUEL_TUNING.xpBase - 4, 'a duel pays less than the tuning says');
  });
});
