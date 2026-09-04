# Deep Space — Encounter Authoring Guide

An **encounter** is the content of one node on the universe map. It is pure data.
The simulation (`src/game/sim.js`) reads it; nothing in an encounter file executes
game logic.

Every registered encounter is validated by the test suite
(`validateEncounter` in `src/game/encounters/index.js`). A typo'd enemy id is a
CI failure, not a silent empty room.

---

## The shape

```js
{
  id: 'picket_line',                 // unique across ALL encounter files
  name: 'Picket Line',               // shown as the encounter title
  type: 'combat',                    // see table below
  weight: 10,                        // relative selection weight (default 10)
  minThreat: 1,                      // lowest node threat this may appear at
  maxThreat: 6,                      // highest
  blurb: 'A thin screen of drones.', // ONE line, shown on the map node
  intro: 'Longer flavour text...',   // optional, shown on the pre-encounter card
  objective: { kind: 'clear' },
  waves: [ /* ... */ ],
  rewards: { xpMult: 1, creditsMult: 1, crates: 0 },  // optional
}
```

### Types

| type | action? | meaning |
|---|---|---|
| `combat` | yes | A standard fight against mixed ships |
| `swarm` | yes | Many weak enemies; about crowd control |
| `elite` | yes | A small number of dangerous named ships |
| `asteroid` | yes | Debris/rock hazard, few or no enemies |
| `tunnel` | yes | Fly a corridor without hitting the walls |
| `survival` | yes | Hold out against endless waves for a time |
| `chase` | yes | Something is chasing you, or you it |
| `derelict` | yes | Explore a wreck; ambush-flavoured |
| `boss` | yes | One capital ship with phases |
| `masterfleet` | yes | The final encounter. Do not author these. |
| `shop` | no | Trading post (handled by the shop screen) |
| `anomaly` | no | Text choice event |
| `empty` | no | Nothing happens |

### Objectives

```js
{ kind: 'clear' }                          // kill everything the script spawns
{ kind: 'survive', seconds: 75 }           // stay alive; waves keep coming
{ kind: 'reach', distance: 9000 }          // travel this far (terrain encounters)
{ kind: 'boss' }                           // kill everything tagged 'boss'
{ kind: 'destroy', tag: 'transport' }      // kill everything with that tag
```

Any objective may add `timeLimit: 120` — exceeding it loses the encounter.

---

## Waves

`waves` is an ordered script. Each wave has a **trigger** and a list of **spawn groups**.

```js
waves: [
  { at: 0,               spawn: [ /* groups */ ] },   // at t=0 seconds
  { at: 12,              spawn: [ ... ] },            // at t=12 seconds
  { after: 'cleared',    spawn: [ ... ] },            // when the field is empty
  { whenRemaining: 3,    spawn: [ ... ] },            // when <=3 enemies are alive
]
```

`after: 'cleared'` and `whenRemaining` both additionally require every earlier
wave to have fired, so the script cannot run out of order.

The first wave may omit its trigger (it fires immediately). Later waves must
have one.

### Spawn groups

Explicit:
```js
{ id: 'gunship', count: 3, formation: 'v', delay: 0.25 }
```

Procedural — fills a budget from a pool, so composition varies by seed:
```js
{ budget: 0.6, pool: ['picket', 'wasp', 'interceptor'], formation: 'arc' }
```

`budget` is a MULTIPLIER of the standard budget for the node's threat
(`standardBudget(threat) = 7 + 4.4 * (threat - 1)`). A whole encounter should
total roughly `1.6` to `2.4` across all its waves for a ~90 second fight.

| field | meaning |
|---|---|
| `id` / `ids` | one enemy id, or an explicit list |
| `count` | how many of `id` (default 1) |
| `budget` + `pool` | procedural fill; `pool` is required with `budget` |
| `formation` | see below (default `line`) |
| `delay` | seconds between each ship in the group entering |
| `wait` | seconds before the whole group starts entering |
| `elite` | `true` → 2.2× hull/damage, "Elite" name prefix |
| `tag` | label for `destroy`/`boss` objectives |
| `threatBonus` | +N to this group's threat scaling |
| `x`, `y`, `gap`, `radius`, `dir` | formation tuning |

### Formations

`line` `column` `v` `echelon` `arc` `cluster` `random` `pincer` `ambush`

- `pincer` enters from the top and bottom edges instead of the right.
- `ambush` starts already on the field — use it sparingly, it is unfair without warning.

---

## Terrain (tunnel / canyon encounters)

```js
terrain: {
  style: 'rock',        // 'rock' | 'ice' | 'metal'
  length: 14000,        // total corridor length in px
  minAperture: 170,     // narrowest gap; the field is 540px tall
  maxAperture: 400,     // widest
  roughness: 1.0,       // how much the centre line wanders
  chambers: 3,          // count of wide-open rooms
  pinches: 5,           // count of tight squeezes
  scroll: 210,          // px/sec the corridor moves past you
},
objective: { kind: 'reach' },
```

The field is **960 × 540** logical units. `minAperture` below ~150 is brutal;
below 120 is effectively impossible for a slow ship. Scraping a wall costs hull.

## Obstacles (asteroid / debris fields)

```js
obstacles: { count: 26, speed: 130, size: 24, toughness: 1, contact: 18, spreadX: 2.6 },
```

These are destructible rocks that drift in from the right.

---

## Enemy roster

Costs come from `src/game/enemies.js` — read it. Summary:

**swarm** (16×16, cheap): `picket` `wasp` `seeker` `zealot` `drifting_mine`
`interceptor` `aegis_pod` `bomblet` `splitter` `turret_pod`

**mid** (32×24): `gunship` `lancer` `artillery` `bulwark` `phantom` `drone_carrier`

**heavy** (64×40): `scout` `fighter` `raider` `missile_boat` `cruiser`
`battle_carrier` `sentinel` `hunter`

**elite** (named threats): `vanguard` `warden` `reaper`

---

## Design rules

1. **A fight is about 60–120 seconds.** Budget accordingly (~1.6–2.4 total).
2. **Waves should escalate**, not repeat. Wave 3 should not be wave 1 again.
3. **Give each encounter one idea.** "Artillery behind a shield aura you must
   break first." "A carrier that must be killed before it floods the field."
   If you cannot say the idea in one sentence, it is two encounters.
4. **Mix ranges of behaviour.** All-`hover` enemies is a shooting gallery;
   all-`kamikaze` is a dodge-fest. Combine.
5. **Threat bands**: low (1–6) should be forgiving and readable. Mid (7–13)
   introduces auras, spawners and elites. High (14–20) assumes a levelled ship
   and may stack several threats at once.
6. **`blurb` must tell the player what they are choosing.** It is the only
   information they get before committing to a node.
7. **Vary the reward shape** with `rewards: { xpMult, creditsMult, crates }`.
   A dangerous encounter should pay more. Default is 1/1/0.
8. **No unwinnable states.** An `ambush` formation plus a `survive` objective
   plus a tight corridor is not difficulty, it is a death sentence.

---

## Anomalies (text encounters, `type: 'anomaly'`)

These have no waves. They present a situation and 2–4 choices.

```js
{
  id: 'derelict_hauler', name: 'Derelict Hauler', type: 'anomaly',
  weight: 10, minThreat: 1, maxThreat: 12,
  blurb: 'A cold hulk, drifting.',
  text: 'The hauler has been dead for a long time. Its cargo bay is intact.',
  choices: [
    {
      text: 'Cut your way in.',
      // Optional gate. Omit for an always-available choice.
      requires: { attr: { systems: 4 } },     // minimum attribute values
      // also: { credits: 80 }, { level: 6 }, { slotItem: 'utility1' }
      outcomes: [
        { weight: 4, text: 'The bay is full of sealed crates.', effects: { credits: 70, crates: 1 } },
        { weight: 2, text: 'Something is still alive in there.', effects: { combat: 'derelict_ambush' } },
      ],
    },
    { text: 'Leave it.', outcomes: [{ text: 'You move on.', effects: { xp: 8 } }] },
  ],
}
```

### `effects`

| key | meaning |
|---|---|
| `credits` | ± credits |
| `xp` | + experience |
| `hull` | ± flat hull (negative damages you) |
| `hullPct` | ± fraction of max hull |
| `crates` | N random items rolled at the node's threat |
| `item` | `{ slot?, rarity? }` — one specific-ish item |
| `attributePoint` | +N unspent attribute points (use very sparingly) |
| `combat` | an encounter id to launch instead of resolving |
| `reveal` | reveal N extra map nodes around you |
| `heal` | fraction of max hull restored |

Outcomes are weighted (`weight`, default 1). A choice with one outcome always
gives it. **Every choice must have at least one outcome.**

### Writing rules for anomalies

- The player is alone in a hostile galaxy. Keep the voice dry and a little bleak.
- No choice should be strictly worse than another. A gamble must pay.
- `requires` gates should reward investment, not punish a build.
- At least one choice should always be safely available (no `requires`).
- Two to four choices. Three is usually right.
