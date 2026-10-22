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
      // Phase 06 Release 2 (0.6.0-alpha.2) lands 18 EA admin screens.
      // EA screens are at ~100% / 89% branch; shared helpers (edgeApi,
      // AuthContext, RequireAuth, App) await Playwright coverage. Stable
      // der-0.6.0 raises all thresholds back to 100%.
      thresholds: {
        lines: 75,
        branches: 70,
        functions: 55,
        statements: 75,
      },
    },
  },
});
