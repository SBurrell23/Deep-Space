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
- **100 named duelists** — a Hostiles node is one opponent with its own silhouette, AI, health bar and up to four telegraphed special moves, drawn from 32 abilities and 16 duel brains
- Nine equipment abilities — EMP burst, phase shift, time dilation, escort drones, nova, decoys and more
- Scrolling tunnel terrain with procedurally generated corridors, and destructible asteroid fields

**Content**
- **250 encounters**: 100 one-on-one duels, 16 hold-outs, 52 debris fields, elites, tunnels, capital ships and a three-stage Master Fleet finale
- **39 hand-written anomalies** — text encounters with gated choices and weighted outcomes
- 10 hulls, each with a distinct attribute spread, starting loadout and a perk that changes how it is flown
- 71 achievements, six of which unlock hulls
- Procedural loot: base templates × five rarity tiers × 22 affixes, scaled by depth

**Everything else**
- Every sound effect is synthesised at runtime with Web Audio — 76 of them, no audio files
- 231 hand-authored pixel sprites plus 74 hull parts that compose into the duelists' hundred silhouettes, all written as character grids and validated in CI
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

**v3.1: the map is duels and hold-outs now.**

Three changes to what a run is made of, and one bug that made a whole ability
class free to ignore.

* **The Derelict type is retired.** All six were clear-the-field fights that
  happened to be set in a wreck, which is scenery rather than a different
  question. They are hold-outs now — which is what their own prose always
  described — and they keep the salvage payout that made them worth the
  detour, because they were the map's money and deleting them would have
  quietly removed most of it. Four new hold-outs join them, for sixteen.
* **The node mix moved.** Hostiles 30-34% -> **37-43%**, hold-outs 5-7% ->
  **11-13%**, debris fields 14-20% -> **9-12%**. Rocks-plus-swarm is the least
  demanding thing on the map and it did not deserve a fifth of it.
* **Hold-outs were free.** 0-10% of the hull bar and not one death across a
  hundred and twenty of them, because their budget discount was set when they
  were 6% of the map. At 1.5 a hold costs 12% and can occasionally kill, and
  the screen stays readable: 0.9 enemy bullets alive on average, median peak
  of seven.
* **Early duels were a grind.** The hull pool is sized for a player who has
  levelled and rolled gear; in the first two rings they have neither. Ramped
  to 60% at threat 1 and back to full by threat 6 — threat 1 is **29s / 6%**
  now, against 41s before, building to 45s / 12% by threat 8.

And the bug: **you could stand behind a wall ship and nullify it entirely.**
`wall`, `double_wall`, `closing_wall`, `forward`, `mine_drop`, `sweep` and Flak
Curtain all fired hard left, an assumption from when enemies streamed in from
the right and the player was never behind one. In a duel the player circles, so
a Barrier Wall ship would spend the whole fight sealing empty space. They fire
down the lane toward the player now, whichever side that is — measured, a wall
ship hits a flanking player 0.86-1.52x as hard as one in front, where it used
to be zero.

**v3.0: a Hostiles node is one ship now.**

The crowd was the problem, and no amount of tuning it was going to fix that.
Ten ships each carrying a tenth of a fight means none of them can afford an
attack worth learning, because ten of that attack at once is a wall. So every
Hostiles fight was the same fight — volume — wearing thirty-eight names.

A Hostiles node is now **one named opponent**: its own silhouette, its own AI,
its own health bar, and up to four telegraphed special moves. Two thirds are a
single ship; the rest are squadrons of two to five bodies flying as one
opponent. The forty-four old crowd encounters were not thrown away — they were
retyped as debris fields, which is where the small ships live now, and the node
mix was reweighted to match.

| | |
|---|---|
| duelists | **100**, in five factions of twenty |
| hull silhouettes | composed from **74 hand-drawn parts** in six slots x 14 liveries |
| abilities | **32**, every one telegraphed, 1-4 per ship |
| duel AI brains | **16**, written for a one-on-one fight |
| median fight | **40s**, 10% hull, 9% deaths (600 measured duels) |
| damage from ramming | **1%** |

Sized by measurement, not by feel: the reference pilot lands 52 damage a second
at threat 1 and 312 at threat 20, so a duelist's hull follows the same 1.098
curve and a fight is the same length at every depth.

Four things had to change in the engine for a lone opponent to work at all, and
all four were bugs the crowd had been hiding:

* **Nothing capped a single blow.** A beam does five times a ship's per-shot
  damage, which at depth is most of a full hull bar in one frame. Deaths ran at
  30%. No hit may now take more than 28% of the bar — a ceiling on catastrophe,
  not a softener.
* **Difficulty was set by flavour.** Ability damage was priced per move, so a
  deep-band opponent carrying three of them took 49% of the hull bar where a
  shallow one carrying a single move took 11%. The ships were not the
  difference; the ability *count* was. The budget is per ship now.
* **A squadron shared one hull pool but five sets of guns.** A four-body
  formation cost 24% of the bar where a lone ship of the same budget cost 10%.
* **Enemy healing had no ceiling.** Repair Weave mends 15% of the bar every 14
  seconds, which against an armoured hull is more than the pilot's entire net
  damage output. Six of the hundred were not hard, they were unkillable.

And one in the harness, which had been quietly wrong for a long time:

* **The synthetic pilot never released a charge weapon.** It holds the trigger
  down; a charge weapon fires on release. It held it for sixty seconds and
  fired once. Every headless measurement ever taken with a charge primary was
  taken with the primary silent — a whole weapon class, across every balance
  pass in this file. It also anchored itself at x = 0.22w and never closed, so
  an opponent parked at the far wall sat outside beam range forever and the
  node scored as unwinnable.

Known and left standing: about 0.8% of (ship, threat, seed) combinations still
run past three minutes. Every one of them wins comfortably on a different gear
roll — it is the reference ship's loadout variance, not the ship — but a player
who draws badly will meet a long fight, and disengaging is the answer.

`debug/bestiary.html` renders all hundred from the live modules: silhouette,
stats, abilities with their tells, and the actual answer to each fight.

**v2.9: the thing hitting you was not the guns.**

Four of the ten swarm archetypes — seeker, zealot, drifting_mine and aegis_pod
— had no weapon at all. Their entire way of interacting with the player was to
fly into them. Measured, collisions were doing 17-47% of all damage taken. So
the part of the fight that hurt was not the shooting you can read and dodge; it
was 16x16 specks moving at up to 205px/sec against a player who moves at
239-325, touching you.

| | before | after |
|---|---|---|
| swarm ship size | 16x16, drawn 1x | **28-34px, drawn 2x** |
| swarm top speed | 205 px/s | **158 px/s** |
| damage from collisions | 17-47% | **2-7%** |
| damage from guns | 53-83% | **79-87%** |
| gunless archetypes | 4 of 10 | **2 of 10** (a mine and a support pod) |

The Seeker Pod has a gun now. The Zealot is the one dedicated rammer left and
is big, slow and obvious about it — a threat you see coming. Everything in the
class costs more, so a fight fields fewer of them.

**v2.8 found what was actually wrong, which was not any of the numbers.**

Enemy shots travelled at 260-430 px/s against a player who moves at 239-325.
At parity you cannot dodge a bullet, only slowly out-walk it — and a shot that
crosses a 1200px field at 260 px/s is on screen for four and a half *seconds*.
Measured: 41-65 enemy bullets alive at once. That was the wall of noise, and it
was caused by bullet speed, not enemy count, which is why cutting the ships to a
third in v2.7 barely touched it. It also forced everything else: shots you cannot
avoid have to be harmless, so a hit cost 0.3-1.6% of hull and nothing was worth
respecting. Every tuning pass before this was adjusting how much a raindrop
hurts, inside a rainstorm you cannot step out of.

| | before | after |
|---|---|---|
| enemy bullet speed | 0.8-1.8x player | **2.4-5.2x player** |
| bullets alive at once | avg 9-15, peak 41-65 | **avg 1-3, peak 8-19** |
| shots fired per fight | ~140 | **~50** |
| telegraph before firing | beams only | **every shot, 0.34s** |
| hull cost per fight | 2-14% | 8-14% |

Fewer shots, three times faster, each one announced. The pilot dodges 90% of
them either way — that was never broken — but a tenth of fifty is four or five
hits rather than thirteen, which is few enough that a hit is allowed to take a
real bite.

`tests/shapes` — six encounters that pose a spatial problem rather than a
roster: a wall to flank, two banks firing across the lane you want, a screen
around something worth screening, and ships that jumped in behind you. Groups
can now override how they fly, so the same archetype reads as a different fight
depending on whether it charges, holds a line, or comes at you from the wrong
side.

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
