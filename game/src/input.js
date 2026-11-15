// NEON BASTION — keyboard and mouse. The loop asks three questions every
// frame: where does the player want to go, where are they aiming, and is
// the trigger held. Keys are tracked by code so layouts do not matter.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';

const MOVE_KEYS = {
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2 - 120, down: false, seen: false };
  let confirmQueued = false;

  function fieldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const at = fieldPoint(event.clientX, event.clientY);
    mouse.x = at.x;
    mouse.y = at.y;
    mouse.seen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const at = fieldPoint(event.clientX, event.clientY);
    mouse.x = at.x;
    mouse.y = at.y;
    mouse.seen = true;
    mouse.down = true;
    confirmQueued = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function moveVector() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        x += dir.x;
        y += dir.y;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  function takeAction(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }

  // Edge-triggered actions, consumed once per frame by the loop.
  function pollActions() {
    const actions = new Set();
    if (takeAction('Enter') || takeAction('Space')) actions.add(ACTION_CONFIRM);
    if (takeAction('KeyP') || takeAction('Escape')) actions.add(ACTION_PAUSE);
    if (takeAction('KeyR')) actions.add(ACTION_RESTART);
    if (confirmQueued) {
      confirmQueued = false;
      actions.add(ACTION_CONFIRM);
    }
    return actions;
  }

  function firing() {
    return held.has('Space') || mouse.down;
  }

  return { moveVector, pollActions, firing, mouse };
}
