/**
 * Persistence.
 *
 * Two independent stores:
 *  - the PROFILE: unlocks, achievements, lifetime stats, high scores. Never
 *    cleared by losing a run.
 *  - the RUN: the in-progress game, written on every jump so a closed tab
 *    doesn't cost progress.
 *
 * Both are versioned and defensively parsed — a corrupt or half-written entry
 * must degrade to "no save" rather than breaking the menu.
 */

const PROFILE_KEY = 'deepspace.profile.v1';
const RUN_KEY = 'deepspace.run.v1';
export const SAVE_VERSION = 1;

export const DEFAULT_PROFILE = {
  version: SAVE_VERSION,
  unlockedShips: { kestrel: ['A'] },
  achievements: {},          // id -> { at: timestamp, ship }
  shipAchievements: {},      // shipId -> { id: true }
  stats: {
    runs: 0, wins: 0, deaths: 0,
    beaconsVisited: 0, shipsDestroyed: 0, crewLost: 0, crewHired: 0,
    scrapEarned: 0, jumps: 0, sectorsCleared: 0, bossKills: 0,
    playSeconds: 0, fastestWinSeconds: null, highScore: 0,
  },
  history: [],               // last 20 runs, newest first
  settings: { showTutorialHints: true, confirmJump: true, autofireDefault: true },
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : fallback;
  } catch {
    return fallback;
  }
}

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
  const stored = safeParse(localStorage.getItem(PROFILE_KEY), null);
  if (!stored) return structuredCopy(DEFAULT_PROFILE);
  return migrateProfile(stored);
}

function migrateProfile(stored) {
  const p = structuredCopy(DEFAULT_PROFILE);
  // Merge field by field so a save written by an older build keeps what it has
  // and gains anything new, instead of being thrown away.
  p.unlockedShips = { ...p.unlockedShips, ...(stored.unlockedShips || {}) };
  for (const [ship, variants] of Object.entries(p.unlockedShips)) {
    p.unlockedShips[ship] = Array.isArray(variants) ? [...new Set(variants)] : ['A'];
  }
  p.achievements = { ...(stored.achievements || {}) };
  p.shipAchievements = { ...(stored.shipAchievements || {}) };
  p.stats = { ...p.stats, ...(stored.stats || {}) };
  p.history = Array.isArray(stored.history) ? stored.history.slice(0, 20) : [];
  p.settings = { ...p.settings, ...(stored.settings || {}) };
  p.version = SAVE_VERSION;
  return p;
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function resetProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* nothing to do */ }
  return structuredCopy(DEFAULT_PROFILE);
}

/** Record a finished run on the profile and return the updated profile. */
export function recordRunResult(profile, result) {
  const p = profile;
  p.stats.runs++;
  if (result.won) p.stats.wins++; else p.stats.deaths++;
  p.stats.beaconsVisited += result.beacons || 0;
  p.stats.shipsDestroyed += result.shipsDestroyed || 0;
  p.stats.crewLost += result.crewLost || 0;
  p.stats.scrapEarned += result.scrapEarned || 0;
  p.stats.jumps += result.jumps || 0;
  p.stats.sectorsCleared += result.sector || 0;
  p.stats.playSeconds += Math.round(result.seconds || 0);
  if (result.won) {
    p.stats.bossKills++;
    if (p.stats.fastestWinSeconds == null || result.seconds < p.stats.fastestWinSeconds) {
      p.stats.fastestWinSeconds = Math.round(result.seconds);
    }
  }
  if ((result.score || 0) > (p.stats.highScore || 0)) p.stats.highScore = result.score;

  p.history.unshift({
    at: Date.now(),
    ship: result.shipId, variant: result.variant, shipName: result.shipName,
    won: !!result.won, sector: result.sector, score: result.score,
    seconds: Math.round(result.seconds || 0), cause: result.cause || null,
    seed: result.seed || null,
  });
  p.history = p.history.slice(0, 20);
  return p;
}

export function unlockShip(profile, shipId, variant = 'A') {
  if (!profile.unlockedShips[shipId]) profile.unlockedShips[shipId] = [];
  if (!profile.unlockedShips[shipId].includes(variant)) {
    profile.unlockedShips[shipId].push(variant);
    return true;
  }
  return false;
}

export function isShipUnlocked(profile, shipId, variant = 'A') {
  return !!profile.unlockedShips[shipId]?.includes(variant);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function saveRun(run) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), run }));
    return true;
  } catch {
    // Quota exceeded, most likely. Drop the old save so we aren't left with a
    // stale one that no longer matches the player's progress.
    try { localStorage.removeItem(RUN_KEY); } catch { /* give up quietly */ }
    return false;
  }
}

export function loadRun() {
  const stored = safeParse(localStorage.getItem(RUN_KEY), null);
  if (!stored || !stored.run) return null;
  if (stored.version !== SAVE_VERSION) return null;
  // Sanity check: a save missing its ship is unusable.
  if (!stored.run.ship || !stored.run.ship.shipId) return null;
  return stored.run;
}

export function hasSavedRun() { return loadRun() !== null; }

export function clearRun() {
  try { localStorage.removeItem(RUN_KEY); return true; } catch { return false; }
}

export function savedRunSummary() {
  const stored = safeParse(localStorage.getItem(RUN_KEY), null);
  if (!stored || !stored.run) return null;
  const r = stored.run;
  return {
    savedAt: stored.savedAt,
    shipName: r.ship?.name || 'Unknown',
    shipId: r.ship?.shipId,
    sector: (r.sectorIndex ?? 0) + 1,
    hull: r.ship?.hull, maxHull: r.ship?.maxHull,
    scrap: r.scrap,
  };
}

// ---------------------------------------------------------------------------

function structuredCopy(o) { return JSON.parse(JSON.stringify(o)); }

/** Approximate bytes used by Deep Space in localStorage. */
export function storageFootprint() {
  let bytes = 0;
  try {
    for (const key of [PROFILE_KEY, RUN_KEY, 'deepspace.audio.v1']) {
      const v = localStorage.getItem(key);
      if (v) bytes += key.length + v.length;
    }
  } catch { /* unavailable */ }
  return bytes;
}

export const KEYS = { PROFILE_KEY, RUN_KEY };
