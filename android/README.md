# DER Android (Capacitor wrap)

Capacitor wrap over the DER client PWA (ADR-0030).

Alpha.1 is a scaffold — the `android/` project boots once Capacitor
generates the native sources, and loads the PWA from `../client/dist`.
Native plugins (biometric unlock, native file picker, APK
auto-update) land in subsequent alphas.

## First-time setup

```
cd client && npm run build
cd ../android && npm install
npx cap add android
npx cap sync android
npx cap open android     # opens Android Studio
```

Debug builds use the Capacitor default debug keystore. Release
signing is operator-driven — follow Android's docs for your
keystore + `./gradlew bundleRelease`.

## Updating

After editing the PWA:

```
cd client && npm run build
cd ../android && npm run build
```

See `docs/architecture/decisions/0030-android-capacitor-wrap.md` for
scope + non-goals.
