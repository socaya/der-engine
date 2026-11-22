# DER Android (native)

Native Kotlin + Jetpack Compose client for DER. Per **ADR-0041** this
is the primary Android client for CHW capture, facility-operator
dashboards, supervisor approvals and device admin. The Capacitor wrap
lives at [`../android-capacitor`](../android-capacitor/) and remains
supported for operator read-mostly scenarios.

## Status

**Phase 1 — scaffold.** Compose + Hilt + Navigation wired up; sign-in
+ home screens render; unit tests green. Subsequent phases bring QR
enrol, aggregate + tracker capture, dashboards, approvals and device
admin. See ADR-0041 §Phased delivery for the roadmap.

## Prerequisites

- JDK 17 (project `kotlinOptions.jvmTarget = "17"`)
- Android SDK with platform `android-35` and build-tools 35.x
- Android Studio **Ladybug** (2024.2.1) or newer for the IDE experience
- A DER edge running on a URL this app can reach:
  - Emulator against your laptop: `http://10.0.2.2:8085` (default)
  - Real device on the same Wi-Fi: your laptop's LAN IP, e.g.
    `http://192.168.1.42:8085`
  - Production: the deployed DER HTTPS origin

Override the baked-in URL in `local.properties`:

```properties
der.server.url=http://192.168.1.42:8085
```

## Build + run

```sh
cd android
./gradlew :app:assembleDebug           # build the debug APK
./gradlew :app:installDebug            # install on the connected device/emulator
./gradlew test                         # run all unit tests
./gradlew :app:lintDebug               # Android lint
```

The first build downloads the Gradle wrapper + the Android Gradle
Plugin; expect a few minutes. Subsequent builds are incremental.

### Release build + Play Internal upload

The release build is minified + resource-shrunk by R8. Release
signing uses a keystore configured via Gradle properties — never
checked in.

In `~/.gradle/gradle.properties` (or `android/local.properties` for
a single-machine setup):

```properties
der.release.keystore=/absolute/path/to/der-android.jks
der.release.keystorePassword=...
der.release.keyAlias=der-android
der.release.keyPassword=...
```

Then produce an Android App Bundle for Play:

```sh
./gradlew :app:bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` to the Play Console's **Internal testing** track.
If any release keystore property is missing, the release build falls
back to **debug signing** so CI stays green on machines without the
production key.

## DER concepts (non-negotiable)

Per ADR-0041 the Android client **must** strictly implement DER
concepts, not generic Android patterns:

- **Inbuilt DER Data Entry** (`feature/dataentry`) — aggregate
  dataset capture for HMIS-style reporting.
- **Inbuilt DER Capture** (`feature/capture`) — tracker + event
  capture for individual-level programs, with client-side program
  rules.
- **Distributed workflows across service points**
  (`feature/workflow`) — Reception → Triage → Clinician → Lab →
  Pharmacy → Exit routing. Tiles are gated by the server's
  workflow `READY/BLOCKED/PENDING` semantics; only steps the
  current user's service-point role can perform are enabled.
- **Offline-first journal mirror** (`core/offline` + `core/sync`) —
  every capture writes locally first; a WorkManager chain drains
  to the edge when online.

## Module layout

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

## Screens → web-client parity

| Web client screen (`client/src/screens/`) | Android module |
|---|---|
| `SignIn`, `signin/*` | `app/ui/signin` |
| `DerHome` | `app/ui/home` (Phase 3 → feature/dashboard) |
| `AggregateDatasetPicker`, `AggregateEntry` | `feature/dataentry` |
| `EventList`, `EventNew`, `ProgramPicker` | `feature/capture` |
| `TrackerSearch`, `TrackerDashboard`, `EnrollmentCreate` | `feature/capture` |
| `CaptureRunList`, `CaptureRunForm`, `ScheduledEvents` | `feature/workflow` |
| `SyncStatus`, `NetworkStatus`, `Dhis2Status`, `RecentWork` | `feature/dashboard` |
| `OfflineQueue`, `Drafts` | `feature/capture` + `core/offline` |
| `SubmittedReview` | `feature/approvals` |
| `SessionDetails`, `DevicePeers` | `feature/devices` |

## Testing

- **Unit:** `./gradlew test` — JUnit 4 + MockK + Turbine.
- **Compose UI (Phase 2+):** `./gradlew :app:connectedDebugAndroidTest`
- Each feature module owns its own `src/test` + `src/androidTest`
  tree. The app module hosts cross-module integration tests.

## Related

- ADR-0041 `docs/architecture/decisions/0041-native-android-client.md`
- ADR-0030 (Capacitor wrap, now scope-limited to admin read-mostly)
- ADR-0036 (capture-form API — the backend contract this client
  consumes)
- ADR-0019 (edge device management — QR enrol pipeline)
