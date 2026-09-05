/**
 * Duelist abilities: the 32 telegraphed special moves a named ship can carry.
 *
 * Each entry is pure data plus a `use(api)` that may only touch the world
 * through the `api` handed to it (docs/duelist-spec.md section 5). Nothing here
 * reads the clock, the renderer or `Math.random` — the ability driver owns
 * cooldowns, windups, charges and the `when` gates, so these functions are a
 * single instant of effect and are trivially replayable headlessly.
 *
 * Reading the balance:
 *
 * - `windup` is the visible charge BEFORE `use` runs, so the player's total
 *   warning is `windup` plus whatever telegraph the effect carries itself. A
 *   beam with `windup: 1.2` and `telegraph: 1.0` gives well over two seconds.
 *   That is deliberate: the dodge should be a decision, not a reaction time.
 * - Damage units. Bullet and mine `damage` is absolute, so it is written as
 *   `api.dmg * k` — `api.dmg` is already threat-scaled. Beam `damage` is
 *   documented as a multiple of `api.dmg` (matching `spawnBeam`, which does the
 *   multiply itself), so beams carry the bare multiplier. Zone `dps` is written
 *   as `api.dmg * k` for the same reason bullets are; the sim's own zone scaling
 *   should therefore be passed through, not applied again on top.
 * - Bullet `speed` stays inside 240–360. A global scale is applied downstream,
 *   so anything authored faster than that arrives undodgeable on high threat.
 *
 * Every ability should change what the player is doing, not just how much
 * damage they are taking. Where that intent is not obvious from the code it is
 * written down above the ability.
 */

const TAU = Math.PI * 2;

export const DUEL_ABILITIES = {
  // ---------------------------------------------------------------------------
  // Beams and lances — punish holding a line
  // ---------------------------------------------------------------------------

  mega_laser: {
    id: 'mega_laser',
    name: 'Mega Laser',
    tags: ['beam', 'offence', 'heavy'],
    desc: 'A wide lance that cuts the field in half. It follows you while it charges and locks an instant before it fires.',
    tell: 'The whole spine lights up and the muzzle drags round onto you.',
    cooldown: 11,
    windup: 1.4,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'mega_laser' });
      // Tracking through the telegraph is what makes it interesting: walking
      // sideways only feeds it. The dodge is a late, committed break.
      api.beam({
        angle: api.aim(), telegraph: 1.0, width: 52,
        damage: 4.2, length: 1400, linger: 0.45, track: true,
      });
    },
  },

  beam_sweep: {
    id: 'beam_sweep',
    name: 'Beam Sweep',
    tags: ['beam', 'offence', 'zoning'],
    desc: 'Four locked beams fire in sequence across the caster\'s arc, closing on you one line at a time.',
    tell: 'Four thin guide lines fan out and brighten from the outside in.',
    cooldown: 12,
    windup: 1.2,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'beam_sweep' });
      const a = api.aim();
      // Staggered telegraphs, not staggered fire: each line announces itself
      // before the previous one has finished, so the safe gap is always moving
      // and standing between two beams is only safe for a beat.
      [-0.42, -0.14, 0.14, 0.42].forEach((o, i) => {
        api.beam({
          angle: a + o, telegraph: 0.6 + i * 0.28, width: 20,
          damage: 2.4, length: 1400, linger: 0.25, track: false,
        });
      });
    },
  },

  chain_lightning: {
    id: 'chain_lightning',
    name: 'Chain Lightning',
    tags: ['beam', 'offence'],
    desc: 'A short arc that jumps three times, each jump landing wider than the last. The first is aimed at you; the rest are aimed at where flinching would put you.',
    tell: 'Three arcs crawl along the hull looking for somewhere to go.',
    cooldown: 11,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'chain_lightning' });
      const a = api.aim();
      // The two off-axis arcs cover the obvious dodges. Committing early beats
      // it; twitching sideways at the last moment walks into the second arc.
      const jumps = [
        { off: 0, tele: 0.7 },
        { off: -0.34, tele: 1.05 },
        { off: 0.34, tele: 1.4 },
      ];
      for (const j of jumps) {
        api.beam({
          angle: a + j.off, telegraph: j.tele, width: 14,
          damage: 1.8, length: 900, linger: 0.15, track: false,
        });
      }
    },
  },

  railshot: {
    id: 'railshot',
    name: 'Railshot',
    tags: ['offence', 'sniper', 'heavy'],
    desc: 'A single needle down a locked line, preceded by two tracers along the same bearing. It hurts badly and it does not turn.',
    tell: 'Two thin tracers go past first. The heavy shot is on that exact line.',
    cooldown: 9,
    windup: 1.3,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'railshot' });
      const a = api.aim();
      // The tracers are the whole design: they cost almost nothing and they
      // draw the line the killing shot will take, so the fight is about not
      // sharing a bearing with this ship rather than about reflexes.
      api.shoot([
        { angle: a, speed: 350, damage: api.dmg * 0.4, sprite: 'eb_needle', life: 3 },
        { angle: a, speed: 350, damage: api.dmg * 0.4, sprite: 'eb_needle', life: 3, delay: 0.12 },
        { angle: a, speed: 360, damage: api.dmg * 3.0, sprite: 'eb_needle', life: 3.5, radius: 18, delay: 0.42 },
      ]);
    },
  },

  // ---------------------------------------------------------------------------
  // Bullet pressure — punish camping and punish crowding
  // ---------------------------------------------------------------------------

  overload_burst: {
    id: 'overload_burst',
    name: 'Overload Burst',
    tags: ['offence', 'nova', 'anti-melee'],
    desc: 'Two rings of shot vented at once, the second offset from the first. Close in, the rings have no gaps worth the name.',
    tell: 'The vents flare white and the ship stops shooting.',
    cooldown: 10,
    windup: 1.1,
    when: { maxDist: 420 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'overload_burst' });
      // A ring is dense at its origin and sparse at range, which is exactly the
      // punish this wants: the answer is to be somewhere else, not to out-trade.
      const out = [];
      for (let i = 0; i < 12; i++) {
        out.push({ angle: (i / 12) * TAU, speed: 300, damage: api.dmg * 0.9 });
        out.push({ angle: ((i + 0.5) / 12) * TAU, speed: 250, damage: api.dmg * 0.9, delay: 0.3 });
      }
      api.shoot(out);
    },
  },

  nova_pulse: {
    id: 'nova_pulse',
    name: 'Nova Pulse',
    tags: ['offence', 'zoning', 'anti-melee'],
    desc: 'A shockwave that grows out of the hull. Standing off is free; standing on top of it is not.',
    tell: 'A ring of light tightens onto the hull before it expands.',
    cooldown: 12,
    windup: 1.2,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'nova_pulse' });
      // Growth rate is the balance lever. At 210 px/s the wave is slower than
      // the player, so outrunning it outward is always available — the only way
      // to be caught is to have been standing still in the middle of it.
      api.zone({
        x: api.e.x, y: api.e.y, r: 30, maxR: 300, growth: 210,
        dps: api.dmg * 2.0, life: 2.2, arm: 0.35, kind: 'field',
      });
      api.shoot(Array.from({ length: 10 }, (_, i) => ({
        angle: (i / 10) * TAU, speed: 260, damage: api.dmg * 0.8, delay: 0.35,
      })));
    },
  },

  flak_curtain: {
    id: 'flak_curtain',
    name: 'Flak Curtain',
    tags: ['offence', 'zoning', 'keepaway'],
    desc: 'A hanging screen of airbursts laid across the middle of the field. Crossing it costs something; sitting behind it costs more.',
    tell: 'A row of small charges is lobbed out and hangs there unlit.',
    cooldown: 9,
    windup: 0.9,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'flak_curtain' });
      const w = api.world;
      // The curtain is laid between the caster and the player, so retreating to
      // maximum range means retreating through it. Camping the back wall is the
      // failure state this ability exists to close.
      // Between the two of you on whichever side the player is, rather than
      // always to the caster's left: a screen laid away from the player is one
      // they can sit behind and ignore.
      const behind = api.player.x > api.e.x;
      const lane = clamp(
        behind ? Math.max(api.e.x + 60, (api.e.x + api.player.x) / 2)
          : Math.min(api.e.x - 60, (api.e.x + api.player.x) / 2),
        80, w.w - 40,
      );
      const rows = 7;
      api.shoot(Array.from({ length: rows }, (_, i) => ({
        x: lane, y: (i + 0.5) * (w.h / rows),
        angle: behind ? 0 : Math.PI, speed: 240, sprite: 'eb_flak',
        damage: api.dmg * 0.8, radius: 34, life: 4.5,
        delay: 0.1 * (i % 2),
      })));
    },
  },

  barrier_wall: {
    id: 'barrier_wall',
    name: 'Barrier Wall',
    tags: ['offence', 'zoning'],
    desc: 'Two full-height walls with one gap each, offset from one another. Find the first gap and you are already late for the second.',
    tell: 'The emitters along the flank light in sequence, top to bottom.',
    cooldown: 10,
    windup: 0.8,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'barrier_wall' });
      // double_wall already encodes the offset-gap puzzle and picks its gaps
      // from the seeded rng, so there is nothing to gain by rewriting it here.
      api.pattern('double_wall');
    },
  },

  shatter_shot: {
    id: 'shatter_shot',
    name: 'Shatter Shot',
    tags: ['offence', 'heavy'],
    desc: 'A heavy shell that breaks apart halfway across the field into a wide fan. The shell is easy; the fan is the attack.',
    tell: 'One slow orb, with the casing already cracked.',
    cooldown: 10,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'shatter_shot' });
      const a = api.aim();
      const burstAt = Math.min(api.dist() * 0.5, 260);
      const bx = api.e.x + Math.cos(a) * burstAt;
      const by = api.e.y + Math.sin(a) * burstAt;
      // There is no fragmenting enemy bullet in the sim, so the fragments are
      // authored as delayed bullets parked at the burst point: a delayed enemy
      // bullet holds position and cannot hit anything, which is exactly the
      // behaviour a shell in flight needs. The delay is the shell's flight time
      // at 250 px/s, so the two read as one event.
      const flight = burstAt / 250;
      const frags = Array.from({ length: 7 }, (_, i) => ({
        x: bx, y: by, angle: a + (i - 3) * 0.16,
        speed: 300, damage: api.dmg * 0.7, sprite: 'eb_flak', life: 3, delay: flight,
      }));
      api.shoot([
        { angle: a, speed: 250, damage: api.dmg * 1.4, sprite: 'eb_heavy', radius: 28, life: flight + 0.1 },
        ...frags,
      ]);
    },
  },

  cluster_bomb: {
    id: 'cluster_bomb',
    name: 'Cluster Bomb',
    tags: ['offence', 'zoning'],
    desc: 'A canister that seeds burning patches along the lane between you and it. The lane closes behind the shot rather than in front of it.',
    tell: 'A fat canister tumbles out, shedding sparks at intervals.',
    cooldown: 11,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'cluster_bomb' });
      const a = api.aim();
      const reach = Math.min(api.dist(), 420);
      api.shoot([{ angle: a, speed: 240, damage: api.dmg * 1.2, sprite: 'eb_heavy', radius: 26, life: 3 }]);
      // Submunitions are zones with staggered arming times rather than more
      // bullets: they land along the canister's track and turn the direct line
      // to the caster into ground you have to give up, which is a different
      // question from "can you dodge this".
      for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        api.zone({
          x: api.e.x + Math.cos(a) * reach * f,
          y: api.e.y + Math.sin(a) * reach * f,
          r: 78, dps: api.dmg * 1.6, life: 5, arm: 0.5 + f * 0.9, kind: 'burn',
        });
      }
    },
  },

  homing_swarm: {
    id: 'homing_swarm',
    name: 'Homing Swarm',
    tags: ['offence', 'missiles'],
    desc: 'A long stream of seekers, launched in pairs. They turn slowly, so they are beaten by turning faster than they do rather than by outrunning them.',
    tell: 'Rack covers open along the flank and stay open.',
    cooldown: 10,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'homing_swarm' });
      const a = api.aim();
      // Turn rate 2.0 and speed 260 together mean a seeker cannot hold a tight
      // circle. Attrition that rewards moving, not a guaranteed hit.
      api.shoot(Array.from({ length: 8 }, (_, i) => ({
        angle: a + (i % 2 ? 0.45 : -0.45),
        speed: 260, damage: api.dmg * 0.7, sprite: 'eb_homing',
        homing: true, turnRate: 2.0, life: 6, delay: i * 0.2,
      })));
    },
  },

  target_lock: {
    id: 'target_lock',
    name: 'Target Lock',
    tags: ['offence', 'missiles', 'sniper'],
    desc: 'Three hard-turning missiles released one at a time against a solved firing solution. Break the line of sight of its own guns and they lose you.',
    tell: 'A reticle settles on your hull and stops drifting.',
    cooldown: 11,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'target_lock' });
      const a = api.aim();
      // Released on a stagger so the answer is one sustained manoeuvre rather
      // than one dodge: three separate decisions, spaced far enough apart to
      // make each one readable.
      api.shoot([0, 1, 2].map(i => ({
        angle: a, speed: 280, damage: api.dmg * 1.1, sprite: 'eb_homing',
        homing: true, turnRate: 2.6, life: 5, delay: 0.35 + i * 0.45,
      })));
    },
  },

  // ---------------------------------------------------------------------------
  // Space denial — punish standing still
  // ---------------------------------------------------------------------------

  gravity_snare: {
    id: 'gravity_snare',
    name: 'Gravity Snare',
    tags: ['control', 'zoning'],
    desc: 'A well opens under wherever you were standing and hauls you back into it. The floor of the well burns.',
    tell: 'Dust and spent shot in the field start sliding toward one point.',
    cooldown: 12,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'gravity_snare' });
      const p = api.player;
      // Anchored to where the player IS at cast, not where they will be: the
      // counter is to be moving already. Standing still means being dragged
      // into the centre of the burn, which is the entire point of the ability —
      // it makes a stationary player pay for it without ever being unavoidable.
      api.pull(220, 260, 1.8);
      api.zone({
        x: p.x, y: p.y, r: 74, dps: api.dmg * 2.2, life: 3.4, arm: 0.9, kind: 'field',
      });
    },
  },

  singularity: {
    id: 'singularity',
    name: 'Singularity',
    tags: ['control', 'zoning', 'heavy'],
    desc: 'A collapsing point dropped into the middle of the field. It pulls weakly but for a long time, and the core of it will kill you.',
    tell: 'A dark point opens mid-field and the light bends round it.',
    cooldown: 16,
    windup: 1.5,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'singularity' });
      const w = api.world;
      // Placed mid-field rather than on the player: this is meant to reshape the
      // arena for the next six seconds, not to catch anyone out. Weak force over
      // a long window, with a small lethal core — you can always fly out of it,
      // but you have to spend the whole fight aware of where it is.
      const x = w.w * 0.5;
      const y = w.h * 0.5;
      api.pull(120, 420, 6);
      api.zone({ x, y, r: 46, dps: api.dmg * 3.2, life: 6.5, arm: 1.0, kind: 'field' });
      api.zone({ x, y, r: 110, maxR: 190, growth: 14, dps: api.dmg * 0.9, life: 6.5, arm: 1.0, kind: 'gas' });
    },
  },

  venom_cloud: {
    id: 'venom_cloud',
    name: 'Venom Cloud',
    tags: ['zoning', 'attrition'],
    desc: 'A cloud vented ahead of your drift that keeps spreading after it lands. It does not hurt much per second; it hurts for a long time.',
    tell: 'A green plume vents from the flank, ahead of you rather than at you.',
    cooldown: 11,
    windup: 0.9,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'venom_cloud' });
      const p = api.player;
      const w = api.world;
      // Led half a second onto the player's current velocity, so it lands where
      // a camper would be and misses anyone who changed direction. Low dps, long
      // life: the cost is having to give up a corner, not the damage. Clamped
      // into the field because a fast player at an edge would otherwise lead the
      // cloud off the map entirely, which is a wasted cast rather than a dodge.
      api.zone({
        x: clamp(p.x + p.vx * 0.5, 30, w.w - 30),
        y: clamp(p.y + p.vy * 0.5, 30, w.h - 30),
        r: 58, maxR: 180, growth: 30, dps: api.dmg * 1.3, life: 8, arm: 0.7, kind: 'gas',
      });
    },
  },

  burn_trail: {
    id: 'burn_trail',
    name: 'Burn Trail',
    tags: ['zoning', 'attrition'],
    desc: 'Burning slag laid in a line that drifts toward you. The field it leaves is narrow, and it is going to be where you are.',
    tell: 'The engines run rich and start shedding lit debris.',
    cooldown: 10,
    windup: 0.7,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'burn_trail' });
      // Drifting patches rather than static ones: a static trail is dodged once
      // and then ignored, a drifting one has to be kept track of. The drift is
      // slower than the player so it is a herding tool, not a chase.
      const w = api.world;
      for (let i = 0; i < 4; i++) {
        api.zone({
          x: api.e.x - i * 16,
          y: clamp(api.e.y + (i - 1.5) * 46, 40, w.h - 40),
          r: 62, dps: api.dmg * 1.5, life: 6, arm: 0.6,
          vx: -70, vy: 0, kind: 'burn',
        });
      }
    },
  },

  mine_lattice: {
    id: 'mine_lattice',
    name: 'Mine Lattice',
    tags: ['zoning', 'mines'],
    desc: 'Six proximity mines set out in two staggered columns. They are shootable and they are patient.',
    tell: 'Canisters are laid out one at a time, each blinking once as it arms.',
    cooldown: 12,
    windup: 0.8,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'mine_lattice' });
      const w = api.world;
      // Two columns with the rows offset means there is no straight horizontal
      // run through the lattice: crossing it costs a change of altitude, which
      // is the whole tax. Proximity is kept well under the mine's blast radius
      // so a mine that triggers is still survivable if you were already moving.
      const specs = [];
      for (let col = 0; col < 2; col++) {
        for (let row = 0; row < 3; row++) {
          specs.push({
            x: clamp(api.e.x - 90 - col * 110, 60, w.w - 60),
            y: clamp(w.h * (0.22 + row * 0.28) + (col ? w.h * 0.14 : 0), 40, w.h - 40),
            damage: api.dmg * 1.8, radius: 78, proximity: 46, life: 12,
          });
        }
      }
      for (const s of specs) api.mine(s);
    },
  },

  // ---------------------------------------------------------------------------
  // Movement — punish approaching, and punish letting it approach
  // ---------------------------------------------------------------------------

  blink_strike: {
    id: 'blink_strike',
    name: 'Blink Strike',
    tags: ['mobility', 'offence'],
    desc: 'It jumps to your flank and fires a cone a beat later. The jump is the warning, not the attack.',
    tell: 'The hull folds in on itself, then is somewhere else.',
    cooldown: 8,
    windup: 0.7,
    when: { minDist: 240 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'blink_strike' });
      const p = api.player;
      const w = api.world;
      const side = api.rng() < 0.5 ? -1 : 1;
      // Arrives offset rather than on top of the player: landing inside the
      // player's hull is contact damage with no dodge, which is a bug dressed as
      // an ability. The x offset also keeps it on the enemy's side of its target.
      api.blink(
        clamp(p.x + 160, w.w * 0.3, w.w - 40),
        clamp(p.y + side * 110, 40, w.h - 40),
      );
      const a = api.aim();
      api.shoot(Array.from({ length: 5 }, (_, i) => ({
        angle: a + (i - 2) * 0.13, speed: 320, damage: api.dmg * 0.8,
        life: 2.2, delay: 0.4,
      })));
    },
  },

  ram_charge: {
    id: 'ram_charge',
    name: 'Ram Charge',
    tags: ['mobility', 'melee'],
    desc: 'A committed run straight through where you are standing. It cannot steer once it is moving.',
    tell: 'It squares up, engines flare, and it stops firing entirely.',
    cooldown: 9,
    windup: 1.1,
    when: { minDist: 180 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'ram_charge' });
      // 1.1s of windup plus a short lunge: a charge that steers all the way in
      // is faster than the player and therefore attaches rather than threatens.
      // The lunge is deliberately brief so it overshoots and has to come round.
      api.lunge(2.4, 0.85);
      api.armour(0.2, 1.2);
    },
  },

  retro_burn: {
    id: 'retro_burn',
    name: 'Retro Burn',
    tags: ['mobility', 'defence', 'keepaway'],
    desc: 'It reverses hard out of knife range and leaves two shots behind it. Closing in is not free.',
    tell: 'The forward thrusters fire in your face.',
    cooldown: 8,
    windup: 0.5,
    when: { maxDist: 280 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'retro_burn' });
      // The point-blank rush is a real answer to most of this vocabulary, so at
      // least some ships should make you pay for it. Short speed window: it buys
      // distance once, it does not become permanently unreachable.
      api.speed(1.9, 1.4);
      api.clearShots(120);
      api.pattern('parting_shot');
    },
  },

  siege_mode: {
    id: 'siege_mode',
    name: 'Siege Mode',
    tags: ['stance', 'offence', 'defence'],
    desc: 'It plants itself, hardens, and doubles its rate of fire. It cannot move at all while it does this.',
    tell: 'Legs deploy and the hull settles, glowing at the joints.',
    cooldown: 13,
    windup: 0.8,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'siege_mode' });
      // A stance trade the player can exploit: rooted for the full window, so
      // this is the ship's most dangerous and most killable four seconds. The
      // armour bonus stops it being a pure free-damage window for the player.
      api.root(4);
      api.fireRate(2, 4);
      api.armour(0.22, 4);
    },
  },

  frenzy: {
    id: 'frenzy',
    name: 'Frenzy',
    tags: ['stance', 'offence', 'desperation'],
    desc: 'Below half hull it stops managing its heat and simply shoots faster than it should. It also stops turning well.',
    tell: 'Vents glow orange and stay orange.',
    cooldown: 14,
    windup: 0.8,
    when: { belowHull: 0.5 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'frenzy' });
      // A late-fight escalation, not a defensive panic button: the fight gets
      // harder as it dies, which is the only honest way to make the last third
      // of a health bar interesting. No armour here — it is trading survival.
      api.fireRate(2.2, 5);
      api.speed(1.25, 5);
    },
  },

  // ---------------------------------------------------------------------------
  // Defence — windows, not walls
  // ---------------------------------------------------------------------------

  phase_out: {
    id: 'phase_out',
    name: 'Phase Out',
    tags: ['defence', 'evasion'],
    desc: 'The hull drops out of phase for a moment. Shots pass through it, and anything already in flight is wasted.',
    tell: 'The silhouette thins to an outline you can see the field through.',
    cooldown: 12,
    windup: 0.6,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'phase_out' });
      // Clearing the shots in flight as well as going untouchable is what turns
      // this from an annoyance into a rule: hold your burst until it is solid
      // again. 1.4s is short enough that waiting it out costs almost nothing.
      api.invuln(1.4);
      api.clearShots(150);
    },
  },

  reflect_field: {
    id: 'reflect_field',
    name: 'Reflect Field',
    tags: ['defence', 'punish'],
    desc: 'For a few seconds anything you fire into it comes back at you at the same speed. It does not stop you shooting. It only makes it your problem.',
    tell: 'A mirrored shell snaps into place around the hull.',
    cooldown: 12,
    windup: 0.9,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'reflect_field' });
      // The one ability in the set that punishes the player's trigger finger
      // rather than their feet. It is only fair because the tell is on the
      // target you are already aiming at — you cannot fail to see it.
      api.reflect(2.6);
      api.armour(0.1, 2.6);
    },
  },

  hardlight_shield: {
    id: 'hardlight_shield',
    name: 'Hardlight Shield',
    tags: ['defence', 'armour'],
    desc: 'A slab of hardlight forms across the bow and soaks most of what lands on it. Shots already in the air are pushed off.',
    tell: 'A bright plate assembles panel by panel across the nose.',
    cooldown: 12,
    windup: 0.6,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'hardlight_shield' });
      // Armour rather than invulnerability, so the damage race continues at a
      // worse rate instead of stopping. Three seconds is roughly one weapon
      // heat cycle: long enough to be worth reacting to, short enough to wait.
      api.armour(0.42, 3);
      api.clearShots(130);
    },
  },

  repair_weave: {
    id: 'repair_weave',
    name: 'Repair Weave',
    tags: ['defence', 'sustain'],
    desc: 'Field repair, run while it is still being shot at. It gives back a slice of hull, once in a while, and it is slow enough to interrupt with damage.',
    tell: 'Repair arms unfold along the spine and start working.',
    cooldown: 14,
    windup: 1.2,
    when: { belowHull: 0.7 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'repair_weave' });
      // Capped at the spec ceiling: any more and a long fight becomes a stall
      // where the ship out-heals the player's damage per cooldown cycle.
      api.heal(0.15);
    },
  },

  shield_recharge: {
    id: 'shield_recharge',
    name: 'Shield Recharge',
    tags: ['defence', 'sustain'],
    desc: 'It dumps reserve power into the shield and stands still while it does. The shield comes back; the hull does not.',
    tell: 'The shield envelope flickers back on from the emitters outward.',
    cooldown: 12,
    windup: 1.0,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'shield_recharge' });
      // Rooted for the recharge so it is a window for the player, not a reset.
      // Shield restore is deliberately partial: a full refill makes the first
      // half of the fight count for nothing.
      api.root(1.1);
      api.restoreShield(0.45);
    },
  },

  emp_pulse: {
    id: 'emp_pulse',
    name: 'EMP Pulse',
    tags: ['control', 'anti-melee'],
    desc: 'A close-range pulse that takes energy off your systems. It costs you your next few specials rather than hull.',
    tell: 'A pale ring gathers on the hull and holds there.',
    cooldown: 12,
    windup: 0.9,
    when: { maxDist: 340 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'emp_pulse' });
      // Gated to close range so it reads as a punish for crowding rather than a
      // tax you pay at random. Energy is the resource that decides whether you
      // can answer the next ability, so this is a real hit without being damage.
      api.drainEnergy(30 + api.threat * 2);
      api.shoot(Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * TAU, speed: 240, damage: api.dmg * 0.6, sprite: 'eb_orb', delay: 0.25,
      })));
    },
  },

  // ---------------------------------------------------------------------------
  // Bodies on the field — every one of these is charge-limited
  // ---------------------------------------------------------------------------

  summon_wing: {
    id: 'summon_wing',
    name: 'Summon Wing',
    tags: ['summon', 'support'],
    desc: 'Calls a pair of escorts in from off the field. It can do this twice in a fight and no more.',
    tell: 'A recall signal, and two contacts crossing in from the right edge.',
    cooldown: 14,
    windup: 1.0,
    charges: 2,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'summon_wing' });
      // Charge-limited because an endless spawner is a stalemate: the player
      // cannot out-damage the production line and the fight has no shape.
      // Interceptors rather than pickets so the escorts pressure the player's
      // position instead of just adding bullets to dodge.
      api.summon('interceptor', 2, { spread: 90 });
    },
  },

  drone_bay: {
    id: 'drone_bay',
    name: 'Drone Bay',
    tags: ['summon', 'support'],
    desc: 'Launches a short-lived pair of drones from a bay in the flank. Three launches, then the bay is empty.',
    tell: 'A bay door opens on the flank and stays open while it cycles.',
    cooldown: 13,
    windup: 0.8,
    charges: 3,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'drone_bay' });
      // An escort, not an army: two weak bodies per launch, three launches. The
      // question this asks is whether the player spends time on the drones or
      // eats their fire while finishing the parent — which is the good version
      // of a carrier fight.
      api.summon('picket', 2, { spread: 70 });
    },
  },

  split_form: {
    id: 'split_form',
    name: 'Split Form',
    tags: ['summon', 'evasion'],
    desc: 'The hull comes apart into smaller bodies that fight on their own. What is left is harder to pin down.',
    tell: 'Seams open along the hull and the sections drift apart.',
    cooldown: 15,
    windup: 0.9,
    charges: 2,
    when: { belowHull: 0.65 },
    use(api) {
      api.emit({ type: 'abilityCast', id: 'split_form' });
      // Gated below two thirds hull so it is a second phase rather than an
      // opener, and charge-limited so the second phase cannot loop. The speed
      // boost sells the split: the remaining body is genuinely harder to hit.
      api.summon('splitter', 2, { spread: 60 });
      api.speed(1.3, 4);
    },
  },

  decoy_split: {
    id: 'decoy_split',
    name: 'Decoy Split',
    tags: ['evasion', 'summon'],
    desc: 'Three copies peel off and fly the same profile. Two of them are nothing, and shooting them wastes the window.',
    tell: 'Three identical hulls where there was one, all still turning together.',
    cooldown: 13,
    windup: 0.6,
    charges: 3,
    use(api) {
      api.emit({ type: 'abilityCast', id: 'decoy_split' });
      // Charge-limited on the same grounds as the true summons: decoys are
      // bodies to shoot, and unlimited bodies is an unwinnable damage race.
      // The speed window is what makes picking the real one actually matter.
      api.decoy(3);
      api.speed(1.2, 3);
    },
  },
};

export const DUEL_ABILITY_IDS = Object.keys(DUEL_ABILITIES);

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
