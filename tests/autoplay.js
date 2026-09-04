/**
 * Headless autoplayer.
 *
 * Plays complete runs with a simple but not stupid bot: it upgrades sensibly,
 * buys what it can afford, targets enemy weapons and shields, and flees when
 * it is losing badly. Used both as a soak test (does a full run ever throw or
 * deadlock?) and as a balance probe (how far does a mediocre pilot get?).
 *
 *   node tests/autoplay.js --runs 50 --ship kestrel --verbose
 */
import { installAll } from './harness.js';
installAll();

const { RNG } = await import('../src/core/rng.js');
const { DEFAULT_PROFILE } = await import('../src/core/save.js');
const run_ = await import('../src/game/run.js');
const { PHASES } = run_;
const { reachableBeacons, atExit, beaconById } = await import('../src/game/sector.js');
const { eventChoices } = run_;
const { livingCrew, isWeaponReady, toggleWeapon } = await import('../src/game/ship.js');
const { upgradeOptions } = await import('../src/game/store.js');
const { getWeapon } = await import('../src/game/weapons.js');

const MAX_STEPS = 4000;
const MAX_COMBAT_TICKS = 9000;

/** Play one run to completion. Returns a result record. */
export function playRun({ seed, shipId = 'kestrel', variant = 'A', verbose = false } = {}) {
  const profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  const rng = new RNG(`BOT-${seed}`);
  const run = run_.startRun(profile, shipId, variant, seed);
  run.profile = profile;

  const log = [];
  const say = m => { log.push(m); if (verbose) console.log('   ' + m); };

  let steps = 0;
  while (steps++ < MAX_STEPS) {
    if (run.phase === PHASES.GAME_OVER || run.phase === PHASES.VICTORY) break;

    switch (run.phase) {
      case PHASES.MAP: {
        run.ship.ftlCharge = 1; // the bot always waits for the drive

        // Final sector: fight the flagship.
        if (run.sectorTree.sectors[run.currentSectorId].isFinal) {
          run_.engageBoss(run);
          break;
        }
        if (atExit(run.map)) {
          const open = run_.openSectorChoice(run);
          if (!open.ok) { run_.endRun(run, false, 'stuck at exit'); break; }
          break;
        }
        if (run.fuel <= 0) { const d = run_.sendDistressSignal(run); if (!d.ok) { run_.endRun(run, false, 'stranded'); } break; }
        const options = reachableBeacons(run.map).filter(b => !b.fleet || run.map.beacons.every(x => x.fleet));
        const pool = options.length ? options : reachableBeacons(run.map);
        if (pool.length === 0) { run_.endRun(run, false, 'nowhere to jump'); break; }

        // Head east: take the exit or a store when adjacent, otherwise the
        // beacon that makes the most progress toward the sector exit.
        const exit = beaconById(run.map, run.map.exitId);
        const pick = pool.find(b => b.isExit)
          || pool.find(b => b.type === 'store' && !b.visited)
          || pool.slice().sort((p, q) =>
              (Math.abs(p.x - exit.x) + Math.abs(p.y - exit.y) * 0.4)
            - (Math.abs(q.x - exit.x) + Math.abs(q.y - exit.y) * 0.4))[0];
        const res = run_.jump(run, pick.id);
        if (!res.ok) { run_.endRun(run, false, 'jump failed: ' + res.reason); }
        break;
      }

      case PHASES.EVENT: {
        const choices = eventChoices(run);
        const usable = choices.filter(c => c.ok);
        if (usable.length === 0) { run_.endRun(run, false, 'event with no valid choice'); break; }
        // Take a gated (usually better) option when one is available.
        const gated = usable.filter(c => c.index > 0);
        const choice = gated.length && rng.chance(0.7) ? rng.pick(gated) : usable[0];
        const r = run_.chooseEventOption(run, choice.index);
        if (!r.ok) { run_.endRun(run, false, 'choice failed: ' + r.reason); }
        break;
      }

      case PHASES.COMBAT: {
        const c = run.combat;
        if (!c) { run.phase = PHASES.MAP; break; }
        aimWeapons(run, c);
        let ticks = 0;
        while (!c.over && ticks++ < MAX_COMBAT_TICKS) {
          c.update(0.05);
          if (ticks % 20 === 0) {
            aimWeapons(run, c);
            // Bail out of a hopeless fight if the drive is ready.
            if (run.ship.hull <= 4 && run.ship.ftlCharge >= 1 && !run.combatMeta.mustKill) {
              c.playerFlee();
            }
          }
        }
        if (!c.over) {
          // Stalemate: treat as a flee so the run can continue.
          c.finish('fled');
          say('stalemate at sector ' + (run.sectorIndex + 1));
        }
        break;
      }

      case PHASES.STORE: {
        shop(run, rng);
        run_.leaveStore(run);
        break;
      }

      case PHASES.SECTOR_CHOICE: {
        const choices = run.sectorChoices || [];
        if (!choices.length) { run_.endRun(run, false, 'no sector choices'); break; }
        const r = run_.enterSector(run, rng.pick(choices).id);
        if (!r.ok) { run_.endRun(run, false, 'sector entry failed: ' + r.reason); }
        break;
      }

      default:
        run_.endRun(run, false, 'unknown phase ' + run.phase);
    }
    run_.tick(run, 6);
  }

  if (steps >= MAX_STEPS && !run.won && run.phase !== PHASES.GAME_OVER) {
    run_.endRun(run, false, 'step limit reached');
  }

  return {
    seed, shipId, variant,
    won: !!run.won,
    sector: run.sectorIndex + 1,
    cause: run.cause,
    score: run.score,
    hull: run.ship.hull,
    crew: livingCrew(run.ship).length,
    scrap: run.scrap,
    kills: run.stats.shipsDestroyed,
    beacons: run.stats.beacons,
    achievements: Object.keys(profile.achievements).length,
    steps,
    log,
  };
}

function aimWeapons(run, c) {
  const enemy = c.enemy;
  const priority = ['shields', 'weapons', 'engines', 'piloting'];
  let roomId = null;
  for (const sysId of priority) {
    const s = enemy.systems[sysId];
    if (s && s.room != null && s.damage < s.level) { roomId = s.room; break; }
  }
  if (roomId == null) roomId = 0;
  for (const w of run.ship.weapons) {
    // Don't spend missiles we don't have.
    const def = getWeapon(w.weaponId);
    if (def.ammo && run.missiles < def.ammo) { w.targetRoom = null; continue; }
    w.targetRoom = roomId;
    w.autofire = true;
  }
}

function shop(run, rng) {
  const ship = run.ship;
  // Repair first — hull is the resource that ends runs.
  const missing = ship.maxHull - ship.hull;
  if (missing > 0) {
    const budget = Math.floor(run.scrap * 0.45);
    const affordable = Math.min(missing, Math.floor(budget / Math.max(1, run.store.repairPrice)));
    if (affordable > 0) run_.repairAtStore(run, affordable);
  }
  // Then shields, then engines, then weapons.
  for (const sysId of ['shields', 'engines', 'weapons']) {
    const opt = upgradeOptions(ship).find(o => o.id === sysId);
    if (opt && !opt.atMax && run.scrap >= opt.cost + 20) run_.upgradeSystem(run, sysId);
  }
  // Buy fuel if low.
  while (run.fuel < 12 && run.scrap >= run.store.fuelPrice + 15) run_.buyResource(run, 'fuel', 1);
  // Buy a weapon if there's a free slot and plenty of scrap.
  run.store.items.forEach((item, i) => {
    if (item.sold) return;
    if (item.kind === 'weapon' && ship.weapons.length < ship.weaponSlots && run.scrap >= item.cost + 40) {
      run_.buyItem(run, i);
    } else if (item.kind === 'crew' && livingCrew(ship).length < ship.crewSlots && run.scrap >= item.cost + 60) {
      run_.buyItem(run, i);
    }
  });
  void rng;
}

// --- CLI -------------------------------------------------------------------

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tests/autoplay.js');
if (isMain) {
  const args = process.argv.slice(2);
  const argVal = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : def;
  };
  const runs = parseInt(argVal('--runs', '30'), 10);
  const shipId = argVal('--ship', 'kestrel');
  const variant = argVal('--variant', 'A');
  const verbose = args.includes('--verbose');

  const results = [];
  const errors = [];
  const t0 = Date.now();
  for (let i = 0; i < runs; i++) {
    try {
      results.push(playRun({ seed: `AUTO-${shipId}-${i}`, shipId, variant, verbose }));
    } catch (err) {
      errors.push({ i, message: err.message, stack: err.stack?.split('\n').slice(0, 4).join('\n') });
    }
  }
  const ms = Date.now() - t0;

  const wins = results.filter(r => r.won).length;
  const avgSector = results.reduce((n, r) => n + r.sector, 0) / Math.max(1, results.length);
  const maxSector = Math.max(0, ...results.map(r => r.sector));
  const avgKills = results.reduce((n, r) => n + r.kills, 0) / Math.max(1, results.length);
  const avgScore = results.reduce((n, r) => n + (r.score || 0), 0) / Math.max(1, results.length);

  console.log(`\nAUTOPLAY  ${shipId}_${variant}  ${runs} runs in ${ms}ms`);
  console.log(`  crashes:      ${errors.length}`);
  console.log(`  wins:         ${wins}/${results.length} (${(wins / Math.max(1, results.length) * 100).toFixed(0)}%)`);
  console.log(`  avg sector:   ${avgSector.toFixed(2)}  (best ${maxSector})`);
  console.log(`  avg kills:    ${avgKills.toFixed(1)}`);
  console.log(`  avg score:    ${Math.round(avgScore)}`);

  const causes = {};
  for (const r of results) if (!r.won) causes[r.cause || 'unknown'] = (causes[r.cause || 'unknown'] || 0) + 1;
  console.log('  death causes:', JSON.stringify(causes));

  const dist = {};
  for (const r of results) dist[r.sector] = (dist[r.sector] || 0) + 1;
  console.log('  sector reached:', Object.entries(dist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `s${k}:${v}`).join(' '));

  if (errors.length) {
    console.log('\n  CRASHES:');
    for (const e of errors.slice(0, 5)) console.log(`   run ${e.i}: ${e.message}\n${e.stack}`);
    process.exit(1);
  }
}
