// NEON BASTION — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. The game moves between
// four screens: title, play, paused and game over.
//
// ?seed=N fixes the drone pattern. ?shot=start|play|boss|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
//
// The title screen is an attract mode: an autopilot plays a wave-6 demo
// behind the title text, so the cover frame is a live fight, not a void.
// A level-up draft freezes the fight until the player picks a card with
// keys 1/2/3 or a click on the card.
import { BEST_KEY, FIELD, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_CLEAR, EVENT_CORE, EVENT_HIT, EVENT_KILL, EVENT_LEVEL, EVENT_NOVA, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, draftCardAt } from './render.js';
import { createAudio } from './audio.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** The demo wave the attract mode plays behind the title. */
const DEMO_WAVE = 6;

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
  if (state.draft) return `Level ${state.level}. Choose an upgrade: press 1, 2 or 3.`;
  return `Wave ${Math.max(1, state.wave)}. Score ${state.score}. Hull ${state.ship.hull} of ${state.maxHull}. Level ${state.level}. Combo times ${Math.max(1, state.combo)}.`;
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

// The attract-mode demo: the autopilot flies wave 6 behind the title.
// A finished demo restarts itself, so the title never goes quiet.
function stepDemo(dt) {
  if (world.state.wave === 0 || world.state.over) {
    world.reset();
    world.startWave(DEMO_WAVE);
  }
  const { move, aim, firing } = autopilot(world.state, world);
  world.step(dt, move, aim, firing);
}

// Pick a draft card by index; returns true when a card was picked.
function pickDraft(index) {
  const draft = world.state.draft;
  if (!draft || index < 0 || index >= draft.length) return false;
  if (world.applyUpgrade(draft[index])) {
    announce();
    return true;
  }
  return false;
}

function handleEvents(events) {
  if (events & EVENT_SHOT) audio.shoot();
  if (events & EVENT_KILL) audio.kill();
  if (events & EVENT_CORE) audio.core();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_CLEAR) audio.clear();
  if (events & EVENT_BOSS) audio.boss();
  if (events & EVENT_LEVEL) audio.clear();
  if (events & EVENT_NOVA) audio.kill();
  if (world.state.draft) announce();
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
  // Draft picks come first: while a draft is open, 1/2/3 chooses a card
  // and Enter/click must not leak through to anything else.
  if (screen === SCREEN_PLAY && world.state.draft) {
    let picked = false;
    for (const digit of input.pollDigits()) {
      picked = pickDraft(digit - 1) || picked;
    }
    if (picked) {
      renderer.paint(world, screen, best);
      requestAnimationFrame(frame);
      return;
    }
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
      if (world.state.over || world.state.draft) break;
    }
  } else if (screen === SCREEN_TITLE) {
    // Attract mode: the demo fight runs behind the title.
    let left = elapsed;
    while (left > 0) {
      const dt = Math.min(STEP, left);
      stepDemo(dt);
      left -= dt;
    }
  }
  renderer.paint(world, screen, best);
  requestAnimationFrame(frame);
}

// Clicking a draft card picks it; clicking anywhere else on the title
// still launches, as before.
canvas.addEventListener('click', (event) => {
  if (screen !== SCREEN_PLAY || !world.state.draft) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * FIELD.width;
  const y = ((event.clientY - rect.top) / rect.height) * FIELD.height;
  pickDraft(draftCardAt(x, y));
});

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
