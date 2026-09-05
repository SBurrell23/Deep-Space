# Duelist spec — the shared contract

A **Hostiles** node is no longer a crowd. It is a fight with **one named ship**
(occasionally a small squadron of 2–5 bodies flying as one opponent). Each
duelist has its own silhouette, its own AI, its own abilities, and its own
health bar.

Everything below is a contract. Several agents author against it at the same
time, so **do not invent new ids** outside the vocabularies listed here, and do
not edit files other than the one you are asked to write.

The engine (loader, ability driver, encounter generation, validation, tests) is
written separately. Your job is data and behaviour that conforms to this.

---

## 1. House style

This codebase has opinions. Match them or the change will read as foreign.

- **Vanilla ES modules. No dependencies. No build step.** No TypeScript, no
  JSX, no framework.
- Two-space indent, single quotes, semicolons, trailing commas in multi-line
  literals.
- **Comments explain *why*, never *what*.** A comment that restates the code is
  noise. A comment that records the reasoning, the failure it prevents, or the
  measurement behind a number earns its place. British spelling in prose
  (`armour`, `behaviour`, `centre`).
- Numbers that define feel get a sentence saying what they trade against.
- No `console.log`. No DOM, no canvas, no `window` in `src/game/**` — the
  simulation is driven headlessly by the test suite.
- All randomness goes through the supplied rng, never `Math.random()`.

---

## 2. Coordinates and orientation

- Field is `world.w` × `world.h` (nominally 960×540, width can vary 860–1700).
- **The player flies on the LEFT. The enemy comes from the RIGHT.**
- Angle `0` points `+x` (right). `Math.PI` points left (at the player).
- So every enemy hull faces **LEFT**: nose at low x, engines at high x.
- Light comes from the **top-left**; shadow bottom-right.

---

## 3. Art: the parts system

A duelist's sprite is **composed** from six hand-authored parts plus a palette.
That is what makes a hundred ships each look like themselves without a hundred
hand-drawn sprites.

### Canvas

Each part is authored as the **top half** of a 64×40 sprite:

- **exactly 20 rows**
- **exactly 64 characters per row**

The composer stacks the parts, then mirrors rows 0–19 to produce rows 20–39.
Ships are therefore always vertically symmetric, which is what makes a
composed ship read as a deliberate silhouette instead of a smear.

Row 19 is the row **adjacent to** the centre line — draw the fuselage's widest
point there.

### Characters

Use only these. Anything else fails validation.

| char | meaning |
|---|---|
| `.` | transparent |
| `k` | outline / darkest — the same near-black on every ship |
| `1` | hull, darkest |
| `2` | hull, dark |
| `3` | hull, mid |
| `4` | hull, light |
| `w` | hull, highlight (use sparingly — top-left edges only) |
| `o` | accent, dark |
| `a` | accent, mid |
| `A` | accent, bright (cockpit glass, warning stripes, eyes) |
| `g` | glow, mid (engine wash, energy) |
| `G` | glow, bright (engine core, muzzle) |

The palette a ship picks decides what actual colours `1 2 3 4 w o a A g G`
resolve to. Author in the ramp, never in colour.

### Composition order

`core` → `nose` → `wing` → `pod` → `engine` → `crest`

Later parts paint **over** earlier ones. A non-`.` character wins. So:

- **`core`** owns the fuselage. It should be a complete, readable ship on its
  own — the other five parts are additions to it.
- **`nose`** occupies roughly x 0–20 (the left end).
- **`wing`** occupies roughly x 14–52, and should extend *above* the core (low
  row indices) so it reads as a wing rather than a stripe.
- **`pod`** is small hardware bolted on: turrets, barbettes, racks. Anywhere.
- **`engine`** occupies roughly x 46–63 (the right end) and is where `g`/`G` go.
- **`crest`** is a small identifying flourish, usually rows 0–8.

Every part **except `core`** must leave most of the canvas transparent. A part
that fills the whole canvas erases the ship underneath it.

### Worked example

A minimal `core` (this is a real, valid part — the shape is a blunt wedge):

```js
  wedge: { rows: [
    '................................................................',
    '................................................................',
    '................................................................',
    '................................................................',
    '................................................................',
    '................................................................',
    '..........................................kkkkkkkkkkkk..........',
    '....................................kkkkkk444444444443k.........',
    '..............................kkkkkk44444444443333333332k.......',
    '....................kkkkkkkkkk444444444333333333222222221k......',
    '..............kkkkkk4444444444333333333322222222222222222k......',
    '.........kkkkk4444444333333333222222222221111111111111111k......',
    '.....kkkk44444333333322222222211111111111111111111111111k.......',
    '..kkk4443333332222222111111111111111111111111111111111k.........',
    '.kk443333222222111111111111111111111111111111111111kkk..........',
    'k4433322222211111111111111111111111111111111111kkkk.............',
    'k433322222111111111111111111111111111111111kkkk.................',
    'k4332222211111111111111111111111111111kkkkk.....................',
    'k43222221111111111111111111111111kkkkkk.........................',
    'k4322222111111111111111111111kkkkk..............................',
  ]},
```

Note how the silhouette tapers to a point at the left (the nose) and is widest
at row 19 (the centre line). That is the shape language.

### Part vocabularies (author exactly these ids)

**`core` (14)** — the fuselage. Each must be a distinct silhouette, not a
restyling of the same wedge.

`wedge` (classic tapered fighter) · `dagger` (long, thin, mean) ·
`barge` (fat rectangular freighter-gunboat) · `ring` (a torus with a hollow
centre) · `trident` (three forward prongs) · `crescent` (concave leading edge) ·
`hammerhead` (wide flat bow, narrow body) · `spindle` (needle, widest at the
back) · `beetle` (rounded carapace, hunched) · `obelisk` (tall slab, blocky) ·
`mantaform` (broad flat ray shape) · `cathedral` (ornate, buttressed, tall) ·
`husk` (asymmetric, damaged, holed) · `lattice` (open framework, lots of gaps)

**`nose` (10)** — left end. `blunt` · `spike` · `split_prow` · `drill` ·
`maw` (an open mouth) · `sensor_dome` · `ram_plate` · `forked` · `lance_tip` ·
`cowl`

**`wing` (14)** — `swept` · `delta` · `gull` (kinked) · `long_straight` ·
`twin_boom` · `folded` · `blade_pair` · `canard` (small forward wing) ·
`sail` (tall vertical) · `spar_frame` (open strut) · `stub` · `scythe` ·
`fan` (multiple thin fins) · `none` (all transparent — 20 rows of 64 dots)

**`engine` (10)** — `twin_cone` · `quad_block` · `single_bell` · `ring_drive` ·
`spread_rail` · `stacked_trio` · `vent_bank` · `pulse_pods` · `hex_cluster` ·
`none`

**`pod` (12)** — `chin_cannon` · `dorsal_turret` · `side_barbettes` ·
`missile_rack` · `spinal_gun` · `drum_magazine` · `claw_arms` · `launch_bay` ·
`shield_emitter` · `twin_lasers` · `gatling_ring` · `none`

**`crest` (10)** — `antenna` · `spine_fin` · `halo` · `banner` · `dish` ·
`horns` · `blade_crest` · `lamp` · `vent_stack` · `none`

**`pal` (14 palettes)** — `crimson` · `ember` · `void` · `verdant` · `ion` ·
`bone` · `rust` · `abyss` · `gold` · `frost` · `plague` · `obsidian` ·
`pearl` · `magenta`

---

## 4. AI brains

`e.move` names a brain. A brain is a function `(e, world, dt)` that sets
`e.vx` / `e.vy` — the sim integrates position itself. It may use `e.mem` as
private scratch space (already seeded with `e.mem.phase`, a random 0–2π).

**A brain must never leave the field.** A duelist that flies off screen is an
unwinnable fight. Keep `e.x` in roughly `world.w * 0.3` … `world.w * 0.92` and
`e.y` in `40` … `world.h - 40` by steering, not by clamping.

Vocabulary (16), all prefixed `duel_`:

| id | behaviour |
|---|---|
| `duel_stalk` | holds mid range, mirrors the player's y, closes very slowly |
| `duel_keepaway` | runs to maximum range; retreats hard when the player closes |
| `duel_circle` | orbits the player at a fixed radius |
| `duel_lunge` | holds station, then periodically dashes at the player and backs off |
| `duel_strafe` | vertical strafing runs across the player's lane |
| `duel_anchor` | holds one spot, drifting only slightly. A gun platform |
| `duel_mirror` | matches the player's y exactly, parked at far x |
| `duel_bob` | traces a figure-eight in the right half of the field |
| `duel_pressure` | walks steadily toward the player and never retreats |
| `duel_flank` | swings above or below to attack from the player's rear |
| `duel_boxer` | advance / retreat rhythm — in, out, in |
| `duel_drift_wide` | sweeps corner to corner across the whole field |
| `duel_pounce` | lurks at an edge, then crosses the field fast |
| `duel_wall` | moves only vertically, pinned to the right edge |
| `duel_erratic` | short unpredictable bursts of movement |
| `duel_escort` | keeps a formation offset from its squadmates (squadron ships) |

---

## 5. Abilities

An ability is a telegraphed special move on a cooldown. A duelist has **up to
four**. They are what make one ship memorable and another forgettable.

### Shape

```js
mega_laser: {
  id: 'mega_laser',
  name: 'Mega Laser',
  tags: ['beam', 'offence'],
  desc: 'A wide tracking lance that cuts the field in half.',
  tell: 'The whole spine lights up.',   // shown in the bestiary
  cooldown: 9,        // seconds between uses
  windup: 1.2,        // seconds of visible charge before `use` fires
  charges: Infinity,  // optional; omit for unlimited
  when: { belowHull: 0.5 },  // optional gate, see below
  use(api) { ... },
},
```

`when` gates (all optional, all must pass):
`belowHull` (0–1) · `aboveHull` · `minDist` · `maxDist` (pixels to the player).

### The `api` handed to `use`

Pure, DOM-free, and the only way an ability may touch the world.

| call | effect |
|---|---|
| `api.e` / `api.world` / `api.player` | the caster, the world, the player |
| `api.rng()` | 0–1, seeded |
| `api.threat` | node threat level |
| `api.dmg` | this ship's scaled per-bullet damage — **multiply, don't hardcode** |
| `api.aim()` | angle from the caster to the player |
| `api.dist()` | pixels to the player |
| `api.shoot(specs)` | spawn bullets from an array of descriptors (see below) |
| `api.pattern(id, opts)` | fire a named pattern from `patterns.js` |
| `api.beam({angle, telegraph, width, damage, length, linger, track})` | telegraphed beam. `damage` is a multiple of `api.dmg` |
| `api.zone({x, y, r, maxR, growth, dps, life, arm, kind, vx, vy, anchored})` | area denial |
| `api.mine({x, y, damage, radius, proximity, life})` | a proximity mine |
| `api.summon(enemyId, count, opts)` | spawn adds (weaker than a natural spawn) |
| `api.heal(frac)` | heal a fraction of max hull |
| `api.restoreShield(frac)` | restore a fraction of max shield |
| `api.invuln(seconds)` | untargetable and untouchable |
| `api.reflect(seconds)` | player bullets that hit are turned back on the player |
| `api.armour(bonus, seconds)` | temporary flat armour bonus (0–1) |
| `api.speed(mult, seconds)` | temporary speed multiplier |
| `api.fireRate(mult, seconds)` | temporary fire-rate multiplier |
| `api.root(seconds)` | stop moving (siege mode) |
| `api.blink(x, y)` | teleport |
| `api.lunge(mult, seconds)` | dash toward the player |
| `api.pull(force, radius, seconds)` | drag the player toward a point |
| `api.clearShots(radius)` | destroy player bullets near the caster |
| `api.decoy(count)` | spawn shootable duplicates of the caster |
| `api.drainEnergy(amount)` | take energy off the player |
| `api.emit(event)` | a renderer event, e.g. `{ type: 'abilityCast', id }` |

A bullet descriptor (what `api.shoot` takes) is:

```js
{ x, y, angle, speed, damage, sprite, life, homing, turnRate, radius,
  mine, proximity, delay }
```

`x`/`y` default to the caster, `damage` to `api.dmg`, `sprite` to `'eb_bolt'`.
Available enemy bullet sprites: `eb_bolt` `eb_heavy` `eb_orb` `eb_needle`
`eb_flak` `eb_wave` `eb_homing`.

### Vocabulary (32) — implement exactly these ids

`mega_laser` · `phase_out` · `reflect_field` · `blink_strike` ·
`overload_burst` · `summon_wing` · `siege_mode` · `repair_weave` ·
`shield_recharge` · `flak_curtain` · `homing_swarm` · `gravity_snare` ·
`mine_lattice` · `ram_charge` · `cluster_bomb` · `beam_sweep` · `emp_pulse` ·
`decoy_split` · `burn_trail` · `railshot` · `barrier_wall` · `venom_cloud` ·
`chain_lightning` · `drone_bay` · `retro_burn` · `nova_pulse` ·
`target_lock` · `hardlight_shield` · `frenzy` · `split_form` · `singularity` ·
`shatter_shot`

### Balance rules for abilities

- **Everything is telegraphed.** `windup >= 0.5` for anything that hurts, and
  `>= 1.0` for anything that hurts a lot. The player should be able to dodge
  every single attack in this game; an ability that cannot be read is a bug.
- Cooldowns 5–16s. Nothing fires two abilities in the same second.
- Damage scales off `api.dmg`. Never write a literal damage number.
- Defensive abilities must be *windows*, not walls: `invuln` ≤ 2.5s,
  `reflect` ≤ 3s, `heal` ≤ 0.15 of max hull per use.
- Summons cost the ability charges (`charges: 2` or `3`) — an endless spawner
  is a stalemate, not a fight.

---

## 6. Ship definitions

```js
{
  id: 'ash_vicar',                    // snake_case, globally unique
  name: 'Ash Vicar',                  // shown on the health bar
  faction: 'Choir',                   // flavour grouping, free text
  band: 'mid',                        // 'low' | 'mid' | 'high' | 'any'
  squadron: 1,                        // 1–5 bodies
  role: 'bruiser',                    // tank|bruiser|skirmisher|glass|artillery|support

  art: { core: 'cathedral', nose: 'cowl', wing: 'sail', pod: 'twin_lasers',
         engine: 'stacked_trio', crest: 'halo', pal: 'bone' },

  hullMul: 1.15,        // 0.65–1.45. Total hull budget for the WHOLE squadron
  shieldMul: 0.25,      // 0–0.5. Fraction of that budget delivered as shield
  damageMul: 1.0,       // 0.7–1.5
  armour: 0.12,         // 0–0.30
  speed: 96,            // 70–200 px/s
  contact: 12,          // 6–20

  move: 'duel_anchor',
  fire: 'spread3',      // a FIRE_PATTERNS id from patterns.js
  fireRate: 0.7,        // 0.35–1.6 volleys/sec
  bulletSpeed: 300,     // 240–360

  abilities: ['mega_laser', 'shield_recharge', 'summon_wing'],  // 1–4

  strategy: 'Stays put and punishes standing still. Kill it from above or below its firing arc.',
  blurb: 'A gun platform that has already chosen where you will die.',
  intro: 'Two or three sentences of prose. Second person, present tense, dry. '
    + 'No exclamation marks. It should tell the player what the fight is about.',
}
```

Hull, shield, xp, credits and cost are **computed by the loader** from
`hullMul` / `shieldMul` / `band` / `squadron`. Do not write them.

### Available `fire` patterns

`none` `single` `forward` `spread3` `spread5` `burst3` `burst5` `radial8`
`radial12` `spiral` `spiral_double` `wall` `homing1` `homing2` `homing4`
`heavy` `needle` `needle_burst` `orb` `sweep` `mine_drop` `parting_shot`
`cross` `burn_zone` `spreading_pool` `repulsor_field` `minefield_zones`
`lance_beam` `siege_beam` `bracket_beams` `cross_beams` `double_wall`
`closing_wall` `missile_barrage` `shotgun`

### Bands

| band | threat range | who meets it |
|---|---|---|
| `low` | 1–7 | the opening rings |
| `mid` | 5–13 | the middle of a run |
| `high` | 11–20 | the deep map |
| `any` | 1–20 | scales the whole way |

### Squadrons

A squadron is **one opponent with several bodies**, not a crowd. The hull
budget is split between them, so five bodies are individually flimsy.

Two thirds of all duelists are a single ship. In a pack of twenty, the split is
fixed for you in the pack's own brief.

Squadron ships should use `duel_escort`, `duel_circle`, `duel_flank`,
`duel_strafe` or `duel_pounce` — brains that read well in multiples — and
should carry **fewer abilities** (1–2), because the effects stack per body.

### What makes a good duelist

A duelist is a **puzzle with a tell**. Before you write one, answer: *what does
the player have to do differently to beat this that they did not have to do for
the last one?* If the answer is "shoot it more", the ship is not finished.

- The art, the AI, the fire pattern and the abilities should all say the same
  thing about the ship. A `duel_keepaway` sniper does not get `ram_charge`.
- Vary the *shape of the problem*: one ship should punish standing still,
  another punish approaching, another punish shooting from the wrong side.
- The `strategy` line is what the bestiary shows. It should be genuinely
  useful — the actual answer to the fight, not a boast.
- Names and prose: dry, concrete, slightly grim. No exclamation marks, no puns,
  no "epic". Look at `src/game/encounters/combat.js` for the register.
