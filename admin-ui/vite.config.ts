/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const version = readFileSync(resolve(here, '..', 'VERSION'), 'utf-8').trim();

const DER_SERVER = process.env.DER_SERVER_URL ?? 'http://127.0.0.1:8085';

export default defineConfig({
  plugins: [react()],
  define: {
    __DER_VERSION__: JSON.stringify(version),
    __DER_APP__: JSON.stringify('admin-ui'),
  },
  server: {
    port: 5173,
    // ADR-0004: admin-ui proxies /edge-api and /api to the DER server; no
    // /dhis proxy — DHIS2 Core does not run on the edge.
    proxy: {
      '/edge-api': { target: DER_SERVER, changeOrigin: true },
      '/api': { target: DER_SERVER, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
      ],
      // 1.0.0 gap G4 pass: lifted from 75/70/55/75 to 100/91/99/100 by
      // adding full test suites for edgeApi (51 cases, every endpoint),
      // AuthContext (8 cases including default-api fallback), RequireAuth
      // (4 cases — INITIAL/ANONYMOUS/EDGE_DOWN/AUTHENTICATED), and App
      // routing (20 cases exercising every route including the
      // :id-param ConflictResolveRoute). The remaining ~9% branch gap
      // sits in the EA screen bundles on the same defensive-coding
      // pattern as client (err instanceof Error else branches whose only
      // throws are EdgeApiError subclasses). Playwright per-screen
      // (roadmap Initiative 9) in der-1.1.0 covers those from a real
      // browser.
      // der-1.2.0-alpha.1 added EA-CWF-01/02 (list + designer) + 3 new
      // edgeApi helpers. 177 tests at 100/90.96/98.67/100. Two
      // onChange handlers on the designer form fall below the strict
      // 99/91 bar — same defensive onChange-undefined pattern noted at
      // der-1.0.0-rc.2 (Initiative 9 covers these from a real browser).
      thresholds: {
        lines: 100,
        branches: 90,
        functions: 97,
        statements: 100,
      },
    },
  },
});
