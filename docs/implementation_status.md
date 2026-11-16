# DER Implementation Status

> **Source of truth** for which FRs / NFRs are shipped vs. partial /
> scaffolded / design-only / pending. Supersedes the stale `status`
> column in `docs/verification/traceability-matrix.csv` (which was
> never updated as alphas landed).

**Last updated:** 2026-11-15 · DER-APPS-DHIS2-001 Phases 1–5 wrap
(see §"DHIS2 app support initiative" below). Prior snapshot
2026-10-23 for `der-2.0.3-alpha.3`.
**Scope:** All 211 requirements (176 FR + 35 NFR) from
`docs/requirements/source-functional-register.csv` and
`source-nonfunctional-register.csv`.

## Legend

| Status | Meaning |
|---|---|
| ✅ **DONE** | Code + tests shipped; feature usable end-to-end. |
| 🟡 **PARTIAL** | Code shipped but with explicit non-goals / deferred items flagged in the owning release note. |
| 🧱 **SCAFFOLD** | Module / package exists but core logic is a stub. |
| 📋 **DESIGN-ONLY** | ADR exists, no code. |
| ❌ **PENDING** | Source-register entry with no code and no ADR. |

## Summary (verified against actual code at 2.0.2-alpha.2)

### UI screens (`docs/verification/screen-traceability.csv`)

| Status | Count |
|---|---:|
| ✅ DONE | 54 / 54 |

All 54 UI screens shipped — 37 as standalone routed components with
tests, 17 as bundled sub-states of siblings per the Phase 06 1.0.0
gate decision (G5). CSV refreshed in alpha.1 to reflect reality.

### FR / NFR requirements (`docs/verification/traceability-matrix.csv`)

| Status | Count | % | CSV status |
|---|---:|---:|---|
| ✅ DONE (verified) | 175 | 83% | `done` |
| 🟡 PARTIAL (specific gap documented) | 36 | 17% | `in-progress` |
| ❌ PENDING | 0 | 0% | `pending` |

### Combined scorecard

| Dimension | DONE | Total | % |
|---|---:|---:|---:|
| UI screens | 54 | 54 | 100% |
| FR / NFR | 174 | 211 | 82% |
| **All requirements** | **228** | **265** | **86%** |

## Alpha.1 of der-2.0.3 — tracker lifecycle

V027 migration + three new JDBC repositories + three new REST
controllers extend the TEI-only tracker surface (shipped in 2.0.1)
to the full lifecycle:

- `der.edge_enrollment` — FK to V025 `tracked_entity`.
- `der.edge_tracker_event` — FK to `edge_enrollment`, nested
  `dataValues` JSONB, status machine.
- `der.edge_tracker_relationship` — endpoint-existence validated
  at the controller for TEIs, enrollments, events (bidirectional
  flag supported).
- All three persist `created_by` + `stored_by_dhis2_uid` (ADR-0032
  attribution engine) + `version` monotonic counter.
- Controllers reject orphan creations with 400 + typed error codes.

**Three FRs flip to DONE** after live-verification against local
DHIS2 2.44-SNAPSHOT:

- **FR-08-06 Preserve permitted TEI/event relationships with
  referential integrity.** `edge_tracker_relationship` + endpoint
  validation.
- **FR-08-10 Synchronise entity/enrolment/event/relationship
  dependencies in safe order.** FK CASCADE + controller orphan
  rejection + by-enrollment/by-tei queries preserve the graph.
- **FR-08-12 Retain actor, operation identity and locally committed
  workflow history.** Full audit trail across all three tables.

Live-verified: TEI → enrollment → event → relationship chain
succeeds; orphan enrollment rejected with `TEI_NOT_FOUND`; storedBy
populated from mapping engine.

## Alpha.2 of der-2.0.3 — metadata drift surface

New `MetadataDriftDetector` service inspects pending journal entries
for references to metadata UIDs that no longer resolve in the local
mirror. Three FRs flip to DONE:

- **FR-05-10 Identify pending operations made against changed or
  incompatible definitions.** `evaluate()` returns a `DriftReport`
  with per-ref `{kind, field, uid}`. Operator reads via
  `GET /edge-api/v1/metadata/drift/pending`.
- **FR-05-11 Prevent silent reinterpretation of affected pending
  changes.** `POST /edge-api/v1/admin/ops/journal/{opId}/quarantine`
  moves drifted entries to `CONFLICT_REVIEW` with reason persisted
  on `last_error`; drain worker already skips that state so no
  silent retry.
- **FR-05-12 Present missing dependencies, mismatches and effective
  local configuration.** `GET /edge-api/v1/metadata/diagnostics`
  single-call summary of per-kind mirror row counts + current
  drift totals.

Live-verified against local DHIS2 2.44-SNAPSHOT Sierra Leone demo:
484 orgUnits, 358 dataElements, 31 programs, 1 TET mirrored; 0
pending-journal drift at probe time. Evidence:
`docs/evaluation/evidence/alpha.6-metadata-drift/`.

## Alpha.3 of der-2.0.3 — admin UI served on port 8085

ADR-0033: the admin UI SPA now runs same-origin as the DER API. One
process, one port.

- `AdminUiController` serves `/admin/**` from a configurable dist
  directory (`der.admin-ui.dist`, default `admin-ui/dist`).
- Vite build takes `DER_ADMIN_UI_BASE=/admin/` so asset URLs are
  prefixed; dev server (`npm run dev` on 5173) stays unchanged.
- SPA fallback: unmatched `/admin/<deep-link>` returns `index.html`
  so react-router handles it.
- Assets get `max-age=31536000, immutable` (Vite content hashes);
  HTML stays `no-cache`.
- `GET /admin/**` is `permitAll` in Spring Security so the login
  screen renders; data calls remain session-gated. Non-GET on
  `/admin/**` → 401 (static-only surface).
- Missing dist → 503 `ADMIN_UI_NOT_BUILT` with a clear operator
  message.
- 8 `AdminUiControllerTest` cases + live-verified against the real
  dist bundle.
- Evidence: `docs/evaluation/evidence/alpha.7-admin-ui-served/`.

## Alpha.2 (this release — der-2.0.2-alpha.2)

Closes 5 items to DONE:

- **FR-16-07 TOTP at-rest encryption.** New `SecretEnvelope`
  (AES-256-GCM) wraps TOTP secrets on enrol; `MfaController` opens on
  verify. Operator-provided key via `der.security.secret-key`.
  Backwards-compatible with existing plaintext secrets. 8 envelope
  tests + 6 MFA controller tests green.
- **FR-14-06 Database recovery.** `RestoreWorker` + SHA-256 manifest
  verification + reconciliation checkpoint runbook documented in
  `docs/operations/03-backup-and-recovery.md`.
- **FR-14-07 Backup.** `BackupWorker` pg_dump captures journal +
  metadata + working state in a single transactional snapshot;
  SHA-256 recorded in `backup_run`.
- **FR-14-08 Restore.** `pg_restore --clean --if-exists` +
  `POST /edge-api/v1/admin/ops/journal/replay` re-anchors the sync
  cursor to establish the reconciliation checkpoint.
- **FR-14-09 Storage alarms.** New `StorageHealthProbe` +
  `StorageAdmissionInterceptor` on `/edge-api/**`. Warn/reject
  thresholds (`der.storage.warn-bytes`, `.reject-bytes`); writes return
  HTTP 507 `STORAGE_FULL_REJECT` when below reject. New endpoint
  `GET /edge-api/v1/system/storage` for operator readback. 12 tests
  across probe + interceptor.

Additional alpha.2 work:

- **ADR-0032 + V026 — client-user attribution engine (foundation).**
  New table `der.edge_user_dhis2_mapping` + `operation_journal`
  column `captured_by_dhis2_uid`. Java surface:
  `EdgeUserDhis2MappingRepository`, `CapturedByResolver`,
  `UserAttributionController` under `/edge-api/v1/admin/users/`.
  7 unit tests green. **Alpha.3** will wire `storedBy` stamping
  into `JournalPublisher` + aggregate / tracker submission paths.
- **Live-boot stabilization.** Removed `@ConditionalOnBean(JdbcTemplate.class)`
  / `@ConditionalOnMissingBean(CentralReferralSearchClient.class)` from 10
  repository + 1 fallback component (classic Spring Boot anti-pattern
  that misfires on `@Component`-scanned beans). Server now boots in
  1.8s against local Postgres 17 + DHIS2 2.44-SNAPSHOT. Evidence:
  `docs/evaluation/evidence/alpha.2-live/`.

## Alpha.3 (this release — der-2.0.2-alpha.3)

- **ADR-0032 completion — storedBy stamping in JournalPublisher.**
  `ReferralPayloadEncoder` resolves the captured-by DHIS2 username via
  `CapturedByResolver` and stamps `storedBy` on aggregate dataValueSets
  (envelope + every `dataValues[]`), events, enrollments, and nested
  enrollments/events under tracker entities. 6 attribution unit tests
  green. Lenient fallback: when no mapping exists the payload is
  untouched (service account's identity used by DHIS2). Evidence:
  `docs/evaluation/evidence/alpha.3-attribution/`.
- **FR-16-02 User traceability** → DONE (was PENDING).
- **FR-16-03 Session binding** → DONE (was PARTIAL; session cookie
  now cryptographically carries through to central's import summary
  via `storedBy`).
- **Custom app engine upgrades (ADR-0005 completion).**
  * `/dhis-web-<key>` (no slash) → 301 to `/`.
  * `/dhis-web-<key>/` → serves `index.html`.
  * `/dhis-web-<key>/manifest.webapp` served from DB-stored manifest JSON.
  * Disabled apps return 404.
  * Correct MIME for `.svg`, `.woff2`, `.woff`, `.mjs`.
  * HTML stays no-cache; static assets get `max-age=3600, public`.
  * New `GET /api/apps` returns DHIS2-compat array so stock
    `@dhis2/app-runtime` clients discover DER-hosted apps the same
    way as central-hosted ones.
  * 7 new tests + 7 existing all green.
  * Live-verified: zip install → listed → trailing-slash serves
    index.html → manifest.webapp from DB → app.js fetches
    `/api/system/info` and renders.
- **Rich `/edge-api/v1/system/info` (admin-only).** New endpoint
  reports build + runtime (java, host, uptime, heap) + dhis2 compat
  snapshot + database (postgres product, flyway, user + session
  counts) + scheduler (Quartz) + journal state counts + storage
  snapshot + installed apps + mapped user count. The anonymous
  `/system/health` stays minimal.

## Alpha.4 (this release — der-2.0.2-alpha.4)

Four alpha.4 bank items landed:

- **DHIS2 `/api/**` passthrough proxy** (`Dhis2ApiProxyController`).
  Opt-in via `der.dhis2.proxy.enabled=true`. Catch-all for `/api/**`
  paths NOT handled by the emulator — stock DHIS2 apps that call
  `/api/analytics`, `/api/dataStore`, `/api/me/*`, `/api/sqlViews`,
  `/api/visualizations`, etc., reach central with Basic auth from
  the configured DER service account. Reads only by default; writes
  gated behind `allow-writes=true`. Allow-list of paths is operator
  tunable (`der.dhis2.proxy.allow-paths`). 501 when disabled, 405
  for unauthorized writes, 403 for off-list paths. 7 unit tests.
- **CSP nonce injection** on custom-app `index.html`. Flag
  `der.apps.csp.enabled=true` → per-request 128-bit nonce injected
  into every `<script` and `<style`, matching header
  `Content-Security-Policy: ...script-src 'self' 'nonce-<n>'...`.
  Static assets untouched. 4 unit tests.
- **App Hub install-by-URL.** `POST /edge-api/v1/apps/install-from-url`
  with `{"url":"https://..."}`. HTTPS only, 60s fetch timeout,
  delegates to existing `AppInstaller`.
- **Strict-mode attribution flag.** `CapturedByResolver` reads
  `der.attribution.strict`. New `enforcedStoredByFor(edgeUserId)`
  throws `UserNotMappedException` when strict + unmapped — drains
  reject with `USER_NOT_MAPPED` instead of falling back to the
  service account. 6 unit tests.

Live-verified: CSP header + nonce present on sample app, proxy
returns 403 for off-list, 405 for writes, forwards allowed reads to
real DHIS2.

Evidence: `docs/evaluation/evidence/alpha.4-proxy-csp/`.

- **Playwright DC live smoke suite** (`client/e2e/live-dc-smoke.spec.ts`).
  9 tests exercising a real DER server (`localhost:8085`) + DHIS2
  2.44-SNAPSHOT (`localhost:8080`): unauth health, admin sign-in,
  rich `/system/info`, `/api/apps` DHIS2-compat, proxy allow-list,
  attribution mapping, custom app index/manifest/301. Opt-in via
  `DER_LIVE_SMOKE=true`. All 9 green against local pilot stack.
  Evidence: `docs/evaluation/evidence/alpha.4-playwright-smoke/`.

## Stable der-2.0.2 — scorecard flips after alpha.3+4 verification

Three more FRs flipped to DONE after live-verification against the
local DHIS2 2.44-SNAPSHOT pilot stack:

- **FR-04-02 Serve supported DHIS2 application resources without
  central live dependencies.** `AppStaticHandler` + `AppsListController`:
  custom apps installed on DER serve `index.html`, `manifest.webapp`
  (from DB), static assets with correct MIME + cache; `/api/apps`
  returns the DHIS2-compat listing. Zero central round-trip at read.
- **FR-04-06 Communicate unsupported operations distinctly.** The
  `/api/**` proxy taxonomy has six distinct status codes: 501 (feature
  disabled offline), 403 (path not on allow-list), 405 (writes blocked
  by policy), 502 (upstream I/O failure), 503 (central not configured),
  504 (interrupted). Each with structured JSON.
- **FR-11-10 Protect object dependencies and sequence-sensitive
  changes.** `OperationJournalRepository.findPendingReadyToDrain()`
  enforces the `supersedes` chain so an entry cannot drain until its
  prerequisite is centrally acknowledged. ADR-0025/0026 formalises
  the invariant; next-hop referrals (ADR-0027) preserve ordering
  across edge-to-edge chains. Pinned by
  `OperationJournalRepositoryTest#findPendingReadyToDrainPredicatePreservesSupersedesGuard`
  (predicate text + non-terminal state tuple).
- **FR-11-09 Persist sync cursors only after associated effects are
  durably acknowledged.** `DataPullService.pullAll` calls
  `markSuccess` only on puller success and `markFailure` on any
  thrown exception; per-entity isolation means a 502 on EVENT cannot
  advance the EVENT cursor even if AGGREGATE + TRACKER succeed.
  Pinned by `DataPullServiceTest#pullerExceptionMarksFailureNotSuccess`
  (explicit `never()` on `markSuccess(EVENT, ...)`).

## Alpha.1 (this release — der-2.0.2-alpha.1)

- Flipped all 54 UI screens in `screen-traceability.csv` to `done`
  with evidence pointers (37 standalone components + 17
  bundled-sibling screens per Phase 06 G5).
- Added `GET /edge-api/v1/admin/metrics/clock` — FR-14-10 / NFR-28
  clock-drift probe.
- Added `POST /edge-api/v1/admin/ops/journal/purge?olderThanDays=` +
  `OperationJournalRepository.purgeTerminalBefore` — FR-09-10
  retention knob.
- 2 narrow extensions promoted to DONE: FR-09-10, FR-14-10.

## Alpha.3 (prior release)

- **NFR cluster (7 items DONE):** NFR-15 p50/p95 + NFR-16 throughput +
  NFR-18 resource budget + NFR-19 concurrency harness via
  `scripts/evaluation/nfr_sweep.sh`; NFR-20 operator metrics via
  `OperatorMetricsController` at `/edge-api/v1/admin/metrics`; NFR-26
  a11y via existing `admin-ui/e2e/axe.spec.ts`; NFR-29 backup
  round-trip via `scripts/evaluation/backup_integrity.py`.
- **Sample evidence shape** under `docs/evaluation/evidence/phase-15/sample-template/`;
  real pilot bundles land under `<run-id>/` when operators run
  `nfr_sweep.sh`.
- **125 additional FRs/NFRs flipped to DONE** via a conservative,
  per-item code-sweep. See "Remaining partials" below for the 53 that
  stayed in-progress with specific gap notes.

## DHIS2 app support initiative (DER-APPS-DHIS2-001)

Six-phase plan documented in `docs/dhis2-apps-req.md`. Phases 1–5
wrapped 2026-11-15; Phase 6 is explicitly gated on Initiative 3 P2P
direction and remains deferred.

### Scorecard

| Phase | Scope | Status |
|---|---|:---:|
| **1** | OU auto-fill Tier 1 (`/api/me`) + Tier 2 (bound-subtree filter on `/api/organisationUnits`) | ✅ DONE |
| **2a** | Hybrid dispatcher backend — `host_kind` / `source` / `trust_level` columns, `/dhis-web-*` interceptor extension | ✅ DONE |
| **2b** | Client `AppDispatcher` + `IframeHost` (D4 sandbox tokens) | ✅ DONE |
| **2c** | Admin `/system/apps` diagnostic screen (FR-DIAG-001) | ✅ DONE |
| **3a** | Emulator gap-fill — `/api/userSettings`, `/api/systemSettings`, `/api/i18n`, FR-EMU-007 envelope + miss log (FR-DIAG-002) | ✅ DONE |
| **3b** | `POST /api/tracker?async=true` envelope + poll + admin miss panel | ✅ DONE |
| **4** | Central auto-sync (`APPS_SYNC_FROM_CENTRAL` scheduled job + dry-run + audit `APP_INSTALLED_FROM_CENTRAL`) | ✅ DONE |
| **5a** | FR-SYNC-004 per-tenant allow/deny-list | ✅ DONE |
| **5b** | FR-SYNC-008 pinned-key signature verify + `APP_UNSIGNED_CENTRAL_ACCEPTED` audit | ✅ DONE |
| **5c** | FR-SYNC-006 7-day rollback window (version listing + rollback API + daily sweep) | ✅ DONE |
| **5d** | Stock DHIS2 Hub install path (DHIS2_IFRAME host + deep-link launch, not iframe-in-shell) | ✅ DONE |
| **5e** | Retention sweeps for `tracker_job` + `app_central_sync_run` | ✅ DONE |
| **5f** | FR-EMU-006 `/api/schemas` endpoint | ✅ DONE |
| **5g** | FR-EMU-005 ETag / If-Match concurrency on `/api/events/{id}` + `/api/trackedEntityInstances/{id}` | ✅ DONE |
| **5h** | FR-OU-005 user-level OU scope override (Tier 3 of auto-fill) | ✅ DONE |
| **5 (FR-APP-007)** | Signing policy clarifier → ADR-0037 | ✅ DONE |
| **6** | FR-WORKFLOW-002/003/004 cleanup | ⏳ **Deferred** — gated on Initiative 3 P2P decision |

### What was delivered in Phase 5 (2026-11-15)

**Phase 4 hardening** (5a-c) — central auto-sync is safe to enable:
admins can scope it (`CentralSyncPolicy` with 3 modes, UI editor on
`/system/apps`), verify it (pinned-key Ed25519 via
`CentralSigningVerifier`; unsigned-override gated behind
`apps.allow-unsigned-central` system setting + dedicated audit
event), and reverse it (GET `/versions` + POST `/rollback` on the
admin surface, 7-day retention via `AppVersionRetentionService`).

**Stock DHIS2 install path** (5d) — resolved the Phase 4 blocker.
`parseZipBytes` now branches on shape: `bundle.js` → DER_ESM (signed);
`index.html` without `bundle.js` → DHIS2_IFRAME (zip is the versioned
artifact, no DER-side signature). `AppStaticHandler.serveFromZip`
reads entries from the stored zip on demand — no filesystem
extraction, rollback keeps working. Design pivot documented: **the
default launch model for DHIS2 apps is a deep-link new tab, not
iframe-in-shell**, matching the Phase 03 pattern in project memory.
Admins can pin `launchMode=IFRAME` per app to keep the in-shell
`IframeHost`. V125 migration drops the NOT NULL on `signature_b64`.

**Retention sweeps** (5e) — daily sweeps at 03:30 and 03:45 enforce
the retention windows V123 (7-day `tracker_job`) and V124 (90-day
`app_central_sync_run`) called out as design intent. Both preserve
RUNNING rows so stuck jobs stay visible until an operator clears
them.

**Emulator breadth** (5f-g):
- `GET /api/schemas` + `GET /api/schemas/{singular}` return a static
  registry of 10 schemas (dataElement, program, organisationUnit,
  categoryCombo, dataSet, trackedEntityType, trackedEntityAttribute,
  programStage, categoryOption, categoryOptionCombo) in DHIS2's
  Jackson-rendered shape. Unknown singulars route to the FR-EMU-007
  envelope so the miss log keeps surfacing real demand.
- `GET /api/events/{id}` + `GET /api/trackedEntityInstances/{id}`
  emit `ETag: "<version>"` on single-row reads; `DELETE` paths
  honour `If-Match` and return 412 `STALE_ETAG` on mismatch. RFC
  7232 matcher tolerates bare / `W/"..."` / quoted / comma-list /
  wildcard forms. Back-compat preserved: no `If-Match` → old
  behaviour.

**OU scoping Tier 3** (5h) — admin surface at
`/edge-api/v1/admin/users/{userId}/scope-assignment` for per-user
narrowing within the device's bound facility. `MeController`
projects the effective scope across all three OU arrays with
precedence `narrowed > bound > empty`; emits
`SCOPE_ASSIGNMENT_OUT_OF_BOUND` warning when a stored scope falls
outside the current bound subtree (e.g. after a rebind).

**Signing policy** (FR-APP-007) — ADR-0037 formalises the
per-host-kind decision table: DER_ESM signed + verify required;
DHIS2_IFRAME unsigned + verify skipped. Central-side signing
(FR-SYNC-008) is orthogonal.

### Migrations landed

| ID | Purpose |
|---|---|
| V117–V121 | Phase 2a host-kind / source / trust-level columns on `installed_app` |
| V122 | `user_setting`, `system_setting`, `emulator_miss` (Phase 3a) |
| V123 | `tracker_job` (Phase 3b async envelope) |
| V124 | `app_central_sync_run` (Phase 4) |
| V125 | `installed_app_version.signature_b64` nullable (Phase 5d) |

### FR delivery counts

| Register bucket | Delivered this initiative |
|---|---:|
| FR-APP-001..007 | 7 |
| FR-SYNC-001..008 | 5 (004, 006, 008 shipped; 001/002/003/005/007 shipped Phase 4) |
| FR-OU-001..005 | 5 |
| FR-EMU-001..007 | 7 |
| FR-DIAG-001..002 | 2 |
| FR-WRITE-002 | 1 (via Phase 3b tracker async) |
| FR-WORKFLOW-002..004 | **0** — Phase 6 (deferred) |

### Follow-up anchors

- **Stock-DHIS2 central downloadUrl.** Phase 4 sync machinery is
  ready; standard DHIS2 `/api/apps` doesn't advertise a bundle
  download endpoint. A central-side shim (or a DER-flavoured app
  manifest) is the remaining unblocker before auto-sync pulls real
  stock bundles.
- **FR-EMU-005 PUT/PATCH on events/TEIs.** Phase 5g covered
  GET + DELETE; mutation beyond delete lands when a driver surfaces
  (events currently immutable per the write pipeline; TEIs have a
  PUT path on `/edge-api/v1/tracked-entities` that could grow
  If-Match).
- **Phase 6.** `FR-WORKFLOW-002` (audit event relabel),
  `FR-WORKFLOW-003` (DISPATCH placeholder resolution),
  `FR-WORKFLOW-004` (ADR-0018 cross-reference) — scoped out
  until Initiative 3 P2P direction is set.

---

## Remaining 53 PARTIAL items — specific gaps

| ID | Gap |
|---|---|
| ~~FR-02-07~~ | ~~First-time offline sign-in gate exists but policy enum not configurable~~ — ✅ **DONE** as of 2026-11-15 (commit `202b3e5f`); 3-tier policy enum enforced in `AuthenticationService` with distinct 403 + `FIRST_TIME_OFFLINE_DENIED` audit reason. |
| ~~FR-02-09~~ | ~~Emergency-access procedure is bootstrap-only; no runtime break-glass flow~~ — ✅ **DONE** as of 2026-11-15 (commit `b12a4bbb`); audited `BREAK_GLASS_*` flow at `POST /edge-api/v1/break-glass/recover` gated by host-filesystem token-file, one-use, disabled by default, caps blast radius by recovering an existing admin rather than minting. |
| ~~FR-02-10~~ | ~~Clock-skew detection surfaces in `/system/health`; no automatic session invalidation on drift~~ — ✅ **DONE** as of 2026-11-15 (commit `4a047744`); configurable `WARN_ONLY`/`REVOKE_SESSION`/`REVOKE_ALL_FOR_USER` action on `POST /admin/metrics/clock/report` + no-grace-window invariant pinned by test on `EdgeSession.isActive`. |
| ~~FR-04-02~~ | ~~DER emulates reads but UI asset serving is PWA-only, not full DHIS2 app shell~~ — ✅ **DONE** as of 2026-11-16 (commits `fa616264`, `b6862b9f`); DER now serves the full DHIS2 app-shell surface a stock 2.4x bundle (eregisters 1.1.12, Capture) reads during bootstrap. New endpoints + fixes: `/api/me` adds `name` + attaches `programs[]` to every OU (unblocks eregisters' require-programs guard); `/api/system/info` aliased to the legacy `/api/systemInfo` path (HeaderBar title rendered `"undefined - <app>"` without it); `/api/dataStore/<ns>/<key>` full CRUD backed by V128 `app_data_store` table; `/api/tracker/trackedEntities` returns the 2.44 `{trackedEntities[], pager}` shape (was pre-2.40 `{instances[], page}` — eregisters' pullData crashed on `instances.length`); `/api/categories` + `/api/organisationUnits/{uid}?includeDescendants=true` wrapper; `/api/programs/{uid}` hydrates `programStages[].programStageDataElements` from the stage mirror (was shallow `{id}` refs); `AppHost` wraps DHIS2_IFRAME apps inside the DER shell with CSS injection hiding the DHIS2 HeaderBar (`header:has([data-test^="headerbar-"])`) and a DER-branded crash envelope that intercepts uncaught errors + unhandled rejections on the iframe `contentWindow`; `SecurityConfig` loosens `X-Frame-Options` to `SAMEORIGIN` so the shell can embed; `NoStoreApiFilter` stamps `Cache-Control: no-store` on every `/api/*` response so the browser HTTP cache can't persist a stale metadata body across shape fixes. Pinned by `scripts/evaluation/fr04_02_app_shell_surface.py` — a 33-row probe matrix that asserts status + shape invariants per endpoint (array-key names, nested hydration, pager envelope). Live-verified end-to-end in a fresh incognito session: eregisters loads cleanly, Pull Data logs `sync.pullData {outcome: "ok", ...}`, zero `Cannot read properties of undefined` errors. |
| ~~FR-04-06~~ | ~~502 vs 503 distinction exists; "unsupported operation" taxonomy incomplete~~ — ✅ **DONE** as of 2026-11-15 (commit `4a22b3c3`); every non-passthrough response from `Dhis2ApiProxyController` now carries `code` discriminating the three FR-04-06 categories: `EMULATOR_NOT_IMPLEMENTED` (unsupported, 404) · `INVALID_REQUEST` (400) · `UPSTREAM_UNAVAILABLE` / `UPSTREAM_INTERRUPTED` (temporary, 502/504). |
| ~~FR-04-09~~ | ~~Period semantics covered; timezone/locale fallbacks TODO~~ — ✅ **DONE** as of 2026-11-15 (commit `706f2eab`); new `der.locale.*` config + `TemporalContext` service own the fallback decisions explicitly; `/api/i18n` + `/admin/metrics/clock` both honour them; configuredTimeZone surfaces distinctly from the JVM-inherited systemTimeZone so operators can see the gap. |
| ~~FR-05-10 / FR-05-11 / FR-05-12~~ | ~~Pending-op quarantine on metadata drift partially shipped (quarantine, no explicit reinterpretation guard, no diagnostic surface)~~ — ✅ **DONE** as of 2026-11-15 (commit `e022f64a`); diagnostic surface was already shipped at `GET /edge-api/v1/metadata/drift/pending`, `JournalWorker` now auto-quarantines drifted entries before publish + emits `METADATA_DRIFT_QUARANTINED` audit; opt-out via `der.journal.drift-guard.enabled=false`. |
| ~~FR-07-08~~ | ~~Event-level central divergence detection — journal captures state, UI classification deferred~~ — ✅ **DONE** as of 2026-11-15 (commit `31bfe4c1`); `EventDivergenceClass` taxonomy (CENTRAL_DIVERGED / CENTRAL_DELETED / DUPLICATE_LOCAL / IN_SYNC), `EventDivergenceClassifier` pure function with field + dataValue diff, `EVENT_DIVERGENCE_*` audits emitted from `EventPuller` on overwrite + from the new `sweepDeletions`, admin endpoint `GET /edge-api/v1/events/divergence/recent`. |
| ~~FR-08-06..12~~ | ~~Tracker relationships, hand-off, uniqueness, program rules, graph reconciliation, import summary classification — minimal TEI surface shipped, lifecycle not completed~~ — ✅ **DONE**: FR-08-06 (`TrackerRelationshipController` + repo), FR-08-07 (workflow-run attribution, ADR-0023), FR-08-09 (program rules mirrored via `MetadataSyncService`), FR-08-10 (`TrackerGraphReconciler`), FR-08-11 (`ResponseClassifier` + `TerminalState`), FR-08-12 (operation_journal + security_audit); FR-08-08 local uniqueness shipped commit `7acdf4ab` — `TeiUniquenessChecker` + 409 `UNIQUE_ATTRIBUTE_COLLISION` on upsert; central-side collisions already routed to `CONFLICT_REVIEW` via the publisher. |
| ~~FR-09-10~~ | ~~Journal purge policy exists; retention knob + evidence export not formalised~~ — ✅ **DONE** as of 2026-11-16 (commit `efa598ea`); new `JournalRetentionService` runs daily at 04:15 with configurable `der.journal.retention-days` (default 90); evidence-export endpoint `GET /admin/ops/journal/purge/history` aggregates per-source counters; pinned invariant test that unresolved states (PENDING / IN_FLIGHT / RETRYABLE / UNKNOWN_OUTCOME / CONFLICT_REVIEW) are never purged. |
| ~~FR-10-04 / FR-10-05~~ | ~~Approved-merge path + no-silent-last-write-wins — gated by APPROVER role, acceptance ADR but not programmatic enforcement test~~ — ✅ **DONE** as of 2026-11-16 (commit `4cf13d19`); 4 new invariant tests pin the whitelist (resolve refuses every non-CONFLICT_REVIEW state), rationale preservation, enum rigidity (no AUTO_MERGE / LATEST_WINS outcome), and append-only re-journal (new operation id via `supersedes`, never in-place state mutation). |
| FR-10-10 | Precision/recall measurement needs seeded conflict corpus — scripts/evaluation stub only |
| ~~FR-11-09 / FR-11-10~~ | ~~Cursor-after-effects + ordering — supersedes column shipped alpha.2; cross-entity ordering not formalised~~ — ✅ **DONE** as of 2026-11-16; invariants pinned by test: `OperationJournalRepositoryTest#findPendingReadyToDrainPredicatePreservesSupersedesGuard` pins the SQL predicate (both `supersedes IS NULL` and `NOT EXISTS` clauses, plus the exact non-terminal state tuple) so an accidental refactor can't silently drop the FR-11-10 ordering guard; `DataPullServiceTest#pullerExceptionMarksFailureNotSuccess` pins FR-11-09 — `markSuccess` MUST NOT fire on a failing puller stream (explicit `never()` assertion for the failed EVENT entity type). Cross-entity ordering trade-off (TEI → ENROLLMENT → EVENT) is documented inline in `OperationJournalRepository.findPendingReadyToDrain` as a deliberate deferral to `TrackerGraphReconciler` post-hoc handling, not a bug. |
| ~~FR-13-02..09~~ | ~~Inbound pull — MetadataSyncService covers metadata; data-value pull back from central (reconciliation) not shipped~~ — ✅ **DONE**: FR-13-01/03/04/05/09 shipped via `AggregatePuller` / `EventPuller` / `TrackerPuller` + `DataPullCursorRepository`; FR-13-06 via `MetadataSyncService`; FR-13-07 via the User Scope viewer (FR-15-06); FR-13-08 for events shipped Phase 7, for aggregates as of commit `34c81c1b` — `AggregatePuller.sweepDeletions` emits `AGGREGATE_DIVERGENCE_CENTRAL_DELETED` when a previously-CENTRAL_ACCEPTED row is missing from central. |
| ~~FR-14-06..10~~ | ~~Backup/restore runbook exists; integrity verification + storage-alarm + full drift procedures deferred to pilot~~ — ✅ **DONE** as of 2026-11-16; new daily `BackupIntegrityService` (05:00 UTC) + `BackupWorker` now records `archive_sha256` anchor in `backup_run` (V126 migration) at backup time. Daily probe recomputes SHA-256 + verifies size for the last N SUCCESS backups, emits `BACKUP_INTEGRITY_CHECK` audit (outcome SUCCESS for `INTEGRITY_SUCCESS`, ERROR for `INTEGRITY_MISMATCH` / `INTEGRITY_MISSING`); results land in `der.backup_verification` alongside the weekly shadow-restore outcomes. Operator endpoints: `POST /admin/ops/backup/integrity/check` (ad-hoc) and `GET /admin/ops/backup/integrity/history`. Smoke-tested live: tamper on an archive flipped the per-run outcome to `INTEGRITY_MISMATCH` and emitted an ERROR audit on the hash chain. Weekly shadow-restore (`BackupVerificationService`), storage-alarm admission (`StorageAdmissionInterceptor` 507s), and WAL archiving stay as the complementary layers. 7 new tests pin success, sha-drift, size-drift, missing-file, pre-migration backup (null-anchor → readable), empty-history, and scheduler-disabled paths. |
| FR-16-07 | Backup encryption shipped (ADR-0017); DB-level TDE / full data-at-rest sweep deferred |
| FR-17-01..07 | Test harness exists (`run_phase_08.sh`, `der_bench.py`, `backup_integrity.py`); seeded workload scenario matrix for the full FR-17 taxonomy incomplete |
| NFR-02 / NFR-03 / NFR-04 | Durability guarantees are supported by `@Transactional` + journal design, but formal fault-injection evidence not captured |
| NFR-08 / NFR-09 | Reference-comparison + validation parity — oracle fixture corpus needed |
| NFR-10 / NFR-11 | Conflict precision + duplicate avoidance — same measurement harness as FR-10-10 |
| NFR-12 / NFR-13 | Operation accounting + recoverability — covered in code, need restart-under-load test evidence |
| ~~NFR-33~~ | ~~Capability-snapshot drift detection shipped; reinterpretation evidence under test TODO~~ — ✅ **DONE**: `JournalWorkerTest#nfr33MetadataDriftQuarantinesWithoutReinterpretation` pins the four invariants together — drifted PENDING op lands in CONFLICT_REVIEW, publisher never consulted, `flipToInFlight` state-advance SQL never fires, `METADATA_DRIFT_QUARANTINED` audit carries operationId + entityType + entityRef + drift summary. 14 tests across JournalWorkerTest. |

**None of the 53 is scoped to a new feature.** They are either (a)
evidence runs on pilot hardware that only operators can produce, or
(b) narrow extensions to existing shipped code (specific detection
classifications, retention knobs, enforcement tests). Each is listed
in `traceability-matrix.csv` with its code path.

---

## Functional Requirements

### FR-01 Provisioning & deployment

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-01-01 | Stable edge-node identity + org scope | P0 | ✅ DONE | ADR-0019; `V015__phase11_device_management.sql`; `device/EdgeDevice.java` |
| FR-01-02 | Verified central endpoint + supported DHIS2 version | P0 | ✅ DONE | ADR-0001; `Dhis2Properties`; `CompatibilityController` |
| FR-01-03 | Enrol edge with scoped credentials | P0 | ✅ DONE | ADR-0003; `ProvisioningController`; bootstrap docs |
| ~~FR-01-04~~ | ~~Verify time, DNS, certs, storage, DB, network~~ | P0 | ✅ DONE | New `PreflightService` + public `GET /edge-api/v1/system/preflight`. Seven probes (time / dns / certs / storage / database / network / dependencies) each return `OK` / `WARN` / `FAIL` / `SKIP` with a structured detail map; overall rolls up to the worst non-SKIP. Certs probe is SKIP when no `server.ssl.key-store` is configured (TLS commonly terminates upstream). Storage probe reuses the existing `StorageHealthProbe`; network probe reads the `CentralReachabilityGate` + resolves the configured DHIS2 `baseUrl`. Live-smoked on 2026-11-16: 7/7 probes returned structured results, overall rolled up correctly from the current environment (time=WARN on UTC, dns=FAIL on blocked target, rest OK). 10 unit tests pin each probe path including the roll-up semantics. |
| FR-01-05 | Import authorised dependency set | P0 | ✅ DONE | ADR-0006; `MetadataSyncService` |
| FR-01-06 | Seed authorised working records | P0 | ✅ DONE | `AggregateDataValueService.submit`; `EventService.submit` |
| FR-01-07 | Site configuration — connectivity policies | P1 | ✅ DONE | New `SiteConfigController` at `/edge-api/v1/site/config` persists a whitelist of 7 site-level keys (display name, local base URL, time zone, connectivity policies: max concurrent sessions, max offline hours, online-window cron, VPN requirement) via `der.admin_setting`. GET returns defaults overlaid with stored values; POST rejects unknown keys and audits each change as `SITE_CONFIG_CHANGED`. Admin UI screen `MockupSiteConfig` on `/site/config` with inline save + audit cross-link. Linked from EASettings. |
| FR-01-08 | Reproducible deployment — versioned install scripts | P1 | ✅ DONE | `scripts/deploy/install.sh` fleshed out: idempotent (re-run detects active), prereq check (java + systemctl), portable sha256 pin verification (sha256sum / shasum fallback), tarball extraction into `<root>/releases/<version>/`, symlink flip to `<root>/current`, NDJSON install-log manifest. New `--list` + `--active` queries. |
| FR-01-09 | Controlled upgrade + rollback | P1 | ✅ DONE | `scripts/deploy/upgrade.sh` captures UPGRADE_START, triggers FULL backup via `/admin/ops/backup/trigger`, probes `/compat` pre-flip, flips, polls `/system/health` 60s, auto-rollbacks on failure. `rollback.sh` writes ROLLBACK audit record. New `_test_install_lifecycle.sh` exercises 16 state-machine assertions (idempotent re-runs, symlink flips, sha256 verification, rollback audit) wired as `deploy-lifecycle-smoke` gate step. |
| FR-01-10 | Decommissioning — credential revocation + evidence export | P1 | ✅ DONE | `MockupDecommission` on `/decommission` posts to `POST /edge-api/v1/admin/ops/decommission` (server endpoint shipped earlier in OperationsAdminController). Typed-confirmation gate (`DECOMMISSION`), post-success receipt view with next-steps checklist + deep-links to Backup / SupportBundle / Lifecycle. Server disables every other user, requests a final FULL backup for evidence export, writes `DECOMMISSION` audit event. Linked from AdminTasks. |

### FR-02 Local identity & session

All P0, all **🟡 PARTIAL** in audit (code present, non-goals in security hardening deferred).

| ID | Title | Status |
|---|---|:---:|
| ~~FR-02-01~~ | ~~Authenticate previously provisioned users~~ | ✅ DONE | Flipped by evidence after FR-02-02 landed: DHIS2-origin users are mirrored into `edge_user` on each `UserSyncService` sweep and can sign in offline through the existing `AuthenticationService` path (FR-02-03 session issue + FR-02-05 Argon2id verifier + FR-02-06 offline-credential-age window). Bootstrap users remain exempt. |
| ~~FR-02-02~~ | ~~Sync permitted user identity + credential material~~ | ✅ DONE | New `UserSyncService` daily at 02:00 UTC (overridable via `der.security.user-sync.cron`; master switch `der.security.user-sync.enabled`). Pulls `GET /api/users?paging=false&fields=id,username,firstName,surname,displayName,disabled,userRoles[...]`; upserts into `edge_user` keyed on `external_uid=DHIS2 UID`; role resolution ALL authority → ADMIN, else OPERATOR; local ADMIN posture sticky; every upsert stamps `last_central_sync_at` so FR-02-06 window auto-refreshes without requiring online sign-in. Operator-triggered path via `sweepNow("OPERATOR")`. 8 unit tests pin the matrix. Commit `aef26d26`. |
| FR-02-03 | Issue/refresh/expire local sessions | ✅ DONE (`SessionIssuer`, `SessionValidationService`) |
| FR-02-04 | Rate limits + failed-attempt control | ✅ DONE (`RateLimiter`, ADR-0017) |
| FR-02-05 | Store only password verifiers | ✅ DONE (Argon2id in `EdgeUserRepository`) |
| ~~FR-02-06~~ | ~~Enforce local offline login age / revocation~~ | ✅ DONE | V127 adds `last_central_sync_at` on `edge_user`; new `der.security.offline-credential.max-age-days` (default 30) and sign-in gate in `AuthenticationService`. BOOTSTRAP-origin users are exempt (no central anchor); DHIS2-origin users whose witness is older than the window are denied with new `OfflineCredentialExpired` outcome + 403 + `WWW-Authenticate: DER-Offline-Credential-Expired` so UI can show "come back online" copy. When central is REACHABLE at sign-in, the service refreshes the witness FIRST — online sign-ins always succeed and reset the window. 5 new unit tests pin the matrix: expired denial, fresh allow, bootstrap bypass, reachable auto-refresh, disabled gate. Smoke-tested live: 90-day-old witness on a DHIS2 user was refreshed to NOW on an online sign-in and sign-in succeeded (confirming the online path); bootstrap admin still signs in unaffected. Full suite (2717 tests) green. |
| FR-02-07 | Deny first-time offline auth | ✅ DONE |
| ~~FR-02-08~~ | ~~Update/disable users on central reconciliation~~ | ✅ DONE | Same `UserSyncService` slice: `disabled=true` from central → `edge_user.disabled=true` + revoke every active session via `EdgeSessionRepository.revokeAllForUser`. Tombstone sweep: DHIS2-origin users present locally but missing from the central response are disabled + sessions revoked + `USER_RECONCILIATION_REMOVED` audit. Role delta applied on every sweep (ADMIN sticky to prevent central-side lockout). Bootstrap users never touched. Commit `aef26d26`. |
| ~~FR-02-09~~ | ~~Emergency-access procedure~~ | ✅ DONE | Service + endpoint already shipped at `b12a4bbb` (audited `BREAK_GLASS_*` flow, token-file gated, one-use, disabled by default). Flipped by adding operator-facing anchors: new §7.4 in `docs/operations/pilot-runbook.md` documents generate-token / rotate / verify / cleanup; `deployment/pilot/smoke_test.sh` step 6 exercises the full recovery path end-to-end (opt-in via `DER_BREAK_GLASS_TEST_TOKEN=yes-i-want-to-rotate` because it rotates the admin password). |
| ~~FR-02-10~~ | ~~Clock skew + token expiry fail-safe~~ | ✅ DONE | Clock-skew side was already shipped (`SecurityProperties.ClockDrift` + `/admin/metrics/clock/report` with WARN_ONLY / REVOKE_SESSION / REVOKE_ALL_FOR_USER policies). Token-expiry side now surfaced: `SessionValidationService` emits `SESSION_VALIDATION_REJECTED` audit on every reject with `reason=SESSION_EXPIRED` or `SESSION_REVOKED` so operators can tell apart legitimate inactivity from a clock-drift incident; audit append failures are swallowed so a dead chain doesn't 500 every request. New `ExpiredSessionPurgeService` daily at 04:45 UTC reclaims rows (configurable `der.security.session.expired-retention-days`, default 7). Alternate ClockDrift policies pinned by new `ClockDriftAlternatePolicyTest` (WARN_ONLY doesn't revoke; REVOKE_ALL_FOR_USER calls `revokeAllForUser`). Full suite 2726 tests green. Live-smoked: expired `DER_SESSION` cookie → 401 + `SESSION_VALIDATION_REJECTED` audit row with `reason=SESSION_EXPIRED`. |

### FR-03 Authorisation (10 items, all P0)

All **🟡 PARTIAL / ✅ DONE** — role matrix + OrgUnit scope + authz interceptors in place; some reconciliation paths still TODO.

Representative DONE: FR-03-02 OU scope (`OrgUnitScopeInterceptor`, ADR-0015), FR-03-10 audit (ADR-0021 hash chain), FR-03-05 API-level enforcement (`SecurityConfig`).

### FR-04 Local serving + emulation (10 items, all P0)

Mostly **🟡 PARTIAL** — DER emulates the DHIS2 Web API subset per ADR-0004 / 0010; DONE on the core request/response paths, PARTIAL on edge cases (locale/period semantics, versioned compatibility matrix).

### FR-05 Metadata (12 items, all P0)

**🟡 PARTIAL** on 10, **📋 DESIGN-ONLY** on 2 (tracker + option-group manage). Core mirror shipped (ADR-0006, V002/V005), extended mirror shipped (`ExtendedMirrorRepository` for tracker).

### FR-06 Aggregate capture (8 items)

Mix: **✅ DONE** FR-06-06 completeness, **🟡 PARTIAL** for conflict detection and bidirectional reconciliation. `AggregateDataValueService` + journal + ADR-0010 drain.

### FR-07 Standalone events (8 items)

Mostly **🟡 PARTIAL**. `EventService` + ADR-0007 program rules + ADR-0023 enforcement.

### FR-08 Tracker (12 items)

Mix of **✅ DONE** (entities, search, basic flow) and **🟡 PARTIAL** (relationships, hand-off, program rules).

### FR-09 Persistence (10 items, all P0)

All **🟡 PARTIAL / ✅ DONE** on data-model side; some **📋 DESIGN-ONLY** on transactional guarantees around sync edges.

### FR-10 Conflict review (10 items)

All **🧱 SCAFFOLD** in the audit. ADR-0005 shipped `operation_journal` with conflict states + ConflictReviewController; UI exists; precision/recall measurement NOT shipped (ties into FR-17).

### FR-11 Journal (10 items)

Mix: **✅ DONE** FR-11-03 (attempt tracking), **🧱 SCAFFOLD** on advanced lease/retention/export semantics.

### FR-12 Outbound sync (12 items)

Mostly **✅ DONE / 🟡 PARTIAL** — `JournalWorker` + `JournalPublisher` + backoff/retry classifier (ADR-0017).

### FR-13 Inbound pull (10 items)

**🟡 PARTIAL / 🧱 SCAFFOLD** — `MetadataSyncService` pull cron shipped; `/sync/notify` push receiver shipped alpha.9; staged metadata activation TODO.

### FR-14 Resilience (12 items)

All **🧱 SCAFFOLD** per audit. Backup/restore workflow shipped (ADR-0012, V010); durable storage warning, lease recovery, LAN-partition behaviour mostly code-complete but tests + evidence incomplete.

### FR-15 Operational admin (10 items)

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-15-01 | Edge identity + version panel | P0 | 🧱 SCAFFOLD | `EASetupWelcome` |
| FR-15-02 | Central reachability + outstanding submissions | P0 | 🧱 SCAFFOLD | `SystemHealthResponse` |
| FR-15-03 | Queue totals + sync outcomes + processing rates | P0 | 🧱 SCAFFOLD | `EAJobsList` + `EAWorkerHealth` |
| FR-15-04 | Review unresolved conflicts | P0 | 🧱 SCAFFOLD | `EAConflictList` |
| FR-15-05 | Current metadata version + compatibility warnings | P0 | 🧱 SCAFFOLD | `EACompatInspector` |
| FR-15-06 | User scope viewer | P1 | ✅ DONE | `MockupUserScope` on `/users/scope` drives `GET /edge-api/v1/admin/ops/users/scope`. Role matrix across the three canonical roles (ADMIN / OPERATOR / VIEWER), origin chip (LOCAL vs DHIS2), stale-permission chip (`permissionAgeHours > 7 days`), search + role filter. Deep-link from Users dashboard. |
| FR-15-07 | Backup tools — schedule + verify | P1 | ✅ DONE | `MockupBackupList` wires `backupVerifyStatus` + `backupVerifyHistory` + `backupVerifyRun` + `backupPitrWal` + schedule display from `readSettings().cron['backup.rotate']` |
| FR-15-08 | Configuration editor + audit | P1 | ✅ DONE | `MockupConfigEditor` on `/configuration` drives `GET/POST /edge-api/v1/admin/ops/settings` (whitelist of 5 runtime keys). Each save writes `SETTINGS_CHANGED` audit event; the screen surfaces recent entries inline via `/security/audit/events?eventType=SETTINGS_CHANGED`. Linked from EASettings. |
| FR-15-09 | Support bundle — sanitised log export | P1 | ✅ DONE | `MockupSupportBundle` on `/support-bundle` drives `GET /edge-api/v1/admin/ops/support-bundle` (manifest + sanitised users + journal-recent). Server endpoint existed in OperationsAdminController; admin UI wiring landed. Deep-link from EADiagnostics. Each export logs `SUPPORT_BUNDLE_EXPORTED` audit event. |
| FR-15-10 | Operational reports | P1 | ✅ DONE | `MockupOperationalReport` on `/reports/operational` drives `GET /edge-api/v1/admin/ops/reports/operational` with local-vs-central split, journal by-state breakdown, sync-job outcomes (listJobs), and worker backlog. Deep-link from EAEvaluationReports. |

### FR-16 Security (12 items, all P0)

All **🟡 PARTIAL** — ADR-0017 Phase 10 hardening (TLS enforce, PII mask, backup encrypt) + ADR-0021 hash chain + ADR-0028 TOTP shipped. Remaining non-goals: WebAuthn, MFA challenge-response, encryption-at-rest for TOTP secret.

### FR-17 Testability (10 items)

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-17-01 | Seeded aggregate/event/Tracker inputs | P0 | 🧱 SCAFFOLD | `scripts/evaluation/der_bench.py` + fixtures |
| FR-17-02 | Deterministic WAN disconnect | P0 | 🧱 SCAFFOLD | `scripts/run_all_checks.sh` |
| FR-17-03 | Simultaneous client-update scenarios | P0 | 🧱 SCAFFOLD | — |
| FR-17-04 | Compare inputs + validation + results | P0 | 🧱 SCAFFOLD | — |
| FR-17-05 | Define conflict classes + compute precision/recall | P0 | 🧱 SCAFFOLD | — |
| FR-17-06 | Confirm journal survives restarts | P0 | 🧱 SCAFFOLD | — |
| FR-17-07 | Compare central + local post-recovery | P0 | 🧱 SCAFFOLD | — |
| FR-17-08 | Capture CPU/RAM/disk/latency/throughput | P1 | ✅ DONE | `scripts/evaluation/resource_sampler.py` extended: `probe_latency()` (GET /system/health round-trip), `probe_metrics()` (parsed /admin/metrics), per-interval throughput (CENTRAL_ACCEPTED deltas / Δt with regression-clamp + missing-counter resilience), `summarize()` with p50/p95/p99 for CPU/RSS/latency plus mean/peak throughput and total disk growth. 15 unit tests (`test_resource_sampler.py`) cover percentile + throughput + summarize, wired as `resource-sampler-tests` gate step. |
| FR-17-09 | Export experiment config + inputs + outputs | P1 | ✅ DONE | New `scripts/evaluation/export_experiment.py` reads every nfr_sweep.sh artefact + the budget pins and writes a reviewer-friendly bundle under `experiment-<ts>-<commit>/` with four pieces: `config.json` (commit/baseUrl/duration/concurrency/hardware/inputsSummary), `failures.json` (aggregated resourceBudget + benchBudget + bench error rows + backup-integrity divergence with `anyFailure` flag), `inputs/` (budget pins copied verbatim), `outputs/` (every raw artefact), `manifest.json` (SHA-256 per file). Wired into `nfr_sweep.sh` as a non-fatal post-step. 9 unit tests cover pure aggregators + end-to-end bundle layout. Gate step `experiment-export-tests`. |
| FR-17-10 | Regression suite for all supported workflows | P1 | ✅ DONE | New `scripts/evaluation/supported_workflows.json` enumerates 16 supported workflows (aggregate / event / tracker-TEI / enrolment / tracker-event / tracker-relationship / journal-publish / draft-publish / data-pull / referral / backup-restore / metadata-sync / capture-workflow / org-unit-binding / device-registry / authentication), each mapped to its backing server-side integration test(s) and FR id(s). `check_workflow_regression.py` validates the catalogue (every claimed test file exists, no duplicate ids, every workflow carries FRs) and exposes a `--probes` flat list the live `regression_suite.sh` consumes so adding a workflow auto-adds its operator probe. 10 unit tests + live catalogue validation wired as `workflow-catalogue-tests` + `workflow-catalogue-live` gate steps. |

---

## Non-Functional Requirements

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| NFR-01 | WAN-partition capture latency | P0 | 🧱 SCAFFOLD | ADR-0004 hub-and-spoke |
| NFR-02 | No acknowledged commit lost | P0 | 📋 DESIGN-ONLY | Journal design |
| NFR-03 | Business change + journal persist together | P0 | 📋 DESIGN-ONLY | `@Transactional` sites |
| NFR-04 | Zero invalid references or silent lost updates | P0 | 🧱 SCAFFOLD | — |
| ~~NFR-05~~ | ~~100% forbidden access rejected~~ | P0 | ✅ DONE | New `scripts/evaluation/forbidden_access_matrix.py` walks a pinned (role × path × method) grid against a running DER, 36 probes per run, exits non-zero + emits evidence JSON on any violation. Discovery fix during pin: Spring's `/<prefix>/**` doesn't match the bare `/<prefix>` so the sync metadata/data/drift branches needed dual matchers — SecurityConfig tightened. Scenario spec at `tests/security/nfr-05-forbidden-access-matrix.md`. |
| NFR-06 | Transport + credential + log + storage protection | P0 | 🟡 PARTIAL | ADR-0017 part 1 |
| ~~NFR-07~~ | ~~Every acknowledged commit retrievable by second client~~ | P0 | ✅ DONE | `Nfr07TwoClientRetrievalScenarioTest` — MockMvc two-session scenario walking the full HTTP stack. Alice POSTs `/api/dataValueSets`, write sink captures the row; Bob GETs on his own cookie, repo returns Alice's row. Pins value preservation + `stored_by=Alice.userId` across readers + `lastUpdated==submittedAt` + 401 for anonymous. Scenario spec at `tests/security/nfr-07-two-client-local-retrieval.md`. Complementary to NFR-32's architectural no-central-coupling pin. |
| NFR-08 | Deterministic equivalent edge + central effects | P0 | 📋 DESIGN-ONLY | `JournalPublisher` + capability matrix |
| NFR-09 | 100% agreement for reference comparison set | P0 | 🟡 PARTIAL | — |
| NFR-10 | 100% integrity-critical conflicts detected | P0 | 🧱 SCAFFOLD | `ConflictReviewService` |
| NFR-11 | Zero unintended duplicate business objects | P0 | 🧱 SCAFFOLD | — |
| NFR-12 | Every journal op has traceable state | P0 | 🧱 SCAFFOLD | — |
| NFR-13 | App/sync restart yields no missing commits | P0 | 🧱 SCAFFOLD | — |
| ~~NFR-14~~ | ~~Offline privilege + credential freshness~~ | P0 | ✅ DONE | FR-02-06 policy + `Nfr14OfflineCredentialFreshnessScenarioTest` time-travel evidence under `server/src/test/java/ug/ac/mak/der/nfr/` — pins the deny/expiry contract across 4 timeline points (T0 online, T+29d offline allowed, T+31d offline denied with audit, T+31d online auto-refreshes). Scenario spec at `tests/security/nfr-14-offline-credential-freshness.md`. |
| NFR-15 | Measure p50/p95 latency at 5/10/20 users | P1 | ✅ DONE | New `scripts/evaluation/budgets/bench_budgets.json` pins per-concurrency latency maxes (c=1: p50≤20/p95≤100, c=5: p50≤40/p95≤300, c=10: p50≤50/p95≤500, c=20: p50≤100/p95≤1000) with a global ceiling fallback. `check_bench_budget.py` asserts per-level. Wired into `nfr_sweep.sh` as a hard assertion. |
| NFR-16 | Sustained writes/s + reads/s under load | P1 | ✅ DONE | Same budget file carries throughputRps minimums per level (c=1: 5, c=5: 20, c=10: 40, c=20: 50) plus error-rate ceiling (≤1%). `check_bench_budget.py` asserts throughputRps >= pin AND errorRatePct <= pin. 12 unit tests cover tightened/loosened overrides, zero-total protection, error-rate math, missing-field tolerance. Wired as `bench-budget-comparator` gate step. |
| NFR-17 | Time to stable central outcomes after restore | P0 | 🧱 SCAFFOLD | `scripts/evaluation/backlog_recovery.py` |
| NFR-18 | CPU + memory + disk budgets | P1 | ✅ DONE | New `scripts/evaluation/budgets/resource_budgets.json` encodes the pilot-site pins (CPU p95 70%, RSS p95 1.5 GiB, latency p95 500 ms on /system/health, disk 50 MiB/hr steady-state). New `scripts/evaluation/check_resource_budget.py` is a pure comparator that reads the sampler report + budgets and asserts per-percentile; emits Markdown + JSON evidence. Wired into `nfr_sweep.sh` as a hard assertion — sweep exits non-zero on budget violation. 10-test unit suite wired as `resource-budget-comparator` gate step. |
| NFR-19 | 1/5/10/20 session concurrency harness | P1 | ✅ DONE | `der_bench.py` extended: `classify_error()` categorises failures (HTTP_4XX, HTTP_5XX, TIMEOUT, CONNECTION_REFUSED, OTHER); `analyze_saturation()` identifies peak concurrency, saturation knee (throughput < 95% of peak), latency inflection (p95 > 2x lowest), and merges per-level error breakdowns. Every `ConcurrencyResult` carries the error map; top-level `saturation` block in the report. 10 new unit tests (`test_der_bench.py` now 15 total) wired as `der-bench-tests` gate step. |
| NFR-20 | Operator-visible metrics | P1 | ✅ DONE | `GET /admin/metrics` now exposes the full NFR-20 contract: `health.status` (derived UP/DEGRADED), `lastSuccessfulSyncAt` (ISO from `scheduled_job_run` most-recent SUCCESS via new `ScheduledJobRepository.findLastSuccessful()`), `queueDepth`, top-level `rejections` + `conflicts` (not just nested in journal), full journal by-state map, process metrics. Contract-shape tests enforce the required keys on both fresh-install + populated journal states — three new assertions in `OperatorMetricsControllerTest`. Controller Javadoc lists the contract fields explicitly. |
| NFR-21 | Every decision + privilege change audited + timestamped | P0 | 🧱 SCAFFOLD | ADR-0021 hash chain |
| NFR-22 | Pinned DHIS2 API versions documented | P0 | ✅ DONE | `docs/verification/compatibility/` |
| NFR-23 | Component separation audit | P1 | ✅ DONE | New `scripts/lint/check_server_separation.sh` enforces one-way package layering (workflows/metadata/security/dhis2 may not reach up into web; metadata may not reach workflows). Two documented allowlist entries with ADR/release-note rationale. Audit section of `docs/operations/component-and-portability.md` §NFR-23 rewritten with the five-category spec mapping, independent-testability table (per-package src/test file counts), and the forbidden-import matrix. Wired into `scripts/run_all_checks.sh` as the new `server-separation-lint` step. |
| NFR-24 | Portability — reproducible reference Linux | P1 | ✅ DONE | New `scripts/install/bootstrap-host.sh` — idempotent Ubuntu 24.04 LTS bootstrap that installs the pinned prerequisite set (OpenJDK 21, Postgres 17 via PGDG apt, nginx, nftables, support utils), enables postgres + nginx services, writes `/etc/der/bootstrap.manifest.json` for audit. `--dry-run` for review mode, `--node` for same-host build. Reference pins + 3-step reproducibility recipe rewritten in `docs/operations/component-and-portability.md` §NFR-24. Bare-metal / systemd target — no container. |
| NFR-25 | Users distinguish local vs. central-accepted | P1 | ✅ DONE | New `LocalVsCentralBadge` + `isCentralAccepted` helpers in `shared.tsx`. Every DataAggregate / DataEvents / DataTracker row now carries a leading "On Central" / "Local only" chip alongside the richer sync-state chip; Drafts screen status bar shows the same Local-only badge so operators get a one-glance answer to "has this reached Central?" without decoding state-machine vocabulary. Only CENTRAL_ACCEPTED counts as on-Central — every other state including UNKNOWN_OUTCOME is treated as local-only. |
| NFR-26 | Semantic forms + keyboard nav + readable states | P2 | ✅ DONE | New `src/test/axe.ts` wraps `axe-core` with jsdom-compatible rule config (disables rules that need real layout: colour-contrast, region, scrollable-region-focusable). New `src/test/axe.test.tsx` runs the smoke across every screen shipped this session (FR-15-06..10, FR-01-07, FR-01-10, NFR-25). Caught + fixed: empty-table-header on Config/Site Save columns, label missing on key/value inputs, select-name missing on user-scope role filter. Zero violations across 7 screens. |
| NFR-27 | Fixed-seed repeatable scenarios | P0 | 🧱 SCAFFOLD | `scripts/evaluation/run_phase_08.sh` |
| NFR-28 | Document time source + detect clock drift | P1 | ✅ DONE | Extended `GET /edge-api/v1/admin/metrics/clock` to disclose `serverTimeZone`, `systemTimeZone`, and the `unsafeDriftMillis` threshold (60s). New `POST /admin/metrics/clock/report` emits `CLOCK_DRIFT_WARN` audit when drift exceeds threshold; benign drift succeeds silently. Admin UI `ClockDriftBanner` mounted in AdminShell probes on load, posts the report, surfaces a warning banner on unsafe drift OR zone mismatch (server vs browser). 5 server MockMvc tests + 5 admin-UI tests. |
| NFR-29 | Verified restoration retains committed records | P1 | ✅ DONE | `scripts/evaluation/backup_integrity.py` extended — now captures the journal by-state distribution (PENDING / RETRYABLE / CENTRAL_ACCEPTED / etc.) via `/admin/ops/reports/operational` AND the health-counter fingerprint on both sides of the round-trip. The new `compare_fingerprint()` fails on any per-state count change (not just the grand total), satisfying the spec's "pending/accepted reconciliation history" clause. Writes JSON evidence + optional Markdown summary. 11-test unit suite (`test_backup_integrity.py`) wired as `backup-integrity-comparator` gate step. |
| ~~NFR-30~~ | ~~Fail-safe acceptance when storage prevents durability~~ | P0 | ✅ DONE | `Nfr30StorageFaultInjectionScenarioTest` — walks the hot write surfaces (`/api/dataValueSets`, `/api/events`, `/api/tracker`, `/edge-api/v1/apps/install`, `/edge-api/v1/backup/request`, `/edge-api/v1/sync/metadata`) against a fault-injected `StorageHealthProbe` reporting REJECT, pins HTTP 507 + `STORAGE_FULL_REJECT` on each + reads pass through + admin-recovery paths stay reachable. Also closes the gap where `/api/*` writes previously bypassed the `StorageAdmissionInterceptor` — gate now covers both `/edge-api/**` and `/api/**` write methods with narrow exemptions for `/api/userSettings` / `/api/systemSettings` (tiny kv writes that can't exhaust storage). Scenario spec at `tests/security/nfr-30-storage-fault-injection.md` includes a tmpfs drill procedure for pilot hardware. 9 unit tests on `StorageAdmissionInterceptorTest` (was 7 + 2 new). |
| ~~NFR-31~~ | ~~Synthetic data for experiments~~ | P0 | ✅ DONE | New `scripts/evaluation/fixtures/generate.py` — Python-stdlib-only deterministic generator for `aggregate` / `tei` / `enrollment` / `event` JSONL corpora. Same `--kind + --count + --seed` → byte-identical output across hosts (verified). PII invariant: every attribute value matches `^(Alice\|Village)-[0-9]{4}$` or a fixed gender literal; grep-auditable. Audit markers: `_syntheticSource: "NFR-31"` + `_syntheticIdx: <int>` on every row — prod audit grep instantly flags any escape. Metadata UIDs sourced from DHIS2 play mirror. README at `scripts/evaluation/fixtures/README.md`, scenario spec at `tests/security/nfr-31-synthetic-data.md`. |
| ~~NFR-32~~ | ~~Successful local op is non-blocking~~ | P0 | ✅ DONE | `Nfr32NoCentralCouplingTest` — reflection-based architectural invariant. Walks every constructor param + field + setter of `AggregateDataValueService` / `EventService` / `TrackerService` and asserts none carries a central-HTTP-client-shaped type (`java.net.http.HttpClient`, `Dhis2ReferenceClient`, Spring `RestTemplate`/`WebClient`, Apache HttpComponents, `CentralAppClient`, `AppHubClient`, `CentralReferralSearchClient`). Positive-control verified: adding a known-present type to the forbidden set fails the test. Guards against the invariant going stale with a tripwire test that pins the canonical HTTP clients in the forbidden set + a tripwire for the hot-path service set. Fails the gate loudly if a future refactor injects a blocking central call into the critical write path. |
| ~~NFR-33~~ | ~~Incompatible metadata doesn't silently reinterpret~~ | P0 | ✅ DONE | `JournalWorker` drift-guard + `JournalWorkerTest#nfr33MetadataDriftQuarantinesWithoutReinterpretation` evidence pin. |
| NFR-34 | Sync-worker failures don't crash local workflows | P0 | 🧱 SCAFFOLD | `JournalWorker` isolation |
| NFR-35 | Report DHIS2 version + fixture + build hash | P0 | ✅ DONE | `/edge-api/v1/system/health` + `/compat` |

---

## Audit notes

- The audit tool scanned `evidence_path` references and found 17
  phase-based paths that don't exist on disk — all post-Phase 03.
  The pilot acceptance gate flagged in every stable release note
  since 1.2.0 is the real reason: operator-side evidence runs
  haven't been bundled into the repo.
- FR-01-01..06 are shown as PENDING / SCAFFOLD in the raw audit but
  are **effectively DONE** in the code. The matrix's `status` column
  was never updated; alpha.1 refreshes it.
- `scripts/evaluation/run_phase_08.sh` can run today for NFR-15/16/17/18/19
  — the gap is that no one has run it on pilot hardware and bundled
  the result. Alpha.3 ships an extended runner that captures all
  five NFRs in one bundle and lands sample output under
  `docs/evaluation/evidence/phase-14/<sample>/`.

## Train plan (`der-2.0.1`)

| Alpha | Scope |
|---|---|
| 2.0.1-alpha.1 (this release) | Honest status doc + CSV status column refresh |
| 2.0.1-alpha.2 | FR-01-07..10 + FR-15-06..10 + FR-17-08..10 (13 FRs) |
| 2.0.1-alpha.3 | NFR-15/16/18/19/20/23/24/25/26/28/29 (11 NFRs) |
| 2.0.1 (stable) | Roll-up |

See each alpha's release note for the exact deliverable list.
