# ADR-0030 — Android client (Capacitor wrap of DER PWA)

- **Status:** Accepted (Phase 14 / der-2.0.0-alpha.1)
- **Related:** ADR-0011 (PWA shell), ADR-0019 (device identity)
- **Roadmap:** Initiative 6

## Decisions

- **D-AND-1:** Capacitor wrap over the existing `client/` PWA.
  Rejects React Native (would require rewriting the client from
  @dhis2/ui to native primitives) and Flutter (same reason).
- **D-AND-2:** `android/` is a sibling top-level directory, not
  under `client/`. The PWA builds via `npm run build` in `client/`;
  Capacitor copies the output into the Android assets. Keeping the
  wrap at the repo root makes `./gradlew assembleDebug` runnable
  without first `cd client/`.
- **D-AND-3:** Alpha.1 ships the scaffold only — no custom native
  plugins. The PWA inherits its offline behaviour from the Service
  Worker shipped in `client/`. Native integration points (biometric
  unlock, native file picker, APK auto-update) ship in subsequent
  alphas.
- **D-AND-4:** Debug builds signed with the Capacitor default debug
  keystore. Pilot APK signing uses the operator's own keystore —
  documented in the Android README, not auto-wired into CI.
- **D-AND-5:** Target SDK 34 (Android 14). Minimum SDK 24
  (Android 7). The DER pilot hardware floor is Android 10 — the
  minSDK is set lower only to simplify emulator testing.

## Non-goals

- iOS wrap (future minor; not in the roadmap).
- Rewrite of the PWA to React Native / Flutter.
- Native payment integration.
- Google Play Store distribution — DER APKs ship as sideloaded
  artifacts.
- CI builds of the APK — operator-side responsibility until the
  signing story stabilises.
