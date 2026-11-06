#!/usr/bin/env node
/**
 * C-UI-5c slice 2 — emits the vendor chunks that
 * `client/index.html`'s importmap points at.
 *
 * DER-dispatched app bundles declare `react`, `react-dom`,
 * `react-dom/client`, `react-router-dom` and `@der/app-sdk` as
 * externals. The browser's native import map resolves each bare
 * specifier to `/vendor/<name>.js` — those files land here, built
 * from node_modules with esbuild so they're real ESM instead of
 * CommonJS, and committed under `public/vendor/` so they survive
 * both dev (Vite serves `public/`) and prod (Vite copies them
 * into `dist/`).
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(here, '..', 'public', 'vendor');
mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  outdir,
  entryNames: '[name]',
  legalComments: 'none',
};

const facade = (n) => resolve(here, 'vendor-facades', `${n}.js`);

// React + ReactDOM ship CJS modules; esbuild's `bundle:esm` of those
// only emits `default`. Named ESM re-exports (`useState`, `jsx`, …)
// need an explicit facade source that destructures the default
// export. The facades live in client/scripts/vendor-facades/.
await build({
  ...common,
  entryPoints: { 'react': facade('react') },
});

await build({
  ...common,
  entryPoints: { 'react-jsx-runtime': facade('react-jsx-runtime') },
  external: ['react'],
});

await build({
  ...common,
  entryPoints: { 'react-dom': facade('react-dom') },
  external: ['react'],
});

await build({
  ...common,
  entryPoints: { 'react-dom-client': facade('react-dom-client') },
  external: ['react', 'react-dom'],
});

await build({
  ...common,
  entryPoints: { 'react-router-dom': facade('react-router-dom') },
  external: ['react', 'react-dom'],
});

await build({
  ...common,
  entryPoints: { 'der-app-sdk':
    resolve(here, '..', 'src', 'apps', 'sdk-bridge.ts') },
  external: ['react', 'react-dom', 'react-router-dom'],
});

console.log(`vendor chunks emitted under ${outdir}`);
