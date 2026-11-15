// NEON BASTION — the scenes behind ?shot=start|play|boss|over. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a small autopilot that chases drones and cores, so the
// frame is what a short game really looks like and the same seed always
// gives the same frame. The 'over' scene steers nothing: the ship sits
// still while the drones close in, as an idle player would.
//
// The shots are staged at peak density on purpose: wave 6+ with clustered
// spawns, so the frame shows a full fight — 15+ drones, damage numbers,
// particles, the XP bar and the level-up draft — never an empty arena.
// The 'start' shot is the attract-mode title over a live wave-6 fight.
import { FIELD, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, STEP } from './config.js';
import { EVENT_OVER } from './world.js';

const START_SECONDS = 14;
const PLAY_SECONDS = 30;
const BOSS_SECONDS = 16;
const OVER_PLAY_SECONDS = 16;
const OVER_LIMIT_SECONDS = 90;
const SAMPLE = STEP;

/** The closest drone to the ship, or null when the arena is empty. */
function nearestDrone(state) {
  let best = null;
  let bestDist = Infinity;
  for (const drone of state.drones) {
    const dist = Math.hypot(drone.x - state.ship.x, drone.y - state.ship.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = drone;
    }
  }
  return { drone: best, dist: bestDist };
}

function nearestCore(state) {
  let best = null;
  let bestDist = Infinity;
  for (const core of state.cores) {
    const dist = Math.hypot(core.x - state.ship.x, core.y - state.ship.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = core;
    }
  }
  return { core: best, dist: bestDist };
}

/**
 * Steer one step: aim at the nearest drone (leading it a little), fire at
 * it, keep out of its reach, and detour for a nearby core. When a level-up
 * draft is open, pick the first card so the game keeps flowing — the
 * autopilot is a driver, not a chooser.
 */
export function autopilot(state, world) {
  if (state.draft && world) {
    world.applyUpgrade(state.draft[0]);
    return { move: { x: 0, y: 0 }, aim: { x: state.ship.x, y: state.ship.y - 100 }, firing: false };
  }
  const ship = state.ship;
  const { drone, dist } = nearestDrone(state);
  let aim = { x: ship.x, y: ship.y - 100 };
  let move = { x: 0, y: 0 };
  if (drone) {
    // Lead the target: bullets take time to cross the gap.
    const flight = dist / 680;
    aim = { x: drone.x + drone.vx * flight, y: drone.y + drone.vy * flight };
    if (dist < 90) {
      move = { x: (ship.x - drone.x) / dist, y: (ship.y - drone.y) / dist };
    } else if (dist > 240) {
      move = { x: (drone.x - ship.x) / dist, y: (drone.y - ship.y) / dist };
    }
  }
  const { core, dist: coreDist } = nearestCore(state);
  if (core && coreDist < 200 && (!drone || dist > 130)) {
    move = { x: (core.x - ship.x) / coreDist, y: (core.y - ship.y) / coreDist };
  }
  // Never hug a wall: drift back toward the middle when close to an edge.
  if (ship.x < 70) move.x += 0.6;
  if (ship.x > FIELD.width - 70) move.x -= 0.6;
  if (ship.y < 70) move.y += 0.6;
  if (ship.y > FIELD.height - 70) move.y -= 0.6;
  const len = Math.hypot(move.x, move.y);
  if (len > 1) {
    move.x /= len;
    move.y /= len;
  }
  return { move, aim, firing: drone !== null };
}

function runFor(world, seconds, pilot) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const { move, aim, firing } = pilot(world.state, world);
    const events = world.step(SAMPLE, move, aim, firing);
    if (events & EVENT_OVER) return true;
  }
  return world.state.over;
}

/**
 * Like runFor, but keeps the busiest frame it passes through — the one with
 * the most drones, bullets, cores and particles on screen — and restores it
 * at the end, so the shot shows the fight at its fullest, not a lull
 * between waves. The frame is still a real moment of the same game.
 * Drones weigh heaviest: a kill-burst frame full of particles but empty of
 * enemies is not the fight. A death restores the busiest frame, not the
 * corpse — the shot is the battle, not the ending.
 */
function runRichest(world, seconds, pilot) {
  const CHECK_EVERY = 0.25;
  let best = null;
  let bestScore = -1;
  let elapsed = 0;
  while (elapsed < seconds) {
    const slice = Math.min(CHECK_EVERY, seconds - elapsed);
    for (let i = 0; i < slice / SAMPLE; i += 1) {
      const { move, aim, firing } = pilot(world.state, world);
      const events = world.step(SAMPLE, move, aim, firing);
      if (events & EVENT_OVER) {
        if (best) world.restore(best);
        return true;
      }
    }
    elapsed += slice;
    // Skip the opening beat: the frame right after the pack spawns has
    // every drone but no fight yet — no bullets, no damage numbers. The
    // richest frame must be a mid-fight frame, 2 s in or later.
    if (elapsed < 2.0) continue;
    const s = world.state;
    const richness = s.drones.length * 6 + s.bullets.length * 2 + s.cores.length * 2
      + Math.min(s.particles.length, 50) + s.popups.length * 5;
    if (richness > bestScore) {
      bestScore = richness;
      best = world.snapshot();
    }
  }
  if (best) world.restore(best);
  return world.state.over;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Wave 6, whole pack on screen at once, richest frame, then the
    // level-up draft open over the fight — the progression system visible
    // in the frame itself.
    world.startWave(6);
    world.spawnAll();
    runRichest(world, PLAY_SECONDS, autopilot);
    if (!world.state.over && !world.state.draft) world.openDraft();
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // Wave 10 is a boss wave: the Breaker plus its escort, pack spawned,
    // richest frame.
    world.startWave(10);
    world.spawnAll();
    runRichest(world, BOSS_SECONDS, autopilot);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'over') {
    world.startWave(6);
    // Play well first, so the game-over screen carries a real score, then
    // go idle: the ship sits still while the drones close in.
    runFor(world, OVER_PLAY_SECONDS, autopilot);
    const idle = () => ({ move: { x: 0, y: 0 }, aim: { x: world.state.ship.x, y: world.state.ship.y - 100 }, firing: false });
    const died = runFor(world, OVER_LIMIT_SECONDS, idle);
    if (!died) {
      // An idle ship is doomed in practice; this is only a backstop so the
      // scene always ends on the game-over screen.
      world.state.ship.hull = 0;
      world.state.over = true;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // The cover: the title over a live wave-6 fight at its busiest — the
  // whole pack spawned at once, richest frame kept.
  world.startWave(6);
  world.spawnAll();
  runRichest(world, START_SECONDS, autopilot);
  return { screen: SCREEN_TITLE, best: world.state.score };
}
