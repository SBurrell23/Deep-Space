/**
 * The balance knobs, in one place.
 *
 * Every number that decides how the game *feels* — rather than how it works —
 * lives here, because these numbers are not independent. Lengthening a fight
 * raises what it costs and how often it kills you at the same time; making a
 * shield tighter makes gold worth less, because gold is mostly repairs. Tuning
 * them one file at a time converges slowly and lies to you on the way.
 *
 * Read them with:
 *   node tests/curve.js       player power against the map's, at every depth
 *   node tests/balance.js     what one fight costs and how long it takes
 *   node tests/tune.js        candidate values swept against the real sim
 *   node tests/economy.js     XP, gold and attrition across whole runs
 *
 * The design these numbers serve:
 *
 *   A fight is a withdrawal, not a coin flip. It should cost hull — 10-20% of
 *   the bar on average — so that a handful of them force a decision about
 *   repairs, and so gold has somewhere to go. What it should almost never do is
 *   kill you outright from full: death is meant to arrive at the end of a bad
 *   stretch, not out of a clear sky. Deaths per fight belong under about 12%;
 *   above that the compounding across a thirty-node run makes the rim
 *   unreachable however well the individual fights play.
 *
 *   That is why enemy damage is low and shields leak. Big hits with a shield
 *   that absorbs them completely produce the opposite game: four fights in five
 *   cost literally nothing, and the fifth is fatal.
 */

export const BALANCE = {
  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------
  enemies: {
    /** Global multiplier on all enemy damage output. */
    damageScale: 0.29,

    /**
     * Per-class toughness on top of each archetype's base hull.
     *
     * Not one global number: swarm enemies were dying to a single starting
     * weapon shot, while the same multiplier on an elite — which already
     * carries an elite flag and an encounter's threatBonus — produced capital
     * ships with 16,000 hull that took 80 seconds of unbroken fire to kill.
     */
    toughness: { swarm: 9.8, mid: 5.7, heavy: 3.7, elite: 2.0 },

    /**
     * Per-threat-level compounding.
     *
     * Both sides compound because the player's does: a level buys attribute
     * points AND better loot, and the attribute multiplies the loot. Linear
     * enemy growth therefore meant the gap to a node above your level kept
     * narrowing, and a level-9 ship could win a threat-18 fight.
     *
     * Hull growth is the gentler of the two on purpose. Player damage output
     * roughly triples across a run while enemy hull was growing six-fold, so
     * deep fights were twice the length of shallow ones and killed through
     * sheer exposure.
     */
    hullGrowth: 1.070,
    damageGrowth: 1.031,

    /**
     * A gentler opening.
     *
     * Threat 1-3 is played on a bare hull: no levels spent, and the loot table
     * does not even start rolling gear until threat 3. Measured against that
     * ship the standard damage curve killed the player on their second or
     * third node one run in eight, which is time wasted rather than tension.
     * Damage ramps from this fraction at threat 1 up to full by threat 4.
     */
    earlyGrace: 0.62,
    earlyGraceUntil: 4,

    /** Per-threat-level growth of what a kill pays. */
    rewardGrowth: 0.22,
  },

  // -------------------------------------------------------------------------
  // Defence
  // -------------------------------------------------------------------------
  defence: {
    /**
     * The fraction of every hit that reaches the hull even at full shield.
     *
     * This is the single most important number in the game. At zero — where it
     * sat for a long time — a shield big enough to eat a fight makes that fight
     * completely free, and measurement bore that out: 79-94% of fights cost no
     * hull at all. Damage was either nothing or death, gold had nothing to buy,
     * and repair was a button nobody pressed.
     *
     * Investing in Shields buys a tighter seal, never a perfect one.
     */
    shieldLeakBase: 0.50,
    shieldLeakPerShields: 0.011,
    shieldLeakFloor: 0.26,

    /**
     * The ceiling on ALL in-fight healing, as a fraction of max hull.
     *
     * One number in one place, because the alternative does not converge:
     * capping lifesteal handed the job to repair pickups, capping those handed
     * it to repair abilities, and each time the measured share of damage healed
     * back stayed near 100%. Whatever the build, a fight can be patched by this
     * much and no more — the rest you carry out with you, which is what makes
     * hull a run-long resource and gives gold something to buy.
     */
    healPerEncounter: 0.12,

    /**
     * Lifesteal, as a fraction of max hull healed per second, however much
     * damage is dealt. At 3%/sec a forty-second fight refunded a hull and a
     * fifth — lifesteal was not sustain, it was immunity, paying back 91-99%
     * of everything a deep fight could do to you.
     */
    lifestealPerSecond: 0.008,

    /**
     * And a ceiling for the whole fight, as a fraction of max hull.
     *
     * A per-second rate alone is not a limit, it is an income: fights got
     * longer, and lifesteal quietly went back to refunding 90-110% of
     * everything a deep fight could do. A per-encounter cap is a safety net of
     * fixed size however long the fight runs.
     */
    lifestealPerEncounter: 0.10,

    /**
     * Repair drops. At a 16% chance of 5% max hull, a thirty-kill fight handed
     * back a quarter of the bar for free. A lucky reprieve, not an income.
     */
    repairDropChance: 0.06,
    repairDropFraction: 0.022,
  },

  // -------------------------------------------------------------------------
  // Encounters
  // -------------------------------------------------------------------------
  encounters: {
    /**
     * How much enemy a budget-driven wave may buy, per threat level.
     *
     * This was 45 flat plus 0.4 per level, so a threat-20 fight fielded the
     * same number of ships as a threat-1 one — every bit of the difficulty
     * curve lived in per-enemy hull and damage. The result was that regular
     * fights stayed thin and free while bosses, whose compositions are written
     * out by hand, carried the entire danger of the game.
     *
     * More, cheaper enemies is the version a player can feel: more guns
     * pointed at you, more to dodge, and a fight that costs something.
     */
    budgetBase: 58,
    budgetPerThreat: 0.6,
  },

  // -------------------------------------------------------------------------
  // Economy
  // -------------------------------------------------------------------------
  economy: {
    /**
     * Credits are meant to be spent, and spending is meant to hurt a little.
     * A run that ends holding four fifths of everything it ever earned did not
     * have an economy, it had a scoreboard.
     */
    creditsPerNodeBase: 10,
    creditsPerNodeThreat: 5,

    /** What it costs to put one point of hull back at a trading post. */
    repairCostPerHull: 3.4,
  },
};

export const ENEMY_TUNING = BALANCE.enemies;
export const DEFENCE_TUNING = BALANCE.defence;
export const ENCOUNTER_TUNING = BALANCE.encounters;
export const ECONOMY_TUNING = BALANCE.economy;
