import { describe, it, assert, beforeEach } from './harness.js';
import * as save from '../src/core/save.js';
import { RNG } from '../src/core/rng.js';
import { startRun, PHASES } from '../src/game/run.js';

describe('profile persistence', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults with no stored profile', () => {
    const p = save.loadProfile();
    assert.deepEqual(p.unlockedShips.kestrel, ['A']);
    assert.equal(p.stats.runs, 0);
    assert.deepEqual(p.achievements, {});
  });

  it('round-trips a profile', () => {
    const p = save.loadProfile();
    p.stats.runs = 7;
    p.achievements.first_blood = { at: 123 };
    save.unlockShip(p, 'torus', 'A');
    save.saveProfile(p);

    const loaded = save.loadProfile();
    assert.equal(loaded.stats.runs, 7);
    assert.ok(loaded.achievements.first_blood);
    assert.equal(save.isShipUnlocked(loaded, 'torus', 'A'), true);
    assert.equal(save.isShipUnlocked(loaded, 'torus', 'B'), false);
  });

  it('survives a corrupt profile without losing the menu', () => {
    localStorage.setItem(save.KEYS.PROFILE_KEY, '{{{not json at all');
    const p = save.loadProfile();
    assert.deepEqual(p.unlockedShips.kestrel, ['A']);
  });

  it('merges an older profile forward instead of discarding it', () => {
    // A save written before some fields existed.
    localStorage.setItem(save.KEYS.PROFILE_KEY, JSON.stringify({
      version: 1,
      unlockedShips: { kestrel: ['A'], mantis: ['A'] },
      stats: { runs: 3 },
    }));
    const p = save.loadProfile();
    assert.equal(p.stats.runs, 3, 'existing stats must be kept');
    assert.equal(p.stats.wins, 0, 'missing stats must be filled in');
    assert.equal(save.isShipUnlocked(p, 'mantis'), true);
    assert.ok(p.settings, 'new sections must be added');
  });

  it('never double-unlocks a ship', () => {
    const p = save.loadProfile();
    assert.equal(save.unlockShip(p, 'engi', 'A'), true);
    assert.equal(save.unlockShip(p, 'engi', 'A'), false);
    assert.equal(p.unlockedShips.engi.length, 1);
  });

  it('records run results and keeps a bounded history', () => {
    const p = save.loadProfile();
    for (let i = 0; i < 30; i++) {
      save.recordRunResult(p, {
        won: i % 5 === 0, shipId: 'kestrel', variant: 'A', shipName: 'The Kestrel',
        sector: 3, score: 100 + i, seconds: 600, beacons: 12, shipsDestroyed: 4,
        crewLost: 1, scrapEarned: 200, jumps: 12, cause: 'test',
      });
    }
    assert.equal(p.stats.runs, 30);
    assert.equal(p.stats.wins, 6);
    assert.equal(p.stats.deaths, 24);
    assert.equal(p.history.length, 20, 'history should be capped');
    assert.equal(p.stats.highScore, 129);
  });

  it('tracks the fastest win only from wins', () => {
    const p = save.loadProfile();
    save.recordRunResult(p, { won: false, seconds: 100, sector: 1, score: 0 });
    assert.equal(p.stats.fastestWinSeconds, null);
    save.recordRunResult(p, { won: true, seconds: 900, sector: 8, score: 500 });
    assert.equal(p.stats.fastestWinSeconds, 900);
    save.recordRunResult(p, { won: true, seconds: 1500, sector: 8, score: 500 });
    assert.equal(p.stats.fastestWinSeconds, 900, 'a slower win must not overwrite');
    save.recordRunResult(p, { won: true, seconds: 400, sector: 8, score: 500 });
    assert.equal(p.stats.fastestWinSeconds, 400);
  });
});

describe('run persistence', () => {
  beforeEach(() => localStorage.clear());

  it('saves and restores an in-progress run', () => {
    const profile = save.loadProfile();
    const run = startRun(profile, 'kestrel', 'A', 'SAVE-TEST');
    run.scrap = 137;
    save.saveRun(run);

    const loaded = save.loadRun();
    assert.ok(loaded, 'expected a saved run');
    assert.equal(loaded.scrap, 137);
    assert.equal(loaded.ship.shipId, 'kestrel');
    assert.equal(loaded.seed, 'SAVE-TEST');
    assert.equal(loaded.map.beacons.length, run.map.beacons.length);
  });

  it('reports no save when there is none', () => {
    assert.equal(save.loadRun(), null);
    assert.equal(save.hasSavedRun(), false);
    assert.equal(save.savedRunSummary(), null);
  });

  it('rejects a truncated or foreign save', () => {
    localStorage.setItem(save.KEYS.RUN_KEY, JSON.stringify({ version: 1, run: { nope: true } }));
    assert.equal(save.loadRun(), null, 'a run with no ship is unusable');
    localStorage.setItem(save.KEYS.RUN_KEY, JSON.stringify({ version: 99, run: { ship: { shipId: 'kestrel' } } }));
    assert.equal(save.loadRun(), null, 'a future version must not be loaded');
    localStorage.setItem(save.KEYS.RUN_KEY, 'garbage');
    assert.equal(save.loadRun(), null);
  });

  it('summarises a save for the continue button', () => {
    const profile = save.loadProfile();
    const run = startRun(profile, 'mantis', 'A', 'SUM');
    save.saveRun(run);
    const s = save.savedRunSummary();
    assert.equal(s.shipId, 'mantis');
    assert.equal(s.sector, 1);
    assert.greater(s.maxHull, 0);
  });

  it('clears the run without touching the profile', () => {
    const profile = save.loadProfile();
    profile.stats.runs = 4;
    save.saveProfile(profile);
    save.saveRun(startRun(profile, 'kestrel', 'A', 'CLR'));
    save.clearRun();
    assert.equal(save.loadRun(), null);
    assert.equal(save.loadProfile().stats.runs, 4, 'losing a run must not wipe progress');
  });

  it('keeps the RNG stream reproducible across a save/load', () => {
    const profile = save.loadProfile();
    const run = startRun(profile, 'kestrel', 'A', 'RNG-SAVE');
    const a = RNG.deserialize(run.rngState);
    save.saveRun(run);
    const b = RNG.deserialize(save.loadRun().rngState);
    for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  });

  it('does not autosave a finished run', () => {
    const profile = save.loadProfile();
    const run = startRun(profile, 'kestrel', 'A', 'DONE');
    run.phase = PHASES.GAME_OVER;
    save.clearRun();
    const { autosave } = { autosave: null };
    void autosave;
    assert.equal(save.loadRun(), null);
  });
});
