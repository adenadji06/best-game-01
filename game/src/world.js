// NEON BASTION — the world: the ship, the drones, the bullets, the cores
// and the wave machine. Pure state plus one fixed step; drawing lives in
// render.js and the boot loop in main.js, so this file can be driven by a
// screenshot autopilot exactly like a player.
import { BULLET, COMBO, CORE, DRONES, FIELD, PALETTE, PLAYER, STEP, WAVES } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_CORE = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_BOSS = 32;
export const EVENT_SHOT = 64;

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
    roster.push('boss');
    for (let i = 0; i < 2 + wave / WAVES.bossEvery; i += 1) roster.push('dart');
    return roster;
  }
  const count = WAVES.baseCount + (wave - 1) * WAVES.perWave;
  for (let i = 0; i < count; i += 1) {
    const roll = random.next();
    if (wave >= 3 && roll < 0.18) roster.push('bulwark');
    else if (roll < 0.45) roster.push('weaver');
    else roster.push('dart');
  }
  return roster;
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
    wave: 0,
    score: 0,
    combo: 0,
    comboIn: 0,
    kills: 0,
    spawnQueue: [],
    spawnIn: 0,
    banner: '',
    bannerIn: 0,
    boss: null,
    shake: 0,
    time: 0,
    over: false,
  };
  for (let i = 0; i < 90; i += 1) {
    state.stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      size: random.range(0.6, 2.2),
      twinkle: random.range(0, TAU),
      speed: random.range(0.4, 1.6),
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

  function popup(x, y, text, colour) {
    state.popups.push({ x, y, text, colour, life: 1.0 });
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = waveRoster(random, wave);
    state.spawnIn = 0.6;
    const isBoss = wave % WAVES.bossEvery === 0;
    state.banner = isBoss ? `WAVE ${wave} — BASTION BREAKER INBOUND` : `WAVE ${wave}`;
    state.bannerIn = 2.2;
    if (isBoss) return EVENT_BOSS;
    return 0;
  }

  function spawnDrone(kind) {
    const def = DRONES[kind];
    const at = edgeSpawn(random);
    const drone = {
      kind,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      radius: def.radius,
      hull: def.hull + Math.floor(state.wave / 4),
      maxHull: def.hull + Math.floor(state.wave / 4),
      speed: def.speed * (1 + state.wave * 0.02),
      phase: random.next() * TAU,
      fireIn: random.range(1.5, 3.5),
      angle: 0,
    };
    state.drones.push(drone);
    if (kind === 'boss') state.boss = drone;
    return drone;
  }

  function killDrone(drone) {
    const def = DRONES[drone.kind];
    state.kills += 1;
    state.combo = Math.min(state.combo + COMBO.step, COMBO.cap);
    state.comboIn = COMBO.window;
    const gained = def.score * Math.max(1, state.combo);
    state.score += gained;
    popup(drone.x, drone.y - drone.radius, `+${gained}`, def.colour);
    burst(drone.x, drone.y, def.colour, drone.kind === 'boss' ? 60 : 18, 260);
    if (drone.kind === 'boss') {
      state.boss = null;
      state.shake = 0.5;
      burst(drone.x, drone.y, '#ffffff', 40, 380);
    }
    if (random.next() < CORE.dropChance || drone.kind === 'boss') {
      const n = drone.kind === 'boss' ? 5 : 1;
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
    return EVENT_KILL;
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
      ship.fireIn = PLAYER.fireGap;
      state.bullets.push({
        x: ship.x + Math.cos(ship.angle) * (ship.radius + 6),
        y: ship.y + Math.sin(ship.angle) * (ship.radius + 6),
        vx: Math.cos(ship.angle) * PLAYER.bulletSpeed,
        vy: Math.sin(ship.angle) * PLAYER.bulletSpeed,
        radius: BULLET.playerRadius,
        life: 1.2,
      });
      return true;
    }
    return false;
  }

  function stepDrones(dt) {
    const ship = state.ship;
    for (const drone of state.drones) {
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
        const targetX = FIELD.width / 2 + Math.sin(state.time * 0.6) * 260;
        drone.vx = (targetX - drone.x) * 0.9;
        drone.vy = (150 - drone.y) * 0.9;
        drone.fireIn -= dt;
        if (drone.fireIn <= 0) {
          drone.fireIn = Math.max(1.1, 2.4 - state.wave * 0.06);
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
          drone.hull -= 1;
          bullet.life = 0;
          burst(bullet.x, bullet.y, '#8ef7ff', 4, 140);
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
    for (const core of state.cores) {
      core.life -= dt;
      const dx = ship.x - core.x;
      const dy = ship.y - core.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < CORE.magnet) {
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
  function step(dt, move, aim, firing) {
    if (state.over) {
      stepFx(dt);
      return EVENT_OVER;
    }
    state.time += dt;
    let events = 0;
    if (stepShip(dt, move, aim, firing)) events |= EVENT_SHOT;
    if (state.spawnQueue.length > 0) {
      state.spawnIn -= dt;
      if (state.spawnIn <= 0) {
        state.spawnIn = WAVES.spawnGap;
        spawnDrone(state.spawnQueue.shift());
      }
    } else if (state.drones.length === 0 && state.wave > 0) {
      state.score += WAVES.clearBonus * state.wave;
      popup(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE BONUS +${WAVES.clearBonus * state.wave}`, '#37f5d3');
      state.banner = `WAVE ${state.wave} CLEAR`;
      state.bannerIn = 2.0;
      events |= EVENT_CLEAR;
      events |= startWave(state.wave + 1);
    }
    stepDrones(dt);
    events |= stepBullets(dt);
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
    state.spawnIn = 0;
    state.banner = '';
    state.bannerIn = 0;
    state.boss = null;
    state.shake = 0;
    state.time = 0;
    state.over = false;
  }

  function snapshot() {
    return structuredClone(state);
  }

  function restore(snap) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, structuredClone(snap));
  }

  return { state, step, reset, startWave, burst, popup, hitShip, snapshot, restore };
}
