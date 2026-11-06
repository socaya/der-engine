#!/usr/bin/env node
/**
 * C-UI-5c — builds every `apps/<app>/src/index.tsx` into a single
 * ESM bundle at `apps/<app>/dist/bundle.js`. The bundle externals
 * `react`, `react-dom`, `react-router-dom` and `@der/app-sdk` so
 * the shell's import map resolves them at runtime.
 *
 * esbuild is used directly (rather than per-app Vite projects) so
 * every app shares the client's node_modules — no per-app npm
 * install, no duplicate dependency trees.
 */
import { build } from 'esbuild';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// client/scripts/ → repo root is two levels up.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appsDir = resolve(root, 'apps');

const appDirs = readdirSync(appsDir)
  .filter((n) => n !== 'app-sdk')
  .map((n) => resolve(appsDir, n))
  .filter((p) => statSync(p).isDirectory()
    && existsSync(resolve(p, 'src', 'index.tsx')));

if (appDirs.length === 0) {
  console.log('[build-apps] no apps to build');
  process.exit(0);
}

const nodePaths = [
  resolve(root, 'client', 'node_modules'),
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules'),
];

for (const appDir of appDirs) {
  const name = appDir.split('/').pop();
  const outdir = resolve(appDir, 'dist');
  mkdirSync(outdir, { recursive: true });
  const t0 = Date.now();
  await build({
    entryPoints: [resolve(appDir, 'src', 'index.tsx')],
    outdir,
    outExtension: { '.js': '.js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    jsx: 'automatic',
    nodePaths,
    external: [
      'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
      'react-router-dom', '@der/app-sdk',
    ],
    legalComments: 'none',
    entryNames: 'bundle',
  });
  console.log(`[build-apps] ${name} → ${outdir}/bundle.js (${Date.now() - t0} ms)`);
}
