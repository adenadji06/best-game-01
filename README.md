[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/adenadji06/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/adenadji06/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# NEON BASTION — hold 15 waves, break the siege

A neon arena wave-defender for make.fun's best-game-01 bounty. Pilot the
last ship of the Bastion, blast the drone waves that pour in from the dark,
grab the cores they drop, and hold the arena — a boss, the Bastion Breaker,
breaks in every 5th wave. **Clear wave 15 and the siege breaks: BASTION
HELD. You win.**

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim
- **Space or click** — fire
- **P or Esc** — pause
- **R** — restart after game over

Chain kills to raise your combo multiplier (up to x8); cores are worth more
while the combo is alive. You have 3 hull. There is no continue — hold all
15 waves to win, or the Bastion falls. Gold-ringed **elite drones** (from
wave 4) are worth triple score and drop three cores; a boss below half hull
**enrages** and fires faster.

## The siege is a campaign, not a counter

- **Shards** (from wave 6) — green diamonds that split into two darts when
  killed, so a wave never goes quiet after the first kill.
- **Named waves** — wave 6 is a **SHARD STORM**, wave 8 a **SWARM SURGE**
  (+8 darts), wave 12 an **ELITE HUNT** (elites three times as likely). The
  banner names each one, and the mix changes with it.
- **Boss phases** — the Bastion Breaker fights in three phases: ring fire,
  **enrage** below half hull (faster rings, faster strafe), and **overdrive**
  below a quarter hull (a rotating spiral fan on top of the ring, double
  strafe). The HUD boss bar names the phase live.

## Level up

Kills and cores grant XP. Fill the bar and the fight freezes for a
pick-1-of-3 upgrade draft — press **1**, **2** or **3**, or click a card:

- **Rapid Fire** — fire 15% faster (up to 5 times)
- **Spread Shot** — +1 bullet stream, wider arc (up to 3 times)
- **Aegis Shield** — +1 max hull and repair 1 (up to 3 times)
- **Core Magnet** — cores fly to you from 50% further (up to 3 times)
- **Nova Burst** — a shockwave blasts nearby drones every few seconds (up to 3 times)

Bullets deal 5 damage (12% crit for 10); every hit floats a damage number
off the drone, and hits flash the hull white. Drones arrive in packs —
clustered spawns, two at a time from wave 5 — among wreck props under a
parallax nebula. The title screen plays a wave-8 demo behind the title,
so the arena is already fighting before you launch.

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
- `screenshots/` — four renders of the game itself: a dense wave-8 fight
  (the cover), the title over a live fight, the wave-15 boss in overdrive,
  and the victory screen.
