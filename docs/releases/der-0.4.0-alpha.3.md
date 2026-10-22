# DER 0.4.0-alpha.3 — Phase 03.6a, intelligent DHIS2 compatibility engine

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** replace the Phase 01 fail-closed prefix pin with a dynamic probe-driven compatibility engine that resolves to a per-minor profile for DHIS2 2.41 through 2.44, caches the resolved snapshot to Postgres for offline reboot, and exposes an admin surface at `/edge-api/v1/compat`. **Architecture:** hybrid per [ADR-0004](../architecture/decisions/0004-hybrid-dhis2-edge-emulation.md); engine policy per [ADR-0006](../architecture/decisions/0006-dhis2-compatibility-engine.md).

**Release label:** `der-0.4.0-alpha.3`
**Git tag:** `der-0.4.0-alpha.3`
**Maven artifact:** `ug.ac.mak.der:der-server:0.4.0-SNAPSHOT`
**Pinned DHIS2 reference:** engine-resolved (observed `2.44-SNAPSHOT` in dev)
**Supersedes:** `der-0.4.0-alpha.2` (aggregate writes), `ADR-0002` (fixed pin)

## New in this release

| Area | Deliverable |
|---|---|
| ADR | [ADR-0006](../architecture/decisions/0006-dhis2-compatibility-engine.md) accepted; ADR-0002 marked SUPERSEDED. |
| Schema | `V004__phase03_6a_capability_snapshot.sql` — `dhis2_capability_snapshot` with full probe report + resolved capability JSON + trigger (`STARTUP`, `ADMIN_REFRESH`, `SCHEDULED`, `TEST`). |
| Engine | `ug.ac.mak.der.dhis2.compatibility.*` package: `Dhis2SemanticVersion`, `CapabilityFlags`, `EndpointId`, `EndpointPolicy`, `Dhis2CapabilityProbe`, `Dhis2ProfileRegistry`, `Dhis2CompatibilityEngine`, `CapabilitySnapshotRepository`, `CompatibilityStartup`, four `V2_4x` profile classes. |
| Config | `der.dhis2.compatibility.{min-supported-version, max-tested-version, mode, allow-unsupported, snapshot-ttl-hours, cached-only}`; legacy `pinned-version` / `allow-mismatch` retained as deprecated aliases. |
| Admin REST | `GET /edge-api/v1/compat`, `POST /edge-api/v1/compat/refresh` (ADMIN), `GET /edge-api/v1/compat/history`. |
| Routing | `SystemInfoController` emits the engine's observed version when available. `MetadataSyncService` field lists are now capability-driven. |
| Endpoint matrix | `docs/verification/compatibility/version-endpoint-matrix.csv` captures every DER-relevant endpoint × DHIS2 2.41/2.42/2.43/2.44 status with replacement pointers. |

## Release-note-driven version policy

Each profile encodes the DHIS2 behaviour that matters to DER, derived from the upstream release notes:

| Minor | Highlights encoded in the profile |
|---|---|
| **2.41** | Legacy tracker (`/api/trackedEntityInstances`, `/api/events`, `/api/enrollments`) primary. `/api/tracker/*` present. `ImportSummary` shape. `/api/audits/*` for change history. Tracker programs (`WITH_REGISTRATION`) + single-event programs (`WITHOUT_REGISTRATION`) both supported. |
| **2.42** | Legacy tracker marked DEPRECATED. `TrackerImportReport` becomes the response shape for tracker writes. Biweekly period type added. |
| **2.43** | Audit surface switches to the per-entity change-log API (`/api/tracker/trackedEntities/{tei}/changeLogs`, `/api/tracker/events/{event}/changeLogs`, `/api/tracker/dataValues/changeLogs`); `/api/audits/*` deprecated. `PATCH /api/dataElements/{id}` supported. **2.43.2** clarifies the tracker-program split: metadata exposes `programType=WITH_REGISTRATION` vs `WITHOUT_REGISTRATION`; DER must route event writes differently per type. |
| **2.44** | Legacy tracker endpoints REMOVED. Legacy `/api/audits/*` REMOVED. WebMessage shape evolves to the 2.44 variant. Only `/api/tracker/*` is available for tracker reads/writes; only `/api/tracker/*/changeLogs` for audit. |

See `docs/verification/compatibility/version-endpoint-matrix.csv` for the complete per-endpoint matrix. New DHIS2 minors are added by writing a new `V2XxProfile` class plus a probe fixture and a matrix row.

## Live-verified behaviour (end-to-end)

With DER pointed at DHIS2 2.44-SNAPSHOT on `localhost:8080/dhis`:

1. **Startup probe writes snapshot 1.** `CompatibilityStartup` fires on `ApplicationReadyEvent`, probes 10 endpoints in `/api/*`, parses `/api/system/info`, resolves to `V2_44` profile with the probe overlay, inserts a `dhis2_capability_snapshot` row.
2. **`GET /edge-api/v1/compat`** returns the resolved snapshot: `profile=V2_44`, `trackerApi=TRACKER_ONLY`, `importSummaryShape=TRACKER_IMPORT_REPORT`, `auditSurface=CHANGELOG_API`, `supportedProgramTypes=[TRACKER, EVENT]`, 32 endpoint policies with the right legacy-removed / changelog-present states.
3. **`POST /edge-api/v1/compat/refresh`** (ADMIN) → snapshot 2 written in <2 s, flags flipped atomically.
4. **`GET /edge-api/v1/compat/history?limit=20`** shows both snapshots in reverse order with their trigger types.
5. **`GET /api/system/info`** emits the engine's observed version string rather than a static pin.

Evidence JSON: `docs/evaluation/evidence/phase-03/c25977b/compat/*.json`.

## Offline resilience (runbook; not auto-verified in this release)

- **Central reachable at boot:** engine probes + writes snapshot (above).
- **Central unreachable at boot, prior snapshot exists:** engine WARN-logs, reuses the latest cached snapshot's resolved flags. `/edge-api/v1/compat` answers with the stale snapshot and a WARNING header.
- **Central unreachable at boot, no cached snapshot:** engine throws `Dhis2CompatibilityUnavailableException`. The admin API comes up anyway so an operator can diagnose and re-probe.
- **TTL expiry:** `snapshot-ttl-hours` (default 168) triggers a re-probe on the next startup even if a snapshot already exists.
- **Dev mode:** `der.dhis2.compatibility.cached-only=true` uses the last snapshot without probing.
- **Below floor:** version `< min-supported-version` throws `UnsupportedDhis2VersionException` on startup unless `allow-unsupported=true`.

Scripted verification of the three cold-boot scenarios is Phase 05 (scheduled resync + drift detection).

## Test state

- Server `./mvnw verify`: **400/400 tests PASS**, JaCoCo **100% line + branch** across `ug.ac.mak.der.{web,build,dhis2,dhis2.compatibility,dhis2.compatibility.profiles,dhis2emulator,metadata,security,workflows,workflows.aggregate}`, SpotBugs clean (21 reviewed suppressions in `server/quality/spotbugs-exclude.xml`), Checkstyle clean.
- Flyway V001 + V002 + V003 + V004 applied cleanly against the live local `der` database.
- Client Vitest: unchanged from alpha.2.
- Full gate `scripts/run_all_checks.sh`: PASS, 18 steps.

## Deliberate non-goals (deferred)

- **Event writes** (`POST /api/events`) + **tracker writes** (`POST /api/tracker`) + **GET readbacks** for aggregate / events — Phase 03.6b (alpha.4).
- **Period-format validation** and **category-option-combo validity** — Phase 03.6b.
- **Full program-rule engine** at the edge — Phase 03.6b per [ADR-0007 PROPOSED].
- **Scheduled re-probe + metadata drift detection + conflict review UI** — Phase 05.
- **Custom DHIS2 app hosting** — Phase 05 per [ADR-0005](../architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md).
- **Phase 04 journal worker** draining PENDING → central — unchanged deferral.
- **Playwright E2E / OWASP scan** — opt-in.

## Reproducing

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine && git checkout der-0.4.0-alpha.3
psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql
cp .env.local.example .env.local  # fill in secrets

set -a; source .env.local; set +a
bash scripts/run_all_checks.sh

# Boot and inspect:
java -jar server/target/der-server-0.4.0-SNAPSHOT.jar &
# wait for V004 to apply + startup probe to run
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$DER_BOOTSTRAP_ADMIN_USERNAME\",\"password\":\"$DER_BOOTSTRAP_ADMIN_PASSWORD\"}"
curl -b /tmp/der.c http://localhost:8085/edge-api/v1/compat | jq .
curl -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/compat/refresh | jq .
curl -b /tmp/der.c "http://localhost:8085/edge-api/v1/compat/history?limit=20" | jq '.snapshots[] | {snapshotId, capturedAt, profileName}'
```
