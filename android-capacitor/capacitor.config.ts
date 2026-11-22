// ADR-0030 / C-UI-5d. Capacitor config for the DER Android wrap.
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * DER server URL the Android app talks to.
 *
 *   - Emulator against a laptop-hosted DER: `http://10.0.2.2:8085`
 *     (Android emulator's alias for the host's localhost).
 *   - Real device on the same Wi-Fi: the host's LAN IP
 *     (e.g. `http://192.168.1.42:8085`) — pass through
 *     `DER_ANDROID_SERVER_URL` at build time.
 *   - Production: the ops-deployed DER HTTPS origin.
 *
 * Capacitor loads the PWA from `webDir`; the shell's
 * `fetch('/edge-api/*')` calls resolve against `server.url`.
 */
const DER_SERVER = process.env.DER_ANDROID_SERVER_URL
  ?? 'http://10.0.2.2:8085';

const config: CapacitorConfig = {
  appId: 'ug.ac.mak.der.client',
  appName: 'DER',
  // The client build output. Must include `vendor/*.js` (react,
  // react-dom, react-router-dom, @der/app-sdk) — C-UI-5c's import
  // map in index.html resolves app-bundle bare specifiers against
  // those files, so they need to ship inside the APK's web assets
  // too. `npm run build` in client/ runs `build-vendor.mjs` as a
  // prebuild step so this is automatic.
  webDir: '../client/dist',
  server: {
    // DER API origin. Capacitor rewrites relative `/edge-api/*` and
    // `/api/*` requests to hit it directly; session cookies ride
    // through same-origin.
    url: DER_SERVER,
    androidScheme: 'https',
    allowNavigation: [new URL(DER_SERVER).host],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
