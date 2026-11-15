// NEON BASTION — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. The game moves between
// four screens: title, play, paused and game over.
//
// ?seed=N fixes the drone pattern. ?shot=start|play|boss|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_CLEAR, EVENT_CORE, EVENT_HIT, EVENT_KILL, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
// Left on the window so a screenshot or test driver can read the live state.
window.__world = world;

let screen = SCREEN_TITLE;
let best = readBest();
let lastTime = performance.now();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Best score is a nicety; a blocked store must never break the game.
  }
}

function describe() {
  const state = world.state;
  if (screen === SCREEN_TITLE) return 'Neon Bastion. Title screen. Press Enter to launch.';
  if (screen === SCREEN_PAUSED) return 'Paused.';
  if (screen === SCREEN_OVER) return `Game over. Score ${state.score}. Best ${best}. Press R to fly again.`;
  return `Wave ${Math.max(1, state.wave)}. Score ${state.score}. Hull ${state.ship.hull} of 3. Combo times ${Math.max(1, state.combo)}.`;
}

function announce() {
  status.textContent = describe();
}

function startGame() {
  world.reset();
  world.startWave(1);
  screen = SCREEN_PLAY;
  audio.unlock();
  announce();
}

function handleEvents(events) {
  if (events & EVENT_SHOT) audio.shoot();
  if (events & EVENT_KILL) audio.kill();
  if (events & EVENT_CORE) audio.core();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_CLEAR) audio.clear();
  if (events & EVENT_BOSS) audio.boss();
  if (world.state.over) {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest();
    }
    announce();
  }
}

function frame(now) {
  const elapsed = Math.min(MAX_FRAME, (now - lastTime) / 1000);
  lastTime = now;
  const actions = input.pollActions();
  if (actions.has(ACTION_PAUSE) && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
    screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
    announce();
  }
  if (screen === SCREEN_TITLE && actions.has(ACTION_CONFIRM)) startGame();
  else if (screen === SCREEN_OVER && (actions.has(ACTION_RESTART) || actions.has(ACTION_CONFIRM))) startGame();
  else if (screen === SCREEN_PAUSED && actions.has(ACTION_RESTART)) startGame();

  if (screen === SCREEN_PLAY) {
    let left = elapsed;
    while (left > 0) {
      const dt = Math.min(STEP, left);
      const events = world.step(dt, input.moveVector(), input.mouse, input.firing());
      if (events) handleEvents(events);
      left -= dt;
      if (world.state.over) break;
    }
  }
  renderer.paint(world, screen, best);
  requestAnimationFrame(frame);
}

if (shot) {
  // A staged scene: paint it twice so glow and particles settle, then tell
  // the screenshot tool the frame is ready.
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  renderer.paint(world, screen, best);
  renderer.paint(world, screen, best);
  window.__shotReady = true;
} else {
  announce();
  requestAnimationFrame(frame);
}
