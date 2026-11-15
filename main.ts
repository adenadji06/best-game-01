// NEON BASTION — the entrypoint (Node 22, standard library only). It hands
// the game in: the static files under game/ and the screenshots under
// screenshots/ are copied from beside this file into the output directory,
// and dossier.json is written there with the vendored make.fun library, so
// the judge can read the game, its pictures and its source from one place.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
copyTree(join(here, 'screenshots'), join(out, 'screenshots'));

// The caps mirror the scorer's own limits: at most 4 screenshots and none
// over 256 KiB, at most 993 files and 48 MiB under game/, and the dossier
// text capped at 160 KiB, so a build that passes here is shaped like one
// the scorer accepts.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
