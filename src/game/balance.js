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
    /**
     * Global multiplier on all enemy damage output.
     *
     * Five times what it was, because there are a third as many ships firing.
     * The old game put twenty-eight hulls and a wall of bullets on the field
     * and made each shot nearly free, which reads as chaos rather than
     * difficulty — there is nothing to dodge when everything is a pinprick and
     * there are too many to see. Fewer guns, each one worth avoiding.
     */
    damageScale: 4.7,

    /**
     * Projectile physics — the thing that was actually wrong.
     *
     * Enemy shots travelled at 260-430 px/s against a player who moves at
     * 239-325. At parity you cannot dodge a bullet, only slowly out-walk it,
     * and a shot that crosses a 1200px field at 260 px/s is on screen for four
     * and a half SECONDS. Measured: 41-65 enemy bullets alive at once. That is
     * the wall of noise, and it was caused by bullet speed, not enemy count —
     * cutting the ships to a third barely touched it.
     *
     * Worse, it forced everything else: bullets you cannot avoid have to be
     * harmless, so a hit cost 0.3-1.6% of hull and nothing was worth
     * respecting. Every tuning pass that followed was adjusting how much a
     * raindrop hurts inside a rainstorm you cannot step out of.
     *
     * Fast shots cross in about a second, so the screen stays readable and a
     * shot becomes a discrete event you slip past. Because you can now avoid
     * them, they are allowed to hurt.
     */
    bulletSpeedScale: 2.9,

    /**
     * Enemies fire far less often, and mean it when they do.
     *
     * A fight was putting about 140 shots at the player. The pilot dodges 90%
     * of them — that part was never broken — but a tenth of a hundred and
     * forty is still thirteen hits, so each one had to be a pinprick and none
     * of it could matter. Around fifty shots a fight turns the same dodge rate
     * into four or five hits, which is few enough that a hit is allowed to
     * take a real bite, and few enough that dodging the next one is a decision
     * rather than a reflex you hold down.
     */
    fireRateScale: 0.22,

    /**
     * Seconds of visible wind-up before an enemy fires.
     *
     * "Dodge everything" is only fair if you can see it coming. Beams already
     * telegraphed; ordinary fire did not, so a faster bullet on its own would
     * just be an unfair one. The enemy flares, then shoots.
     */
    windup: 0.34,

    /**
     * Per-class toughness on top of each archetype's base hull.
     *
     * Not one global number: swarm enemies were dying to a single starting
     * weapon shot, while the same multiplier on an elite — which already
     * carries an elite flag and an encounter's threatBonus — produced capital
     * ships with 16,000 hull that took 80 seconds of unbroken fire to kill.
     */
    // Raised alongside the count cut so a fight is not over in half a minute:
    // a third of the ships have to carry roughly twice the hull between them.
    //
    // Elites get more again. A capital ship is meant to be a duel you learn
    // the rhythm of, and with its escort screen cut to a third it was dying in
    // twenty-two seconds — the whole encounter resolved before its later waves
    // had even arrived.
    // A duelist is 1 because it does not use this at all: its hull is
    // already an absolute pool computed in duelists/index.js, since one
    // opponent's toughness is the fight rather than a modifier on it.
    toughness: { swarm: 19.6, mid: 11.4, heavy: 7.4, elite: 5.8, duelist: 1 },

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
    damageGrowth: 1.008,

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

    /**
     * Global multiplier on ramming damage.
     *
     * Bumping into a ship was doing 17-47% of all the damage a fight dealt,
     * and four of the ten swarm archetypes had no guns at all — flying into
     * you was their entire design. So the thing that hurt was not the shooting
     * you can read and dodge, it was small fast objects touching you, which is
     * both unreadable and unfun. A collision is a scrape now; the guns are the
     * fight.
     */
    contactScale: 0.34,

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
    /**
     * No single blow may take more than this fraction of the hull bar.
     *
     * Death is meant to arrive at the end of a bad stretch, not out of a
     * clear sky — that is the design the rest of this file serves, and one
     * uncapped hit is the shortest route to breaking it. A named opponent's
     * heaviest move is a beam at five times its per-shot damage, which at
     * depth is most of a full bar in a single frame: the difference between
     * a fight you lost and a fight you did not get to have.
     *
     * Deliberately generous. It is a ceiling on catastrophe, not a softener:
     * almost nothing in the game reaches it, and the things that do are
     * supposed to be frightening.
     */
    maxHitFraction: 0.28,

    healPerEncounter: 0.06,

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
     * How many ships a fight fields.
     *
     * The old answer was "as many as will fit". A threat-8 Hostiles node put
     * twenty-eight ships on the field with two dozen alive at once, and the
     * screen was a wall of bullets nobody could read, let alone dodge. Volume
     * is not difficulty; it is noise that difficulty hides behind.
     *
     * The game these numbers describe instead: ten to twenty ships in a
     * shallow fight, a handful on screen at a time, each one carrying an
     * attack worth respecting. You are meant to be dodging every shot, and
     * that is only possible when you can see them.
     *
     * `budget` feeds waves that ask for "some ships"; `countScale` trims the
     * waves that name an exact number, so both kinds shrink together without
     * editing thirty-eight encounters by hand.
     */
    budgetBase: 17,
    budgetPerThreat: 0.55,
    countScale: 0.42,
  },

  // -------------------------------------------------------------------------
  // Duels
  // -------------------------------------------------------------------------
  /**
   * A Hostiles node is one ship now, not a crowd.
   *
   * The crowd was the problem. Ten ships each carrying a tenth of a fight
   * cannot any of them be interesting: none can afford an attack worth
   * learning, because ten of that attack at once is a wall. The fight was
   * therefore always the same fight — volume — wearing thirty-eight names.
   *
   * One named opponent can spend its whole budget on being itself: a
   * telegraphed move you learn to read, a movement pattern you learn to
   * exploit, a weakness you learn to wait for. That is a fight you can get
   * better at, which is the thing the crowd could never offer.
   *
   * The hull pool below is measured, not guessed. The reference pilot lands
   * 52 damage a second at threat 1 and 312 at threat 20 (tests/curve.js), a
   * 1.098 compounding curve — so a duelist's hull follows the same curve, and
   * the fight stays the same length at every depth. `hullBase` is set for
   * roughly fifty seconds of that output at the two thirds uptime a moving,
   * shooting opponent actually allows.
   */
  duels: {
    /**
     * Total hull+shield pool for the whole opponent at threat 1.
     *
     * Measured twice. The reference pilot lands 52 damage a second at threat
     * one, so this is about sixty-five seconds of theoretical output, which
     * comes out at forty-odd seconds of real fighting once dodging,
     * repositioning and the opponent's own evasion are paid for. Half of it
     * produced twenty-three-second fights, and twenty-three seconds is not
     * long enough to show the player a four-move opponent even once.
     */
    hullBase: 3300,

    /**
     * Matched to the player's measured damage growth, NOT to the swarm
     * curve. The ordinary enemy grows at 1.070 because ten of them arrive
     * together and the count carries the rest; a lone ship has to keep pace
     * with the player on its own or the deep map turns into target practice.
     */
    hullGrowth: 1.085,

    /**
    * Per-bullet damage at damageMul 1, before the global damage scale.
    *
    * Set so an ordinary shot costs about five per cent of the bar and the
    * heaviest telegraphed move about a fifth of it. At ten, which is what
    * the crowd's numbers suggested, a duel cost 37% of the hull and killed
    * the reference pilot three times in ten: one opponent firing unthinned
    * puts as many shots in the air as the ten it replaced, so it cannot also
    * hit as hard as one of ten.
    */
    damageBase: 3.8,

    /**
     * Matched to the player's measured effective hull, which grows 1.051 a
     * level (246+73 at threat 1, 580+246 at twenty). The swarm figure of
     * 1.008 is almost flat because at depth you meet MORE guns; a duelist
     * only ever has its own, so its shots have to keep up on their own.
     */
    damageGrowth: 1.050,

    /**
     * Seconds of visible wind-up before an opponent's ordinary shot.
     *
     * Longer than the crowd's 0.34. A tell only has to compete with the other
     * tells on screen, and in a duel there are none — so it can afford to be
     * legible, and the fight can afford to hit harder because of it.
     */
    windup: 0.46,

    /**
     * Armour is folded back out of the hull pool.
     *
     * Armour multiplies effective hull, so a ship with 0.30 of it and the
     * same pool is a 43% longer fight for no reason the player can see. Since
     * a hundred duelists all have to take about the same time to kill,
     * armour buys texture — resistance to chip damage, a reason to hit it
     * with something bigger — rather than duration.
     */
    armourCompensation: true,

    /**
     * How much of its own hull an opponent may put back over a whole fight.
     *
     * The same lesson the player's healing taught, learned again from the
     * other side. Repair Weave mends fifteen per cent of the bar every
     * fourteen seconds, which is a little over one per cent a second: against
     * a lightly armoured hull that is a texture, and against a heavily
     * armoured one it is more than the reference pilot's entire net damage
     * output. Six of the hundred were literally unkillable — not hard,
     * unkillable — and the fight ran to the three-minute cap with the ship
     * above half hull.
     *
     * A budget keeps mending as a phase that resets a fight's momentum, and
     * stops it being a wall the player cannot get through.
     */
    healPerFight: 0.35,

    /**
     * Ability damage, as a fraction of the ship's ordinary shot.
     *
     * A special move is several hits, a wide beam or a lingering field, so
     * pricing each one at a full shot's worth made abilities most of the
     * incoming damage in the game: sixteen casts a fight, and a deep-band
     * opponent carrying three moves took forty-nine per cent of the hull bar
     * where a shallow one carrying a single move took eleven. The ships were
     * not the difference. The ability COUNT was — which meant difficulty was
     * being set by a decision five authors made about flavour.
     *
     * So the budget is per ship, not per move: `2 / (1 + moves)` splits it
     * between them. One move lands at full weight, four at two fifths each.
     * A four-move opponent is still harder — more to read, more to time —
     * but it is harder because there is more of it, not because it was
     * silently handed four times the damage.
     */
    abilityDamageScale: 0.8,

    /** Hardest total damage reduction a duelist may reach, armour and all. */
    armourCeiling: 0.6,

    /** What clearing one pays, before the per-threat reward growth. */
    xpBase: 150,
    creditsBase: 46,

    /**
     * Seconds between an opponent's special moves, floor across all of them.
     *
     * Abilities declare their own cooldowns, but two landing together reads
     * as noise rather than as a move, and a hundred authors will eventually
     * line two up. One at a time, always.
     */
    abilityGap: 1.6,

    /** Seconds before an opponent may use any ability at all. */
    abilityGrace: 3.5,
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
export const DUEL_TUNING = BALANCE.duels;
