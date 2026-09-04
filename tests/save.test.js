import { describe, it, assert } from './harness.js';
import * as save from '../src/core/save.js';
import { unlockedShips, STARTER_SHIP, SHIP_IDS } from '../src/game/ships.js';
import { ACHIEVEMENTS } from '../src/game/achievements.js';

/** A minimal run-shaped object, enough for recordRunResult. */
function fakeRun(overrides = {}) {
  return {
    seed: 'TEST-0001',
    elapsed: 1800,
    ship: {
      shipId: 'kestrel',
      name: 'The Kestrel',
      progress: { level: 9, xp: 0, unspentPoints: 0, attributes: {} },
    },
    stats: {
      kills: 120, nodesCleared: 22, creditsEarned: 900, deepestRing: 6,
      bossesKilled: 2, perfectClears: 3,
    },
    ...overrides,
  };
}

describe('profile persistence', () => {
  it('returns a usable default with no stored profile', () => {
    localStorage.clear();
    const p = save.loadProfile();
    assert.equal(p.version, save.SAVE_VERSION);
    assert.deepEqual(p.achievements, {});
    assert.equal(p.stats.runs, 0);
    assert.equal(p.stats.wins, 0);
    assert.deepEqual(p.history, []);
    assert.deepEqual(unlockedShips(p), [STARTER_SHIP], 'only the starter hull on a fresh profile');
  });

  it('round-trips a profile', () => {
    localStorage.clear();
    const p = save.loadProfile();
    p.achievements.first_blood = Date.now();
    p.stats.wins = 2;
    p.lastShip = 'mantis';
    save.saveProfile(p);

    const loaded = save.loadProfile();
    assert.ok(loaded.achievements.first_blood);
    assert.equal(loaded.stats.wins, 2);
    assert.equal(loaded.lastShip, 'mantis');
  });

  it('survives a corrupt profile without losing the menu', () => {
    localStorage.setItem(save.KEYS.PROFILE_KEY, '{ not json at all');
    const p = save.loadProfile();
    assert.equal(p.stats.runs, 0);
    assert.deepEqual(unlockedShips(p), [STARTER_SHIP]);
  });

  it('survives a profile that is valid JSON but the wrong shape', () => {
    localStorage.setItem(save.KEYS.PROFILE_KEY, '[1,2,3]');
    const p = save.loadProfile();
    assert.ok(p.stats, 'stats must exist even from nonsense');
    assert.deepEqual(p.achievements, {});
  });

  it('merges an older profile forward instead of discarding it', () => {
    // A profile written by an earlier build is missing fields the UI reads;
    // dropping it would silently wipe someone's unlocks.
    localStorage.setItem(save.KEYS.PROFILE_KEY, JSON.stringify({
      version: 2,
      achievements: { victory: 1 },
      stats: { runs: 5, wins: 1 },
    }));
    const p = save.loadProfile();
    assert.equal(p.stats.runs, 5, 'existing stats must survive');
    assert.equal(p.stats.totalKills, 0, 'missing stats must be filled in');
    assert.ok(p.achievements.victory, 'achievements must survive');
    assert.ok(Array.isArray(p.history));
    assert.includes(unlockedShips(p), 'torus', 'a recorded win should still unlock');
  });

  it('caps the history it keeps', () => {
    localStorage.clear();
    const p = save.loadProfile();
    for (let i = 0; i < 45; i++) save.recordRunResult(p, fakeRun(), 'death');
    assert.lessOrEqual(p.history.length, 30);
    assert.equal(p.stats.runs, 45);
    assert.equal(p.stats.losses, 45);
  });

  it('records a run into lifetime totals', () => {
    localStorage.clear();
    const p = save.loadProfile();
    save.recordRunResult(p, fakeRun(), 'victory');
    assert.equal(p.stats.runs, 1);
    assert.equal(p.stats.wins, 1);
    assert.equal(p.stats.totalKills, 120);
    assert.equal(p.stats.totalNodes, 22);
    assert.equal(p.stats.bestRing, 6);
    assert.equal(p.stats.bestLevel, 9);
    assert.equal(p.history[0].outcome, 'victory');
    assert.greater(p.history[0].score, 0);
  });

  it('tracks the fastest win only from wins', () => {
    localStorage.clear();
    const p = save.loadProfile();
    save.recordRunResult(p, fakeRun({ elapsed: 600 }), 'death');
    assert.equal(p.stats.fastestWin, null, 'a loss is not a fast win');
    save.recordRunResult(p, fakeRun({ elapsed: 3600 }), 'victory');
    assert.equal(p.stats.fastestWin, 3600);
    save.recordRunResult(p, fakeRun({ elapsed: 1800 }), 'victory');
    assert.equal(p.stats.fastestWin, 1800, 'a faster win should replace it');
    save.recordRunResult(p, fakeRun({ elapsed: 9000 }), 'victory');
    assert.equal(p.stats.fastestWin, 1800, 'a slower win must not replace it');
  });

  it('keeps best-of stats monotonic', () => {
    localStorage.clear();
    const p = save.loadProfile();
    save.recordRunResult(p, fakeRun({ stats: { ...fakeRun().stats, deepestRing: 9 } }), 'death');
    save.recordRunResult(p, fakeRun({ stats: { ...fakeRun().stats, deepestRing: 2 } }), 'death');
    assert.equal(p.stats.bestRing, 9, 'a worse run must not lower a record');
  });

  it('unlocks hulls as wins and achievements accumulate', () => {
    localStorage.clear();
    const p = save.loadProfile();
    assert.equal(unlockedShips(p).length, 1);
    p.stats.wins = 3;
    assert.greater(unlockedShips(p).length, 1);
    for (const a of ACHIEVEMENTS) p.achievements[a.id] = 1;
    assert.equal(unlockedShips(p).length, SHIP_IDS.length, 'everything should be unlockable');
  });

  it('erases everything on request', () => {
    const p = save.loadProfile();
    p.stats.wins = 7;
    save.saveProfile(p);
    save.saveRun({ seed: 'x', ship: {}, stats: {} });
    const fresh = save.resetProfile();
    assert.equal(fresh.stats.wins, 0);
    assert.equal(save.loadRun(), null, 'wiping data must also drop the run');
  });
});

describe('run persistence', () => {
  it('reports no saved run when there is none', () => {
    localStorage.clear();
    assert.equal(save.loadRun(), null);
    assert.equal(save.hasSavedRun(), false);
    assert.equal(save.savedRunSummary(), null);
  });

  it('stores and returns a run', () => {
    localStorage.clear();
    const payload = {
      seed: 'ABC-1234',
      ship: { shipId: 'engi', progress: { level: 4 }, hull: 88 },
      stats: { nodesCleared: 6, deepestRing: 3 },
      elapsed: 420,
    };
    assert.equal(save.saveRun(payload), true);
    assert.equal(save.hasSavedRun(), true);
    const summary = save.savedRunSummary();
    assert.equal(summary.shipId, 'engi');
    assert.equal(summary.level, 4);
    assert.equal(summary.nodes, 6);
    assert.equal(summary.seed, 'ABC-1234');
  });

  it('rejects a run saved by an incompatible version', () => {
    localStorage.setItem(save.KEYS.RUN_KEY, JSON.stringify({ version: 1, run: { seed: 'old' } }));
    assert.equal(save.loadRun(), null, 'a v1 record belongs to a different game');
  });

  it('survives a corrupt run record', () => {
    localStorage.setItem(save.KEYS.RUN_KEY, 'not json');
    assert.equal(save.loadRun(), null);
    assert.equal(save.savedRunSummary(), null);
  });

  it('tolerates a run record missing the fields the summary reads', () => {
    localStorage.setItem(save.KEYS.RUN_KEY,
      JSON.stringify({ version: save.SAVE_VERSION, run: { seed: 'x' } }));
    assert.equal(save.savedRunSummary(), null, 'a half-written record should not throw');
  });

  it('clears a run permanently', () => {
    save.saveRun({ seed: 'gone', ship: { shipId: 'kestrel', progress: { level: 1 }, hull: 1 }, stats: {} });
    save.clearRun();
    assert.equal(save.hasSavedRun(), false);
  });
});

describe('storage diagnostics', () => {
  it('reports a footprint', () => {
    localStorage.clear();
    save.saveProfile(save.loadProfile());
    const f = save.storageFootprint();
    assert.equal(f.available, true);
    assert.greater(f.bytes, 0);
  });

  it('purges records left by the previous game', () => {
    localStorage.setItem('deepspace.profile.v1', '{"old":true}');
    localStorage.setItem('deepspace.run.v1', '{"old":true}');
    assert.equal(save.purgeLegacy(), 2);
    assert.equal(localStorage.getItem('deepspace.profile.v1'), null);
    assert.equal(save.purgeLegacy(), 0, 'purging twice should be a no-op');
  });
});
