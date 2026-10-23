# DER 2.0.0-alpha.1 — Initiative 6: Android Capacitor wrap scaffold

> **Scope:** Begins the 2.0.0 train with the Android client scaffold.
> Capacitor wraps the existing `client/` PWA into an Android project
> under `android/`. Native plugins (biometric unlock, APK auto-update)
> land in subsequent alphas.

**Release label:** `der-2.0.0-alpha.1`
**Git tag:** `der-2.0.0-alpha.1`

## New

- `android/` top-level module with `package.json`, `capacitor.config.ts`,
  README.
- Target SDK 34, min SDK 24, debug keystore. Operators run `npx cap
  add android` + `npx cap sync android` + Android Studio to generate
  native sources.
- ADR-0030 pins: wrap over the PWA (no React Native rewrite);
  sibling to `client/`; alpha.1 is scaffold-only; sideload APK
  (not Play Store).

## Non-goals

- iOS wrap.
- Native biometric unlock / file picker (future alpha).
- CI-driven APK builds (operator-driven for now).
- Play Store distribution.

## Test state

- Native project generation is operator-side; no CI tests added in
  alpha.1. Server + web tests unchanged (1277 / 237 / 153).
