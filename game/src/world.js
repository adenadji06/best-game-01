// NEON BASTION — the world: the ship, the drones, the bullets, the cores
// and the wave machine. Pure state plus one fixed step; drawing lives in
// render.js and the boot loop in main.js, so this file can be driven by a
// screenshot autopilot exactly like a player.
//
// Progression: kills and cores grant XP; filling the bar opens a level-up
// draft (pick 1 of 3 upgrades) and pauses the fight until the player picks.
// Upgrades live on state.upgrades as plain levels, so the draft, the HUD
// and the renderer all read the same numbers.
import {
  BULLET, COMBO, CORE, DRONES, ELITE, FIELD, NOVA, PALETTE, PLAYER, PROPS, STEP,
  UPGRADE_ORDER, UPGRADES, WAVES, WIN_WAVE, XP,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_CORE = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_BOSS = 32;
export const EVENT_SHOT = 64;
export const EVENT_LEVEL = 128;
export const EVENT_NOVA = 256;

const TAU = Math.PI * 2;

function makeShip() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height - 90,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hull: PLAYER.hull,
    fireIn: 0,
    invuln: 0,
    thrust: 0,
  };
}

function edgeSpawn(random) {
  const side = Math.floor(random.next() * 4);
  if (side === 0) return { x: random.range(30, FIELD.width - 30), y: -24 };
  if (side === 1) return { x: random.range(30, FIELD.width - 30), y: FIELD.height + 24 };
  if (side === 2) return { x: -24, y: random.range(30, FIELD.height - 30) };
  return { x: FIELD.width + 24, y: random.range(30, FIELD.height - 30) };
}

function waveRoster(random, wave) {
  const roster = [];
  const isBoss = wave % WAVES.bossEvery === 0;
  if (isBoss) {
    roster.push({ kind: 'boss', elite: false });
    // A boss wave brings a real escort, not a token pair of darts.
    for (let i = 0; i < 10 + Math.floor(wave / WAVES.bossEvery); i += 1) {
      roster.push({ kind: random.next() < 0.5 ? 'dart' : 'weaver', elite: rollElite(random, wave) });
    }
    return roster;
  }
  const count = WAVES.baseCount + (wave - 1) * WAVES.perWave;
  for (let i = 0; i < count; i += 1) {
    const roll = random.next();
    const kind = wave >= 3 && roll < 0.18 ? 'bulwark' : roll < 0.45 ? 'weaver' : 'dart';
    roster.push({ kind, elite: rollElite(random, wave) });
  }
  return roster;
}

// An elite drone: same kind, gold-ringed, three times the hull and score.
// Rolled per drone from wave 4, so a later wave always has a few.
function rollElite(random, wave) {
  return wave >= ELITE.fromWave && random.next() < ELITE.chance;
}

// Drones spawn in clusters of up to clusterSize from one shared anchor,
// so the arena fills with packs instead of a thin trickle from all sides.
function clusterAnchors(random, roster) {
  const anchors = [];
  let left = 0;
  let anchor = null;
  for (let i = 0; i < roster.length; i += 1) {
    if (left <= 0) {
      anchor = edgeSpawn(random);
      left = WAVES.clusterSize;
    }
    anchors.push(anchor);
    left -= 1;
  }
  return anchors;
}

export function createWorld(random) {
  const state = {
    ship: makeShip(),
    drones: [],
    bullets: [],
    enemyBullets: [],
    cores: [],
    particles: [],
    popups: [],
    stars: [],
    props: [],
    wave: 0,
    score: 0,
    combo: 0,
    comboIn: 0,
    kills: 0,
    spawnQueue: [],
    spawnAnchors: [],
    spawnIn: 0,
    banner: '',
    bannerIn: 0,
    boss: null,
    shake: 0,
    time: 0,
    over: false,
    won: false, // set when the final wave clears: the siege is broken
    // Progression.
    xp: 0,
    level: 1,
    xpNext: XP.baseNext,
    maxHull: PLAYER.hull,
    upgrades: { rapid: 0, spread: 0, aegis: 0, magnet: 0, nova: 0 },
    draft: null, // null, or an array of 3 upgrade ids awaiting a pick
    novaIn: NOVA.baseGap,
  };
  for (let i = 0; i < 130; i += 1) {
    state.stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      size: random.range(0.6, 2.2),
      twinkle: random.range(0, TAU),
      speed: random.range(0.4, 1.6),
    });
  }
  for (let i = 0; i < PROPS.count; i += 1) {
    // Keep props out of the ship's launch lane (centre bottom).
    const x = random.range(40, FIELD.width - 40);
    const y = random.range(40, FIELD.height - 160);
    state.props.push({
      x, y,
      r: random.range(22, 46),
      rot: random.next() * TAU,
      points: 7 + Math.floor(random.next() * 3),
      colour: random.next() < 0.5 ? '#2a1b4d' : '#132a3d',
      rim: random.next() < 0.5 ? '#7a2bff' : '#0e7490',
    });
  }

  function burst(x, y, colour, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.next() * TAU;
      const power = random.range(0.3, 1) * speed;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life: random.range(0.3, 0.8),
        max: 0.8,
        size: random.range(1.5, 3.5),
        colour,
      });
    }
  }

  function popup(x, y, text, colour, size = 15) {
    state.popups.push({ x, y, text, colour, life: 1.0, size });
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = waveRoster(random, wave);
    state.spawnAnchors = clusterAnchors(random, state.spawnQueue);
    state.spawnIn = 0.6;
    const isBoss = wave % WAVES.bossEvery === 0;
    state.banner = isBoss ? `WAVE ${wave} — BASTION BREAKER INBOUND` : `WAVE ${wave}`;
    state.bannerIn = 2.2;
    if (isBoss) return EVENT_BOSS;
    return 0;
  }

  function spawnDrone(entry, anchor) {
    const def = DRONES[entry.kind];
    const kind = entry.kind;
    const elite = !!entry.elite;
    const at = anchor
      ? {
        x: Math.max(-30, Math.min(FIELD.width + 30, anchor.x + random.range(-46, 46))),
        y: Math.max(-30, Math.min(FIELD.height + 30, anchor.y + random.range(-46, 46))),
      }
      : edgeSpawn(random);
    const hullBonus = Math.floor(state.wave / 4) * BULLET.damage;
    const hull = (def.hull + hullBonus) * (elite ? ELITE.hullMul : 1);
    const drone = {
      kind,
      elite,
      enraged: false,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      radius: def.radius + (elite ? ELITE.radiusBonus : 0),
      hull,
      maxHull: hull,
      speed: def.speed * (1 + state.wave * 0.02) * (elite ? 0.9 : 1),
      phase: random.next() * TAU,
      fireIn: random.range(1.5, 3.5),
      angle: 0,
      flash: 0,
    };
    state.drones.push(drone);
    if (kind === 'boss') state.boss = drone;
    return drone;
  }

  function gainXp(amount) {
    if (state.draft || state.over) return 0;
    state.xp += amount;
    if (state.xp < state.xpNext) return 0;
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = XP.baseNext + (state.level - 1) * XP.perLevel;
    openDraft();
    return EVENT_LEVEL;
  }

  // Offer 3 distinct upgrades the player has not maxed yet. When every
  // upgrade is maxed there is no draft — the level pays out in score.
  function openDraft() {
    const open = UPGRADE_ORDER.filter((id) => state.upgrades[id] < UPGRADES[id].max);
    if (open.length === 0) {
      state.score += 500;
      popup(FIELD.width / 2, FIELD.height / 2 - 40, 'MAXED OUT +500', '#ffe45e');
      return;
    }
    const pool = [...open];
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(Math.floor(random.next() * pool.length), 1)[0]);
    }
    state.draft = picks;
  }

  function applyUpgrade(id) {
    if (!state.draft || !state.draft.includes(id)) return false;
    state.upgrades[id] += 1;
    state.draft = null;
    if (id === 'aegis') {
      state.maxHull += 1;
      state.ship.hull = Math.min(state.maxHull, state.ship.hull + 1);
    }
    popup(state.ship.x, state.ship.y - 30, `${UPGRADES[id].name} LV${state.upgrades[id]}`, '#37f5d3', 17);
    burst(state.ship.x, state.ship.y, '#37f5d3', 24, 240);
    return true;
  }

  function killDrone(drone) {
    const def = DRONES[drone.kind];
    state.kills += 1;
    state.combo = Math.min(state.combo + COMBO.step, COMBO.cap);
    state.comboIn = COMBO.window;
    const gained = def.score * (drone.elite ? ELITE.scoreMul : 1) * Math.max(1, state.combo);
    state.score += gained;
    popup(drone.x, drone.y - drone.radius, drone.elite ? `ELITE +${gained}` : `+${gained}`, drone.elite ? PALETTE.gold : def.colour, drone.elite ? 18 : 15);
    burst(drone.x, drone.y, def.colour, drone.kind === 'boss' ? 80 : 26, 260);
    state.shake = Math.max(state.shake, drone.kind === 'boss' ? 0.5 : 0.12);
    if (drone.kind === 'boss') {
      state.boss = null;
      burst(drone.x, drone.y, '#ffffff', 40, 380);
    }
    if (random.next() < CORE.dropChance || drone.kind === 'boss' || drone.elite) {
      const n = drone.kind === 'boss' ? 5 : drone.elite ? ELITE.coreDrop : 1;
      for (let i = 0; i < n; i += 1) {
        state.cores.push({
          x: drone.x + random.range(-14, 14),
          y: drone.y + random.range(-14, 14),
          vx: random.range(-40, 40),
          vy: random.range(-40, 40),
          radius: CORE.radius,
          life: 9,
        });
      }
    }
    return EVENT_KILL | gainXp(def.xp);
  }

  function hitShip() {
    if (state.ship.invuln > 0 || state.over) return 0;
    state.ship.hull -= 1;
    state.ship.invuln = PLAYER.invulnSeconds;
    state.combo = 0;
    state.comboIn = 0;
    state.shake = 0.45;
    burst(state.ship.x, state.ship.y, '#ff4d6d', 26, 300);
    if (state.ship.hull <= 0) {
      state.over = true;
      burst(state.ship.x, state.ship.y, PALETTE.ship, 70, 420);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireGap() {
    return PLAYER.fireGap * Math.pow(0.85, state.upgrades.rapid);
  }

  function magnetRadius() {
    return CORE.magnet * Math.pow(1.5, state.upgrades.magnet);
  }

  function stepShip(dt, move, aim, firing) {
    const ship = state.ship;
    const ax = move.x * PLAYER.accel;
    const ay = move.y * PLAYER.accel;
    ship.vx += ax * dt;
    ship.vy += ay * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    ship.vx *= drag;
    ship.vy *= drag;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > PLAYER.speed) {
      ship.vx = (ship.vx / speed) * PLAYER.speed;
      ship.vy = (ship.vy / speed) * PLAYER.speed;
    }
    ship.x = Math.min(FIELD.width - ship.radius, Math.max(ship.radius, ship.x + ship.vx * dt));
    ship.y = Math.min(FIELD.height - ship.radius, Math.max(ship.radius, ship.y + ship.vy * dt));
    ship.thrust = Math.min(1, Math.hypot(move.x, move.y));
    const dx = aim.x - ship.x;
    const dy = aim.y - ship.y;
    if (dx * dx + dy * dy > 4) ship.angle = Math.atan2(dy, dx);
    ship.fireIn -= dt;
    if (ship.invuln > 0) ship.invuln -= dt;
    if (firing && ship.fireIn <= 0) {
      ship.fireIn = fireGap();
      // Spread shot: extra streams fan out from the aim angle.
      const streams = 1 + state.upgrades.spread;
      for (let s = 0; s < streams; s += 1) {
        const off = (s - (streams - 1) / 2) * 0.09;
        const a = ship.angle + off;
        state.bullets.push({
          x: ship.x + Math.cos(a) * (ship.radius + 6),
          y: ship.y + Math.sin(a) * (ship.radius + 6),
          vx: Math.cos(a) * PLAYER.bulletSpeed,
          vy: Math.sin(a) * PLAYER.bulletSpeed,
          radius: BULLET.playerRadius,
          life: 1.2,
        });
      }
      return true;
    }
    return false;
  }

  function stepNova(dt) {
    if (state.upgrades.nova <= 0) return 0;
    state.novaIn -= dt;
    if (state.novaIn > 0) return 0;
    state.novaIn = Math.max(NOVA.minGap, NOVA.baseGap - NOVA.gapPerLevel * state.upgrades.nova);
    const ship = state.ship;
    let events = EVENT_NOVA;
    burst(ship.x, ship.y, '#b06bff', 36, 420);
    for (const drone of state.drones) {
      const dist = Math.hypot(drone.x - ship.x, drone.y - ship.y);
      if (dist < NOVA.radius + drone.radius) {
        drone.hull -= NOVA.damage;
        drone.flash = 0.12;
        popup(drone.x, drone.y - drone.radius, `-${NOVA.damage}`, '#b06bff', 13);
        if (drone.hull <= 0) events |= killDrone(drone);
      }
    }
    state.drones = state.drones.filter((d) => d.hull > 0);
    state.shake = Math.max(state.shake, 0.2);
    return events;
  }

  function stepDrones(dt) {
    const ship = state.ship;
    for (const drone of state.drones) {
      if (drone.flash > 0) drone.flash -= dt;
      const def = DRONES[drone.kind];
      const dx = ship.x - drone.x;
      const dy = ship.y - drone.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (drone.kind === 'dart') {
        drone.vx = (dx / dist) * drone.speed;
        drone.vy = (dy / dist) * drone.speed;
      } else if (drone.kind === 'weaver') {
        const along = (dx / dist) * drone.speed * 0.8;
        const side = Math.cos(state.time * 3 + drone.phase) * drone.speed * 0.7;
        drone.vx = along - (dy / dist) * side;
        drone.vy = (dy / dist) * drone.speed * 0.8 + (dx / dist) * side;
      } else if (drone.kind === 'bulwark') {
        drone.vx = (dx / dist) * drone.speed;
        drone.vy = (dy / dist) * drone.speed;
      } else {
        // The boss holds the upper arena, strafes, and fires rings.
        // Below half hull it enrages: faster rings, faster strafe, and a
        // banner, so the fight visibly turns in its second phase.
        if (!drone.enraged && drone.hull < drone.maxHull / 2) {
          drone.enraged = true;
          state.banner = 'BASTION BREAKER ENRAGED';
          state.bannerIn = 2.2;
          burst(drone.x, drone.y, '#ff2e4d', 40, 380);
        }
        const strafe = drone.enraged ? 1.5 : 1;
        const targetX = FIELD.width / 2 + Math.sin(state.time * 0.6 * strafe) * 260;
        drone.vx = (targetX - drone.x) * 0.9 * strafe;
        drone.vy = (150 - drone.y) * 0.9;
        drone.fireIn -= dt;
        if (drone.fireIn <= 0) {
          drone.fireIn = Math.max(1.1, 2.4 - state.wave * 0.06) * (drone.enraged ? 0.6 : 1);
          const shots = 10 + Math.floor(state.wave / 2);
          for (let i = 0; i < shots; i += 1) {
            const a = (i / shots) * TAU + state.time;
            state.enemyBullets.push({
              x: drone.x,
              y: drone.y,
              vx: Math.cos(a) * BULLET.enemySpeed,
              vy: Math.sin(a) * BULLET.enemySpeed,
              radius: BULLET.enemyRadius,
              life: 4,
            });
          }
        }
      }
      drone.angle = Math.atan2(drone.vy, drone.vx);
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;
      if (drone.kind === 'weaver' && state.wave >= 3) {
        drone.fireIn -= dt;
        if (drone.fireIn <= 0 && dist < 420) {
          drone.fireIn = random.range(2.2, 3.4);
          state.enemyBullets.push({
            x: drone.x,
            y: drone.y,
            vx: (dx / dist) * BULLET.enemySpeed,
            vy: (dy / dist) * BULLET.enemySpeed,
            radius: BULLET.enemyRadius,
            life: 3,
          });
        }
      }
      // A drone that touches the ship explodes against it.
      if (dist < drone.radius + ship.radius && ship.invuln <= 0) {
        drone.hull = 0;
        burst(drone.x, drone.y, def.colour, 14, 220);
        hitShip();
      }
    }
    state.drones = state.drones.filter((d) => d.hull > 0);
  }

  function stepBullets(dt) {
    let events = 0;
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      for (const drone of state.drones) {
        if (drone.hull <= 0) continue;
        const dx = drone.x - bullet.x;
        const dy = drone.y - bullet.y;
        const reach = drone.radius + bullet.radius;
        if (dx * dx + dy * dy < reach * reach) {
          const crit = random.next() < BULLET.critChance;
          const damage = crit ? BULLET.damage * 2 : BULLET.damage;
          drone.hull -= damage;
          drone.flash = 0.09;
          bullet.life = 0;
          burst(bullet.x, bullet.y, '#8ef7ff', 4, 140);
          popup(bullet.x, bullet.y - 8, crit ? `${damage}!` : `${damage}`, crit ? '#ffe45e' : '#bfefff', crit ? 19 : 14);
          if (drone.hull <= 0) events |= killDrone(drone);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter(
      (b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20,
    );
    for (const shot of state.enemyBullets) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      const dx = state.ship.x - shot.x;
      const dy = state.ship.y - shot.y;
      const reach = state.ship.radius + shot.radius - 2;
      if (dx * dx + dy * dy < reach * reach && state.ship.invuln <= 0) {
        shot.life = 0;
        events |= hitShip();
      }
    }
    state.enemyBullets = state.enemyBullets.filter(
      (b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20,
    );
    return events;
  }

  function stepCores(dt) {
    let events = 0;
    const ship = state.ship;
    const magnet = magnetRadius();
    for (const core of state.cores) {
      core.life -= dt;
      const dx = ship.x - core.x;
      const dy = ship.y - core.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < magnet) {
        core.vx += (dx / dist) * 900 * dt;
        core.vy += (dy / dist) * 900 * dt;
      } else {
        core.vx *= Math.exp(-2 * dt);
        core.vy *= Math.exp(-2 * dt);
      }
      core.x += core.vx * dt;
      core.y += core.vy * dt;
      if (dist < ship.radius + core.radius + 4) {
        core.life = 0;
        const gained = CORE.value * Math.max(1, state.combo);
        state.score += gained;
        popup(core.x, core.y - 10, `+${gained}`, '#ffe45e');
        burst(core.x, core.y, '#ffe45e', 6, 120);
        events |= EVENT_CORE;
        events |= gainXp(CORE.xp);
      }
    }
    state.cores = state.cores.filter((c) => c.life > 0);
    return events;
  }

  function stepFx(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.4 * dt);
      p.vy *= Math.exp(-2.4 * dt);
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.popups) {
      p.y -= 34 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter((p) => p.life > 0);
    for (const star of state.stars) {
      star.twinkle += dt * star.speed;
      star.y += star.speed * 6 * dt;
      if (star.y > FIELD.height) {
        star.y = 0;
        star.x = random.range(0, FIELD.width);
      }
    }
    if (state.bannerIn > 0) state.bannerIn -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.comboIn > 0) {
      state.comboIn -= dt;
      if (state.comboIn <= 0) state.combo = 0;
    }
  }

  // Advance the world one fixed step. `move` is a -1..1 vector, `aim` a field
  // point, `firing` whether the trigger is held. Returns an event bitmask.
  // While a level-up draft is open the fight is frozen: only particles move.
  function step(dt, move, aim, firing) {
    if (state.over || state.won) {
      stepFx(dt);
      return state.won ? EVENT_CLEAR : EVENT_OVER;
    }
    if (state.draft) {
      stepFx(dt);
      return 0;
    }
    state.time += dt;
    let events = 0;
    if (stepShip(dt, move, aim, firing)) events |= EVENT_SHOT;
    if (state.spawnQueue.length > 0) {
      state.spawnIn -= dt;
      if (state.spawnIn <= 0) {
        state.spawnIn = WAVES.spawnGap;
        // From wave 5 the packs arrive two at a time: the arena stays
        // crowded instead of draining to a trickle between kills.
        const burst = state.wave >= 5 ? 2 : 1;
        for (let i = 0; i < burst && state.spawnQueue.length > 0; i += 1) {
          spawnDrone(state.spawnQueue.shift(), state.spawnAnchors.shift());
        }
      }
    } else if (state.drones.length === 0 && state.wave > 0) {
      state.score += WAVES.clearBonus * state.wave;
      popup(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE BONUS +${WAVES.clearBonus * state.wave}`, '#37f5d3');
      events |= EVENT_CLEAR;
      if (state.wave >= WIN_WAVE) {
        // The siege is broken: the final wave cleared is the win. No
        // next wave starts; the victory screen takes over from here.
        state.won = true;
        state.score += WAVES.winBonus;
        state.banner = 'BASTION HELD — SIEGE BROKEN';
        state.bannerIn = 3.0;
        burst(state.ship.x, state.ship.y, '#ffd23e', 70, 420);
      } else {
        state.banner = `WAVE ${state.wave} CLEAR`;
        state.bannerIn = 2.0;
        events |= startWave(state.wave + 1);
      }
    }
    stepDrones(dt);
    events |= stepBullets(dt);
    events |= stepNova(dt);
    events |= stepCores(dt);
    stepFx(dt);
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  function reset() {
    const fresh = makeShip();
    state.ship = fresh;
    state.drones = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.cores = [];
    state.particles = [];
    state.popups = [];
    state.wave = 0;
    state.score = 0;
    state.combo = 0;
    state.comboIn = 0;
    state.kills = 0;
    state.spawnQueue = [];
    state.spawnAnchors = [];
    state.spawnIn = 0;
    state.banner = '';
    state.bannerIn = 0;
    state.boss = null;
    state.shake = 0;
    state.time = 0;
    state.over = false;
    state.won = false;
    state.xp = 0;
    state.level = 1;
    state.xpNext = XP.baseNext;
    state.maxHull = PLAYER.hull;
    state.upgrades = { rapid: 0, spread: 0, aegis: 0, magnet: 0, nova: 0 };
    state.draft = null;
    state.novaIn = NOVA.baseGap;
  }

  // Spawn the whole queued wave at once, from its cluster anchors, so a
  // staged frame shows the wave as a pack instead of a trickle.
  function spawnAll() {
    while (state.spawnQueue.length > 0) {
      spawnDrone(state.spawnQueue.shift(), state.spawnAnchors.shift());
    }
  }

  function snapshot() {
    return structuredClone(state);
  }

  function restore(snap) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, structuredClone(snap));
  }

  return { state, step, reset, startWave, burst, popup, hitShip, openDraft, applyUpgrade, snapshot, restore, spawnAll };
}
