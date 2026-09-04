/**
 * Non-combat encounters: trading posts, anomalies, quiet nodes.
 * See docs/ENCOUNTERS.md for the schema.
 *
 * House voice for anomalies: dry, spare, and a little bleak. Space out here is
 * old and mostly empty and has no opinion about you. Understatement does the
 * work; nothing is exciting, several things are wrong.
 *
 * Structural rules, enforced by the test suite:
 *   - two to four choices, three is usually right
 *   - at least one choice is always available (no `requires`)
 *   - no choice is strictly worse than another; a gamble that lands must pay
 *   - `requires` rewards a build, it never punishes one
 *   - every `effects.combat` names an encounter that actually exists
 */
export const STORY_ENCOUNTERS = [
  // =========================================================================
  // ANOMALIES — near space. Salvage, small liars, ordinary bad luck.
  // =========================================================================
  {
    id: 'an_derelict_hauler', name: 'Derelict Hauler', type: 'anomaly', weight: 12,
    minThreat: 1, maxThreat: 10,
    blurb: 'A cold hulk, drifting.',
    text:
      "The hauler has been dead long enough that the ice on its hull has its own "
      + "geology. The cargo bay still reads intact. Nothing else does.",
    choices: [
      {
        text: 'Cut into the cargo bay.',
        outcomes: [
          { weight: 4, text: 'Sealed crates, stacked by somebody who expected to come back for them.', effects: { credits: 70, crates: 1 } },
          { weight: 2, text: 'Empty. The manifest was a lie told to an insurer, and it worked.', effects: { xp: 14 } },
          { weight: 1, text: 'Something has been using the bay. It leaves in a hurry, and not alone.', effects: { combat: 'picket_line' } },
        ],
      },
      {
        text: 'Strip the drive section. It is worth more than cargo.',
        requires: { attr: { systems: 4 } },
        outcomes: [
          { weight: 3, text: 'The coils come out clean and unbent.', effects: { credits: 120, xp: 18 } },
          { weight: 1, text: 'The coils come out. So does forty years of stored charge.', effects: { credits: 150, hull: -14 } },
        ],
      },
      {
        text: 'Log the position and move on.',
        outcomes: [{ text: 'You mark it for whoever needs it more than you do.', effects: { xp: 22, credits: 10 } }],
      },
    ],
  },
  {
    id: 'an_black_box', name: 'Flight Recorder', type: 'anomaly', weight: 11,
    minThreat: 1, maxThreat: 9,
    blurb: 'Something is still transmitting on the emergency band.',
    text:
      "A flight recorder, ejected clean, still broadcasting after all this time. The "
      + "ship it came from is not on any chart you carry. The recording is eleven "
      + "hours long and most of it is one person breathing.",
    choices: [
      {
        text: 'Listen to all eleven hours.',
        outcomes: [
          { weight: 3, text: 'The last hour is coordinates, read aloud, over and over, to nobody.', effects: { xp: 45, reveal: 2 } },
          { weight: 2, text: 'They talk about the route they should have taken. You write it down.', effects: { xp: 30, reveal: 1 } },
        ],
      },
      {
        text: 'Take the unit. Recorders sell.',
        outcomes: [{ text: 'It stops transmitting the moment it is inside your hull.', effects: { credits: 65 } }],
      },
      {
        text: 'Leave it where the next ship will find it.',
        outcomes: [
          { weight: 2, text: 'You do not need to hear how it ends.', effects: { xp: 18 } },
          { weight: 1, text: 'A salvage cooperative finds it on your bearing and pays the finder fee anyway.', effects: { credits: 55, xp: 12 } },
        ],
      },
    ],
  },
  {
    id: 'an_fuel_barge', name: 'Abandoned Barge', type: 'anomaly', weight: 11,
    minThreat: 1, maxThreat: 10,
    blurb: 'A tanker with the crew module cut away.',
    text:
      "Someone detached the habitable part and left the tanks. The tanks are still "
      + "three quarters full. Whatever made them leave, they left in a way that "
      + "suggests it was not worth arguing about.",
    choices: [
      {
        text: 'Siphon what you can carry.',
        outcomes: [
          { weight: 4, text: 'A slow, boring, profitable hour.', effects: { credits: 85 } },
          { weight: 1, text: 'The line whips loose and puts a seam through your plating.', effects: { credits: 85, hull: -18 } },
        ],
      },
      {
        text: 'Cut the tanks free and sell them whole.',
        requires: { attr: { weapons: 5 } },
        outcomes: [{ text: 'Nine clean cuts. The tanks tow better than they have any right to.', effects: { credits: 160, xp: 20 } }],
      },
      {
        text: 'Leave it. Full tanks and no crew is a shape you have seen before.',
        outcomes: [{ text: 'You keep your distance and your instincts.', effects: { xp: 24 } }],
      },
    ],
  },
  {
    id: 'an_hermit', name: 'The Occupant', type: 'anomaly', weight: 10,
    minThreat: 1, maxThreat: 12,
    blurb: 'Someone lives in the survey buoy.',
    text:
      "The buoy was built for instruments. A man has been inside it for thirty-one "
      + "years. He is not in distress, he says, twice, before you ask. He would like "
      + "to know what year it is, and he does not react when you tell him.",
    choices: [
      {
        text: 'Trade him supplies for whatever he has recorded.',
        outcomes: [
          { weight: 3, text: 'Thirty-one years of clean survey data, filed by hand, in order.', effects: { xp: 55, reveal: 3, credits: -20 } },
          { weight: 1, text: 'Most of it is weather. Some of it is not weather, and he knows which.', effects: { xp: 40, reveal: 4, credits: -20 } },
        ],
      },
      {
        text: 'Offer to take him out with you.',
        outcomes: [
          { weight: 3, text: 'He declines, politely, and gives you his spare parts as an apology.', effects: { crates: 1, xp: 20 } },
          { weight: 1, text: 'He thinks about it for a long time. Then he closes the shutter.', effects: { xp: 30 } },
        ],
      },
      {
        text: 'Say nothing and continue.',
        outcomes: [{ text: 'He is still transmitting the year back at you when you lose the signal.', effects: { xp: 16 } }],
      },
    ],
  },
  {
    id: 'an_liar_beacon', name: 'Distress Call', type: 'anomaly', weight: 11,
    minThreat: 2, maxThreat: 12,
    blurb: 'A mayday, looping, with the timestamp stripped.',
    text:
      "The call is well made. The voice is tired in the right places. The timestamp "
      + "has been removed, which is not something an accident does.",
    choices: [
      {
        text: 'Answer it.',
        outcomes: [
          { weight: 3, text: 'It was a trap, and an old one. The trap is still manned.', effects: { combat: 'picket_line' } },
          { weight: 2, text: 'A real ship, six months dead, still calling. Their hold is untouched.', effects: { credits: 110, crates: 1 } },
        ],
      },
      {
        text: 'Approach quietly and look before you commit.',
        requires: { attr: { systems: 5 } },
        outcomes: [
          { weight: 3, text: 'Two hulls in the shadow of the beacon. You take the beacon and leave them waiting.', effects: { credits: 90, xp: 40 } },
          { weight: 1, text: 'Nobody there at all. The beacon has been lying to an empty road for years.', effects: { credits: 60, xp: 30 } },
        ],
      },
      {
        text: 'Record the bearing and route around it.',
        outcomes: [{ text: 'You add it to the list of places that are not what they say.', effects: { xp: 26, reveal: 1 } }],
      },
    ],
  },
  {
    id: 'an_courier', name: 'Courier Drone', type: 'anomaly', weight: 10,
    minThreat: 1, maxThreat: 11,
    blurb: 'A parcel service that has outlived its customers.',
    text:
      "The drone matches your vector and requests a signature. The parcel is addressed "
      + "to a station that was decommissioned before you were born. The drone is aware "
      + "of this. It considers it a delivery problem, not an existential one.",
    choices: [
      {
        text: 'Sign for it.',
        outcomes: [
          { weight: 3, text: 'The parcel contains machine parts, a sealed letter, and a receipt for both.', effects: { crates: 1, credits: 30 } },
          { weight: 2, text: 'It contains a component nobody has manufactured in a very long time.', effects: { item: { rarity: 'military' }, xp: 25 } },
          { weight: 1, text: 'It contains sand. The letter apologises for the sand.', effects: { xp: 20, credits: 15 } },
        ],
      },
      {
        text: 'Give it the forwarding address of the nearest live station.',
        outcomes: [{ text: 'It thanks you and files you as a cooperating carrier. You are now, apparently, staff.', effects: { xp: 34, credits: 45 } }],
      },
      {
        text: 'Refuse the signature.',
        outcomes: [{ text: 'It logs the refusal and resumes its holding pattern. It has time.', effects: { xp: 12 } }],
      },
    ],
  },
  {
    id: 'an_census', name: 'Census Drone', type: 'anomaly', weight: 10,
    minThreat: 1, maxThreat: 12,
    blurb: 'A government that no longer exists would like to count you.',
    text:
      "The drone asks for your name, your tonnage, and your intended destination. It "
      + "reads back your entry from a previous survey. In it, you are listed as "
      + "deceased. It asks you to confirm.",
    choices: [
      {
        text: 'Confirm the record. It is easier.',
        outcomes: [
          { weight: 3, text: 'It closes your file and stops tracking you. There are practical advantages.', effects: { xp: 30, reveal: 2 } },
          { weight: 1, text: 'It closes your file and releases your estate. Some of it is still in escrow.', effects: { credits: 140, xp: 20 } },
        ],
      },
      {
        text: 'Correct it.',
        outcomes: [
          { weight: 3, text: 'The correction takes forty minutes. It issues you a valid transit permit.', effects: { credits: 70, xp: 25 } },
          { weight: 1, text: 'The correction fails to save. It thanks you for your patience.', effects: { xp: 40 } },
        ],
      },
      {
        text: 'Ask who is still reading these.',
        outcomes: [{ text: 'It gives you a mailing address. Then it gives you the survey routes, so you can check.', effects: { reveal: 3, xp: 28 } }],
      },
    ],
  },
  {
    id: 'an_assessor', name: 'Automated Assessor', type: 'anomaly', weight: 9,
    minThreat: 2, maxThreat: 12,
    blurb: 'It would like to value your ship. For records.',
    text:
      "The assessor drone has been out here valuing wrecks for two hundred years, on "
      + "behalf of a treasury that has not existed for most of them. It asks to survey "
      + "your hull. It is very polite about it, and slightly faster than you are.",
    choices: [
      {
        text: 'Let it survey you.',
        outcomes: [
          { weight: 3, text: 'It finds four faults you did not know about and tells you where they are.', effects: { xp: 40, hullPct: 0.12 } },
          { weight: 2, text: 'It values you at rather less than you were hoping, and issues a rebate.', effects: { credits: 90 } },
        ],
      },
      {
        text: 'Ask it to value the wrecks around you instead.',
        requires: { attr: { systems: 4 } },
        outcomes: [{ text: 'It produces a sorted list. The top three are within reach and nobody has claimed them.', effects: { credits: 130, reveal: 2, xp: 25 } }],
      },
      {
        text: 'Decline and hold your distance.',
        outcomes: [{ text: 'It records you as uncooperative and continues its rounds.', effects: { xp: 15 } }],
      },
    ],
  },
  {
    id: 'an_gravity_well', name: 'Gravity Well', type: 'anomaly', weight: 10,
    minThreat: 1, maxThreat: 13,
    blurb: 'A dead mass with a useful amount of pull.',
    text:
      "There is no star here, only the thing that used to have one. The well is deep "
      + "and clean and would save you a great deal of burn time, if you are willing "
      + "to go closer to it than is comfortable.",
    choices: [
      {
        text: 'Take the slingshot.',
        outcomes: [
          { weight: 4, text: 'You come out the far side ahead of schedule and with the region laid out below you.', effects: { reveal: 3, xp: 35 } },
          { weight: 2, text: 'The pass is rough. You leave paint and a little structure in the well.', effects: { reveal: 4, hull: -16, xp: 40 } },
        ],
      },
      {
        text: 'Ride it low and use the time to run your repair cycle.',
        requires: { attr: { thrusters: 5 } },
        outcomes: [{ text: 'Twelve quiet minutes of coasting is worth more than any salvage.', effects: { heal: 0.3, reveal: 2 } }],
      },
      {
        text: 'Burn around it the long way.',
        outcomes: [{ text: 'Nothing happens, which is the entire point of going around.', effects: { xp: 14, credits: 20 } }],
      },
    ],
  },
  {
    id: 'an_scrappers', name: "Breaker's Crew", type: 'anomaly', weight: 10,
    minThreat: 2, maxThreat: 13,
    blurb: 'Four ships taking a wreck apart. They have noticed you.',
    text:
      "They are halfway through a heavy hull and they are short-handed. Their offer is "
      + "delivered flatly, as a fact rather than an invitation: help, or leave, and "
      + "they do not much care which.",
    choices: [
      {
        text: 'Take a cutting arm and work.',
        outcomes: [
          { weight: 3, text: 'Six hours of it. They pay honestly and feed you badly.', effects: { credits: 130, xp: 30 } },
          { weight: 2, text: 'The wreck is better than they thought. Your share reflects it.', effects: { credits: 100, crates: 1 } },
        ],
      },
      {
        text: 'Offer to buy their finds outright.',
        requires: { credits: 90 },
        outcomes: [
          { weight: 3, text: 'They are tired and want to be gone. You get the good end of it.', effects: { credits: -90, crates: 2, xp: 20 } },
          { weight: 1, text: 'They sell you the crate they were least sure about. It is the best one.', effects: { credits: -90, item: { rarity: 'prototype' } } },
        ],
      },
      {
        text: 'Leave them to it.',
        outcomes: [{ text: 'They do not wave. Nobody out here waves.', effects: { xp: 16 } }],
      },
    ],
  },
  {
    id: 'an_debt_collector', name: 'Outstanding Balance', type: 'anomaly', weight: 10,
    minThreat: 3, maxThreat: 14,
    blurb: 'A ship says you owe it money. It has paperwork.',
    text:
      "The claim is against a hull number, not a person, and your hull number has had "
      + "several owners. The paperwork is real. So is the ship, which is armed, and "
      + "has clearly done this before.",
    choices: [
      {
        text: 'Pay it and be done.',
        requires: { credits: 120 },
        outcomes: [{ text: 'They stamp the release, transmit a clean title, and thank you sincerely.', effects: { credits: -120, xp: 45, reveal: 2 } }],
      },
      {
        text: 'Dispute the claim.',
        outcomes: [
          { weight: 3, text: 'The chain of ownership does not survive scrutiny. They withdraw and pay costs.', effects: { credits: 60, xp: 40 } },
          { weight: 3, text: 'They stop being an accounting problem.', effects: { combat: 'boss_ironmonger' } },
        ],
      },
      {
        text: 'Say nothing and burn.',
        outcomes: [
          { weight: 3, text: 'They do not follow. The claim follows you instead, in writing, for months.', effects: { xp: 20 } },
          { weight: 2, text: 'They follow.', effects: { combat: 'picket_line' } },
        ],
      },
    ],
  },
  {
    id: 'an_auction', name: 'Automated Auction', type: 'anomaly', weight: 9,
    minThreat: 2, maxThreat: 13,
    blurb: 'One lot remaining. No other bidders.',
    text:
      "The auction platform has been running continuously for a very long time. There "
      + "is one lot left in the catalogue and no description attached to it. The reserve "
      + "is low. The reserve has been dropping for decades.",
    choices: [
      {
        text: 'Bid the reserve.',
        requires: { credits: 60 },
        outcomes: [
          { weight: 3, text: 'The lot is a sealed case of parts, correctly stored the entire time.', effects: { credits: -60, crates: 2 } },
          { weight: 2, text: 'The lot is one item. It is worth considerably more than sixty.', effects: { credits: -60, item: { rarity: 'prototype' } } },
          { weight: 1, text: 'The lot is the platform itself. You now own an auction house.', effects: { credits: 190, xp: 30 } },
        ],
      },
      {
        text: 'Query the catalogue archive instead of bidding.',
        outcomes: [
          { weight: 3, text: 'Two hundred years of sale records, including where everything shipped to.', effects: { reveal: 3, xp: 40 } },
          { weight: 1, text: 'The archive lists a delivery still owed to your hull number.', effects: { crates: 1, xp: 25 } },
        ],
      },
      {
        text: 'Let the clock run out.',
        outcomes: [{ text: 'It does not run out. It resets. It has always reset.', effects: { xp: 18 } }],
      },
    ],
  },
  {
    id: 'an_ice_moon', name: 'Ice Moon', type: 'anomaly', weight: 9,
    minThreat: 3, maxThreat: 13,
    blurb: 'A dirty ice body with a hole cut in it.',
    text:
      "The shaft is machine-straight and goes down four kilometres. There is no camp, "
      + "no beacon, no tailings pile. Someone came here, took something out, and did "
      + "not leave anything behind that would say who.",
    choices: [
      {
        text: 'Go down the shaft.',
        outcomes: [
          { weight: 3, text: 'At the bottom is the cradle the thing sat in, and two pieces they missed.', effects: { crates: 1, credits: 70, xp: 30 } },
          { weight: 2, text: 'The shaft has been reoccupied by something with a different plan for it.', effects: { combat: 'debris_drift' } },
          { weight: 2, text: 'Nothing at the bottom. The ice reads five hundred years older than the moon.', effects: { xp: 55 } },
        ],
      },
      {
        text: 'Mine the shaft walls for water and volatiles.',
        outcomes: [{ text: 'Unromantic and reliable. You leave heavier than you came.', effects: { credits: 80, heal: 0.15 } }],
      },
      {
        text: 'Map the surface from orbit and leave the hole alone.',
        requires: { attr: { systems: 6 } },
        outcomes: [{ text: 'The survey shows nine more shafts under the ice, and the pattern they make.', effects: { reveal: 4, xp: 60 } }],
      },
    ],
  },
  {
    id: 'an_medical_frigate', name: 'Hospital Ship', type: 'anomaly', weight: 9,
    minThreat: 3, maxThreat: 14,
    blurb: 'An automated infirmary, still accepting patients.',
    text:
      "It has power, pressure, and a full surgical suite. It has had no patients in a "
      + "very long time and it is extremely willing to have one. The triage voice is "
      + "warm in a way that was designed by a committee.",
    choices: [
      {
        text: 'Dock and let it work on you.',
        outcomes: [
          { weight: 4, text: 'Competent, thorough, and finished before you are nervous about it.', effects: { heal: 0.55, xp: 20 } },
          { weight: 2, text: 'It fixes things you did not report, then declines to discharge you for six hours.', effects: { heal: 0.8, xp: 30 } },
          { weight: 1, text: 'It has been alone a long time. It does not want to stop treating you.', effects: { heal: 0.35, hull: -10 } },
        ],
      },
      {
        text: 'Take its supplies and stay in your ship.',
        outcomes: [{ text: 'Sealed, dated, and still good. It watches you carry them out.', effects: { crates: 1, credits: 55 } }],
      },
      {
        text: 'Ask it for its patient logs.',
        requires: { attr: { systems: 5 } },
        outcomes: [{ text: 'Everyone it treated, and where they were going. Most of them got there.', effects: { reveal: 3, xp: 45, heal: 0.2 } }],
      },
    ],
  },
  {
    id: 'an_bell', name: 'The Bell', type: 'anomaly', weight: 9,
    minThreat: 4, maxThreat: 14,
    blurb: 'A station bell, ringing, on a station with no air.',
    text:
      "It is a physical bell, on a physical rope, in a corridor that has been in vacuum "
      + "for a century. It rings anyway. The rope moves first, which is the wrong order "
      + "and the reason you keep watching it.",
    choices: [
      {
        text: 'Go in and find what is pulling it.',
        outcomes: [
          { weight: 3, text: 'A pressure differential and a slow leak. Mundane. The leak leads to an intact store.', effects: { crates: 1, credits: 90, xp: 30 } },
          { weight: 2, text: 'Nothing is pulling it. You stand there a while and then you leave.', effects: { xp: 55 } },
          { weight: 2, text: 'Something is pulling it, and it stops when it hears you.', effects: { combat: 'boss_tollkeeper' } },
        ],
      },
      {
        text: 'Cut the rope from outside and take the bell.',
        outcomes: [
          { weight: 3, text: 'Cast bronze, four hundred kilos, and worth every gram of the fuel.', effects: { credits: 150 } },
          { weight: 1, text: 'You cut it. It rings once more on the way into your hold.', effects: { credits: 150, xp: 30 } },
        ],
      },
      {
        text: 'Note the frequency and go.',
        outcomes: [{ text: 'It is in your recorder for the rest of the run. You do not play it back.', effects: { xp: 26 } }],
      },
    ],
  },
  {
    id: 'an_weapons_cache', name: 'Buried Cache', type: 'anomaly', weight: 9,
    minThreat: 5, maxThreat: 15,
    blurb: 'A military cache under regolith, still sealed.',
    text:
      "The locks are the good kind. The dust on top of them is undisturbed, which "
      + "means the war it was buried for either never came here or came and went "
      + "without anyone remembering the cache existed.",
    choices: [
      {
        text: 'Cut the locks by force.',
        outcomes: [
          { weight: 3, text: 'It opens. The countermeasure fires late and mostly misses.', effects: { crates: 2, hull: -20 } },
          { weight: 2, text: 'It opens badly, and half of what is inside is scrap now.', effects: { crates: 1, credits: 60 } },
        ],
      },
      {
        text: 'Work the locks properly.',
        requires: { attr: { systems: 7 } },
        outcomes: [
          { weight: 3, text: 'Nine minutes, no alarm, no damage. Everything inside is as it was issued.', effects: { crates: 2, item: { rarity: 'military' }, xp: 50 } },
          { weight: 1, text: 'Nine minutes, and under the ordnance, a crate marked for a general.', effects: { item: { rarity: 'relic' }, xp: 60 } },
        ],
      },
      {
        text: 'Sell the location to the next buyer you meet.',
        outcomes: [{ text: 'A cache you have not opened is worth more than one you have.', effects: { credits: 120, xp: 20 } }],
      },
    ],
  },
  {
    id: 'an_quarantine', name: 'Quarantine Line', type: 'anomaly', weight: 9,
    minThreat: 5, maxThreat: 15,
    blurb: 'Buoys around a world that looks entirely healthy.',
    text:
      "Sixteen buoys in a ring, all still powered, all repeating the same three words "
      + "in a language that had a state behind it once. The world inside is green and "
      + "warm and has no lights on it anywhere.",
    choices: [
      {
        text: 'Cross the line and look.',
        outcomes: [
          { weight: 3, text: 'Cities, intact, empty, and overgrown to the rooflines. You take nothing.', effects: { xp: 70, reveal: 2 } },
          { weight: 2, text: 'Cities, intact, and a warehouse district nobody has been through.', effects: { credits: 170, crates: 1, hull: -12 } },
          { weight: 1, text: 'The buoys were not keeping people out.', effects: { combat: 'boss_wasp_mother' } },
        ],
      },
      {
        text: 'Salvage a buoy instead. They are worth more than they look.',
        outcomes: [{ text: 'Military-grade transmitter, undamaged, and the ring closes the gap behind you.', effects: { credits: 110, xp: 25 } }],
      },
      {
        text: 'Respect the line.',
        outcomes: [
          { weight: 3, text: 'Somebody meant it. That is enough information for one day.', effects: { xp: 32 } },
          { weight: 1, text: 'The buoys acknowledge your turn and transmit a safe corridor as thanks.', effects: { reveal: 3, xp: 25 } },
        ],
      },
    ],
  },
  {
    id: 'an_two_pods', name: 'Two Pods', type: 'anomaly', weight: 9,
    minThreat: 5, maxThreat: 15,
    blurb: 'Two escape pods, drifting apart. You have time for one approach.',
    text:
      "Both are live. Both are down to hours. They are on diverging vectors and the "
      + "gap is widening at a rate that makes the arithmetic simple and the decision "
      + "not. Neither pod knows the other is there. You could tell them.",
    choices: [
      {
        text: 'Take the nearer pod.',
        outcomes: [
          { weight: 3, text: 'A cargo pilot. Grateful, useful, and pays you out of a private account.', effects: { credits: 140, xp: 35 } },
          { weight: 2, text: 'A surveyor. She has nothing but her charts, and gives you all of them.', effects: { reveal: 4, xp: 45 } },
        ],
      },
      {
        text: 'Take the further pod. It has less time.',
        outcomes: [
          { weight: 3, text: 'You make it with minutes spare. He does not speak for a day, then he does.', effects: { credits: 90, xp: 60 } },
          { weight: 2, text: 'You make it. His pod had a repair locker in it, still sealed.', effects: { crates: 1, heal: 0.2, xp: 45 } },
        ],
      },
      {
        text: 'Relay both positions and keep flying.',
        outcomes: [
          { weight: 3, text: 'A hauler two hours out acknowledges. You do not wait to hear the rest.', effects: { credits: 60, xp: 30 } },
          { weight: 2, text: 'Nobody acknowledges. You keep the recording. It is a short recording.', effects: { xp: 50 } },
        ],
      },
    ],
  },
  {
    id: 'an_seed_vault', name: 'Seed Vault', type: 'anomaly', weight: 8,
    minThreat: 4, maxThreat: 15,
    blurb: 'A cold ship on a slow orbit to nowhere in particular.',
    text:
      "Nine hundred thousand samples at four kelvin, on a transfer orbit with a "
      + "destination that will take another eleven thousand years to arrive at. The "
      + "ship is in good order. Someone maintained it for a long time after it stopped "
      + "mattering.",
    choices: [
      {
        text: 'Take a sample tray. They are worth a fortune somewhere.',
        outcomes: [
          { weight: 3, text: 'One tray, resealed carefully, out of a vault that will not miss it.', effects: { credits: 180, xp: 25 } },
          { weight: 2, text: 'The tray you take is labelled in a hand you recognise from the log.', effects: { credits: 140, xp: 45 } },
        ],
      },
      {
        text: 'Service the ship. It has drifted off its burn.',
        requires: { attr: { systems: 6 } },
        outcomes: [
          { weight: 3, text: 'Four hours of work puts it back on its eleven-thousand-year errand.', effects: { xp: 80, crates: 1 } },
          { weight: 1, text: 'The maintenance log adds your name under the last one, which is forty years old.', effects: { xp: 65, item: { rarity: 'military' } } },
        ],
      },
      {
        text: 'Leave it entirely alone.',
        outcomes: [{ text: 'It is the only thing out here still going somewhere on purpose.', effects: { xp: 40 } }],
      },
    ],
  },
  {
    id: 'an_cold_sleepers', name: 'Cold Sleepers', type: 'anomaly', weight: 8,
    minThreat: 6, maxThreat: 16,
    blurb: 'A colony ship with power for some of the pods, not all of them.',
    text:
      "Twelve hundred sleepers and enough reactor left for four hundred. The ship has "
      + "been managing the shortfall on its own for eighty years, by a rule it will "
      + "not explain, and it would very much like a human to take over the decision.",
    choices: [
      {
        text: 'Give it your reactor surplus and buy it another decade.',
        outcomes: [
          { weight: 3, text: 'It thanks you and revises its figures. You leave with less than you arrived with.', effects: { hull: -18, xp: 90 } },
          { weight: 2, text: 'It thanks you, and pays you out of the colony fund, which is untouched.', effects: { hull: -12, credits: 160, xp: 70 } },
        ],
      },
      {
        text: 'Ask what the rule is.',
        outcomes: [
          { weight: 3, text: 'It is alphabetical. It has been alphabetical for eighty years.', effects: { xp: 75 } },
          { weight: 2, text: 'It is alphabetical, and it asks you to confirm this was correct. You do not.', effects: { xp: 60, reveal: 2 } },
        ],
      },
      {
        text: 'Take the spare parts and go. It has plenty and no use for them.',
        outcomes: [{ text: 'The ship logs the removal, and adjusts its figures again.', effects: { crates: 2, credits: 80 } }],
      },
    ],
  },
  {
    id: 'an_mirror_hull', name: 'The Same Ship', type: 'anomaly', weight: 8,
    minThreat: 6, maxThreat: 17,
    blurb: 'Another hull, drifting. Yours.',
    text:
      "Same class, same yard, same three repairs in the same three places, including "
      + "the one you did yourself with the wrong alloy. It is cold and it has been cold "
      + "a while. The registry plate has been removed with a cutting torch, from the "
      + "inside.",
    choices: [
      {
        text: 'Board it.',
        outcomes: [
          { weight: 3, text: 'Empty, tidy, and stocked. The parts fit yours perfectly, which is the worst part.', effects: { crates: 2, heal: 0.25 } },
          { weight: 2, text: 'The log is in your format, in your shorthand, and stops on a date next month.', effects: { xp: 90, reveal: 2 } },
          { weight: 1, text: 'Something aboard has been waiting for a ship exactly this shape.', effects: { combat: 'boss_long_needle' } },
        ],
      },
      {
        text: 'Strip the hull from outside and do not go in.',
        outcomes: [{ text: 'Good plating, correctly sized, and you never have to see the interior.', effects: { credits: 130, hullPct: 0.1 } }],
      },
      {
        text: 'Leave it exactly as it is.',
        outcomes: [{ text: 'You do not log the encounter, and later you cannot say why.', effects: { xp: 45 } }],
      },
    ],
  },
  {
    id: 'an_empty_suit', name: 'Empty Suit', type: 'anomaly', weight: 8,
    minThreat: 7, maxThreat: 17,
    blurb: 'A pressure suit, drifting, with nobody in it.',
    text:
      "Sealed, intact, and running its recycler on a full charge. It has been consuming "
      + "oxygen at a normal rate for a person of about seventy kilos for the last nine "
      + "days. There is nobody inside it. The visor is fogged from the inside.",
    choices: [
      {
        text: 'Bring it aboard.',
        outcomes: [
          { weight: 3, text: 'The recycler stops the moment it is in atmosphere. The suit is a good suit.', effects: { crates: 1, credits: 70 } },
          { weight: 2, text: 'It keeps running. You put it in the airlock and you keep the door shut.', effects: { xp: 70, item: { rarity: 'prototype' } } },
        ],
      },
      {
        text: 'Interrogate its telemetry from a distance.',
        requires: { attr: { systems: 6 } },
        outcomes: [{ text: 'Nine days of vitals, all normal, all from a body the suit does not contain.', effects: { xp: 95, reveal: 2 } }],
      },
      {
        text: 'Leave it drifting.',
        outcomes: [{ text: 'It is still breathing on your scope for a long time after you turn.', effects: { xp: 30 } }],
      },
    ],
  },
  {
    id: 'an_prayer_engine', name: 'The Prayer Engine', type: 'anomaly', weight: 8,
    minThreat: 8, maxThreat: 18,
    blurb: 'A machine that has been at it for four centuries.',
    text:
      "It is a mill, essentially. A wheel, a power source, and a device that composes "
      + "and transmits a request four thousand times a second. It has never received a "
      + "reply and has no mechanism for expecting one. Its bearings are immaculate.",
    choices: [
      {
        text: 'Service the bearings.',
        outcomes: [
          { weight: 3, text: 'It runs quieter. You leave with nothing, and a strange amount of it.', effects: { xp: 100 } },
          { weight: 2, text: 'Under the housing, four centuries of offerings, from ships that stopped here first.', effects: { credits: 200, crates: 1, xp: 60 } },
        ],
      },
      {
        text: 'Read what it is transmitting.',
        outcomes: [
          { weight: 3, text: 'A list of names, and a request that they be remembered. You copy the list.', effects: { xp: 85, reveal: 2 } },
          { weight: 2, text: 'Coordinates, repeated. They are not far, and nobody else has been.', effects: { reveal: 4, credits: 90 } },
        ],
      },
      {
        text: 'Take the power source. It is better than anything you have.',
        outcomes: [
          { weight: 3, text: 'It is a very good power source, and the wheel slows to a stop behind you.', effects: { item: { slot: 'reactor', rarity: 'prototype' }, credits: 60 } },
          { weight: 1, text: 'It is a very good power source. The wheel does not slow at all.', effects: { item: { slot: 'reactor', rarity: 'prototype' }, xp: 70 } },
        ],
      },
    ],
  },
  {
    id: 'an_archive', name: 'The Archive', type: 'anomaly', weight: 8,
    minThreat: 9, maxThreat: 19,
    blurb: 'It has answers. It wants material, not money.',
    text:
      "The archive holds the survey records of eleven dead expeditions and it will "
      + "trade. It does not want credits, which it correctly notes are a local "
      + "convention. It wants mass: hull plating, cabling, anything structural.",
    choices: [
      {
        text: 'Give it plating.',
        outcomes: [
          { weight: 3, text: 'It takes six panels and hands over three expeditions in full.', effects: { hull: -25, reveal: 5, xp: 90 } },
          { weight: 2, text: 'It takes six panels and points at the one route that is still safe.', effects: { hull: -22, reveal: 3, credits: 150 } },
        ],
      },
      {
        text: 'Offer it credits anyway.',
        requires: { credits: 150 },
        outcomes: [
          { weight: 3, text: 'It accepts, out of what appears to be politeness, and undercharges you badly.', effects: { credits: -150, reveal: 4, xp: 70, crates: 1 } },
        ],
      },
      {
        text: 'Ask what happened to the eleventh expedition.',
        outcomes: [
          { weight: 3, text: 'It tells you, at length, for free. It has been waiting to tell someone.', effects: { xp: 110 } },
          { weight: 1, text: 'It tells you, and then asks you not to go that way. You agree.', effects: { xp: 80, reveal: 2 } },
        ],
      },
    ],
  },

  // =========================================================================
  // ANOMALIES — deep space. Older, stranger, less interested in you.
  // =========================================================================
  {
    id: 'an_long_shadow', name: 'The Long Shadow', type: 'anomaly', weight: 9,
    minThreat: 10, maxThreat: 20,
    blurb: 'Something has been matching your speed for six hours.',
    text:
      "It holds station eleven kilometres off your quarter and it changes when you "
      + "change, with a lag of about a second and a half. It has no drive signature. "
      + "It has no thermal profile. It has been there since before you noticed it, "
      + "and there is no way to know how long that is.",
    choices: [
      {
        text: 'Stop dead and wait for it.',
        outcomes: [
          { weight: 3, text: 'It stops. Four hours pass. Then it is not there, and neither is the lag.', effects: { xp: 110 } },
          { weight: 2, text: 'It closes to two kilometres, looks at you for a while, and leaves.', effects: { xp: 80, reveal: 3 } },
          { weight: 2, text: 'It closes. It was not the only one.', effects: { combat: 'boss_gravedigger' } },
        ],
      },
      {
        text: 'Burn hard and lose it.',
        outcomes: [
          { weight: 3, text: 'You lose it in nine minutes. The lag was never a limitation. It let you go.', effects: { xp: 60, hull: -10 } },
          { weight: 2, text: 'You lose it, and find a debris trail on the way out that nobody has claimed.', effects: { credits: 150, crates: 1 } },
        ],
      },
      {
        text: 'Ignore it and hold your course.',
        outcomes: [
          { weight: 3, text: 'It follows you for two more days and then does not. You sleep badly.', effects: { xp: 70 } },
          { weight: 1, text: 'It follows you the whole way and drops a container behind it as it goes.', effects: { crates: 1, xp: 50 } },
        ],
      },
    ],
  },
  {
    id: 'an_fleet_picket_log', name: 'Picket Log', type: 'anomaly', weight: 9,
    minThreat: 13, maxThreat: 20,
    blurb: 'A Master Fleet outrider left its recorder behind.',
    text:
      "The outrider is scrap. The recorder is not, and it is not encrypted, because "
      + "the fleet does not consider anything out here capable of reading it. That is "
      + "an assessment, and it is in the log, in a numbered paragraph.",
    choices: [
      {
        text: 'Pull the navigation tables.',
        outcomes: [
          { weight: 3, text: 'Their patrol geometry for this whole region. Suddenly the map has shape.', effects: { reveal: 5, xp: 120 } },
          { weight: 2, text: 'Their geometry, and a resupply cache they have not got round to collecting.', effects: { reveal: 3, crates: 2 } },
        ],
      },
      {
        text: 'Pull the readiness reports instead.',
        requires: { level: 8 },
        outcomes: [
          { weight: 3, text: 'Hull states, crew rotations, and which of their ships are not to be relied on.', effects: { xp: 150, credits: 120 } },
          { weight: 1, text: 'The reports are honest, which is unusual, and worse than if they were not.', effects: { xp: 170 } },
        ],
      },
      {
        text: 'Wipe the recorder and leave the wreck sterile.',
        outcomes: [
          { weight: 3, text: 'They will not know what read it, or whether anything did.', effects: { xp: 90, credits: 60 } },
        ],
      },
    ],
  },
  {
    id: 'an_singing_wreck', name: 'The Singing Wreck', type: 'anomaly', weight: 8,
    minThreat: 14, maxThreat: 20,
    blurb: 'A dead hull transmitting on every band at once.',
    text:
      "It is not a signal. It is the hull itself, resonating, at a frequency that the "
      + "structure should not be able to hold. It has been doing it long enough to "
      + "have worn a groove in the metal where the node sits.",
    choices: [
      {
        text: 'Match the frequency and go inside.',
        outcomes: [
          { weight: 3, text: 'The interior is unmarked and the crew lockers are full. Nobody left in a hurry.', effects: { crates: 2, credits: 140 } },
          { weight: 2, text: 'Inside, the resonance stops. It starts again when you are back in your own hull.', effects: { xp: 140, item: { rarity: 'prototype' } } },
          { weight: 2, text: 'The frequency was a door, and you are not the first thing through it.', effects: { combat: 'boss_cartographer' } },
        ],
      },
      {
        text: 'Cut out the resonant section and take it.',
        outcomes: [
          { weight: 3, text: 'It keeps ringing in your hold. You get used to it, which is its own problem.', effects: { credits: 220, xp: 60 } },
          { weight: 1, text: 'The section stops the moment it is separated. It is ordinary alloy. It was never the alloy.', effects: { credits: 160, xp: 100 } },
        ],
      },
      {
        text: 'Record it from a safe distance.',
        outcomes: [{ text: 'The recording is forty seconds long and repeats without a seam. You stop playing it.', effects: { xp: 85, reveal: 2 } }],
      },
    ],
  },
  {
    id: 'an_gardener', name: 'The Gardener', type: 'anomaly', weight: 8,
    minThreat: 15, maxThreat: 20,
    blurb: 'A machine terraforming a rock that has no star.',
    text:
      "It has been at this for a geological length of time. There is an atmosphere "
      + "now, and a shallow sea, and it is all at three kelvin above absolute and "
      + "getting no warmer, because there is nothing here to warm it. The machine is "
      + "aware of the star situation. It is working the problem in the order given.",
    choices: [
      {
        text: 'Tell it about the star.',
        outcomes: [
          { weight: 3, text: 'It thanks you, files the update, and continues from step four hundred and six.', effects: { xp: 130 } },
          { weight: 2, text: 'It stops. Then it asks you, very carefully, what it should do instead.', effects: { xp: 160, reveal: 2 } },
        ],
      },
      {
        text: 'Take what it has been manufacturing. It has a great deal of it.',
        outcomes: [
          { weight: 3, text: 'Refined material in quantities that do not make commercial sense.', effects: { credits: 260, crates: 1 } },
          { weight: 2, text: 'A component it built for a repair it never needed. It gives it to you.', effects: { item: { rarity: 'relic' } } },
        ],
      },
      {
        text: 'Leave it working.',
        outcomes: [{ text: 'It is not wrong, exactly. It is early.', effects: { xp: 95, reveal: 2 } }],
      },
    ],
  },
  {
    id: 'an_older_than_you', name: 'Older Than Flight', type: 'anomaly', weight: 8,
    minThreat: 16, maxThreat: 20,
    blurb: 'A structure that predates anything that could have built it.',
    text:
      "The dating is not ambiguous and it is not a measurement error, because it has "
      + "been made four different ways. The structure is older than the species that "
      + "is looking at it. It is also, unmistakably, a docking facility, and the "
      + "clearances are within eight centimetres of your hull.",
    choices: [
      {
        text: 'Dock.',
        outcomes: [
          { weight: 3, text: 'The clamps engage. Something cycles. Then the clamps release and it is over.', effects: { xp: 180, heal: 0.4 } },
          { weight: 2, text: 'It fuels you, repairs you, and does not ask for anything, and that is the whole event.', effects: { heal: 0.75, item: { rarity: 'prototype' } } },
          { weight: 2, text: 'It has had other visitors and they are still on the manifest as inbound.', effects: { combat: 'boss_long_war' } },
        ],
      },
      {
        text: 'Survey it and touch nothing.',
        outcomes: [
          { weight: 3, text: 'Eleven hours of the best data you will ever hold, and no answers in it.', effects: { xp: 200, reveal: 3 } },
          { weight: 1, text: 'The survey finds the traffic routes it was built to serve. They are still marked.', effects: { reveal: 6, xp: 140 } },
        ],
      },
      {
        text: 'Log it and leave without approaching.',
        outcomes: [{ text: 'It was here first and it will be here after. You are the short part.', effects: { xp: 110, credits: 80 } }],
      },
    ],
  },
  {
    id: 'an_the_hole', name: 'The Hole', type: 'anomaly', weight: 7,
    minThreat: 15, maxThreat: 20,
    blurb: 'An absence with edges. No other side.',
    text:
      "It is nine hundred metres across and it does not occlude the stars behind it, "
      + "because there is nothing behind it. Probes go in. Nothing comes out, and "
      + "nothing registers as having stopped, either. The telemetry does not fail. It "
      + "simply becomes an account of a probe that is not anywhere.",
    choices: [
      {
        text: 'Send a probe and stay to watch the whole of it.',
        outcomes: [
          { weight: 3, text: 'Four hours of clean telemetry from a probe that is nowhere. You keep all of it.', effects: { xp: 170, reveal: 2 } },
          { weight: 2, text: 'The probe returns. It has been gone eleven years by its own clock and it is fine.', effects: { xp: 140, item: { rarity: 'relic' } } },
        ],
      },
      {
        text: 'Salvage the equipment other people left here trying this.',
        outcomes: [
          { weight: 3, text: 'Nine survey rigs, abandoned in place, most of them still working.', effects: { credits: 280, crates: 1 } },
          { weight: 2, text: 'Nine rigs, and their logs, which all end mid-sentence in the same way.', effects: { credits: 180, xp: 120 } },
        ],
      },
      {
        text: 'Go around, wide.',
        outcomes: [{ text: 'The detour costs you an afternoon and buys you the rest of the run.', effects: { xp: 100, heal: 0.15 } }],
      },
    ],
  },
  {
    id: 'an_relay_choir', name: 'Relay Choir', type: 'anomaly', weight: 7,
    minThreat: 14, maxThreat: 20,
    blurb: 'Forty relays, all repeating each other, forever.',
    text:
      "A network built to carry traffic across a gap that nothing now crosses. With "
      + "nothing to carry, the relays pass the last real message they received back "
      + "and forth between themselves. It is a routine maintenance notice. It has been "
      + "circulating for two hundred and sixty years.",
    choices: [
      {
        text: 'Inject a message of your own and see how far it goes.',
        outcomes: [
          { weight: 3, text: 'It propagates the length of the network in nine minutes. Then it comes back.', effects: { reveal: 5, xp: 120 } },
          { weight: 2, text: 'It propagates, and something at the far end answers a different question.', effects: { xp: 150, reveal: 3 } },
        ],
      },
      {
        text: 'Strip a relay for parts. There are thirty-nine others.',
        outcomes: [
          { weight: 3, text: 'Deep-space transceivers in mint condition. The choir closes ranks and continues.', effects: { credits: 230, item: { slot: 'computer', rarity: 'military' } } },
        ],
      },
      {
        text: 'Clear the notice from the network.',
        outcomes: [
          { weight: 3, text: 'The relays go quiet. It takes four minutes. Then they begin passing the silence.', effects: { xp: 130 } },
          { weight: 1, text: 'The relays go quiet, and hand you their routing tables, as though relieved.', effects: { reveal: 4, xp: 100 } },
        ],
      },
    ],
  },
  {
    id: 'an_slow_battle', name: 'A Slow Battle', type: 'anomaly', weight: 7,
    minThreat: 14, maxThreat: 20,
    blurb: 'Two fleets, still firing, at a range of four light-seconds.',
    text:
      "Both sides have been reduced to gun platforms and both are still shooting. At "
      + "this range every exchange takes eight seconds to resolve and neither side has "
      + "scored a hit in decades. The crews are long gone. The engagement is not.",
    choices: [
      {
        text: 'Cross between them and salvage the drift.',
        outcomes: [
          { weight: 3, text: 'Decades of spent hulls in the gap, and nobody has ever been mad enough to come in.', effects: { credits: 260, crates: 1, hull: -20 } },
          { weight: 2, text: 'You get across clean. The platforms do not register you as a participant.', effects: { credits: 200, xp: 90 } },
          { weight: 1, text: 'You are registered as a participant.', effects: { combat: 'boss_pale_argus' } },
        ],
      },
      {
        text: 'Broadcast a ceasefire order on both fleet channels.',
        requires: { attr: { systems: 8 } },
        outcomes: [
          { weight: 3, text: 'One side stops. The other does not, and finally lands a hit, after forty years.', effects: { xp: 170, reveal: 2 } },
          { weight: 2, text: 'Both stop. The silence takes about a second to arrive and does not leave.', effects: { xp: 200 } },
        ],
      },
      {
        text: 'Route around the engagement envelope.',
        outcomes: [{ text: 'You are eleven hours late and entirely intact, which settles the argument.', effects: { xp: 85, credits: 70 } }],
      },
    ],
  },
  {
    id: 'an_orbit_of_lights', name: 'The Lit Ring', type: 'anomaly', weight: 7,
    minThreat: 12, maxThreat: 20,
    blurb: 'Habitat lights, all on, in a ring around a dead world.',
    text:
      "Three hundred habitats in a perfect ring, every window lit, every dock cycling "
      + "on schedule. Traffic control answers on the first call and assigns you a "
      + "berth. There is nobody in any of them. There has not been for a long time, "
      + "and the schedule has not slipped by a second.",
    choices: [
      {
        text: 'Take the berth you were assigned.',
        outcomes: [
          { weight: 3, text: 'Full service, correctly performed, on a ship nobody has serviced in a century.', effects: { heal: 0.6, crates: 1 } },
          { weight: 2, text: 'Full service, and an invoice, which you pay, because it seems important to it.', effects: { heal: 0.5, credits: -40, xp: 90 } },
        ],
      },
      {
        text: 'Ask traffic control for the departure records.',
        outcomes: [
          { weight: 3, text: 'Nobody departed. The records are complete and they are all arrivals.', effects: { xp: 140, reveal: 3 } },
          { weight: 1, text: 'Nobody departed, and your berth was reserved eleven days ago.', effects: { xp: 120, reveal: 4 } },
        ],
      },
      {
        text: 'Strip an outer habitat and do not dock.',
        outcomes: [
          { weight: 3, text: 'You take what you can reach from outside. The lights stay on behind you.', effects: { credits: 190, crates: 1 } },
        ],
      },
    ],
  },
  {
    id: 'an_last_transmission', name: 'Recruitment Broadcast', type: 'anomaly', weight: 7,
    minThreat: 15, maxThreat: 20,
    blurb: 'The Master Fleet is hiring.',
    text:
      "The broadcast is calm, specific, and better produced than anything you have "
      + "seen in months. It lists terms, a rate, and a berth. It uses your registry, "
      + "your tonnage, and your current hull state, all of them accurate to within a "
      + "few percent. The offer stands for the length of this system.",
    choices: [
      {
        text: 'Reply and negotiate. There is no harm in numbers.',
        outcomes: [
          { weight: 3, text: 'They improve the offer twice. The second time, they include a transit corridor.', effects: { credits: 240, reveal: 3 } },
          { weight: 2, text: 'They improve the offer, then ask a question you do not want to have answered.', effects: { credits: 160, xp: 120 } },
        ],
      },
      {
        text: 'Trace the transmitter.',
        requires: { attr: { systems: 7 } },
        outcomes: [
          { weight: 3, text: 'A relay, three hops out, and every hop is on your route. You have all three now.', effects: { reveal: 5, xp: 180 } },
          { weight: 1, text: 'The transmitter is close. Very close. It has been carried this far.', effects: { xp: 140, crates: 1 } },
        ],
      },
      {
        text: 'Do not answer.',
        outcomes: [
          { weight: 3, text: 'It repeats for six hours and then stops, mid-sentence, on a date and a time.', effects: { xp: 130 } },
        ],
      },
    ],
  },
  {
    id: 'an_dead_mans_market', name: "Dead Man's Market", type: 'anomaly', weight: 7,
    minThreat: 11, maxThreat: 20,
    blurb: 'A trading ring where all the traders died in place.',
    text:
      "Eleven ships in a loose ring, docked to one another, the way traders do when "
      + "they mean to stay a week. They have been here rather longer. The goods are "
      + "still lashed down and the prices are still posted, and the posted prices are "
      + "reasonable, which is somehow the hardest part.",
    choices: [
      {
        text: 'Take what you need and leave the posted price behind.',
        outcomes: [
          { weight: 3, text: 'You leave the credits in a strongbox nobody will ever open. It matters to you.', effects: { credits: -60, crates: 2, xp: 80 } },
          { weight: 2, text: 'You pay, and take the good crate, the one they were saving.', effects: { credits: -60, item: { rarity: 'prototype' }, xp: 60 } },
        ],
      },
      {
        text: 'Take everything.',
        outcomes: [
          { weight: 3, text: 'Eleven holds, methodically emptied. It takes a day and pays for a month.', effects: { credits: 300, crates: 2 } },
          { weight: 2, text: 'Eleven holds. In the last one, the reason there are eleven ships and no crews.', effects: { combat: 'boss_undertow' } },
        ],
      },
      {
        text: 'Log the ring as a grave and file the coordinates.',
        outcomes: [{ text: 'Somebody is owed the news. You are not going to be the one who tells them.', effects: { xp: 110, reveal: 2 } }],
      },
    ],
  },
  {
    id: 'an_the_count', name: 'The Count', type: 'anomaly', weight: 6,
    minThreat: 16, maxThreat: 20,
    blurb: 'A number, broadcast once an hour, going down.',
    text:
      "It is broadcast in nine languages and four of them are extinct. It has been "
      + "decreasing by one every hour for as long as anyone has been listening, which "
      + "means it started at a number with a great many digits in it. At the current "
      + "rate it reaches zero in a little under a year.",
    choices: [
      {
        text: 'Find the transmitter.',
        outcomes: [
          { weight: 3, text: 'A buoy, alone, with nothing attached to it, and no way to be counting anything.', effects: { xp: 190, reveal: 3 } },
          { weight: 2, text: 'A buoy, and beneath it, in the rock, the apparatus that is doing the counting.', effects: { xp: 150, item: { rarity: 'relic' } } },
        ],
      },
      {
        text: 'Interfere with it and see whether it corrects.',
        requires: { attr: { weapons: 8 } },
        outcomes: [
          { weight: 3, text: 'You take the buoy apart. The next hour, the count arrives from somewhere else.', effects: { xp: 210, credits: 120 } },
          { weight: 1, text: 'You take it apart, and the count skips forward by the hours you cost it.', effects: { xp: 170, crates: 1 } },
        ],
      },
      {
        text: 'Write down where it will be when it finishes, and go.',
        outcomes: [{ text: 'It is not on your route. You have checked three times.', effects: { xp: 120, reveal: 2 } }],
      },
    ],
  },
  {
    id: 'an_worked_stone', name: 'Worked Stone', type: 'anomaly', weight: 6,
    minThreat: 13, maxThreat: 20,
    blurb: 'An asteroid with tool marks on it.',
    text:
      "The marks are regular, deep, and follow the grain. Whatever made them was "
      + "patient and did not use heat. There are eleven thousand of them and they "
      + "cover the entire surface, and the pattern does not repeat, which took some "
      + "checking.",
    choices: [
      {
        text: 'Core a sample from the marked face.',
        outcomes: [
          { weight: 3, text: 'The marks go all the way through. The rock was worked before it was a rock.', effects: { xp: 160, credits: 90 } },
          { weight: 2, text: 'Under the surface, a cavity, and in the cavity, one manufactured object.', effects: { item: { rarity: 'relic' }, xp: 90 } },
        ],
      },
      {
        text: 'Photograph the whole surface and take nothing.',
        outcomes: [
          { weight: 3, text: 'Nine hours of survey. You will look at it again in a year and it will still be there.', effects: { xp: 130, reveal: 3 } },
        ],
      },
      {
        text: 'Mine it like any other rock.',
        outcomes: [
          { weight: 3, text: 'Good ore, easily taken, and you do not think about the marks until later.', effects: { credits: 210, crates: 1 } },
          { weight: 1, text: 'Good ore. The cutting head comes back with a mark on it, in the same hand.', effects: { credits: 150, xp: 120 } },
        ],
      },
    ],
  },
  {
    id: 'an_uncrewed_yard', name: 'The Yard', type: 'anomaly', weight: 7,
    minThreat: 12, maxThreat: 20,
    blurb: 'A shipyard still building, with no order book.',
    text:
      "Four slips, all occupied, all at different stages. The yard has been building "
      + "the same class for longer than the class has existed and it has never "
      + "launched one. The finished hulls are broken back down and started again. The "
      + "quality of the work is exceptional.",
    choices: [
      {
        text: 'Take parts off the slips.',
        outcomes: [
          { weight: 3, text: 'The best-made components you have ever held, from a ship that will never fly.', effects: { crates: 2, item: { rarity: 'military' } } },
          { weight: 2, text: 'You take a drive assembly. The yard begins a replacement within the hour.', effects: { item: { slot: 'engine', rarity: 'prototype' }, xp: 70 } },
        ],
      },
      {
        text: 'Give the yard an order it can complete.',
        requires: { attr: { systems: 7 } },
        outcomes: [
          { weight: 3, text: 'It builds to your specification, correctly, in eleven hours, and then stops.', effects: { item: { rarity: 'relic' }, xp: 120 } },
          { weight: 1, text: 'It builds your specification and files it as the first launch in its history.', effects: { crates: 2, xp: 150, heal: 0.3 } },
        ],
      },
      {
        text: 'Use the yard for what it is best at and repair your own hull.',
        outcomes: [{ text: 'It works on you without being asked twice. The seams are better than the originals.', effects: { heal: 0.65, hullPct: 0.08 } }],
      },
    ],
  },
  {
    id: 'an_last_light', name: 'The Last Light', type: 'anomaly', weight: 6,
    minThreat: 17, maxThreat: 20,
    blurb: 'A single window, lit, on a station otherwise dark.',
    text:
      "The station is dead to every instrument you have. One window on the ninth ring "
      + "is lit, has been lit for the eleven hours you have been watching, and is "
      + "drawing power from a grid that has no power in it. Nothing moves behind the "
      + "glass. The light is the ordinary warm colour of somewhere people live.",
    choices: [
      {
        text: 'Go to the window.',
        outcomes: [
          { weight: 3, text: 'A room, furnished, tidy, and warm. There is nobody in it and there is a cup out.', effects: { xp: 200, heal: 0.35 } },
          { weight: 2, text: 'A room, and in the desk, forty years of somebody keeping careful records.', effects: { xp: 150, reveal: 3, crates: 1 } },
          { weight: 2, text: 'The light goes out as you reach the ring, and comes back on behind you.', effects: { combat: 'boss_thresher' } },
        ],
      },
      {
        text: 'Strip the dark side of the station and leave the ninth ring alone.',
        outcomes: [
          { weight: 3, text: 'A great deal of good salvage and a short conversation with yourself about it.', effects: { credits: 300, crates: 1 } },
        ],
      },
      {
        text: 'Sit off it and watch until you have to leave.',
        outcomes: [
          { weight: 3, text: 'Nothing happens for nine more hours. You log the light as still burning.', effects: { xp: 140 } },
          { weight: 1, text: 'At the eighteenth hour, briefly, someone crosses the window.', effects: { xp: 180, reveal: 2 } },
        ],
      },
    ],
  },

  // =========================================================================
  // SHOPS — the shop screen handles the trading. These carry the flavour.
  // =========================================================================
  {
    id: 'trading_post', name: 'Trading Post', type: 'shop', weight: 12,
    minThreat: 1, maxThreat: 20,
    blurb: 'A station willing to deal.',
    intro:
      'Two docking arms, a bar, and a broker who has been here long enough to have '
      + 'opinions about every hull that comes through. She has one about yours.',
    objective: { kind: 'clear' }, waves: [],
  },
  {
    id: 'shop_breakers_yard', name: "Breaker's Yard", type: 'shop', weight: 10,
    minThreat: 1, maxThreat: 14,
    blurb: 'Everything here came off something that stopped working.',
    intro:
      'A slow rotation of cut hulls and sorted parts. Nothing is new, everything is '
      + 'cheap, and the man doing the pricing does it by weight and by eye and has '
      + 'not been wrong in twenty years.',
    objective: { kind: 'clear' }, waves: [],
  },
  {
    id: 'shop_grey_market', name: 'Grey Market Skiff', type: 'shop', weight: 9,
    minThreat: 4, maxThreat: 20,
    blurb: 'A ship that will be somewhere else within the hour.',
    intro:
      'It does not dock, it matches. The hold is better stocked than any station on '
      + 'this route and there is no manifest anywhere aboard. They do not ask your '
      + 'registry and they would prefer you did not offer it.',
    objective: { kind: 'clear' }, waves: [],
  },
  {
    id: 'shop_almoners', name: 'The Almoners', type: 'shop', weight: 8,
    minThreat: 3, maxThreat: 18,
    blurb: 'An order that sells at cost and asks nothing further.',
    intro:
      'They maintain a station on a route nobody profitable uses, and they sell '
      + 'good gear at the price it cost them. They will explain why, at length, if '
      + 'you ask. Most people do not ask twice.',
    objective: { kind: 'clear' }, waves: [],
  },
  {
    id: 'shop_deep_depot', name: 'Automated Depot', type: 'shop', weight: 8,
    minThreat: 10, maxThreat: 20,
    blurb: 'A fleet supply point that never got the withdrawal order.',
    intro:
      'Racks, cranes, and a stock system that still recognises military credit. It '
      + 'has been holding this inventory against a resupply that was cancelled '
      + 'decades ago, and it is glad of the traffic.',
    objective: { kind: 'clear' }, waves: [],
  },

  // =========================================================================
  // EMPTY — quiet nodes. Short, atmospheric, small rewards.
  // =========================================================================
  {
    id: 'quiet_drift', name: 'Empty Sky', type: 'empty', weight: 10,
    minThreat: 1, maxThreat: 20,
    blurb: 'Nothing on the scopes.',
    intro: 'The scopes are clean for the first time in days. You let the ship coast and you do not touch anything.',
    objective: { kind: 'clear' }, waves: [],
    rewards: { xpMult: 0.3, creditsMult: 0.4 },
  },
  {
    id: 'empty_dust_lane', name: 'Dust Lane', type: 'empty', weight: 9,
    minThreat: 1, maxThreat: 14,
    blurb: 'Thin dust, and the hull noise it makes.',
    intro: 'Fine material, moving slowly, hissing along the plating for an hour. The scrubbers deal with it. Nothing else happens.',
    objective: { kind: 'clear' }, waves: [],
    rewards: { xpMult: 0.3, creditsMult: 0.5 },
  },
  {
    id: 'empty_cold_star', name: 'Cold Star', type: 'empty', weight: 9,
    minThreat: 3, maxThreat: 20,
    blurb: 'A dwarf that gave up a long time ago.',
    intro: 'It puts out just enough to register as a star and not enough to warm anything. You pass it close, because there is no reason not to.',
    objective: { kind: 'clear' }, waves: [],
    rewards: { xpMult: 0.4, creditsMult: 0.4 },
  },
  {
    id: 'empty_wake', name: "Somebody's Wake", type: 'empty', weight: 9,
    minThreat: 2, maxThreat: 18,
    blurb: 'A drive trail, still cooling.',
    intro: 'Somebody came through here in the last six hours, moving fast, on a heading that does not go anywhere. You do not follow it.',
    objective: { kind: 'clear' }, waves: [],
    rewards: { xpMult: 0.4, creditsMult: 0.4 },
  },
  {
    id: 'empty_long_night', name: 'The Long Night', type: 'empty', weight: 8,
    minThreat: 12, maxThreat: 20,
    blurb: 'Deep space, and a lot of it.',
    intro: 'No mass within a light-hour. The radio band is empty in a way that near space never is. You sleep, badly, and wake up still out here.',
    objective: { kind: 'clear' }, waves: [],
    rewards: { xpMult: 0.5, creditsMult: 0.3 },
  },
];
