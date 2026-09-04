/**
 * Menu screens: title, hangar, achievements, records, help.
 * Also owns the shared modal and toast machinery used by the in-game UI.
 */

import { $, $$, el, clear, show, duration, relativeTime, tooltip, tipContent, hideTooltip } from './dom.js';
import { spriteEl } from './render.js';
import { play } from '../audio/sfx.js';
import { SHIPS, SHIP_IDS, getLayout } from '../game/ships.js';
import { SYSTEMS } from '../game/systems.js';
import { getWeapon, getDrone, getAugment } from '../game/weapons.js';
import { RACES } from '../game/crew.js';
import { ACHIEVEMENTS, SHIP_ACHIEVEMENTS, totalAchievementCount, earnedAchievementCount } from '../game/achievements.js';
import { isShipUnlocked } from '../core/save.js';
import { RNG } from '../core/rng.js';

let current = 'title';
const history = [];

export function showScreen(name) {
  for (const s of $$('.screen')) show(s, s.dataset.screen === name);
  if (name !== current) history.push(current);
  current = name;
  hideTooltip();
  return name;
}

export function currentScreen() { return current; }

export function goBack(fallback = 'title') {
  const prev = history.pop() || fallback;
  // popping pushes again inside showScreen, so drop the duplicate
  showScreen(prev);
  history.pop();
  return prev;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

let modalDismiss = null;

/**
 * Open the shared modal.
 * @param {object} o { title, body (Node|string), actions: [{label, kind, onClick, disabled}],
 *                     dismissable, wide, onDismiss }
 */
export function openModal(o) {
  const root = $('#modal-root');
  const modal = $('#modal');
  $('#modal-title').textContent = o.title || '';
  modal.classList.toggle('modal-wide', !!o.wide);

  const body = clear($('#modal-body'));
  if (o.body) body.append(o.body instanceof Node ? o.body : el('p.modal-text', { text: o.body }));

  const actions = clear($('#modal-actions'));
  for (const a of o.actions || []) {
    const btn = el('button.btn', {
      class: `btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-ghost btn-danger' : a.kind === 'ghost' ? 'btn-ghost' : ''}`,
      text: a.label,
      disabled: a.disabled || false,
      onclick: () => { play('click'); a.onClick?.(); },
    });
    actions.append(btn);
  }

  modalDismiss = o.dismissable === false ? null : (o.onDismiss || closeModal);
  root.hidden = false;

  const focusTarget = actions.querySelector('.btn-primary') || actions.querySelector('.btn') || modal;
  focusTarget.focus?.();
  return modal;
}

export function closeModal() {
  const root = $('#modal-root');
  if (root.hidden) return false;
  root.hidden = true;
  modalDismiss = null;
  hideTooltip();
  return true;
}

export function isModalOpen() { return !$('#modal-root').hidden; }

export function initModal() {
  $('#modal-root').addEventListener('click', e => {
    if (e.target.dataset.action === 'modal-dismiss' && modalDismiss) modalDismiss();
  });
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export function toast({ tag = 'Achievement', name, desc = '', kind = '' }) {
  const stack = $('#toast-stack');
  const node = el(`div.toast${kind ? '.' + kind : ''}`, null,
    el('div', null,
      el('div.tt', { text: tag }),
      el('div.tn', { text: name }),
      desc ? el('div.td', { text: desc }) : null));
  stack.append(node);
  play(kind === 'unlock' ? 'unlock' : 'achievement');

  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 320);
  }, 4600);
}

/** Drain a run's pending achievement list into toasts. */
export function flushAchievements(run) {
  if (!run || !run.newAchievements?.length) return;
  const pending = run.newAchievements.splice(0, run.newAchievements.length);
  pending.forEach((a, i) => {
    setTimeout(() => toast({
      tag: a.unlock ? 'Unlocked' : 'Achievement',
      name: a.name, desc: a.desc || '',
      kind: a.unlock ? 'unlock' : '',
    }), i * 550);
  });
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export function renderTitle(savedSummary) {
  const btn = $('#btn-continue');
  if (savedSummary) {
    btn.hidden = false;
    $('#continue-sub').textContent =
      `${savedSummary.shipName} · Sector ${savedSummary.sector} · ${savedSummary.hull}/${savedSummary.maxHull} hull · ${relativeTime(savedSummary.savedAt)}`;
  } else {
    btn.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Hangar
// ---------------------------------------------------------------------------

const hangarState = { shipId: 'kestrel', variant: 'A', seed: '' };

export function renderHangar(profile, onLaunch) {
  const list = clear($('#ship-list'));

  const unlockedCount = SHIP_IDS.filter(id => isShipUnlocked(profile, id, 'A')).length;
  $('#hangar-unlocked').textContent = `${unlockedCount} / ${SHIP_IDS.length} hulls`;

  // Default the selection to something the player actually owns.
  if (!isShipUnlocked(profile, hangarState.shipId, 'A')) hangarState.shipId = 'kestrel';
  if (!isShipUnlocked(profile, hangarState.shipId, hangarState.variant)) hangarState.variant = 'A';

  for (const id of SHIP_IDS) {
    const ship = SHIPS[id];
    const unlocked = isShipUnlocked(profile, id, 'A');
    const row = el(`li.ship-row${id === hangarState.shipId ? '.selected' : ''}${unlocked ? '' : '.locked'}`, {
      role: 'option',
      'aria-selected': id === hangarState.shipId ? 'true' : 'false',
      tabindex: unlocked ? '0' : '-1',
    },
    spriteEl(ship.sprite, 1, unlocked ? null : '#2a3550'),
    el('div', null,
      el('div.rname', { text: unlocked ? ship.name : '???????' }),
      el('div.rsub', {
        text: unlocked
          ? `Layout ${isShipUnlocked(profile, id, 'B') ? 'A + B' : 'A'}`
          : 'Locked',
      })));

    if (unlocked) {
      const select = () => {
        hangarState.shipId = id;
        if (!isShipUnlocked(profile, id, hangarState.variant)) hangarState.variant = 'A';
        play('beacon_select');
        renderHangar(profile, onLaunch);
      };
      row.addEventListener('click', select);
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    } else {
      row.addEventListener('click', () => play('error'));
    }
    list.append(row);
  }

  renderShipDetail(profile, onLaunch);
}

function renderShipDetail(profile, onLaunch) {
  const pane = clear($('#ship-detail'));
  const ship = SHIPS[hangarState.shipId];
  const unlockedA = isShipUnlocked(profile, ship.id, 'A');

  if (!unlockedA) {
    const prereq = ship.unlockedBy ? SHIPS[ship.unlockedBy].name : null;
    pane.append(
      el('h3', { text: 'Locked Hull' }),
      el('div.locked-note', null,
        prereq
          ? el('p', { html: `Win a run with the <b>${prereq}</b> to add this hull to your hangar.` })
          : el('p', { text: 'This hull has not been discovered yet.' }),
        el('p', { text: 'Derelict hulls can also be recovered from sealed hangars found in abandoned and uncharted space.' })));
    return;
  }

  const layout = getLayout(ship.id, hangarState.variant);
  const hasB = isShipUnlocked(profile, ship.id, 'B');

  pane.append(
    el('h3', { text: layout.name }),
    el('div.hull-name', { text: `${ship.name} · Layout ${hangarState.variant}` }),
    spriteEl(ship.sprite, 4),
    el('p.blurb', { text: ship.blurb }),
    el('p.desc', { text: layout.desc }));

  // Variant tabs
  const tabs = el('div.variant-tabs');
  for (const v of ['A', 'B']) {
    const unlocked = isShipUnlocked(profile, ship.id, v);
    tabs.append(el('button', {
      class: `btn btn-small ${hangarState.variant === v ? 'active' : ''}`,
      text: unlocked ? `Layout ${v}` : `Layout ${v} 🔒`,
      disabled: !unlocked,
      onclick: () => {
        hangarState.variant = v;
        play('tab');
        renderHangar(profile, onLaunch);
      },
    }));
  }
  if (!hasB) {
    tabs.append(el('span.rsub', {
      text: 'Earn any achievement with this hull to unlock Layout B',
      style: { alignSelf: 'center', marginLeft: '8px' },
    }));
  }
  pane.append(tabs);

  // Loadout blocks
  const loadout = el('div.loadout');

  loadout.append(block('Hull', [
    line('icon_hull', 'Hull integrity', layout.hull),
    line('icon_power', 'Reactor', layout.reactor),
    line('icon_crew', 'Crew slots', layout.crewSlots),
    line('icon_sys_weapons', 'Weapon slots', layout.weaponSlots),
    line('icon_sys_drones', 'Drone slots', layout.droneSlots),
  ]));

  loadout.append(block('Systems', Object.entries(layout.systems)
    .sort((a, b) => SYSTEMS[a[0]].order - SYSTEMS[b[0]].order)
    .map(([id, lvl]) => line(SYSTEMS[id].icon, SYSTEMS[id].name, lvl, SYSTEMS[id].desc))));

  loadout.append(block('Armament', [
    ...layout.weapons.map(w => line('icon_sys_weapons', getWeapon(w).name, null, getWeapon(w).desc)),
    ...(layout.drones || []).map(d => line('icon_sys_drones', getDrone(d).name, null, getDrone(d).desc)),
    ...(layout.drones || []).length === 0 && layout.weapons.length === 0 ? [line('icon_cross', 'Unarmed', null)] : [],
  ]));

  loadout.append(block('Crew', layout.crew.map(r =>
    line(`crew_${r}_idle0`, RACES[r].name, null, RACES[r].desc))));

  if ((layout.augments || []).length) {
    loadout.append(block('Augments', layout.augments.map(a =>
      line('icon_star', getAugment(a).name, null, getAugment(a).desc))));
  }

  loadout.append(block('Stores', [
    line('icon_scrap', 'Scrap', layout.resources.scrap),
    line('icon_fuel', 'Fuel', layout.resources.fuel),
    line('icon_missile', 'Missiles', layout.resources.missiles),
    line('icon_dronepart', 'Drone parts', layout.resources.droneParts),
  ]));

  pane.append(loadout);

  // Seed
  const seedInput = el('input', {
    type: 'text', placeholder: 'random', value: hangarState.seed,
    maxlength: '24', spellcheck: 'false',
    'aria-label': 'Run seed',
    oninput: e => { hangarState.seed = e.target.value.toUpperCase().slice(0, 24); e.target.value = hangarState.seed; },
  });
  pane.append(el('div.seed-row', null,
    el('label', { for: 'seed', text: 'Seed' }),
    seedInput,
    el('button.btn.btn-small', {
      text: 'Random',
      onclick: () => { hangarState.seed = RNG.friendlySeed(); seedInput.value = hangarState.seed; play('click'); },
    })));

  pane.append(el('button.btn.btn-primary', {
    text: `Launch the ${layout.name}`,
    style: { minWidth: '240px' },
    onclick: () => {
      play('jump');
      onLaunch(hangarState.shipId, hangarState.variant, hangarState.seed || null);
    },
  }));
}

function block(title, lines) {
  return el('div.loadout-block', null,
    el('h4', { text: title }),
    el('ul', null, ...lines));
}

function line(icon, name, level, desc) {
  const li = el('li', null,
    spriteEl(icon, 1),
    el('span', { text: name }),
    level != null ? el('span.lvl', { text: String(level) }) : null);
  if (desc) tooltip(li, () => tipContent(name, desc));
  return li;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function renderAchievements(profile) {
  const grid = clear($('#ach-grid'));
  const earned = earnedAchievementCount(profile);
  $('#ach-progress').textContent = `${earned} / ${totalAchievementCount()}`;

  for (const a of ACHIEVEMENTS) {
    const has = !!profile.achievements[a.id];
    grid.append(achCard(a, has));
  }

  for (const shipId of SHIP_IDS) {
    const list = SHIP_ACHIEVEMENTS[shipId] || [];
    if (!list.length) continue;
    grid.append(el('div.ach-ship-head', { text: SHIPS[shipId].name }));
    const owned = profile.shipAchievements[shipId] || {};
    for (const a of list) grid.append(achCard(a, !!owned[a.id]));
  }
}

function achCard(a, earned) {
  return el(`div.ach.${earned ? 'earned' : 'locked'}`, null,
    spriteEl(a.icon || 'icon_trophy', 1, earned ? null : '#3d4a6b'),
    el('div', null,
      el('div.an', { text: a.name }),
      el('div.ad', { text: a.desc })));
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export function renderStats(profile) {
  const grid = clear($('#stat-grid'));
  const s = profile.stats;
  const winRate = s.runs > 0 ? Math.round((s.wins / s.runs) * 100) : 0;

  const cards = [
    ['Runs', s.runs],
    ['Victories', s.wins],
    ['Win rate', `${winRate}%`],
    ['High score', s.highScore || 0],
    ['Ships destroyed', s.shipsDestroyed],
    ['Beacons visited', s.beaconsVisited],
    ['Sectors cleared', s.sectorsCleared],
    ['Scrap earned', s.scrapEarned],
    ['Crew lost', s.crewLost],
    ['Time played', duration(s.playSeconds)],
    ['Fastest win', s.fastestWinSeconds ? duration(s.fastestWinSeconds) : '—'],
    ['Achievements', `${earnedAchievementCount(profile)} / ${totalAchievementCount()}`],
  ];
  for (const [label, value] of cards) {
    grid.append(el('div.stat', null,
      el('div.sv', { text: String(value) }),
      el('div.sl', { text: label })));
  }

  const hist = clear($('#history'));
  if (!profile.history.length) {
    hist.append(el('div.empty-note', { text: 'No runs recorded yet. The void awaits.' }));
    return;
  }
  for (const h of profile.history) {
    hist.append(el(`div.hrow.${h.won ? 'win' : 'loss'}`, null,
      el('span.hres', { text: h.won ? '★' : '✕' }),
      el('span.hship', { text: `${h.shipName || h.ship} ${h.variant || ''}` }),
      el('span.hmeta', { text: `Sector ${h.sector}` }),
      el('span.hmeta', { text: duration(h.seconds) }),
      el('span.hmeta', { text: `${h.score} pts` })));
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

export function renderHelp() {
  const body = $('#help-body');
  if (body.dataset.rendered) return;
  body.dataset.rendered = '1';
  body.innerHTML = `
    <h3>The Situation</h3>
    <p>You command a single ship carrying data the Federation needs. The Swarm fleet is behind you and gaining.
    Cross eight sectors, survive what is between, and destroy the Swarm Flagship at the end.</p>

    <h3>Jumping</h3>
    <ul>
      <li>Open the <b>Star Map</b> and jump to a connected beacon. Every jump costs <b>1 fuel</b> and lets the fleet advance.</li>
      <li>The red front on the left is the fleet. Beacons behind it are always a fight — do not linger.</li>
      <li>Reach the beacon marked with the exit icon to leave the sector and choose where to go next.</li>
      <li>Out of fuel? Send a <b>distress signal</b>. Someone always answers. Not always helpfully.</li>
    </ul>

    <h3>Power</h3>
    <p>Your reactor has a fixed number of bars. Click a system in the left panel to add power, right-click to remove it.
    You will never have enough for everything — that is the game.</p>
    <ul>
      <li><b>Shields</b> take two bars per layer. Each layer absorbs one hit.</li>
      <li><b>Engines</b> raise evasion and shorten your FTL charge — but only with a pilot at the helm.</li>
      <li>Damaged bars cannot be powered until a crew member repairs them.</li>
      <li><b>Ion</b> damage locks bars temporarily instead of destroying them.</li>
    </ul>

    <h3>Combat</h3>
    <ul>
      <li>Combat is real time. Press <span class="key">Space</span> to pause and give orders — use it.</li>
      <li>Click a weapon (or press <span class="key">1</span>–<span class="key">4</span>), then click an enemy room to target it.</li>
      <li>Kill their <b>shields</b> first, or their <b>weapons</b> to stop the bleeding. Their <b>piloting</b> room drops their evasion to nothing.</li>
      <li>Missiles ignore shields entirely but cost ammunition. Beams sweep several rooms but cannot pierce shields.</li>
      <li>Press <span class="key">1</span>–<span class="key">4</span> for speed control, and jump out if a fight has gone wrong.</li>
    </ul>

    <h3>Your Crew</h3>
    <ul>
      <li>Click a crew member, then click a room to send them there. They repair whatever is broken where they stand.</li>
      <li>Crew standing in a system room <b>man</b> it, which makes it work better and earns them skill.</li>
      <li>Fires need air. Open an <b>airlock</b> to vent a burning room — or a room full of boarders.</li>
      <li>Breaches bleed air until someone seals them.</li>
    </ul>

    <h3>Progression</h3>
    <ul>
      <li>Win a run to unlock the next hull in the hangar.</li>
      <li>Earn any achievement with a hull to unlock its second layout.</li>
      <li>Everything — unlocks, achievements, records — is saved to this browser automatically.</li>
      <li>Your current run is saved on every jump, so you can close the tab and come back.</li>
    </ul>

    <h3>Keyboard</h3>
    <ul>
      <li><span class="key">Space</span> pause &middot; <span class="key">M</span> star map &middot; <span class="key">Esc</span> menu / close</li>
      <li><span class="key">1</span>–<span class="key">4</span> select weapon &middot; <span class="key">A</span> toggle autofire</li>
      <li><span class="key">Tab</span> cycle crew &middot; <span class="key">O</span> open all doors &middot; <span class="key">C</span> close all doors</li>
    </ul>`;
}
