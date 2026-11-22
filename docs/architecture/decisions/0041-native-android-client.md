# ADR-0041: Native Android client (Kotlin + Jetpack Compose)

- Status: ACCEPTED
- Date: 2026-11-22
- Deciders: socaya
- Supersedes (scope-limited): ADR-0030 (Capacitor wrap) for CHW capture
  on real devices. ADR-0030 remains ACCEPTED for operator/supervisor
  read-mostly scenarios where a WebView is adequate.
- Related: ADR-0036 (capture form API), ADR-0019 (device management),
  ADR-0004 (offline-first journal), ADR-0039 (DER Browser Edge
  continuity).

## Context

The DER client-ui ships as a React PWA and — via ADR-0030 — a
Capacitor WebView wrap for Android. That wrap is adequate for admins
and supervisors who mostly *read* (dashboards, approvals, queues),
but field CHW capture on low-end Android has repeatedly surfaced
problems the WebView cannot fix:

- **Background sync.** Capacitor can't run reliable background work
  when the WebView is paused; `WorkManager` drains require native
  Kotlin code on the main process.
- **Capture reliability.** Form-field rendering, long sessions,
  memory pressure under 2 GB RAM, and long-running GPS/camera
  sessions behave poorly in a WebView compared to Compose.
- **Hardware integration.** Biometric unlock, strong device
  attestation, native QR-scan performance, and health-grade input
  (PIN pads, offline-first keyboards) each need native surfaces.
- **Update story.** The Capacitor wrap couples to Chromium versions
  that lag on Android < 10; the signed-bundle dispatch pipeline from
  ADR-0037 silently degrades on older WebView.

The DHIS2 ecosystem has already made this call: the official DHIS2
Android Capture app is native Kotlin for the same reasons. DER CHW
clients run alongside that ecosystem, so we match the idiom.

## Decision

Build a **native Android client** at `/android` in Kotlin + Jetpack
Compose. The Capacitor wrap moves to `/android-capacitor` and remains
supported for read-mostly operator/supervisor use.

### Coexistence rules

| User role | Primary client | Fallback |
|---|---|---|
| CHW doing capture | **Native** (`/android`) | Web PWA in Chrome |
| Facility operator | **Native** dashboard | Admin-UI in browser / Capacitor wrap |
| Supervisor / approver | **Native** | Admin-UI in browser |
| Admin / ops | Admin-UI in browser | Capacitor wrap |

Both artifacts talk to the same DER edge via `/edge-api/v1/*`. The
native client holds its own local Room database (mirror of the
journal); the Capacitor wrap reuses the PWA's IndexedDB (DBE, see
ADR-0039). No shared on-device state between them.

### Stack

- **Language:** Kotlin 2.0 with KSP.
- **Build:** Gradle 8.x with Kotlin DSL and the
  `gradle/libs.versions.toml` version catalog.
- **UI:** Jetpack Compose + Material 3. A DER theme module mirrors
  the canonical tokens from `apps/app-sdk/src/tokens.css`
  (`--der-primary` → `MaterialTheme.colorScheme.primary`, etc.).
- **Navigation:** Compose Navigation with type-safe routes.
- **DI:** Hilt.
- **Networking:** Retrofit + OkHttp + kotlinx-serialization against
  the existing `/edge-api/v1/*` surface; no new server contracts are
  introduced by this ADR.
- **Persistence:** Room (SQLite) for the local journal mirror;
  Jetpack DataStore for prefs and session.
- **Background work:** WorkManager chains for drain → pull →
  reconcile.
- **QR enrol:** ML Kit Barcode Scanning (bundled).
- **Biometrics:** AndroidX Biometric.
- **Testing:** JUnit + Turbine + Compose UI tests + Paparazzi for
  deterministic screenshot tests.

### DER concepts the Android client MUST implement

The native client is not a generic "forms app" — it enforces DER
concepts that already exist on the server. These are non-negotiable:

1. **Inbuilt DER Data Entry app** (`feature/dataentry`). Aggregate
   dataset entry for monthly/quarterly reporting (HMIS, DHIS2
   dataset forms). Honours the DER data-entry contract exposed at
   `/edge-api/v1/aggregate/*`. No external DHIS2 app launch — the
   Compose UI *is* the Data Entry app on Android.
2. **Inbuilt DER Capture app** (`feature/capture`). Tracker + event
   capture for individual-level programs (TEI search, enrol, event
   capture, stage advance). Honours the DER capture-form API
   (ADR-0036). Program rules run client-side via the ported rule
   engine. No external DHIS2 Capture app launch.
3. **Distributed workflows across service points**
   (`feature/workflow`). DER's workflow module (ADR-0022…ADR-0026,
   §2.3.58..§2.3.104) routes a patient encounter through ordered
   service-point steps: Reception → Triage → Clinician → Lab →
   Pharmacy → Exit (names vary per clinic). The Android client:
   - Fetches the clinic's workflow catalogue + the current user's
     service-point role.
   - Shows only the tiles the current step permits (readiness ≠
     READY blocks downstream steps).
   - Enforces the "queue blocked / ready / pending predecessor"
     semantics the server already exposes under `workflowQueue`.
   - Records who did which step as an attributable action — same
     audit shape as the web client.
   - Supports referrals: a Supervisor on the Android client can
     accept/reject a referral the same way the web supervisor does.
4. **Offline-first with journal mirror** (`core/offline` +
   `core/sync`). Every capture writes locally to a Room-backed
   journal that mirrors the server's journal row shape; a
   WorkManager chain drains to `/edge-api/v1/journal/drain` when
   connectivity returns, pulls deltas via
   `/edge-api/v1/sync/pull`, and surfaces conflicts to the
   user with DER's standard resolution choices.
5. **Role-aware shell**. CHW / facility operator / supervisor /
   admin see role-appropriate top-level routes. The Android role
   derives from the authenticated session, not device profile —
   same model as the web client.

### Module layout

```
android/
  app/                    # Application + MainActivity + root nav
  core/
    data/                 # Retrofit services, Room, DataStore, repos
    domain/               # Pure Kotlin models + use-cases
    design/               # DER Material 3 theme (tokens.css mirror)
    sync/                 # WorkManager drain → pull → reconcile
    offline/              # Journal mirror, conflict replay
    auth/                 # Session, QR enrol, biometric unlock
  feature/
    dataentry/            # DER Data Entry (aggregate datasets)
    capture/              # DER Capture (tracker + events)
    workflow/             # Service-point workflow routing + run enforcement
    dashboard/            # Facility-operator read-mostly views
    approvals/            # Supervisor workflow queue + referrals
    devices/              # Enrol + admin tasks
    settings/             # Local config, server URL, about
```

The web client's screen taxonomy (`client/src/screens`) maps to
Compose screens 1:1 under the matching feature module. Data Entry
and Capture are separate modules so each can carry its own dataset
of program rules and offline validators without one dominating the
other.

### Phased delivery

Each phase lands end-to-end (building, running, tests green) before
the next starts; no half-finished scaffolding on main.

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 | Scaffold + CI + sign-in placeholder | `./gradlew :app:assembleDebug` succeeds; unit tests green; SignIn renders |
| 2 | QR enrol + session round-trip | Device appears in admin-ui enrolment queue; approved device signs in |
| 3 | Shell nav + role routing | CHW / operator / supervisor / admin see role-appropriate top nav |
| 4 | DER Data Entry MVP | Aggregate form entry → Room → drain to DER → row visible in Data overview |
| 5 | DER Capture MVP | Tracker TEI search, enrol, stage new; rule engine port |
| 6 | Distributed workflow enforcement | Service-point routing: tiles gated by current step; blocked/ready semantics match server |
| 7 | Dashboard + sync read views | SyncStatus, NetworkStatus, Dhis2Status, RecentWork at web parity |
| 8 | Approvals + referral inbox | Supervisor can approve/reject; referral accept at next service point; audit events |
| 9 | Device admin + settings | Server URL, logs, diagnostics, clear local data |
| 10 | Hardening + release | Biometric unlock, signed release, Play Internal track |
| 11 | Beta with real devices | 5+ devices in pilot site; crash-free session rate ≥ 99% |

### Non-goals (for this ADR)

- Replacing admin-ui in the browser.
- Running on iOS — out of scope for the foundation release.
- Shared code between Compose and the web client via KMP — considered
  but rejected for now; the capture logic footprint doesn't yet
  justify the KMP build complexity.
- A second native binary for the admin surface — admins stay on
  the web admin-ui.

## Consequences

**Positive**

- Field-grade capture UX on low-end Android, with proper offline,
  background sync, biometrics, and camera/GPS integration.
- Idiom familiar to teams who already operate the DHIS2 Android
  Capture app.
- Decouples CHW capture from WebView Chromium minimums, so older
  phones (Android 7+) can still capture data even without a
  C-UI-5-capable WebView.

**Negative**

- Second codebase in a new language. Requires Android tooling in
  CI, dedicated Compose test harness, and Google Play release
  pipeline work.
- Duplicate screens: every new UX change is now two edits unless we
  invest in shared contract tests. Mitigated by (a) keeping
  `/edge-api/v1/*` as the single source of truth and (b) screenshot
  tests on both clients driven from the same backend fixtures.
- 3–6 months to full web parity. Phased delivery keeps main stable
  throughout.

## Links

- DHIS2 Android Capture app (reference idiom):
  <https://github.com/dhis2/dhis2-android-capture-app>
- Web client screen inventory: `client/src/screens/`
- Capacitor wrap predecessor: ADR-0030, `/android-capacitor/README.md`
