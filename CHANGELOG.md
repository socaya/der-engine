# Changelog

All notable changes to the DHIS2 Edge Runtime (DER) are recorded in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
Release labels are of the form `der-X.Y.Z` with a matching annotated git tag.

The DHIS2 upstream release is **not** the DER version. The pinned reference DHIS2 patch
is recorded separately per release in `docs/releases/`.

## [Unreleased]

### Added

- Custom DHIS2 app hosting (ADR-0005 finalized → alpha.6) and Phase 04 journal worker drain (der-0.5.0-alpha.1) not yet started.

## [0.4.0-alpha.5] — unreleased

Phase 05 — scheduled sync + drift detection + conflict-review API
(see `docs/releases/der-0.4.0-alpha.5.md`).

- Added: ADR-0008 — Quartz Postgres JobStore drives three durable jobs
  (METADATA_SYNC_FULL / COMPAT_PROBE_REFRESH / DRIFT_SNAPSHOT) with
  configurable cron + `scheduled_job_run` sidecar.
- Added: ADR-0009 — conflict-review admin REST surface over the
  operation journal (list / resolve / re-journal) with ADMIN role gate.
- Added: V006 migration — scheduled_job_run, drift_snapshot, journal
  supersedes + resolved_* columns.
- Added: `ug.ac.mak.der.scheduler.*` — SchedulerConfig + three Jobs +
  ScheduledJobRepository.
- Added: `ug.ac.mak.der.sync.drift.*` — DriftDetectionService +
  DriftSnapshotRepository.
- Added: `ug.ac.mak.der.workflows.journal.ConflictReviewService`.
- Added: Admin REST — SyncJobsController, DriftController,
  ConflictReviewController.
- Changed: `MetadataSyncService` now also pulls COC + program-stages
  (+ PSDE) + tracked-entity-attributes + program-rules (+ actions);
  constructor gains `ExtendedMirrorRepository` dependency.
- Changed: `OperationJournalRepository` adds `findByState(...)`;
  `findPending(...)` delegates.
- Server tests: 681 pass. SpotBugs clean (28 reviewed suppressions).

[0.4.0-alpha.5]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.5

## [0.4.0-alpha.4] — unreleased

Phase 03.6b — event/tracker writes + readbacks + full edge program-rule engine
(see `docs/releases/der-0.4.0-alpha.4.md`).

- Added: ADR-0007 — server-impacting program-rule actions execute in a lean
  Java engine inside DER (ASSIGN, SHOWERROR, SHOWWARNING, WARNINGONCOMPLETE,
  ERRORONCOMPLETE, SETMANDATORYFIELD); UI-only actions deferred to the
  device-client via `@dhis2/rules-engine`.
- Added: V005 migration — mirror additions (COC, program stage, program-stage
  data elements, tracked-entity attributes, program rules + actions) and
  edge write tables (TEI, enrollment, event, event-data-value). Default
  COC `HllvX50cXC0` seeded automatically.
- Added: `ug.ac.mak.der.rules.*` — hand-written lexer + parser + evaluator
  for DHIS2 program-rule expressions; sealed AST hierarchy; `D2Functions`
  with 25 functions covering hasValue/zing/oizp/zpvc/dates/strings/counts.
- Added: `PeriodParser` — capability-driven DHIS2 period code parser
  (strict ISO `uuuuMMdd` for DAILY). Supports every DHIS2 2.x period type.
- Added: `CategoryOptionComboValidator` — mirror-backed with default-COC fallback.
- Added: `EventService` + `EventRepository` + `EventsController` + `EventsReadController`
  — accepts both `POST /api/events` and `POST /api/tracker` envelopes;
  response shape driven by `capabilities().importSummaryShape()`.
- Added: `GET /api/dataValueSets` branch on `DataValueSetsController` for
  aggregate read-back.
- Added: `ExtendedMirrorRepository` for Phase 03.6b entity types.
- Changed: tracker-program-vs-event-program split per 2.43.2 reflected in
  `CapabilityFlags.supportedProgramTypes()` + validated by `EventService`.
- Live-verified: aggregate GET returns alpha.2 writes with full DHIS2 shape;
  event GET returns empty shape before mirror population; metadata sync
  continues to work (874 rows).
- Server tests: 470 pass; JaCoCo at 100% for prior-release packages;
  Phase 03.6b packages carry a documented alpha coverage waiver (raised
  back to 100% at stable `der-0.4.0`).
- SpotBugs clean (25 reviewed suppressions).

[0.4.0-alpha.4]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.4

## [0.4.0-alpha.3] — unreleased

Phase 03.6a — intelligent DHIS2 compatibility engine
(see `docs/releases/der-0.4.0-alpha.3.md`).

- Added: ADR-0006 — dynamic compatibility engine with cached capability snapshot;
  SUPERSEDES ADR-0002 (fixed pin).
- Added: V004 migration — `dhis2_capability_snapshot` with full probe report +
  resolved capability JSON + trigger (`STARTUP`, `ADMIN_REFRESH`, `SCHEDULED`, `TEST`).
- Added: `ug.ac.mak.der.dhis2.compatibility.*` — `Dhis2SemanticVersion` parser,
  `CapabilityFlags` with per-endpoint `EndpointPolicy` map, `Dhis2CapabilityProbe`
  (10-endpoint battery), `Dhis2ProfileRegistry`, four `V2_4x` profiles encoding
  real DHIS2 release-note differences (tracker API, ImportSummary vs
  TrackerImportReport, audit vs changelog surface, tracker-program split
  per 2.43.2, legacy endpoint removal on 2.44).
- Added: admin REST — `GET /edge-api/v1/compat`, `POST /edge-api/v1/compat/refresh`
  (ADMIN), `GET /edge-api/v1/compat/history`.
- Added: `docs/verification/compatibility/version-endpoint-matrix.csv` — the full
  per-endpoint × per-minor status matrix driving the profiles.
- Added: `CompatibilityStartup` fires on `ApplicationReadyEvent`; probe outcomes
  are persisted even when central is unreachable and a cached snapshot exists.
- Changed: `SystemInfoController` reflects the engine's observed version;
  `Dhis2Properties.Compatibility` records the ADR-0006 config shape with a
  `legacy(pinned, allowMismatch)` factory for the Phase 01 call sites.
- Live-verified: boot → probe → snapshot 1 → refresh → snapshot 2 → history
  returns both; endpoint matrix on 2.44-SNAPSHOT correctly reports legacy TEI /
  events / audits as REMOVED and changelog endpoints as PRESENT.
- Server tests: 400/400 PASS, JaCoCo 100% line + branch, SpotBugs clean.
- Client unchanged.

[0.4.0-alpha.3]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.3

## [0.4.0-alpha.2] — unreleased

Phase 03.5 — aggregate dataValueSets write path + durable journal rows
(see `docs/releases/der-0.4.0-alpha.2.md`).

- Added: V003 migration — `aggregate_data_value` (compound-key unique, optimistic
  `value_version`) + `operation_journal` (full state machine, Phase 03.5 only
  writes PENDING).
- Added: `ug.ac.mak.der.workflows.aggregate` package — `AggregateDataValue`,
  `OperationJournalEntry`, repositories, `AggregateDataValueService` (atomic
  value + journal write under `@Transactional`).
- Added: `POST /api/dataValueSets` emulator with DHIS2 2.44 `ImportSummary` shape.
- Changed: `SyncStatusService` returns real `LOCALLY_COMMITTED` for persisted
  aggregate rows; placeholder `UNKNOWN` for everything else.
- Live-verified: upsert bumps `value_version`, type-mismatch rejection returns
  DHIS2-shape conflicts, journal rows accumulate as PENDING.
- Server tests: 291/291 PASS, JaCoCo 100% line + branch, SpotBugs clean.
- Client unchanged (branch threshold stays 90% until stable 0.4.0).

[0.4.0-alpha.2]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.2

## [0.4.0-alpha.1] — unreleased

Phase 03c — DER device-client on @dhis2/ui + @dhis2/app-runtime
(see `docs/releases/der-0.4.0-alpha.1.md`).

- Added: `main.tsx` wires `DataProvider` → `BrowserRouter` → `App`.
- Added: `AuthProvider` + `RequireAuth` + `useAuth` hook; auth state
  machine with INITIAL / ANONYMOUS / AUTHENTICATED / EDGE_DOWN.
- Added: `src/api/edgeApi.ts` — fetch wrapper with typed `EdgeApiError`.
- Added: `SyncStatusPill` — never emits "Synchronised" at Phase 03.
- Added: `SignIn`, `SessionDetails`, `Launcher`, `RecentWork`,
  `MetadataBrowser`, `EdgeConnectionError` screens.
- Added: `App.tsx` route table covering DC-01/02/03/04/17 chrome/18 and
  the five read-only metadata lanes.
- Added: ADR-0005 PROPOSED — Hosting custom DHIS2 apps on the edge
  (motivated by Uganda MoH eRegister); decision deferred to Phase 05.
- Client Vitest: 59/59; V8 100% line/function/statement, 92.25%
  branch (threshold temporarily 90% for alpha; documented in
  `client/vite.config.ts`).
- Server unchanged from alpha.0.

[0.4.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.1

## [0.4.0-alpha.0] — unreleased

Phase 03b — DHIS2 Web API emulator (read-only) + metadata mirror
(see `docs/releases/der-0.4.0-alpha.0.md`).

- Added: ADR-0004 — hybrid architecture; supersedes ADR-0003.
- Added: V002 migration — metadata_snapshot + five mirror tables.
- Added: `ug.ac.mak.der.metadata` package — records + repositories + `MetadataSyncService`.
- Added: `ug.ac.mak.der.dhis2emulator` package — `SystemInfoController`,
  `MeController`, `MetadataListController` serving DHIS2-shape read endpoints.
- Added: `POST /edge-api/v1/sync/metadata` admin endpoint.
- Added: `Dhis2ReferenceClient.fetchJson(path)` generic authenticated GET helper.
- Removed: Option-A artefacts (`deployment/dhis2/`, `WorkflowAppsController`, `Dhis2AppCatalogue`).
- Verified live: 874 metadata records pulled from DHIS2 2.44-SNAPSHOT and
  served from DER's `/api/*` to the DER session cookie.
- Server tests: **247/247 pass**; JaCoCo **100% line + branch**.

[0.4.0-alpha.0]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.0

## [0.3.0] — unreleased

Phase 02 — edge identity, offline sessions, authorisation (see `docs/releases/der-0.3.0.md`).

- Added: `database/migrations/V001__phase02_identity.sql` with `edge_node`,
  `edge_configuration`, `edge_user`, `edge_role`, `edge_credential`,
  `edge_session`, `scope_assignment`, `security_audit`. Flyway now runs on boot.
- Added: `ug.ac.mak.der.security` package — `EdgeUser`, `EdgeSession`,
  `EdgeRole`, `PasswordHasher` (Argon2id), `SessionIssuer`, `RateLimiter`,
  `AuthenticationService`, `SessionValidationService`, `BootstrapAdminProvisioner`,
  `SessionCookieAuthenticationFilter`, `SecurityConfig`.
- Added: `AuthController` and `ProvisioningController` endpoints at
  `/edge-api/v1/auth/*` and `/edge-api/v1/provisioning/*`.
- Added: `security_audit` append-only logger; writes on every sign-in, provisioning
  and bootstrap event.
- Added: `deployment/tls/README.md` self-signed-cert runbook (not enforced at Phase 02).
- Added: `.env.local.example` template; `.env.local` gitignored.
- Changed: `VERSION`, `pom.xml`, both `package.json` → `0.3.0-SNAPSHOT`.
- Changed: `application.yml` reads datasource + Flyway + security config from
  the environment; test profile excludes DB autoconfig.

[0.3.0]: https://github.com/socaya/der-engine/releases/tag/der-0.3.0

## [0.2.0] — unreleased

Phase 01 — DHIS2 compatibility and architecture (see `docs/releases/der-0.2.0.md`).

- Added: ADR-0003 (Option A — full local DHIS2 instance), ACCEPTED. ADR-0002
  (DHIS2 version pin) moved from PROPOSED to ACCEPTED with a documented
  deviation to `2.44-SNAPSHOT`.
- Added: `ug.ac.mak.der.dhis2` package — `Dhis2Version`, `Dhis2Properties`,
  `Dhis2ReferenceClient`, `Dhis2CompatibilityGuard` and Spring glue, with a
  fail-closed version admission policy.
- Added: `GET /edge-api/v1/dhis2/compatibility` diagnostic endpoint.
- Added: `docs/verification/compatibility/supported-matrix.csv` listing the
  DHIS2 Web API routes DER depends on, with Phase mapping and expected
  status contracts.
- Added: `scripts/verify_dhis2_reference.py` — live probe that walks the
  matrix and writes `docs/evaluation/evidence/phase-01/<commit>/compatibility/*.json`.
- Added: `deployment/dhis2/README.md` and `deployment/postgresql/der-db-bootstrap.sql`
  for the Option A install path (Postgres 17 + Tomcat 10 + DHIS2 2.44-SNAPSHOT).
- Changed: `VERSION`, `pom.xml`, both `package.json` → `0.2.0-SNAPSHOT`;
  Maven `dhis2.reference.version` property set to `2.44-SNAPSHOT`.
- Changed: traceability-matrix status flipped to `in-progress` for FR-04-04,
  FR-04-10, FR-12-04, NFR-22, NFR-35.

[0.2.0]: https://github.com/socaya/der-engine/releases/tag/der-0.2.0

## [0.1.0] — unreleased

Phase 00 baseline: repository governance, FR/NFR/screen registers, version tooling,
quality gates and local-evidence runner. **No DHIS2 integration, authentication,
journal or synchronisation is implemented at this release.**

- Added: root `VERSION` file as single source of truth for the DER release.
- Added: `CHANGELOG.md` and `docs/releases/` directory.
- Added: `scripts/check_version_consistency.py` and `scripts/release.sh`.
- Added: `scripts/check_registers.py` validating the pre-existing authoritative
  design baseline in `docs/`: 176 FRs in `docs/requirements/source-functional-register.csv`,
  35 NFRs in `docs/requirements/source-nonfunctional-register.csv`, 54 screen specs
  in `docs/ui/screens/` and the full traceability matrix in
  `docs/verification/traceability-matrix.csv`.
- Added: Maven wrapper, JaCoCo, SpotBugs, Checkstyle, OWASP dependency-check,
  Flyway, Postgres driver and Testcontainers-Postgres (test scope) on the server.
- Added: ESLint, Prettier, Vitest V8 coverage, React Testing Library, Playwright and
  axe-core on both frontends.
- Added: `scripts/run_all_checks.sh` producing an evidence bundle under
  `docs/evaluation/evidence/phase-00/<commit>/`.
- Changed: `GET /edge-api/v1/system/health` now returns `version`, `commit`,
  `buildTime`, `dhis2Reference.version` (pinned patch, `unknown` until Phase 01)
  and `dhis2Integrated=false`.
- Changed: honest root `README.md` and ADR template introduced.

[Unreleased]: https://github.com/socaya/der-engine/compare/der-0.1.0...HEAD
[0.1.0]: https://github.com/socaya/der-engine/releases/tag/der-0.1.0
