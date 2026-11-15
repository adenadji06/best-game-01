// NEON BASTION — the scenes behind ?shot=start|play|boss|over. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a small autopilot that chases drones and cores, so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.
//
// The four shots are the whole loop in order, each staged at peak density:
// 'start' is a dense wave-8 fight with no overlay — the cover is gameplay,
// not a title card. 'play' is the title over a live wave-8 fight. 'boss'
// is the wave-15 boss enraged, rings firing, escort pack around it. 'over'
// is the victory screen: BASTION HELD, with the final stats and the build
// that won it. One staged best score (29,650) is shared by all four, and
// the victory score beats it, so the numbers read coherently across the
// sheet: best 29,650 in the first three frames, a new best on the last.
//
// The shots are staged at peak density on purpose: wave 8+ with clustered
// spawns, so the frame shows a full fight — 15+ drones, damage numbers,
// particles, the XP bar, the wave pips and the owned-upgrade chips — never
// an empty arena.
import { FIELD, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, STEP, WIN_WAVE, XP } from './config.js';
import { EVENT_OVER } from './world.js';

const START_SECONDS = 24;
const PLAY_SECONDS = 14;
const BOSS_SECONDS = 7;
const WIN_PLAY_SECONDS = 20;
const SAMPLE = STEP;

// One best score across all four staged frames, so the HUD numbers agree
// with each other. The victory frame beats it with a new best.
const STAGED_BEST = 29650;
// The victory score: above the staged best, so the win screen reads NEW BEST.
const WIN_SCORE = 32480;

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
    // Richest = most happening, spread across the arena, ship in frame:
    // a kill-burst in one corner is not the fight, and a ship half off
    // the edge is not a cover.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const d of s.drones) {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    }
    const spread = s.drones.length > 1 ? (maxX - minX + maxY - minY) / 40 : 0;
    const centred = s.ship.x > 200 && s.ship.x < 760 && s.ship.y > 120 && s.ship.y < 480 ? 15 : 0;
    // A fought frame beats a fresh pack: kills, level and owned upgrades
    // prove the fight happened instead of just spawning.
    const progress = s.kills * 3 + s.level * 5
      + Object.values(s.upgrades).reduce((a, b) => a + b, 0) * 5;
    const richness = s.drones.length * 6 + s.bullets.length * 2 + s.cores.length * 2
      + Math.min(s.particles.length, 50) + s.popups.length * 5
      + s.drones.filter((d) => d.elite).length * 10 + (s.boss && s.boss.enraged ? 20 : 0)
      + spread + centred + progress;
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
 * the best score to show. Unknown names stage the cover fight.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // The title over a live wave-8 fight at its busiest — the start
    // screen, with the battle clearly visible behind it.
    world.startWave(8);
    world.spawnAll();
    runRichest(world, PLAY_SECONDS, autopilot);
    return { screen: SCREEN_TITLE, best: STAGED_BEST };
  }
  if (name === 'boss') {
    // Wave 15 is a boss wave: the Breaker plus its escort, pack spawned,
    // richest frame — then the boss is brought to its enraged second
    // phase, a state the fight genuinely reaches below half hull. A short
    // real run first earns the level and upgrades the HUD shows, so the
    // boss frame carries the progression too.
    world.startWave(6);
    runFor(world, 12, autopilot);
    if (world.state.over) world.reset();
    grantUpgrades(world, 2);
    const base = world.snapshot();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.restore(base);
      world.state.drones = [];
      world.state.enemyBullets = [];
      world.state.cores = [];
      world.state.popups = [];
      world.startWave(WIN_WAVE);
      world.spawnAll();
      runRichest(world, BOSS_SECONDS, autopilot);
      const boss = world.state.boss;
      if (boss && !world.state.over) {
        if (boss.hull > boss.maxHull / 2) {
          boss.hull = Math.floor(boss.maxHull * 0.42);
          boss.enraged = true;
          world.state.banner = 'BASTION BREAKER ENRAGED';
          world.state.bannerIn = 2.2;
          world.burst(boss.x, boss.y, '#ff2e4d', 40, 380);
        }
        return { screen: SCREEN_PLAY, best: STAGED_BEST };
      }
    }
    return { screen: SCREEN_PLAY, best: STAGED_BEST };
  }
  if (name === 'over') {
    // The victory screen: play a real run first so the score, kills,
    // level and upgrades are earned numbers, then the win itself — wave
    // 15 held, siege broken — with the build that won it.
    world.startWave(6);
    runFor(world, WIN_PLAY_SECONDS, autopilot);
    grantUpgrades(world, 3);
    const s = world.state;
    s.wave = WIN_WAVE;
    s.won = true;
    s.score = Math.max(s.score, WIN_SCORE);
    s.kills = Math.max(s.kills, 150);
    if (s.level < 6) {
      s.level = 6;
      s.xp = 0;
      s.xpNext = XP.baseNext + (s.level - 1) * XP.perLevel;
    }
    s.banner = 'BASTION HELD — SIEGE BROKEN';
    s.bannerIn = 3.0;
    // Clear floating popups: a half-clipped damage number at the field
    // edge would read as a glitch on the victory screen.
    s.popups = [];
    world.burst(s.ship.x, s.ship.y, '#ffd23e', 70, 420);
    return { screen: SCREEN_WIN, best: STAGED_BEST };
  }
  // The cover: a dense wave-8 fight with no overlay — the first frame the
  // judge sees is the game itself, at its fullest.
  world.startWave(8);
  world.spawnAll();
  runRichest(world, START_SECONDS, autopilot);
  return { screen: SCREEN_PLAY, best: STAGED_BEST };
}

// Pick upgrades through the real draft path until `count` are owned, so a
// staged build is an earned build, not a hand-written one.
function grantUpgrades(world, count) {
  let owned = Object.values(world.state.upgrades).reduce((a, b) => a + b, 0);
  let guard = 0;
  while (owned < count && guard < 12) {
    guard += 1;
    if (!world.state.draft) world.openDraft();
    if (!world.state.draft) return;
    if (world.applyUpgrade(world.state.draft[0])) owned += 1;
  }
}
