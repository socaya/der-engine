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
import { mkdirSync, readdirSync, readFileSync, writeFileSync,
         statSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, basename } from 'node:path';
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

function readManifest(appDir) {
  const pkgPath = resolve(appDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.derAppManifest ?? null;
}

/**
 * Translate the package.json `derAppManifest` block into a
 * DHIS2-shaped `manifest.webapp` for the zip. Keeps DHIS2's
 * `requires_der_api` snake_case convention; stores DER-only
 * fields (`module`) alongside it.
 */
function toWebappManifest(manifest, hasIcon) {
  const out = {
    name: manifest.appKey,
    displayName: manifest.displayName,
    version: manifest.version,
    requires_der_api: manifest.requiresDerApi,
  };
  if (manifest.module) out.module = manifest.module;
  if (manifest.description) out.description = manifest.description;
  if (manifest.developer) out.developer = manifest.developer;
  if (hasIcon) out.icons = { '128': 'icon.svg' };
  return out;
}

for (const appDir of appDirs) {
  const name = appDir.split('/').pop();
  const outdir = resolve(appDir, 'dist');
  mkdirSync(outdir, { recursive: true });
  const manifest = readManifest(appDir);
  // Keep the @der-app banner for backward-compat with the raw-.js
  // upload path; the zip carries the canonical manifest.webapp.
  const banner = manifest
    ? { js: `/* @der-app ${JSON.stringify(manifest)} */` }
    : undefined;
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
    banner,
  });

  // Also emit the DHIS2-style zip: manifest.webapp + bundle.js
  // (+ icon.svg if the app ships one at `apps/<name>/icon.svg`).
  if (manifest) {
    const stageDir = resolve(outdir, '.zip-stage');
    rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(stageDir, { recursive: true });
    const iconSrc = resolve(appDir, 'icon.svg');
    const hasIcon = existsSync(iconSrc);
    if (hasIcon) copyFileSync(iconSrc, resolve(stageDir, 'icon.svg'));
    copyFileSync(resolve(outdir, 'bundle.js'), resolve(stageDir, 'bundle.js'));
    writeFileSync(
      resolve(stageDir, 'manifest.webapp'),
      JSON.stringify(toWebappManifest(manifest, hasIcon), null, 2),
    );
    const zipPath = resolve(outdir, `${name}.zip`);
    rmSync(zipPath, { force: true });
    execFileSync('zip', ['-j', '-q', zipPath,
      resolve(stageDir, 'manifest.webapp'),
      resolve(stageDir, 'bundle.js'),
      ...(hasIcon ? [resolve(stageDir, 'icon.svg')] : []),
    ]);
    rmSync(stageDir, { recursive: true, force: true });
  }

  const label = manifest ? `${basename(outdir)}/${name}.zip` : 'bundle.js';
  console.log(`[build-apps] ${name} → ${label} (${Date.now() - t0} ms)`);
}
