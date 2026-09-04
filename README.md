# Deep Space

A roguelike space shooter in vanilla JavaScript — **no framework, no bundler, no build step**. Open `index.html` and it runs.

**▶ [Play it](https://sburrell23.github.io/Deep-Space/)**

You start at the centre of a fogged web of star systems in a small ship, and fly outward. Every node is one encounter. The further out you go the worse the odds get, and your hull does not heal between jumps. Get deep enough and the Master Fleet appears on the rim — level 20, and the end of the run if you can break it.

Die and the run is gone for good.

---

## The loop

**Fly out.** The universe is a 195-node radial spiderweb. You can see two to four jumps into the fog; everything beyond that is dark. Each visible node shows its threat level, coloured against your own — green is even odds, red is not. You can absolutely fly somewhere that kills you, and nothing stops you.

**Fight.** Encounters are played as a 2D side-scrolling shooter. You move with WASD, aim with the mouse and shoot with the buttons; enemies come from the right. Firing draws on your energy, dashing gives you invulnerability frames, and your shield regenerates between fights while your hull does not.

**Get stronger.** Everything you clear gives experience. Each level grants two points across six attributes, and gear fills nine slots — two weapons, engine, shield, reactor, plating, nav computer and two utility slots that grant active abilities.

**Nodes pay out once.** Going back over old ground gets you nothing, so the run only moves one way: outward.

---

## What's in it

**The action game**
- A deterministic, DOM-free simulation the renderer only reads from — which is also how the game is playtested
- 24 weapons across ten firing behaviours: straight shots, piercing rails, chain lightning, homing swarms, continuous beams, charge shots, mines, gravity wells, fragmenting shards and autonomous drones
- 27 enemy archetypes across four weight classes, each pairing one of 16 movement behaviours with one of 24 bullet patterns
- Nine equipment abilities — EMP burst, phase shift, time dilation, escort drones, nova, decoys and more
- Scrolling tunnel terrain with procedurally generated corridors, and destructible asteroid fields

**Content**
- **133 encounters** across combat, swarms, elites, asteroid fields, tunnels, survival holds, pursuits, derelicts, capital ships and a three-stage Master Fleet finale
- **39 hand-written anomalies** — text encounters with gated choices and weighted outcomes
- 10 hulls, each with a distinct attribute spread, starting loadout and a perk that changes how it is flown
- 71 achievements, six of which unlock hulls
- Procedural loot: base templates × five rarity tiers × 22 affixes, scaled by depth

**Everything else**
- Every sound effect is synthesised at runtime with Web Audio — 76 of them, no audio files
- 231 hand-authored pixel sprites, written as character grids and validated in CI
- Sound and settings reachable from every screen; volume, mute and gameplay options persist
- Versioned localStorage saves, autosaved on every jump

---

## Controls

| | |
|---|---|
| `W A S D` | Move |
| Mouse | Aim |
| Left click | Primary weapon |
| Right click | Secondary weapon |
| `Space` / `Shift` | Dash (invulnerable while dashing) |
| `1` `2` / `Q` `E` | Abilities |
| `I` | Ship and loadout |
| `Esc` | Pause |

---

## Development

```bash
npm test                          # 208 tests, no dependencies
node tests/autoplay.js --runs 10  # play complete runs headlessly
node tests/autoplay.js --matrix   # is it beatable, and does skill matter?
node tests/balance.js             # every encounter at every threat level
node tests/balance.js --detail 8  # per-encounter breakdown at threat 8
npm run serve                     # http://localhost:8123
```

The simulation has no DOM dependency, so `tests/autoplay.js` drives complete runs through the real game code with a synthetic pilot whose competence is a parameter. That is how the difficulty curve is tuned — the numbers in `tests/balance.js` are measured, not guessed, and they have caught bugs no unit test would have: kamikaze enemies that were faster than the player and therefore unshakeable, enemies that could stall a "clear" objective forever, and a shield that persisted between encounters and killed every run on its second node.

CI runs the suite plus a six-run soak of complete games on every push, and gates the deploy on both.

`docs/ENCOUNTERS.md` documents the encounter schema — encounters are pure data, and every one is validated against it in CI.

---

## Honest state

The synthetic pilot beats the Master Fleet in roughly one run in six, with winning runs taking 25–40 minutes of combat and perhaps an hour of wall clock. A human explores more of the map than a bot that beelines for the rim the moment it hits level 18, so a real playthrough runs longer — but the two-hour figure is a design target, not a measured one.

The soundtrack is *New Planets*, supplied by the author of this repository.
