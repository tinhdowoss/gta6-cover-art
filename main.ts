// Sunset State Cover Studio — gta6-cover-art-01 entry (Node 22, standard library only).
// The app is app/: static files (index.html, ES modules in app/js, OFL fonts in app/fonts) that a desktop
// browser runs offline. It builds multi-panel poster covers (tilted panels, pixel-level sunset/neon grades,
// extruded italic lettering) from the user's own photos and exports PNGs at 1920x1080, 1080x1350 and 1080x1080.
//
// This program hands it in: it copies app/ and screenshots/ to /output (MAKEFUN_OUTPUT_DIR outside the grader)
// and writes /output/dossier.json with the vendored make.fun library.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Hidden files (.DS_Store and friends) never ship: they would make two runs on a desktop machine differ.
const skipHiddenFiles = (src: string): boolean => !basename(src).startsWith('.');

function copyFolderClean(name: string): void {
  const from = join(here, name);
  const to = join(out, name);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true, filter: (src) => src === from || skipHiddenFiles(src) });
}

mkdirSync(out, { recursive: true });
copyFolderClean('app');
copyFolderClean('screenshots');

// The scorer's own caps: only text_max_bytes shapes the bytes; the others refuse an entry the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
console.log(`Sunset State Cover Studio written to ${out}`);
