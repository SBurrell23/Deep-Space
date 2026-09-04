/**
 * Menu screens and the shared modal/toast plumbing.
 *
 * Screens are plain sections in index.html toggled by `showScreen`; their
 * contents are rebuilt on entry rather than kept live, which keeps the state
 * here to a single string.
 */

import { $, $$, el, clear, show, duration, relativeTime, tooltip, tipContent } from './dom.js';
import { spriteEl } from './render.js';
import { play } from '../audio/sfx.js';
import { SHIPS, SHIP_IDS, unlockedShips, unlockProgress, STARTER_SHIP } from '../game/ships.js';
import { ACHIEVEMENTS, CATEGORIES, earnedCount } from '../game/achievements.js';
import { ATTRIBUTES } from '../game/attributes.js';
import { WEAPONS } from '../game/weapons.js';
import { RNG } from '../core/rng.js';

let current = 'title';
const history = [];

export function showScreen(name) {
  for (const s of $$('.screen')) show(s, s.dataset.screen === name);
  if (name !== current) history.push(current);
  current = name;
  window.scrollTo(0, 0);
}

export function currentScreen() { return current; }

export function goBack(fallback = 'title') {
  const prev = history.pop() || fallback;
  for (const s of $$('.screen')) show(s, s.dataset.screen === prev);
  current = prev;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

let modalDismissable = true;

export function initModal() {
  $('#modal-root').addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'modal-dismiss' && modalDismissable) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal-root').hidden && modalDismissable) {
      e.stopPropagation();
      closeModal();
    }
  }, true);
}

/**
 * @param o { title, body, actions[], dismissable, wide }
 * Actions are { text, kind: 'primary'|'ghost'|'danger', onClick }.
 */
export function openModal(o) {
  modalDismissable = o.dismissable !== false;
  $('#modal-title').textContent = o.title || '';
  const body = clear($('#modal-body'));
  if (o.body) body.append(o.body);
  $('#modal').classList.toggle('modal-wide', !!o.wide);

  const actions = clear($('#modal-actions'));
  for (const a of o.actions || []) {
    const cls = a.kind === 'primary' ? '.btn-primary' : a.kind === 'danger' ? '.btn-ghost.btn-danger' : '.btn-ghost';
    actions.append(el(`button.btn${cls}`, { onclick: a.onClick }, el('span', { text: a.text })));
  }
  show($('#modal-root'), true);
  // Focus the confirming action so Enter does the obvious thing.
  const primary = actions.querySelector('.btn-primary') || actions.querySelector('button');
  if (primary) primary.focus();
}

export function closeModal() {
  show($('#modal-root'), false);
  modalDismissable = true;
}

export function isModalOpen() { return !$('#modal-root').hidden; }

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export function toast({ tag = 'Achievement', name, desc = '', kind = '' }) {
  const stack = $('#toast-stack');
  const node = el(`div.toast${kind ? '.' + kind : ''}`, null,
    el('div.toast-tag', { text: tag }),
    el('div.toast-name', { text: name }),
    desc ? el('div.toast-desc', { text: desc }) : null);
  stack.append(node);
  setTimeout(() => node.classList.add('out'), 4200);
  setTimeout(() => node.remove(), 4900);
  // Never let a burst of unlocks bury the screen.
  while (stack.children.length > 4) stack.firstChild.remove();
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export function renderTitle(savedSummary) {
  const btn = $('#btn-continue');
  show(btn, !!savedSummary);
  if (savedSummary) {
    const ship = SHIPS[savedSummary.shipId];
    $('#continue-sub').textContent =
      `${ship ? ship.name : 'Ship'} · Level ${savedSummary.level} · Ring ${savedSummary.ring} · ${savedSummary.nodes} nodes`;
  }
}

// ---------------------------------------------------------------------------
// Hangar
// ---------------------------------------------------------------------------

export function renderHangar(profile, onLaunch) {
  const unlocked = unlockedShips(profile);
  $('#hangar-unlocked').textContent = `${unlocked.length} / ${SHIP_IDS.length} hulls`;

  const list = clear($('#ship-list'));
  let selected = unlocked.includes(profile.lastShip) ? profile.lastShip : STARTER_SHIP;

  const select = (id) => {
    selected = id;
    for (const row of $$('.ship-row')) row.classList.toggle('selected', row.dataset.ship === id);
    renderShipDetail(profile, id, unlocked.includes(id), onLaunch);
  };

  for (const id of SHIP_IDS) {
    const ship = SHIPS[id];
    const isUnlocked = unlocked.includes(id);
    const row = el(`li.ship-row${isUnlocked ? '' : '.locked'}`, {
      dataset: { ship: id },
      role: 'option',
      onclick: () => { play('tab'); select(id); },
    },
    spriteEl(ship.sprite, 1),
    el('div', null,
      el('div.rname', { text: ship.name }),
      el('div.rsub', { text: isUnlocked ? ship.tagline : (unlockProgress(profile, id)?.text || 'Locked') })));
    list.append(row);
  }
  select(selected);
}

function renderShipDetail(profile, id, isUnlocked, onLaunch) {
  const ship = SHIPS[id];
  const pane = clear($('#ship-detail'));

  pane.append(el('div.detail-hero', null, spriteEl(ship.sprite, 3)));
  pane.append(el('h3.detail-name', { text: ship.name }));
  pane.append(el('p.detail-tagline', { text: ship.tagline }));

  if (!isUnlocked) {
    const prog = unlockProgress(profile, id);
    pane.append(el('div.locked-box', null,
      spriteEl('icon_lock', 2),
      el('div', null,
        el('div.locked-title', { text: 'How to unlock' }),
        el('div.locked-desc', { text: prog?.text || '' }),
        prog && prog.need > 1 ? el('div.locked-prog', { text: `${prog.have} / ${prog.need}` }) : null)));
    return;
  }

  pane.append(el('p.detail-desc', { text: ship.desc }));

  pane.append(el('h4.section-title', { text: 'Starting attributes' }));
  pane.append(el('div.attr-bars', null, ...ATTRIBUTES.map(a => {
    const v = ship.attributes[a.id];
    return el('div.attr-bar', null,
      spriteEl(a.icon, 1),
      el('span.ab-name', { text: a.name }),
      el('span.ab-track', null, el('span', { style: { width: `${(v / 8) * 100}%`, background: a.accent } })),
      el('b.ab-val', { text: String(v) }));
  })));

  pane.append(el('h4.section-title', { text: 'Starting loadout' }));
  const gear = Object.entries(ship.gear || {}).map(([slot, baseId]) => {
    const w = WEAPONS[baseId];
    return el('div.gear-line', null,
      el('span.gl-slot', { text: slot.replace(/\d$/, '') }),
      el('span.gl-name', { text: w ? w.name : baseId.replace(/_/g, ' ') }));
  });
  pane.append(el('div.gear-list', null, ...gear));

  pane.append(el('div.perk-box', null,
    el('div.perk-name', { text: ship.perk.name }),
    el('div.perk-desc', { text: ship.perk.desc })));

  // Optional seed, for sharing a run.
  const seedInput = el('input.seed-input', {
    type: 'text', placeholder: 'Seed (optional)', maxlength: '24',
    'aria-label': 'Run seed',
  });
  pane.append(el('div.seed-row', null,
    seedInput,
    el('button.btn.btn-small.btn-ghost', {
      onclick: () => { seedInput.value = RNG.friendlySeed(); play('tab'); },
    }, el('span', { text: 'Roll' }))));

  pane.append(el('button.btn.btn-primary.launch-btn', {
    onclick: () => { play('confirm'); onLaunch(id, seedInput.value.trim() || null); },
    // A hull whose name already starts with an article must not get another.
  }, el('span', { text: /^the\s/i.test(ship.name) ? `Launch ${ship.name}` : `Launch the ${ship.name}` })));
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function renderAchievements(profile) {
  const earned = profile.achievements || {};
  $('#ach-progress').textContent = `${earnedCount(profile)} / ${ACHIEVEMENTS.length}`;

  const grid = clear($('#ach-grid'));
  for (const cat of CATEGORIES) {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat);
    if (!items.length) continue;
    grid.append(el('h3.ach-cat', { text: cat }));
    const wrap = el('div.ach-row');
    for (const a of items) {
      const got = !!earned[a.id];
      wrap.append(el(`div.ach${got ? '.got' : '.locked'}`, null,
        spriteEl(a.icon || 'icon_trophy', 2),
        el('div', null,
          el('div.ach-name', { text: a.name }),
          el('div.ach-desc', { text: a.desc }))));
    }
    grid.append(wrap);
  }
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export function renderStats(profile) {
  const s = profile.stats;
  const grid = clear($('#stat-grid'));
  const rows = [
    ['Runs started', s.runs],
    ['Master Fleets broken', s.wins],
    ['Ships lost', s.losses],
    ['Hostiles destroyed', s.totalKills],
    ['Nodes cleared', s.totalNodes],
    ['Credits earned', s.totalCredits],
    ['Deepest ring', s.bestRing],
    ['Highest level', s.bestLevel],
    ['Most nodes in a run', s.bestNodes],
    ['Fastest victory', s.fastestWin ? duration(s.fastestWin) : '—'],
    ['Time in combat', duration(s.playtime)],
    ['Achievements', `${earnedCount(profile)} / ${ACHIEVEMENTS.length}`],
  ];
  for (const [k, v] of rows) {
    grid.append(el('div.stat-cell', null,
      el('div.sc-v', { text: String(v) }),
      el('div.sc-k', { text: k })));
  }

  const hist = clear($('#history'));
  if (!profile.history.length) {
    hist.append(el('p.modal-text.flavour', { text: 'No runs yet.' }));
    return;
  }
  for (const h of profile.history) {
    hist.append(el(`div.hist-row.${h.outcome}`, null,
      spriteEl(SHIPS[h.shipId]?.sprite || 'ship_ext_kestrel', 1),
      el('div.hr-main', null,
        el('div.hr-name', { text: `${h.shipName || 'Ship'} — ${outcomeLabel(h.outcome)}` }),
        el('div.hr-sub', { text: `Level ${h.level} · Ring ${h.ring} · ${h.nodes} nodes · ${h.kills} kills · ${duration(h.elapsed)}` })),
      el('div.hr-score', null,
        el('b', { text: String(h.score) }),
        el('span', { text: relativeTime(h.at) }))));
  }
}

function outcomeLabel(o) {
  return o === 'victory' ? 'Victory' : o === 'abandoned' ? 'Abandoned' : 'Lost';
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

export function renderHelp() {
  const body = clear($('#help-body'));
  const section = (title, ...children) =>
    el('section.help-sec', null, el('h3', { text: title }), ...children);
  const p = text => el('p', { text });
  const keyRow = (k, d) => el('div.keyrow', null, el('kbd', { text: k }), el('span', { text: d }));

  body.append(
    section('The run',
      p('You start at the centre of a web of star systems and fly outward. Every node you jump to is one encounter — a fight, a hazard, a derelict, a trading post, or something stranger.'),
      p('The further out you go, the higher the threat. Each node shows its threat level, coloured against your own: green is even odds, red is not. You can absolutely fly somewhere that kills you.'),
      p('Nodes pay out once. Going back over old ground gets you nothing, so the run only moves one way: outward.'),
      p('Fog hides everything more than a few jumps from somewhere you have been. Get deep enough and the Master Fleet appears on the rim — level 20, and the end of the run if you can break it.'),
      p('Your hull does not heal between nodes. Repairs come from drops, trading posts and the odd anomaly. Die and the run is gone for good.')),

    section('Flying',
      el('div.keygrid', null,
        keyRow('W A S D', 'Move'),
        keyRow('Mouse', 'Aim'),
        keyRow('Left click', 'Primary weapon'),
        keyRow('Right click', 'Secondary weapon'),
        keyRow('Middle click', 'Heavy mount — unlocked at level 13'),
        keyRow('Space / Shift', 'Dash — you are briefly untouchable'),
        keyRow('1 / 2 / 3 · Q / E / R', 'Abilities from your utility gear'),
        keyRow('I · Tab', 'Ship and loadout'),
        keyRow('Esc', 'Pause')),
      p('Firing draws on your energy. Run it dry and your guns stop, so watch the bar. Dashing has invulnerability frames — it is the answer to a wall of fire you cannot fly around.')),

    section('Getting stronger',
      p('Everything you clear gives experience. Each level gives you two points to put into six attributes: Hull, Shields, Weapons, Reactor, Thrusters and Systems. There is no respec, so build deliberately.'),
      p('Gear fills eleven mounts — two weapons plus a heavy mount cut in at level 13, engine, shield, reactor, hull plating, nav computer, and three utility slots.'),
      p('Active abilities are rare and only appear on Military-tier gear or better, so a blue drop is worth stopping for. Drones from any source are an escort, not an army: at most four fly with you and they expire on their own.'),
      p('Loot is rolled, not fixed: a Relic-tier part found early can carry a whole run.')),

    section('Reading a fight',
      p('Enemy fire is red, amber or purple. Yours is cyan. If it is warm-coloured it can hurt you.'),
      p('A green ring around an enemy means it is sheltering everything nearby — kill it first or the rest will not die.'),
      p('A chevron on the right edge means something is about to arrive there.'),
      p('You can disengage from any fight. You keep the damage and lose the reward, but you keep the ship.')));
}
