// NEON BASTION — tuning and palette. One place holds every number the
// rest of the game reads, so balancing is a matter of editing this file.
export const FIELD = { width: 960, height: 600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'neon-bastion-best';

export const PLAYER = {
  radius: 14,
  speed: 360,
  accel: 2600,
  drag: 6.5,
  hull: 3,
  fireGap: 0.15,
  bulletSpeed: 680,
  invulnSeconds: 2.0,
};

export const BULLET = { playerRadius: 4, enemyRadius: 5, enemySpeed: 230 };

// Drone kinds: how fast they move, how much hull they take to kill, what
// they are worth, and the colour they glow.
export const DRONES = {
  dart:    { radius: 12, speed: 135, hull: 1, score: 50,  colour: '#ff5d8f' },
  weaver:  { radius: 13, speed: 105, hull: 2, score: 80,  colour: '#ffb020' },
  bulwark: { radius: 21, speed: 55,  hull: 6, score: 150, colour: '#b06bff' },
  boss:    { radius: 46, speed: 42,  hull: 70, score: 1000, colour: '#ff2e4d' },
};

export const WAVES = {
  baseCount: 8,      // drones in wave 1, before the per-wave growth
  perWave: 3,        // extra drones each later wave
  spawnGap: 0.4,     // seconds between spawns inside a wave
  clearBonus: 250,   // points times the wave number on a clear
  bossEvery: 5,      // a boss wave every 5th wave
};

export const COMBO = { window: 3.0, step: 1, cap: 8 };
export const CORE = { radius: 7, value: 25, magnet: 110, dropChance: 0.6 };

export const PALETTE = {
  bgTop: '#0a0618',
  bgBottom: '#12082e',
  grid: 'rgba(120, 90, 255, 0.07)',
  ship: '#37f5d3',
  shipCore: '#eafffb',
  bullet: '#8ef7ff',
  enemyBullet: '#ff7a59',
  core: '#ffe45e',
  text: '#eef2ff',
  dim: '#9aa3c7',
  danger: '#ff4d6d',
};

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
