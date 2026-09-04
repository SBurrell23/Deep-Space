/**
 * Starter hulls.
 *
 * Each hull is a different opening hand: a distinct attribute spread, starting
 * gear, and one perk that changes how the ship is flown rather than just adding
 * numbers. Hulls unlock as you win runs and clear achievements, so the roster
 * widens as you win runs and clear achievements.
 *
 * Internal ids are historical and never shown; the displayed names are the
 * player-facing identity.
 */

export const SHIPS = {
  kestrel: {
    id: 'kestrel', name: 'Meridian', sprite: 'ship_ext_kestrel',
    tagline: 'Fleet-pattern light cruiser. No surprises, no excuses.',
    desc: 'An even spread across every system. The ship to learn the game on, and never a bad pick.',
    attributes: { hull: 3, shields: 3, weapons: 3, reactor: 3, thrusters: 3, systems: 3 },
    gear: { primary: 'pulse', secondary: 'missiles' },
    perk: { id: 'adaptable', name: 'Adaptable', desc: 'Gain 8% more experience from every encounter.' },
    unlock: { kind: 'start' },
  },

  torus: {
    id: 'torus', name: 'Torus', sprite: 'ship_ext_torus',
    tagline: 'A ring-hulled freighter with the cargo bays welded shut.',
    desc: 'Enormously durable and slow to move. Soaks punishment that would end a lighter hull, and hauls out more salvage.',
    attributes: { hull: 6, shields: 4, weapons: 2, reactor: 3, thrusters: 1, systems: 2 },
    gear: { primary: 'flak_primary', secondary: 'torpedo' },
    perk: { id: 'hold_full', name: 'Full Hold', desc: 'Gain 25% more credits, and repairs cost 20% less.' },
    unlock: { kind: 'wins', count: 1, desc: 'Defeat the Master Fleet once.' },
  },

  mantis: {
    id: 'mantis', name: 'Hatchet', sprite: 'ship_ext_mantis',
    tagline: 'Everything that was not a gun has been taken out of it.',
    desc: 'Brutal firepower on a thin hull. It kills things before they can kill it, or it does not survive.',
    attributes: { hull: 2, shields: 1, weapons: 7, reactor: 3, thrusters: 4, systems: 1 },
    gear: { primary: 'scatter', secondary: 'lance' },
    perk: { id: 'bloodlust', name: 'Bloodlust', desc: 'Killing an enemy heals 1.5% of your max hull.' },
    unlock: { kind: 'wins', count: 2, desc: 'Defeat the Master Fleet twice.' },
  },

  engi: {
    id: 'engi', name: 'Shepherd', sprite: 'ship_ext_engi',
    tagline: 'More drone bay than ship.',
    desc: 'Fights at arm’s length behind a screen of drones. Weak on its own, formidable with its escorts alive.',
    attributes: { hull: 3, shields: 3, weapons: 1, reactor: 4, thrusters: 2, systems: 6 },
    gear: { primary: 'needler', secondary: 'drone_swarm', utility1: 'drone_bay' },
    perk: { id: 'wingmates', name: 'Wingmates', desc: 'Your drones last 60% longer and fire faster.' },
    unlock: { kind: 'achievement', id: 'drone_master', desc: 'Earn "Not Alone Out Here".' },
  },

  zoltan: {
    id: 'zoltan', name: 'Filament', sprite: 'ship_ext_zoltan',
    tagline: 'The crew is the power plant.',
    desc: 'Vast energy reserves feed weapons that would drain anything else dry, behind a screen that always stops the first hit.',
    attributes: { hull: 2, shields: 4, weapons: 3, reactor: 7, thrusters: 2, systems: 3 },
    gear: { primary: 'beam', secondary: 'shield_breaker' },
    perk: { id: 'zoltan_screen', name: 'Static Screen', desc: 'Fully negate one hit every 12 seconds.' },
    unlock: { kind: 'wins', count: 3, desc: 'Defeat the Master Fleet three times.' },
  },

  stealth: {
    id: 'stealth', name: 'Nisos', sprite: 'ship_ext_stealth',
    tagline: 'No shields worth the name. It is never where you shot.',
    desc: 'Built entirely around not being hit. Two dash charges and a hull that cannot afford a mistake.',
    attributes: { hull: 2, shields: 1, weapons: 4, reactor: 3, thrusters: 7, systems: 3 },
    gear: { primary: 'rail', secondary: 'minelayer', utility1: 'phase_cloak' },
    perk: { id: 'ghost', name: 'Ghost Drive', desc: 'Start with a second dash charge, and dashing leaves a damaging wake.' },
    unlock: { kind: 'achievement', id: 'untouched', desc: 'Earn "Never Laid A Finger".' },
  },

  rock: {
    id: 'rock', name: 'Basalt', sprite: 'ship_ext_rock',
    tagline: 'A flying wall with engines bolted to the back.',
    desc: 'Armoured to the point of absurdity. Ramming things is a legitimate tactic.',
    attributes: { hull: 7, shields: 2, weapons: 4, reactor: 2, thrusters: 1, systems: 2 },
    gear: { primary: 'plasma', secondary: 'cluster', plating: 'spiked_hull' },
    perk: { id: 'ram', name: 'Ram Prow', desc: 'Take 60% less collision damage and deal heavy damage by ramming.' },
    unlock: { kind: 'achievement', id: 'ramming_speed', desc: 'Earn "Ramming Speed".' },
  },

  slug: {
    id: 'slug', name: 'Vensu', sprite: 'ship_ext_slug',
    tagline: 'Grown, not built. It knows what is out there.',
    desc: 'Reads the map far further than anything else in the hangar. Knowing what is over the horizon is its own kind of armour.',
    attributes: { hull: 3, shields: 3, weapons: 3, reactor: 2, thrusters: 3, systems: 6 },
    gear: { primary: 'arc', secondary: 'gravity_well', computer: 'survey_array' },
    perk: { id: 'farsight', name: 'Farsight', desc: 'See two extra jumps into the fog, and node threats are always revealed.' },
    unlock: { kind: 'achievement', id: 'nodes_60', desc: 'Earn "Cartographer" — clear 60 nodes in one run.' },
  },

  crystal: {
    id: 'crystal', name: 'Bright Lattice', sprite: 'ship_ext_crystal',
    tagline: 'Older than the charts. Nobody knows who built it.',
    desc: 'A shield array that rebuilds itself from every kill. Sustained fights are where it wins.',
    attributes: { hull: 3, shields: 7, weapons: 3, reactor: 3, thrusters: 2, systems: 2 },
    gear: { primary: 'shard', secondary: 'nova_charge' },
    perk: { id: 'resonance', name: 'Resonance', desc: 'Each kill restores 6% of your shield and shortens the break delay.' },
    unlock: { kind: 'achievement', id: 'unbroken', desc: 'Earn "Unbroken".' },
  },

  nomad: {
    id: 'nomad', name: 'Magpie', sprite: 'ship_ext_nomad',
    tagline: 'Nine hulls in a trenchcoat.',
    desc: 'Nothing on it matches and all of it works. Finds better salvage than anything else out here.',
    attributes: { hull: 4, shields: 2, weapons: 2, reactor: 3, thrusters: 3, systems: 4 },
    gear: { primary: 'ricochet', secondary: 'cluster', computer: 'salvage_ai' },
    perk: { id: 'scavenger', name: 'Scavenger', desc: 'Loot rolls one rarity tier higher, and crates drop twice as often.' },
    unlock: { kind: 'achievement', id: 'magpie_haul', desc: 'Earn "Nine Hulls In A Trenchcoat" — find 60 items and earn 12,000 credits in one run.' },
  },
};

export const SHIP_IDS = Object.keys(SHIPS);
export function getShip(id) { return SHIPS[id] || null; }

/** The one hull available on a fresh profile. */
export const STARTER_SHIP = 'kestrel';

/**
 * Which hulls a profile has earned. Kept here rather than in save.js so the
 * unlock rules live next to the ships they describe.
 */
export function unlockedShips(profile) {
  const out = [STARTER_SHIP];
  for (const id of SHIP_IDS) {
    if (id === STARTER_SHIP) continue;
    const u = SHIPS[id].unlock;
    if (u.kind === 'wins' && (profile.stats?.wins || 0) >= u.count) out.push(id);
    else if (u.kind === 'achievement' && profile.achievements?.[u.id]) out.push(id);
  }
  return out;
}

export function isUnlocked(profile, id) {
  return unlockedShips(profile).includes(id);
}

/** Human-readable progress toward a locked hull. */
export function unlockProgress(profile, id) {
  const u = SHIPS[id]?.unlock;
  if (!u || u.kind === 'start') return null;
  if (u.kind === 'wins') {
    return { text: u.desc, have: profile.stats?.wins || 0, need: u.count };
  }
  return { text: u.desc, have: profile.achievements?.[u.id] ? 1 : 0, need: 1 };
}
