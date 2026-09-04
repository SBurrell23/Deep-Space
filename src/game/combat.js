/**
 * Combat.
 *
 * Real time with pause, exactly like the game this owes its existence to.
 * `Combat` owns both ships, the projectiles in flight, boarding parties and
 * the enemy AI. It emits presentation events (`onEvent`) rather than touching
 * the DOM, so the whole fight is simulatable headlessly in the test suite.
 */

import {
  updateShip, applyHit, absorbWithShields, evasion, isWeaponReady, crewInRoom,
  refreshShields, powerCap, setPower, livingCrew, crewAboard, placeInRoom,
  findPath, reconcileWeaponPower, TUNING,
} from './ship.js';
import { effectiveLevel, SYSTEMS } from './systems.js';
import { getWeapon, getDrone, augmentValue, hasAugment } from './weapons.js';
import { isAlive, damageCrew, combatPower, grantXP, getRace, moveSpeed } from './crew.js';

export const COMBAT_SPEEDS = [0, 1, 2, 4];

export class Combat {
  /**
   * @param {object} player  player ship
   * @param {object} enemy   enemy ship (isEnemy: true)
   * @param {RNG}    rng
   * @param {object} opts    { onEvent, environment, canFlee, runState }
   */
  constructor(player, enemy, rng, opts = {}) {
    this.player = player;
    this.enemy = enemy;
    this.rng = rng;
    this.onEvent = opts.onEvent || (() => {});
    this.environment = opts.environment || null; // 'asteroids' | 'solar' | 'nebula' | 'pulsar' | null
    this.canFlee = opts.canFlee !== false;
    // The run's resource pool, so missiles spent in a fight leave the stores.
    this.runState = opts.runState || null;

    this.projectiles = [];
    this.beams = [];
    this.boarders = [];        // player crew aboard the enemy ship
    this.enemyBoarders = [];   // enemy crew aboard the player ship
    this.time = 0;
    this.paused = false;
    this.speed = 1;
    this.over = false;
    this.outcome = null;       // 'victory' | 'defeat' | 'fled' | 'enemyFled'
    this.rewards = null;

    this.ai = new EnemyAI(this, rng);
    this.environmentTimer = this.rng.float(4, 9);

    this.applyPreCombatAugments(player);
    this.applyPreCombatAugments(enemy);
  }

  applyPreCombatAugments(ship) {
    ship.echoUsed = false;
    const zs = augmentValue(ship.augments, 'superShield', 0);
    ship.superShield = typeof zs === 'number' ? zs : 0;
    if (hasAugment(ship.augments, 'pre_igniter')) {
      for (const w of ship.weapons) {
        if (w.powered) {
          const def = getWeapon(w.weaponId);
          w.charge = def.charge;
          if (def.maxCharges) w.charges = def.maxCharges;
        }
      }
    }
    refreshShields(ship, true);
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  update(realDt) {
    if (this.over || this.paused || this.speed === 0) return;
    // Clamp dt so a background tab returning doesn't teleport the fight.
    const dt = Math.min(0.1, realDt) * this.speed;
    this.time += dt;

    const ctx = { rng: this.rng, inCombat: true };
    updateShip(this.player, dt, { ...ctx, onEvent: (t, p) => this.onEvent(t, { ...p, side: 'player' }) });
    updateShip(this.enemy, dt, { ...ctx, onEvent: (t, p) => this.onEvent(t, { ...p, side: 'enemy' }) });

    this.updateAutofire(this.player, dt);
    this.ai.update(dt);
    this.updateProjectiles(dt);
    this.updateBeams(dt);
    this.updateDrones(dt);
    this.updateBoarders(dt);
    this.updateEnvironment(dt);
    this.updateFleeing(dt);
    this.checkOutcome();
  }

  /** Player weapons on autofire shoot the moment they're charged and aimed. */
  updateAutofire(ship, dt) {
    for (const w of ship.weapons) {
      if (!w.autofire || w.targetRoom == null) continue;
      if (isWeaponReady(ship, w.slot)) this.fireWeapon(ship, w.slot, w.targetRoom);
    }
    void dt;
  }

  // -------------------------------------------------------------------------
  // Firing
  // -------------------------------------------------------------------------

  /** Returns true if the volley actually launched. */
  fireWeapon(ship, slot, targetRoom) {
    const w = ship.weapons[slot];
    if (!w || !isWeaponReady(ship, slot)) return false;
    const def = getWeapon(w.weaponId);
    const attackerIsPlayer = ship === this.player;
    const target = def.friendly ? ship : (attackerIsPlayer ? this.enemy : this.player);
    if (!target || target.destroyed) return false;
    if (targetRoom == null || !target.rooms[targetRoom]) return false;

    // Ammunition.
    const run = this.runState;
    if (def.ammo) {
      if (attackerIsPlayer) {
        if (!run || run.missiles < def.ammo) { this.onEvent('outOfAmmo', { slot }); return false; }
        run.missiles -= def.ammo;
      } else if ((ship.missiles ?? 99) < def.ammo) {
        return false;
      } else {
        ship.missiles -= def.ammo;
      }
    }

    // Firing normally drops a cloak.
    if (ship.cloakTimer > 0 && !hasAugment(ship.augments, 'stealth_weapons')) {
      ship.cloakTimer = 0;
      this.onEvent('cloakOff', { side: attackerIsPlayer ? 'player' : 'enemy' });
    }

    if (def.maxCharges) { w.charges = Math.max(0, w.charges - 1); } else { w.charge = 0; }
    if (def.rampUp) w.rampHeat = Math.min(2.2, w.rampHeat + 0.55);
    if (def.chain) w.chainBonus = Math.min(1.2, w.chainBonus + def.chain);

    const crew = ship.crew.find(c => isAlive(c) && c.manning === 'weapons');
    if (crew) grantXP(crew, 'weapons', 4);

    if (def.type === 'beam') {
      this.launchBeam(ship, target, def, targetRoom);
    } else {
      const shots = def.shots || 1;
      for (let i = 0; i < shots; i++) {
        this.projectiles.push({
          id: `p${this.projectiles.length}${this.time.toFixed(3)}${i}`,
          from: attackerIsPlayer ? 'player' : 'enemy',
          attacker: ship, target, def,
          targetRoom: def.scatter ? this.scatterRoom(target, targetRoom) : targetRoom,
          t: -i * 0.12,             // stagger the volley
          speed: def.type === 'missile' ? 0.55 : 1.05,
          intercepted: false,
        });
      }
    }
    this.onEvent('weaponFired', { side: attackerIsPlayer ? 'player' : 'enemy', weapon: def.id, sfx: def.sfx });
    return true;
  }

  /** Flak spreads: some shots drift into neighbouring rooms. */
  scatterRoom(target, roomId) {
    if (this.rng.chance(0.45)) return roomId;
    return this.rng.int(0, target.rooms.length - 1);
  }

  launchBeam(ship, target, def, startRoom) {
    const rooms = this.beamPath(target, startRoom, def.length || 3);
    this.beams.push({
      attacker: ship, target, def, rooms,
      progress: 0, duration: 1.1, hitIndex: -1,
      reflected: false,
    });
  }

  /** A beam sweeps across a run of rooms starting from the aim point. */
  beamPath(target, startRoom, length) {
    const start = target.rooms[startRoom];
    if (!start) return [startRoom];
    const ordered = [...target.rooms].sort((a, b) => a.id - b.id);
    const idx = ordered.findIndex(r => r.id === start.id);
    const out = [];
    for (let i = 0; i < length && idx + i < ordered.length; i++) out.push(ordered[idx + i].id);
    return out.length ? out : [startRoom];
  }

  // -------------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------------

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.t < 0) { p.t += dt * 2; continue; }
      p.t += dt * p.speed;

      // Defense drones intercept mid-flight.
      if (!p.intercepted && p.t > 0.35 && !p.checkedIntercept) {
        p.checkedIntercept = true;
        if (this.tryIntercept(p)) { p.intercepted = true; p.dead = true; continue; }
      }
      if (p.t >= 1) { this.resolveHit(p); p.dead = true; }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  tryIntercept(p) {
    const defender = p.target;
    if (hasAugment(p.attacker.augments, 'defense_scrambler')) return false;
    for (const d of defender.drones) {
      if (!d.powered || !d.deployed) continue;
      const def = getDrone(d.droneId);
      if (!def.intercept) continue;
      const isMissile = p.def.type === 'missile' || p.def.type === 'bomb';
      if (!isMissile && !def.alsoLasers) continue;
      if (this.rng.chance(def.intercept)) {
        this.onEvent('intercepted', { side: defender === this.player ? 'player' : 'enemy' });
        return true;
      }
    }
    return false;
  }

  resolveHit(p) {
    const { attacker, target, def } = p;
    const side = target === this.player ? 'player' : 'enemy';

    // Bombs teleport directly into the room and never miss.
    if (def.type !== 'bomb') {
      const ev = evasion(target);
      if (this.rng.int(1, 100) <= ev) {
        this.onEvent('miss', { side, room: p.targetRoom });
        return;
      }
    }

    // Shields. Ion always beats a layer down; missiles and bombs ignore them.
    const pierce = def.pierce || 0;
    if (!(def.type === 'bomb')) {
      const res = absorbWithShields(target, def.damage || 0, pierce);
      if (res.shielded) {
        this.onEvent('shieldHit', { side, superShield: !!res.superShield });
        return;
      }
    }

    const report = applyHit(target, p.targetRoom, def.damage || 0, {
      fire: def.fire, breach: def.breach, ion: def.ion, stun: def.stun,
      sysOnly: def.sysOnly, hullBonus: def.hullBonus, crewDamage: def.crewDamage,
      repair: def.repair, pullCrew: def.pullCrew,
    }, this.rng);

    attacker.stats.damageDealt += report.hull;
    this.afterHit(target, attacker, p.targetRoom, report, def, side);
  }

  afterHit(target, attacker, roomId, report, def, side) {
    if (report.hull > 0) this.onEvent('hullHit', { side, room: roomId, damage: report.hull });
    else if (report.systemDamage > 0) this.onEvent('systemHit', { side, room: roomId, system: report.system });
    else if (report.blocked) this.onEvent('armorBlocked', { side, room: roomId });
    if (report.fire) this.onEvent('fire', { side, room: roomId });
    if (report.breach) this.onEvent('breach', { side, room: roomId });
    for (const c of report.killed) this.onEvent('crewDied', { side, crew: c, cause: 'weapon' });

    // Gravity Hook scatters the crew it hits.
    if (def.pullCrew) {
      for (const c of crewInRoom(target, roomId)) {
        placeInRoom(target, c, this.rng.int(0, target.rooms.length - 1));
      }
    }

    // Crystal Vengeance fires a shard back at the attacker.
    if (report.hull > 0) {
      const chance = augmentValue(target.augments, 'vengeance', 0);
      if (chance && this.rng.chance(chance)) {
        const room = this.rng.int(0, attacker.rooms.length - 1);
        applyHit(attacker, room, 1, {}, this.rng);
        this.onEvent('vengeance', { side: side === 'player' ? 'enemy' : 'player', room });
      }
    }

    if (target.destroyed) this.onEvent('shipDestroyed', { side });
  }

  updateBeams(dt) {
    for (const b of this.beams) {
      b.progress += dt / b.duration;
      const step = Math.floor(b.progress * b.rooms.length);
      while (b.hitIndex < step - 1 && b.hitIndex < b.rooms.length - 1) {
        b.hitIndex++;
        this.hitBeamRoom(b, b.rooms[b.hitIndex]);
      }
      if (b.progress >= 1) {
        // Mirror Beam sweeps back across the same rooms.
        if (b.def.reflect && !b.reflected) {
          b.reflected = true;
          b.rooms = [...b.rooms].reverse();
          b.progress = 0; b.hitIndex = -1;
        } else {
          b.dead = true;
        }
      }
    }
    this.beams = this.beams.filter(b => !b.dead);
  }

  hitBeamRoom(beam, roomId) {
    const { target, def, attacker } = beam;
    const side = target === this.player ? 'player' : 'enemy';
    // Beams are stopped by shields entirely unless they pierce.
    const layers = target.superShield > 0 ? 99 : target.shields.layers;
    if (layers > (def.pierce || 0)) {
      this.onEvent('shieldHit', { side, beam: true });
      return;
    }
    const report = applyHit(target, roomId, def.damage || 0, {
      fire: def.fire, breach: def.breach, hullBonus: def.hullBonus,
      crewDamage: def.crewDamage, sysOnly: def.sysOnly,
    }, this.rng);
    attacker.stats.damageDealt += report.hull;
    this.afterHit(target, attacker, roomId, report, def, side);
  }

  // -------------------------------------------------------------------------
  // Drones
  // -------------------------------------------------------------------------

  updateDrones(dt) {
    for (const ship of [this.player, this.enemy]) {
      const foe = ship === this.player ? this.enemy : this.player;
      const speed = 1 + augmentValue(ship.augments, 'droneSpeed', 0);
      for (const d of ship.drones) {
        if (!d.powered) { d.deployed = false; continue; }
        if (!d.deployed) { d.deployed = true; d.hp = d.maxHp; this.onEvent('droneLaunched', { side: ship === this.player ? 'player' : 'enemy' }); }
        const def = getDrone(d.droneId);
        if (!def.fireRate || foe.destroyed) continue;
        d.cooldown -= dt * speed;
        if (d.cooldown > 0) continue;
        d.cooldown = def.fireRate;
        const room = this.rng.int(0, foe.rooms.length - 1);
        const ev = evasion(foe);
        if (this.rng.int(1, 100) <= ev) { this.onEvent('miss', { side: foe === this.player ? 'player' : 'enemy', room }); continue; }
        const res = absorbWithShields(foe, def.damage, 0);
        if (res.shielded) { this.onEvent('shieldHit', { side: foe === this.player ? 'player' : 'enemy' }); continue; }
        const report = applyHit(foe, room, def.damage, {}, this.rng);
        ship.stats.damageDealt += report.hull;
        this.afterHit(foe, ship, room, report, { id: d.droneId }, foe === this.player ? 'player' : 'enemy');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Boarding
  // -------------------------------------------------------------------------

  /** Send the crew standing in the teleporter room over to the enemy. */
  teleportOut(ship, targetRoom) {
    const tele = ship.systems.teleporter;
    if (!tele || effectiveLevel(tele) <= 0 || tele.cooldown > 0) return 0;
    const foe = ship === this.player ? this.enemy : this.player;
    const squad = crewInRoom(ship, tele.room);
    if (squad.length === 0) return 0;

    for (const c of squad) {
      c.onEnemyShip = true;
      c.room = targetRoom;
      const room = foe.rooms[targetRoom];
      c.x = room ? 0 : 0; c.y = 0;
      c.path = null; c.manning = null;
      (ship === this.player ? this.boarders : this.enemyBoarders).push(c);
    }
    tele.cooldown = SYSTEMS.teleporter.cooldown(effectiveLevel(tele));
    ship.stats.roomsBoarded++;
    this.onEvent('teleportOut', { side: ship === this.player ? 'player' : 'enemy', count: squad.length });
    return squad.length;
  }

  /** Recall boarders. They must survive the trip back. */
  teleportBack(ship) {
    const tele = ship.systems.teleporter;
    if (!tele || effectiveLevel(tele) <= 0) return 0;
    const list = ship === this.player ? this.boarders : this.enemyBoarders;
    let n = 0;
    for (const c of [...list]) {
      c.onEnemyShip = false;
      c.fighting = null;
      placeInRoom(ship, c, tele.room);
      list.splice(list.indexOf(c), 1);
      n++;
    }
    if (n) this.onEvent('teleportIn', { side: ship === this.player ? 'player' : 'enemy', count: n });
    return n;
  }

  updateBoarders(dt) {
    this.resolveBoarding(this.boarders, this.enemy, this.player, dt, 'enemy');
    this.resolveBoarding(this.enemyBoarders, this.player, this.enemy, dt, 'player');
  }

  /**
   * Boarders fight anyone in their room; with the room clear they sabotage the
   * system in it. Defenders fight back at the same time.
   */
  resolveBoarding(boarders, hostShip, homeShip, dt, hostSide) {
    if (boarders.length === 0) return;
    const stimBonus = augmentValue(homeShip.augments, 'crewCombat', 0);

    for (const b of [...boarders]) {
      if (!isAlive(b)) { boarders.splice(boarders.indexOf(b), 1); continue; }
      b.stunned = Math.max(0, b.stunned - dt);
      if (b.stunned > 0) continue;

      const room = hostShip.rooms[b.room];
      if (!room) continue;

      // Boarders suffocate too, unless their species doesn't breathe.
      if (room.oxygen < TUNING.O2_DANGER) {
        const race = getRace(b.race);
        if (!race.traits.noOxygen && damageCrew(b, 5.2 * dt)) {
          this.onEvent('crewDied', { side: hostSide === 'enemy' ? 'player' : 'enemy', crew: b, cause: 'oxygen' });
          boarders.splice(boarders.indexOf(b), 1);
          continue;
        }
      }

      const defenders = crewInRoom(hostShip, b.room);
      if (defenders.length > 0) {
        const target = defenders[0];
        const dmg = TUNING.CREW_MELEE_DPS * combatPower(b, stimBonus) * dt;
        b.fighting = target.id;
        if (damageCrew(target, dmg)) {
          hostShip.stats.crewLost++;
          this.onEvent('crewDied', { side: hostSide, crew: target, cause: 'boarders' });
        }
        grantXP(b, 'combat', 1.6 * dt);

        // The defender hits back.
        const hostBonus = augmentValue(hostShip.augments, 'crewCombat', 0);
        const back = TUNING.CREW_MELEE_DPS * combatPower(target, hostBonus) * dt;
        if (damageCrew(b, back)) {
          this.onEvent('crewDied', { side: hostSide === 'enemy' ? 'player' : 'enemy', crew: b, cause: 'boarders' });
          boarders.splice(boarders.indexOf(b), 1);
          continue;
        }
        grantXP(target, 'combat', 1.6 * dt);
        this.onEvent('melee', { room: b.room, side: hostSide, throttle: 400 });
        continue;
      }

      b.fighting = null;
      // Room clear: wreck the system in it.
      if (room.system && hostShip.systems[room.system]) {
        const sys = hostShip.systems[room.system];
        if (sys.damage < sys.level) {
          sys.damage = Math.min(sys.level, sys.damage + 0.55 * combatPower(b, stimBonus) * dt);
          sys.power = Math.min(sys.power, powerCap(hostShip, sys.id));
          if (sys.id === 'shields') refreshShields(hostShip);
          if (sys.id === 'weapons') reconcileWeaponPower(hostShip);
          this.onEvent('sabotage', { side: hostSide, system: sys.id, throttle: 600 });
          continue;
        }
      }
      // Nothing left here — move toward a system worth breaking.
      this.walkBoarder(b, hostShip, dt);
    }
  }

  walkBoarder(b, hostShip, dt) {
    if (!b.path || b.path.length === 0) {
      const targets = hostShip.rooms
        .filter(r => r.system && hostShip.systems[r.system] && hostShip.systems[r.system].damage < hostShip.systems[r.system].level);
      const goal = targets.length ? this.rng.pick(targets) : this.rng.pick(hostShip.rooms);
      b.path = findPath(hostShip, b.room, goal.id) || [];
    }
    if (b.path.length === 0) return;
    b.walkTimer = (b.walkTimer || 0) + dt * moveSpeed(b);
    if (b.walkTimer >= 1.1) {
      b.walkTimer = 0;
      b.room = b.path.shift();
    }
  }

  // -------------------------------------------------------------------------
  // Special systems
  // -------------------------------------------------------------------------

  activateCloak(ship) {
    const sys = ship.systems.cloaking;
    if (!sys || effectiveLevel(sys) <= 0 || ship.cloakCooldown > 0) return false;
    ship.cloakTimer = SYSTEMS.cloaking.duration(effectiveLevel(sys));
    ship.cloakCooldown = ship.cloakTimer + 22;
    this.onEvent('cloakOn', { side: ship === this.player ? 'player' : 'enemy' });
    return true;
  }

  activateBattery(ship) {
    const sys = ship.systems.battery;
    if (!sys || effectiveLevel(sys) <= 0 || ship.batteryCooldown > 0) return false;
    ship.batteryTimer = SYSTEMS.battery.duration;
    ship.batteryCooldown = SYSTEMS.battery.duration + SYSTEMS.battery.rechargeTime;
    this.onEvent('batteryOn', { side: ship === this.player ? 'player' : 'enemy' });
    return true;
  }

  activateHacking(ship, systemId) {
    const sys = ship.systems.hacking;
    const foe = ship === this.player ? this.enemy : this.player;
    if (!sys || effectiveLevel(sys) <= 0) return false;
    const target = foe.systems[systemId];
    if (!target) return false;
    if (!sys.hackTargetId) {
      // First use plants the drone.
      sys.hackTargetId = systemId;
      target.hacked = true;
      this.onEvent('hackLand', { side: foe === this.player ? 'player' : 'enemy', system: systemId });
      return true;
    }
    const hacked = foe.systems[sys.hackTargetId];
    if (!hacked || sys.cooldown > 0) return false;
    const bonus = 1 + augmentValue(ship.augments, 'hackDuration', 0);
    hacked.hackActive = true;
    hacked.hackTimer = SYSTEMS.hacking.duration(effectiveLevel(sys)) * bonus;
    hacked.power = 0;
    if (hacked.id === 'shields') refreshShields(foe);
    sys.cooldown = hacked.hackTimer + 12;
    this.onEvent('hack', { side: foe === this.player ? 'player' : 'enemy', system: hacked.id });
    return true;
  }

  activateSiphon(ship) {
    const sys = ship.systems.siphon;
    const foe = ship === this.player ? this.enemy : this.player;
    if (!sys || effectiveLevel(sys) <= 0 || sys.cooldown > 0) return false;
    if (foe.shields.layers <= 0) return false;
    foe.shields.layers -= 1;
    ship.shields.layers = Math.min(ship.shields.max + 1, ship.shields.layers + 1);
    sys.cooldown = SYSTEMS.siphon.cooldown(effectiveLevel(sys));
    this.onEvent('siphon', { side: ship === this.player ? 'player' : 'enemy' });
    return true;
  }

  activateTemporal(ship, targetShip, roomId, mode = 'slow') {
    const sys = ship.systems.temporal;
    if (!sys || effectiveLevel(sys) <= 0 || sys.cooldown > 0) return false;
    const room = targetShip.rooms[roomId];
    if (!room) return false;
    const lvl = effectiveLevel(sys);
    const f = SYSTEMS.temporal.factor(lvl);
    room.temporalFactor = mode === 'slow' ? f : 1 / f;
    room.temporalTimer = SYSTEMS.temporal.duration(lvl);
    sys.cooldown = SYSTEMS.temporal.cooldown;
    this.onEvent('temporal', { side: targetShip === this.player ? 'player' : 'enemy', room: roomId, mode });
    return true;
  }

  activateOverdrive(ship, systemId) {
    const sys = ship.systems.overdrive;
    const target = ship.systems[systemId];
    if (!sys || effectiveLevel(sys) <= 0 || sys.cooldown > 0 || !target) return false;
    const lvl = effectiveLevel(sys);
    target.overcharge = SYSTEMS.overdrive.boost(lvl);
    target.overchargeTimer = SYSTEMS.overdrive.duration;
    setPower(ship, systemId, target.overcharge);
    sys.cooldown = SYSTEMS.overdrive.cooldown;
    // Overcharging can burn the system out when the field collapses.
    if (this.rng.chance(SYSTEMS.overdrive.burnoutChance(lvl))) {
      target.pendingBurnout = true;
    }
    this.onEvent('overdrive', { side: ship === this.player ? 'player' : 'enemy', system: systemId });
    return true;
  }

  activateMindControl(ship, crewId) {
    const sys = ship.systems.mindcontrol;
    const foe = ship === this.player ? this.enemy : this.player;
    if (!sys || effectiveLevel(sys) <= 0 || sys.cooldown > 0) return false;
    const victim = foe.crew.find(c => c.id === crewId && isAlive(c));
    if (!victim) return false;
    if (getRace(victim.race).traits.mindImmune) { this.onEvent('mindResisted', {}); return false; }
    victim.mindControlled = SYSTEMS.mindcontrol.duration(effectiveLevel(sys));
    sys.cooldown = victim.mindControlled + 18;
    this.onEvent('mindcontrol', { side: foe === this.player ? 'player' : 'enemy', crew: victim.id });
    return true;
  }

  // -------------------------------------------------------------------------
  // Environment
  // -------------------------------------------------------------------------

  updateEnvironment(dt) {
    if (!this.environment) return;
    this.environmentTimer -= dt;
    if (this.environmentTimer > 0) return;

    switch (this.environment) {
      case 'asteroids': {
        this.environmentTimer = this.rng.float(3.5, 7);
        for (const ship of [this.player, this.enemy]) {
          if (this.rng.chance(0.55)) continue;
          if (this.rng.int(1, 100) <= evasion(ship)) continue;
          const res = absorbWithShields(ship, 1, 0);
          const side = ship === this.player ? 'player' : 'enemy';
          if (res.shielded) { this.onEvent('shieldHit', { side }); continue; }
          const room = this.rng.int(0, ship.rooms.length - 1);
          const report = applyHit(ship, room, 1, {}, this.rng);
          this.onEvent('asteroidHit', { side, room });
          this.afterHit(ship, ship, room, report, { id: 'asteroid' }, side);
        }
        break;
      }
      case 'solar': {
        this.environmentTimer = this.rng.float(12, 20);
        for (const ship of [this.player, this.enemy]) {
          const room = this.rng.int(0, ship.rooms.length - 1);
          ship.rooms[room].fire = Math.max(ship.rooms[room].fire, 0.3);
          this.onEvent('solarFlare', { side: ship === this.player ? 'player' : 'enemy', room });
        }
        break;
      }
      case 'pulsar': {
        this.environmentTimer = this.rng.float(14, 22);
        for (const ship of [this.player, this.enemy]) {
          for (const sys of Object.values(ship.systems)) {
            sys.ionCharges = Math.min(sys.level, sys.ionCharges + 1);
            sys.ionTimer = Math.max(sys.ionTimer, 6);
            sys.power = Math.min(sys.power, powerCap(ship, sys.id));
          }
          refreshShields(ship);
          this.onEvent('pulsar', { side: ship === this.player ? 'player' : 'enemy' });
        }
        break;
      }
      case 'nebula':
        // Nebulae suppress sensors and slow shield recharge; handled passively.
        this.environmentTimer = 999;
        break;
      default:
        this.environmentTimer = 999;
    }
  }

  // -------------------------------------------------------------------------
  // Fleeing and resolution
  // -------------------------------------------------------------------------

  updateFleeing(dt) {
    if (this.enemy.fleeing) {
      const blocked = hasAugment(this.player.augments, 'void_anchor')
        && this.player.weapons.some((w, i) => isWeaponReady(this.player, i));
      if (!blocked) {
        this.enemy.fleeProgress += dt / 12;
        if (this.enemy.fleeProgress >= 1) this.finish('enemyFled');
      }
    }
  }

  /** The player jumps out. Requires a charged FTL drive. */
  playerFlee() {
    if (this.player.ftlCharge < 1) return false;
    this.finish('fled');
    return true;
  }

  checkOutcome() {
    if (this.over) return;
    // Losing every hand is as fatal as losing the hull — but crew still alive
    // aboard the enemy ship keep the run going.
    if (this.player.destroyed || livingCrew(this.player).length === 0) {
      this.finish('defeat');
    } else if (this.enemy.destroyed) {
      this.finish('victory');
    } else if (livingCrew(this.enemy).length === 0 && this.enemy.crewedShip) {
      // Every hand lost: the ship is yours, intact.
      this.enemy.destroyed = true;
      this.finish('victory', { captured: true });
    }
  }

  finish(outcome, extra = {}) {
    if (this.over) return;
    this.over = true;
    this.outcome = outcome;
    if (outcome === 'victory') this.rewards = this.computeRewards(extra.captured);
    this.onEvent('combatEnd', { outcome, rewards: this.rewards, ...extra });
  }

  computeRewards(captured = false) {
    const e = this.enemy;
    const base = e.rewardScrap ?? 20;
    const salvageSys = this.player.systems.salvage;
    const salvageBonus = salvageSys ? SYSTEMS.salvage.bonus(effectiveLevel(salvageSys)) : 0;
    const augBonus = augmentValue(this.player.augments, 'scrapBonus', 0);
    const captureBonus = captured ? 0.4 : 0;

    const scrap = Math.round(base * (1 + salvageBonus + augBonus + captureBonus));
    const out = {
      scrap,
      // Fuel drops are deliberately generous: running dry is meant to be a
      // scare handled by the distress signal, not the usual way runs end.
      fuel: this.rng.chance(0.62) ? this.rng.int(1, 3) : 0,
      missiles: this.rng.chance(0.35) ? this.rng.int(1, 4) : 0,
      droneParts: this.rng.chance(0.2) ? this.rng.int(1, 2) : 0,
      weapon: null, drone: null, augment: null, captured,
    };
    if (hasAugment(this.player.augments, 'salvage_nets')) {
      out.fuel += 1; out.missiles += 1;
    }
    if (e.dropWeapon && this.rng.chance(0.3)) out.weapon = e.dropWeapon;
    if (e.dropDrone && this.rng.chance(0.2)) out.drone = e.dropDrone;
    if (e.dropAugment && this.rng.chance(0.15)) out.augment = e.dropAugment;
    return out;
  }

  togglePause() { this.paused = !this.paused; return this.paused; }
  setSpeed(s) { this.speed = COMBAT_SPEEDS.includes(s) ? s : 1; }
}

// ---------------------------------------------------------------------------
// Enemy AI
// ---------------------------------------------------------------------------

/**
 * The opposing captain. Retargets on a timer rather than every frame so its
 * decisions look deliberate, and it plays to whatever loadout it was rolled.
 */
class EnemyAI {
  constructor(combat, rng) {
    this.c = combat;
    this.rng = rng;
    this.decisionTimer = 0;
    this.targets = new Map();  // weapon slot -> room id
    this.boardTimer = this.rng.float(8, 20);
    this.repairTimer = 0;
  }

  update(dt) {
    const e = this.c.enemy;
    const p = this.c.player;
    if (e.destroyed || p.destroyed) return;

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.rng.float(1.4, 3.2);
      this.retarget();
      this.considerSpecials();
      this.considerFlee();
    }

    this.assignCrew(dt);

    // Fire whatever is charged.
    for (const w of e.weapons) {
      if (!w.powered) continue;
      if (!isWeaponReady(e, w.slot)) continue;
      const room = this.targets.get(w.slot) ?? this.pickTargetRoom(getWeapon(w.weaponId));
      this.targets.set(w.slot, room);
      this.c.fireWeapon(e, w.slot, room);
    }

    // Boarding.
    if (e.systems.teleporter && effectiveLevel(e.systems.teleporter) > 0) {
      this.boardTimer -= dt;
      if (this.boardTimer <= 0 && this.c.enemyBoarders.length === 0) {
        this.boardTimer = this.rng.float(25, 45);
        const room = this.pickBoardingRoom();
        if (room != null) this.c.teleportOut(e, room);
      }
    }
  }

  retarget() {
    const e = this.c.enemy;
    for (const w of e.weapons) {
      if (!w.powered) continue;
      this.targets.set(w.slot, this.pickTargetRoom(getWeapon(w.weaponId)));
    }
  }

  /**
   * Weapon-appropriate targeting: ion goes for shields, bombs for the medbay,
   * beams for a long run of rooms, everything else for whatever hurts most.
   */
  pickTargetRoom(def) {
    const p = this.c.player;
    const roomFor = sysId => {
      const s = p.systems[sysId];
      return s && s.room != null ? s.room : null;
    };
    const priorities = def.ion
      ? ['shields', 'engines', 'weapons']
      : def.type === 'bomb'
        ? ['medbay', 'clonebay', 'shields', 'weapons']
        : def.crewDamage
          ? ['medbay', 'piloting', 'weapons']
          : ['shields', 'weapons', 'engines', 'piloting', 'oxygen'];

    // A little randomness keeps the AI from being perfectly predictable.
    const list = this.rng.chance(0.75) ? priorities : this.rng.shuffle(priorities);
    for (const sysId of list) {
      const r = roomFor(sysId);
      if (r != null) return r;
    }
    return this.rng.int(0, p.rooms.length - 1);
  }

  pickBoardingRoom() {
    const p = this.c.player;
    const wanted = ['piloting', 'shields', 'weapons', 'engines'];
    for (const sysId of wanted) {
      const s = p.systems[sysId];
      if (s && s.room != null) return s.room;
    }
    return p.rooms.length ? this.rng.int(0, p.rooms.length - 1) : null;
  }

  considerSpecials() {
    const e = this.c.enemy;
    const p = this.c.player;
    if (e.systems.cloaking && e.cloakCooldown <= 0) {
      // Cloak when something is inbound.
      if (this.c.projectiles.some(pr => pr.target === e)) this.c.activateCloak(e);
    }
    if (e.systems.battery && e.batteryCooldown <= 0 && this.rng.chance(0.4)) {
      this.c.activateBattery(e);
    }
    if (e.systems.hacking && this.rng.chance(0.5)) {
      const pick = ['shields', 'engines', 'weapons'].find(s => p.systems[s]);
      if (pick) this.c.activateHacking(e, pick);
    }
    if (e.systems.mindcontrol && this.rng.chance(0.35)) {
      const victim = p.crew.find(c => isAlive(c) && !c.onEnemyShip);
      if (victim) this.c.activateMindControl(e, victim.id);
    }
    if (e.systems.siphon && this.rng.chance(0.5)) this.c.activateSiphon(e);
  }

  /** Wounded enemies run, unless they're a boss or an automated hull. */
  considerFlee() {
    const e = this.c.enemy;
    if (e.noFlee || e.fleeing) return;
    const hurt = e.hull / e.maxHull;
    if (hurt < 0.35 && this.rng.chance(0.35)) {
      e.fleeing = true;
      this.c.onEvent('enemyFleeing', {});
    }
  }

  /** Keep the enemy crew usefully employed: repair first, then man stations. */
  assignCrew(dt) {
    this.repairTimer -= dt;
    if (this.repairTimer > 0) return;
    this.repairTimer = 1.5;
    const e = this.c.enemy;

    for (const c of e.crew) {
      if (!isAlive(c) || c.onEnemyShip || c.path) continue;
      const room = e.rooms[c.room];
      if (room && (room.fire > 0 || room.breaches > 0)) continue;
      if (room && room.system && e.systems[room.system] && e.systems[room.system].damage > 0) continue;

      // Head for the worst problem on the ship.
      const emergency = e.rooms.find(r => r.fire > 0 || r.breaches > 0);
      const broken = e.rooms.find(r => r.system && e.systems[r.system] && e.systems[r.system].damage > 0);
      const intruder = this.c.boarders.length ? e.rooms[this.c.boarders[0].room] : null;
      const goal = intruder || emergency || broken;
      if (goal && goal.id !== c.room) {
        const path = findPath(e, c.room, goal.id);
        if (path) { c.path = path; c.targetRoom = goal.id; }
      }
    }
  }
}

export { EnemyAI };
