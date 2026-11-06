# DER Android (Capacitor wrap)

Capacitor wrap over the DER client PWA (ADR-0030, extended under
ADR-0037 C-UI-5d). The Android app is a thin Chromium WebView
around the same PWA that runs in browsers; every C-UI-5 capability
(importmap-resolved vendor chunks, Blob-URL dynamic ESM imports
for DER-dispatched apps, Ed25519 WebCrypto signature verify) works
inside the WebView without any native code change.

## C-UI-5 compatibility

| Capability | Chromium requirement | Status |
|---|---|---|
| `<script type="importmap">` in index.html | Chrome 89+ | ✅ shipped |
| Dynamic ESM `import(Blob URL)` for app bundles | Chrome 63+ | ✅ shipped |
| `crypto.subtle.importKey('raw', …, 'Ed25519', …)` | Chrome 113+ | ✅ shipped |
| IndexedDB (`der-apps` store) for bundle cache | Chrome 11+ | ✅ shipped |
| Service worker + PWA cache | Chrome 40+ | ✅ shipped |

Android 10+ ships Chromium ≥ 128 via the system WebView component
(auto-updated through Google Play Services), so the signed-bundle
dispatch pipeline runs unmodified. Operators running
Android < 10 (WebView < 113) will see AppHost surface a
`SIGNING_KEY_UNAVAILABLE` on the first bundle load — the shell
itself stays usable; signed-bundle apps don't execute.

## First-time setup

```sh
cd client && npm run build            # emits dist/vendor/*.js + dist/assets/*
cd ../android && npm install
npx cap add android                   # generates android/android/
npx cap sync android                  # copies client/dist into Android assets
npx cap open android                  # opens Android Studio
```

`npm run build` inside `client/` runs `scripts/build-vendor.mjs` +
`scripts/build-apps.mjs` through its `prebuild` hook, so
`client/dist/vendor/*.js` and every `apps/<name>/dist/bundle.js`
end up in the APK's web assets automatically.

### Pointing at a non-local DER

```sh
# Device on same LAN as the laptop
DER_ANDROID_SERVER_URL=http://192.168.1.42:8085 \
  npx cap sync android

# Production
DER_ANDROID_SERVER_URL=https://der.example.org \
  npx cap sync android
```

`capacitor.config.ts` reads the env var into `server.url`; all PWA
`fetch('/edge-api/*')` calls resolve against it.

## Updating (after a PWA change)

```sh
cd client && npm run build
cd ../android && npm run build        # alias: cap copy + cap sync
```

Debug builds use Capacitor's default debug keystore. Release
signing is operator-driven — see Android's keystore docs +
`./gradlew bundleRelease`.

## Known gaps (future alphas)

- **Native bundle cache (`@capacitor/filesystem`).** Bundles
  currently live in IndexedDB — a filesystem-backed store would
  survive WebView data wipes. Nice-to-have, not required for MVP.
- **Biometric unlock** (`@capacitor/biometric-auth`): deferred.
- **Native file picker** for admin bundle upload: deferred —
  admin-ui is browser-only in alpha.
- **APK auto-update**: deferred to a later release.

See ADR-0030 for scope + non-goals and
`docs/ui/der-client-ui-enhancement-plan.md` §C-UI-5d for the
roll-out plan.
