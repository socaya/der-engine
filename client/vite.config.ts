/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const version = readFileSync(resolve(here, '..', 'VERSION'), 'utf-8').trim();

// Where the server-side components actually listen in development. In packaged
// deployments NGINX (deployment/nginx/der.conf.example) does the stitching;
// in dev we proxy both from vite so the browser sees a single origin and
// DHIS2's SAMEORIGIN iframe policy keeps working (ADR-0003, Phase 03).
const DER_SERVER = process.env.DER_SERVER_URL ?? 'http://127.0.0.1:8085';

export default defineConfig({
  plugins: [react()],
  define: {
    __DER_VERSION__: JSON.stringify(version),
    __DER_APP__: JSON.stringify('client'),
  },
  server: {
    port: 5174,
    // ADR-0004: no /dhis proxy. DER itself emulates /api/*; the client's
    // DHIS2 Data Engine is pointed at /api which Vite forwards to the DER
    // coordination service in development.
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
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
