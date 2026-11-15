# NEON BASTION

A neon arena wave-defender for make.fun's best-game-01 bounty. Pilot the
last ship of the Bastion, blast the drone waves that pour in from the dark,
grab the cores they drop, and hold the arena — a boss, the Bastion Breaker,
breaks in every 5th wave.

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim
- **Space or click** — fire
- **P or Esc** — pause
- **R** — restart after game over

Chain kills to raise your combo multiplier (up to x8); cores are worth more
while the combo is alive. You have 3 hull. There is no continue — how many
waves can you hold?

## Play it locally

```
node serve.ts
```

then open http://localhost:8080 in a desktop browser. No network requests:
every file the game loads sits under `game/`.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `game/index.html` — the page; `game/src/` holds the game, one job per
  file (`config`, `world`, `render`, `input`, `audio`, `shots`, `main`).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — four renders of the game itself: title, play, boss wave,
  game over.
