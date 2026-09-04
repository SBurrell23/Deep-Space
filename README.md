# Deep Space

A roguelike starship simulator in the spirit of *FTL: Faster Than Light* — written in vanilla JavaScript with **no framework, no bundler and no build step**. Open `index.html` and it runs.

**▶ [Play it](https://sburrell23.github.io/Deep-Space/)**

You command a ship, its crew and its reactor across eight procedurally generated sectors while a hostile fleet closes in behind you. Manage power, fight in real time with pause, keep your crew breathing, and destroy the Swarm Flagship at the end of it.

---

## Features

**Ship simulation**
- Reactor power allocation across 20 systems, every one damageable, ionisable and hackable
- Room-by-room oxygen simulation with diffusion, breaches, airlocks and venting
- Fires that spread through open doors, burn systems, consume air and die in vacuum
- Crew who walk the decks, man stations, fight fires, seal breaches, repair systems and train six skills
- Nine playable species with real mechanical differences — Zoltan supply free power to the room they stand in, Rockmen are fireproof, Engi repair at double speed and fight at half, Synths do not breathe but cannot be healed in a medbay

**Combat**
- Real time with pause, at 1×/2×/4× speed
- 38 weapons across lasers, beams, missiles, bombs, ion, flak and plasma, each with its own shield interaction
- 10 drone types, 24 augments, boarding parties, teleporters, cloaking, mind control and hacking
- Enemy captains who target your shields, repair their own ship, board you, cloak against incoming fire and run when they are losing
- Environmental hazards: asteroid fields, solar flares, ion pulsars and sensor-blinding nebulae

**Original systems** beyond the FTL template — a **Nanoforge** that welds your hull back together mid-fight, an **Overdrive Core** that overcharges a system at the risk of burning it out, a **Shield Siphon** that strips a layer off the enemy and grafts it onto you, a **Temporal Field** that bends time inside a single room, and a **Salvage Arm** that pays out on every wreck.

**Runs**
- Procedurally generated sector trees and beacon maps, fully seeded — share a seed, share a run
- 30+ hand-written encounters with choices gated on your crew, systems and cargo
- Trading posts, distress calls, environmental hazards and a pursuing fleet that makes lingering expensive
- A three-phase flagship at the end

**Progression**
- 10 ships × 2 layouts. Win with a hull to unlock the next; earn any achievement with a hull to unlock its second layout
- 61 achievements, 31 general and 30 ship-specific
- Everything saved to `localStorage` — unlocks, achievements, records, and the current run (autosaved on every jump)

**Audio**
- **Every sound effect is synthesised at runtime with the Web Audio API.** There are no sound files — 76 effects built from oscillators, filtered noise and envelopes
- Sound & settings panel reachable from every screen, with live master/music/effects volume, persisted to the browser

**Art**
- ~145 hand-authored pixel sprites, written as plain character grids and rasterised at runtime

---

## Controls

| | |
|---|---|
| `Space` | Pause / resume combat |
| `M` | Star map |
| `Esc` | Pause menu / close dialog |
| `1`–`4` | Combat speed (hold `Shift` to select a weapon instead) |
| `A` | Toggle autofire |
| `Tab` | Cycle crew |
| `O` / `C` | Open / close all doors |
| Click a system | Add power (right-click removes it) |
| Click a crew member, then a room | Send them there |
| Click a weapon, then an enemy room | Target it |
| Right-click your own room | Vent it to space |

---

## Running it locally

No dependencies, no install step.

```bash
node tools/serve.js
```

Then open <http://localhost:8123>. Any static file server works — the game is plain ES modules. Opening `index.html` directly from the filesystem will not work, because browsers block ES module imports over `file://`.

## Tests

```bash
npm test
```

A dependency-free harness (`tests/harness.js`) with fakes for `localStorage`, Web Audio, canvas and the DOM. It covers the seeded RNG, the audio graph, every deck plan, the ship simulation, combat resolution, map generation, encounters, stores, saves, and full end-to-end runs.

There is also a headless autoplayer that plays complete runs with a simple bot — useful as a soak test and as a balance probe:

```bash
node tests/autoplay.js --runs 50 --ship kestrel
```

---

## How it is put together

```
index.html            the whole UI shell
styles/main.css       one stylesheet
src/
  core/
    rng.js            seeded mulberry32 — a run is reproducible from its seed
    save.js           versioned localStorage persistence
  audio/
    bus.js            audio graph + persisted volume settings
    sfx.js            76 procedurally synthesised sound effects
    music.js          soundtrack playback, fades and ducking
  game/               pure logic, no DOM, fully testable
    systems.js  weapons.js  crew.js  ships.js  ship.js
    combat.js   enemy.js    sector.js events.js
    store.js    achievements.js  run.js
  ui/
    pixel.js          sprite engine (character-grid art -> cached canvases)
    art-crew.js       91 crew and icon sprites
    art-ships.js      54 ship, projectile and effect sprites
    render.js         canvas rendering
    dom.js  screens.js  gameui.js  settings.js
  main.js             bootstrap, game loop, key bindings
tests/                harness, suites, autoplayer
tools/serve.js        zero-dependency static server
```

Two design decisions drive the rest:

**Game state is plain serialisable data.** Ships, crew, maps and runs are objects with no methods and no class instances, and all behaviour lives in functions that take them as arguments. Saving a run is `JSON.stringify`, and the entire simulation runs headlessly under Node in the test suite.

**Deck plans are ASCII.** Each ship's layout is drawn as a character grid:

```js
grid: [
  '....gg..mm....',
  '....gg..mm....',
  'eehhsssswwppcc',
  'eehhsssswwppcc',
  '....ff..oo....',
  '....ff..oo....',
],
map: { e: 'engines', s: 'shields', w: 'weapons', p: 'piloting', /* ... */ },
```

Rooms are derived as the bounding box of each letter and validated to be solid rectangles; doors are derived from adjacency; connectivity is checked at load. A typo in a deck plan fails loudly in the test suite instead of stranding a crew member in an unreachable room at runtime. The pixel art uses the same idea — sprites are arrays of strings indexed into a per-sprite palette.

---

## Licence

MIT. The soundtrack (`assets/audio/deep-space-theme.mp3`) is included as supplied by the project owner and is not covered by the MIT licence.
