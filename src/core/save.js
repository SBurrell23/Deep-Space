/**
 * Persistence.
 *
 * Two records in localStorage:
 *   - the PROFILE, which survives everything: achievements, unlocks, lifetime
 *     stats and run history.
 *   - the RUN, an in-progress game. Deleted permanently on death — the run is
 *     gone for good, which is the whole point.
 *
 * Every read is defensive. A corrupt or half-written record must degrade to a
 * fresh profile rather than a white screen.
 */

export const SAVE_VERSION = 2;

const PROFILE_KEY = 'deepspace.profile.v2';
const RUN_KEY = 'deepspace.run.v2';
/** v1 belonged to the ship-management game; its shape is unrelated. */
const LEGACY_KEYS = ['deepspace.profile.v1', 'deepspace.run.v1'];

export const DEFAULT_PROFILE = {
  version: SAVE_VERSION,
  created: 0,
  achievements: {},
  stats: {
    runs: 0, wins: 0, losses: 0,
    totalKills: 0, totalNodes: 0, totalCredits: 0, playtime: 0,
    bestRing: 0, bestLevel: 1, bestNodes: 0,
    fastestWin: null,
  },
  history: [],
  lastShip: 'kestrel',
};

function storageAvailable() {
  try {
    const k = '__ds_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const canPersist = storageAvailable;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function loadProfile() {
  const fresh = () => ({
    ...structuredCopy(DEFAULT_PROFILE),
    created: Date.now(),
  });
  if (!storageAvailable()) return fresh();

  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return fresh();

    // Merge onto the defaults so a profile written by an older build gains any
    // new fields instead of leaving them undefined all over the UI.
    const profile = {
      ...structuredCopy(DEFAULT_PROFILE),
      ...data,
      stats: { ...DEFAULT_PROFILE.stats, ...(data.stats || {}) },
      achievements: data.achievements && typeof data.achievements === 'object' ? data.achievements : {},
      history: Array.isArray(data.history) ? data.history.slice(0, 30) : [],
      version: SAVE_VERSION,
    };
    return profile;
  } catch {
    return fresh();
  }
}

export function saveProfile(profile) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function resetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(RUN_KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch { /* nothing we can do */ }
  return loadProfile();
}

/**
 * Fold a finished run into the profile. Called on both victory and death, so
 * a lost run still counts toward lifetime totals and unlock progress.
 */
export function recordRunResult(profile, run, outcome) {
  const s = run.stats;
  const st = profile.stats;

  st.runs++;
  if (outcome === 'victory') st.wins++;
  else st.losses++;

  st.totalKills += s.kills;
  st.totalNodes += s.nodesCleared;
  st.totalCredits += s.creditsEarned;
  st.playtime += run.elapsed;
  st.bestRing = Math.max(st.bestRing, s.deepestRing);
  st.bestLevel = Math.max(st.bestLevel, run.ship.progress.level);
  st.bestNodes = Math.max(st.bestNodes, s.nodesCleared);
  if (outcome === 'victory' && (st.fastestWin == null || run.elapsed < st.fastestWin)) {
    st.fastestWin = run.elapsed;
  }

  profile.lastShip = run.ship.shipId;
  profile.history.unshift({
    at: Date.now(),
    outcome,
    shipId: run.ship.shipId,
    shipName: run.ship.name,
    level: run.ship.progress.level,
    ring: s.deepestRing,
    nodes: s.nodesCleared,
    kills: s.kills,
    elapsed: Math.round(run.elapsed),
    seed: run.seed,
    score: runScore(run, outcome),
  });
  profile.history = profile.history.slice(0, 30);

  saveProfile(profile);
  return profile;
}

/** A single comparable number for the records screen. */
export function runScore(run, outcome) {
  const s = run.stats;
  return Math.round(
    s.nodesCleared * 25
    + s.deepestRing * 140
    + run.ship.progress.level * 90
    + s.kills * 2
    + s.bossesKilled * 200
    + s.perfectClears * 40
    + (outcome === 'victory' ? 4000 : 0));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function saveRun(serialized) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), run: serialized }));
    return true;
  } catch {
    return false;
  }
}

export function loadRun() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION || !data.run) return null;
    return data.run;
  } catch {
    return null;
  }
}

export function hasSavedRun() { return loadRun() !== null; }

/** Permanent. Called on death — there is no recovering a lost run. */
export function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ }
}

/** A short description for the title screen's Continue button. */
export function savedRunSummary() {
  const run = loadRun();
  if (!run) return null;
  try {
    return {
      shipId: run.ship.shipId,
      level: run.ship.progress.level,
      hull: Math.round(run.ship.hull),
      nodes: run.stats?.nodesCleared || 0,
      ring: run.stats?.deepestRing || 0,
      elapsed: Math.round(run.elapsed || 0),
      seed: run.seed,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function storageFootprint() {
  if (!storageAvailable()) return { bytes: 0, available: false };
  let bytes = 0;
  for (const k of [PROFILE_KEY, RUN_KEY]) {
    bytes += (localStorage.getItem(k) || '').length;
  }
  return { bytes, available: true };
}

/** Remove records from the previous game so they don't sit in storage forever. */
export function purgeLegacy() {
  let removed = 0;
  try {
    for (const k of LEGACY_KEYS) {
      if (localStorage.getItem(k) != null) { localStorage.removeItem(k); removed++; }
    }
  } catch { /* ignore */ }
  return removed;
}

function structuredCopy(v) { return JSON.parse(JSON.stringify(v)); }

export const KEYS = { PROFILE_KEY, RUN_KEY };
