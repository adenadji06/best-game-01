// NEON BASTION — tuning and palette. One place holds every number the
// rest of the game reads, so balancing is a matter of editing this file.
export const FIELD = { width: 960, height: 600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'neon-bastion-best';

// The siege ends at wave 15: clear it and the Bastion holds — the game
// has a win, not just a loss. The HUD shows the 15 wave pips so the goal
// is visible in every frame.
export const WIN_WAVE = 15;

export const PLAYER = {
  radius: 16,
  speed: 360,
  accel: 2600,
  drag: 6.5,
  hull: 3,
  fireGap: 0.15,
  bulletSpeed: 680,
  invulnSeconds: 2.0,
};

// One bullet deals this much hull damage; a crit (12%) deals double.
// Drone hull is scaled to match, so damage numbers read 5 / 10, not 1.
export const BULLET = { playerRadius: 5, enemyRadius: 5, enemySpeed: 230, damage: 5, critChance: 0.12 };

export const DRONES = {
  dart:    { radius: 15, speed: 135, hull: 5,  score: 50,  colour: '#ff5d8f', xp: 5 },
  weaver:  { radius: 16, speed: 105, hull: 10, score: 80,  colour: '#ffb020', xp: 8 },
  bulwark: { radius: 24, speed: 55,  hull: 30, score: 150, colour: '#b06bff', xp: 15 },
  boss:    { radius: 52, speed: 42,  hull: 350, score: 1000, colour: '#ff2e4d', xp: 100 },
};

export const WAVES = {
  baseCount: 14,     // drones in wave 1, before the per-wave growth
  perWave: 5,        // extra drones each later wave
  spawnGap: 0.30,    // seconds between spawns inside a wave
  clearBonus: 250,   // points times the wave number on a clear
  bossEvery: 5,      // a boss wave every 5th wave
  clusterSize: 4,    // drones spawned from one shared anchor point
  winBonus: 5000,    // points for holding the final wave
};

// Elites: from wave 4, a share of the pack spawns gold-ringed, three
// times as tough and worth three times the score, dropping three cores.
// One more thing for the eye to read at a glance, and one more reason a
// wave is never just "more of the same".
export const ELITE = { fromWave: 4, chance: 0.12, hullMul: 3, scoreMul: 3, coreDrop: 3, radiusBonus: 6 };

export const COMBO = { window: 3.0, step: 1, cap: 8 };
export const CORE = { radius: 7, value: 25, magnet: 110, dropChance: 0.6, xp: 2 };

// Level-up draft: kill XP + core XP fill the bar; each level offers a
// pick-1-of-3 upgrade card. xpNext grows 40 / 70 / 100 / ...
export const XP = { baseNext: 40, perLevel: 30 };

// The upgrade pool for the level-up draft. `max` is how many times one
// upgrade can be taken; `apply` is described in world.js (levels live on
// state.upgrades so the draft, the HUD and the renderer all read one place).
export const UPGRADES = {
  rapid:  { name: 'RAPID FIRE',  max: 5, desc: 'Fire 15% faster',            short: 'RAPID' },
  spread: { name: 'SPREAD SHOT', max: 3, desc: '+1 bullet stream, wider arc', short: 'SPREAD' },
  aegis:  { name: 'AEGIS SHIELD', max: 3, desc: '+1 max hull and repair 1',   short: 'AEGIS' },
  magnet: { name: 'CORE MAGNET', max: 3, desc: 'Cores fly to you from 50% further', short: 'MAGNET' },
  nova:   { name: 'NOVA BURST',  max: 3, desc: 'A shockwave blasts nearby drones', short: 'NOVA' },
};
export const UPGRADE_ORDER = ['rapid', 'spread', 'aegis', 'magnet', 'nova'];
export const NOVA = { radius: 240, damage: 15, baseGap: 6.0, gapPerLevel: 0.7, minGap: 3.5 };

// Arena props: wrecked hull plates and asteroids. Visual anchors only —
// they never collide — so the arena reads as a place, not a void.
export const PROPS = { count: 12 };

export const PALETTE = {
  bgTop: '#0d0824',
  bgBottom: '#1a0e40',
  grid: 'rgba(120, 90, 255, 0.15)',
  ship: '#37f5d3',
  shipCore: '#eafffb',
  bullet: '#8ef7ff',
  enemyBullet: '#ff7a59',
  core: '#ffe45e',
  text: '#eef2ff',
  dim: '#9aa3c7',
  danger: '#ff4d6d',
  gold: '#ffd23e',
};

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
