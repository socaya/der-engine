/**
 * Template Vite config for a DER-dispatched app bundle.
 *
 * Copy this into `apps/<your-app>/vite.config.ts` and adjust
 * `entry` to point at the app's root component. The output is a
 * single ESM file that runs inside the device-client shell via
 * `C-UI-5b`'s AppHost + Blob-URL dynamic import.
 *
 * Externals matter — the shell's `<script type="importmap">`
 * block resolves `react`, `react-dom`, `react-router-dom` and
 * `@der/app-sdk` to its own copies so the app and the shell share
 * one React instance (hook rules require this).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.tsx',
      name: 'DerApp',
      formats: ['es'],
      fileName: () => 'bundle.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client',
                 'react-router-dom', '@der/app-sdk'],
    },
    cssCodeSplit: false,
  },
});
