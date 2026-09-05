# Deep Space

A roguelike space shooter in vanilla JavaScript — **no framework, no bundler, no build step**. Open `index.html` and it runs.

**▶ [Play it](https://sburrell23.github.io/Deep-Space/)**

You start at the centre of a fogged web of star systems in a small ship, and fly outward. Every node is one encounter. The further out you go the worse the odds get, and your hull does not heal between jumps. Get deep enough and the Master Fleet appears on the rim — level 20, and the end of the run if you can break it.

Die and the run is gone for good.

---

## The loop

**Fly out.** The universe is a 195-node radial spiderweb. You can see two to four jumps into the fog; everything beyond that is dark. Each visible node shows its threat level, coloured against your own — green is even odds, red is not. You can absolutely fly somewhere that kills you, and nothing stops you.

**Fight.** Encounters are played as a 2D side-scrolling shooter. You move with WASD, aim with the mouse and shoot with the buttons; enemies come from the right. Firing draws on your energy, dashing gives you invulnerability frames, and your shield regenerates between fights while your hull does not.

**Get stronger.** Everything you clear gives experience. Each level grants two points across six attributes, and gear fills eleven mounts — two weapons plus a heavy mount cut in at level 13, engine, shield, reactor, plating, nav computer, and three utility slots that grant active abilities.

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

## Versioning

The version on the title screen is the release number. Bump it in `index.html` on every push — the minor for a batch of changes (`v2.0` → `v2.1`), the major for a change to what the game is. It is the only place the number lives.

---

## Honest state

**The Master Fleet is reachable, but only just.** Over twelve headless runs at
pilot skill 0.75 the synthetic pilot won two — 17%, against 0% before the v2.5
balance pass. A winning run is about 25 minutes of combat and roughly 38 minutes
of wall clock, though the bot beelines for the rim the moment it can and a human
who explores will take considerably longer. The two-hour figure remains a design
target, not a measured one.

What the v2.5 pass found, in the order it mattered:

* **Most enemies never had to be fought.** In a typical encounter the majority
  of the spawn flew past the player and off the left edge, where it was culled:
  `splitter_bloom` was resolving with 1 kill out of 17 spawned, `outrun_the_swarm`
  with 3 out of 81. You did not beat a fight, you outlasted it. Enemies now
  circle back for up to two more passes when the objective is to destroy them.
* **Nothing a fight did to you stuck.** 79-94% of fights cost no hull at all,
  because a shield large enough to absorb a fight refilled for free afterwards,
  and 88-103% of the damage that did land was healed back before the fight ended.
  Shields leak now, and all in-fight healing draws on one allowance.
* **Capital ships could win the fight by leaving.** A boss culled for drifting
  off satisfied the boss objective — `boss_famine_late_model` ended in three
  seconds with nothing killed. Others drifted thousands of pixels to the right,
  out of reach, and stalled the encounter instead.

Where the numbers sit now, measured with `tests/balance.js` and `tests/curve.js`:

| | before | after |
|---|---|---|
| fights costing no hull | 79-94% | 11-54% |
| damage healed back mid-fight | 88-103% | 14-44% |
| median fight length | 26-56s | 42-67s |
| survivability, shallow to deep | x1.20 | x0.96 |
| killing power, shallow to deep | x0.43 | x0.79 |
| gold spent per run | 9% | 42% |
| shops where you could afford everything | 46% | 31% |

The last two are the economy question: a run that ended holding four fifths of
everything it earned did not have an economy, it had a scoreboard.

Every one of those numbers lives in `src/game/balance.js`, with the reasoning
next to it, and can be re-measured or swept from `tests/`.

**v2.7 rebuilt what a fight is.** Hostiles, Swarm and Pursuit were three node
types that all came down to "ships are shooting at you", and one of them could
be won by running out a clock. They are one type now — Hostiles — and it always
means the same thing: destroy everything that turns up.

The fight underneath changed with it. A threat-8 node used to field 28 ships
with two dozen alive at once and a wall of bullets nobody could read; each shot
was close to free. Volume is not difficulty, it is noise that difficulty hides
behind. Now:

| | before | after |
|---|---|---|
| ships in a shallow fight | 34 spawned, 28 at once | 10 spawned, 9 at once |
| ships in a deep fight | 25-59 spawned | 18 spawned, 15 at once |
| enemy damage multiplier | 0.29 | 1.15 |
| median fight length | 43-67s | 39-70s |
| hull cost per fight | 2-14% | 5-17% |

Roughly a third of the ships, each hitting about four times as hard. You are
meant to be dodging every shot, and that is only possible when you can see them.

The synthetic pilot had to be rewritten to measure any of this: it dodged by
repulsion inside a 70-140px radius, which is a third of a second of warning
against a reaction lag of up to 0.3s. It reads shots forward now and steps off
their line, and it can only track a few at a time — which is what makes skill
mean anything in a fight with bullets in it. Per-fight death now runs 14% at
pilot skill 0.4 against 10% at 0.95; before the rewrite skill barely moved it.

Outstanding: 10% per fight at the top of the skill range is still high for a
thirty-node run, and the headless pilot wins none. A person who genuinely
dodges should beat it, but that is an assumption this harness cannot check.

**v2.6 found the probes themselves were wrong.** All three built their reference
ship by spending attribute points in a loop without ever raising
`progress.level`, so the "level 20" ship they measured was formally level 1.
Nothing level-gated was exercised — and since the heavy weapon mount unlocks at
13, the entire tertiary class had been tuned without ever being measured. The
builder now lives once, in `tests/refship.js`.

Outstanding: deaths per fight sit at 17-19% in the threat 14-18 band against a
target of 12%. The deaths concentrate in boss and elite encounters rather than
in the curve, so the fix is content work, not another global knob.

The soundtrack is *New Planets*, supplied by the author of this repository.
