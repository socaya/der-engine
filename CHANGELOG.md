# Changelog

All notable changes to the DHIS2 Edge Runtime (DER) are recorded in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
Release labels are of the form `der-X.Y.Z` with a matching annotated git tag.

The DHIS2 upstream release is **not** the DER version. The pinned reference DHIS2 patch
is recorded separately per release in `docs/releases/`.

## [Unreleased]

### Added

- Pilot acceptance evidence bundle under `docs/evaluation/evidence/phase-09/<run>/`; stable `der-1.0.0` cut when the pilot run passes NFR-15/17/18/29 thresholds.

## [1.4.0] — 2026-10-23

Third stable release. Bundles alphas 1.4.0-alpha.1 through 1.4.0-alpha.9; no code change versus alpha.9.

- Initiative 3 option A — chain-via-hub referral is feature-complete for aggregate + event (ADR-0027).
- Initiative 2 part 1 scaffolded as `agents/dhis2-edge-agent/`; edge-side `/sync/notify` receiver live (ADR-0029). Polling + webhook dispatch deferred.
- Initiative 8 part 3 — TOTP MFA enrol/verify/disable (ADR-0028). Sign-in challenge-response flow deferred.
- Open scope flagged in `docs/releases/der-1.4.0.md`: Agent polling, MFA sign-in flow, multi-hop referrals, pilot acceptance.

[1.4.0]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0

## [1.4.0-alpha.9] — unreleased

Initiative 2 scaffold — Edge Agent + /sync/notify receiver (ADR-0029).

- Added: `agents/dhis2-edge-agent/` Maven module (Spring Boot shell, config template, README).
- Added: `SyncNotifyController` at POST `/edge-api/v1/sync/notify` — any authenticated user; schedules an immediate `MetadataSyncService.syncAll`.
- Changed: `SecurityConfig` relaxes `/sync/notify` to `authenticated()` (rest of `/sync/**` remains ADMIN).
- Added: ADR-0029.
- Added: 3 server tests.

[1.4.0-alpha.9]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.9

## [1.4.0-alpha.8] — unreleased

Initiative 8 part 3 — TOTP MFA (ADR-0028 alpha.8 slice).

- Added: V023 `totp_secret` + `totp_enrolled_at` columns on `edge_user`.
- Added: `TotpService` (RFC 6238, SHA-1, 6-digit, 30s step, ±1 step drift) with no external dependency.
- Added: `MfaController` at `/edge-api/v1/auth/mfa/{enrol,verify,disable}`. Audits chained via ADR-0021.
- Added: ADR-0028.
- Non-goal: sign-in challenge-response (deferred); encryption-at-rest for `totp_secret` (deferred); WebAuthn / backup codes (out of scope).
- Added: 15 server tests.

[1.4.0-alpha.8]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.8

## [1.4.0-alpha.7] — unreleased

Initiative 3 closeout — events + tracker scan + ingest (ADR-0027 alpha.7 slice).

- Changed: `ReferralPayloadEncoder` now rewrites `orgUnit` on EVENT / PROGRAM_STAGE_EVENT / ENROLLMENT / TRACKED_ENTITY payloads (mirrors aggregate).
- Changed: `HttpCentralReferralSearchClient.findReferrals` now runs two queries per tick — aggregate + events. Events parse looks for the marker in `notes[].value`.
- Added: `ReferralIngestService` EVENT path reconstructs an `EventService.EventInput` from the stored payload and submits.
- Non-goal: ENROLLMENT / TRACKED_ENTITY ingest remains a stub (`false`); multi-hop and signed referrals are post-1.4.0.
- Added: 9 server tests.

[1.4.0-alpha.7]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.7

## [1.4.0-alpha.6] — unreleased

Initiative 3 — outbound OU rewrite + accept-ingest (ADR-0027 alpha.6 slice).

- Changed: `ReferralPayloadEncoder` rewrites `orgUnit` on AGGREGATE_DATA_VALUE payloads when `nextHopOrgUnitUid` is set. Central stores the dataValue under the destination OU; receiving edge's bound-OU scan surfaces it.
- Added: `ReferralIngestService` parses the stored payload and writes it to the local store via `AggregateDataValueService.submit`. The inbox entry's `bound_org_unit` overrides the payload orgUnit on ingest.
- Added: `ReferralInboxRepository.findById` for the look-before-ingest flow.
- Changed: `ReferralInboxController` accept now `findById` → ingest (via `ObjectProvider<ReferralIngestService>`) → `markResolved`; returns `{ inboxId, status, ingested }`.
- Non-goal (deferred to alpha.7): events / tracker scan + ingest; payload drill-in; multi-hop.
- Added: 8 server tests.

[1.4.0-alpha.6]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.6

## [1.4.0-alpha.5] — unreleased

Initiative 3 — HTTP referral search + resolve (ADR-0027 alpha.5 slice).

- Added: `HttpCentralReferralSearchClient` queries central `/api/dataValueSets` and filters by `\[DER-next-hop:([A-Za-z0-9_-]+)\]` marker. `@Primary` + `@ConditionalOnProperty(der.referral.http.enabled=true)` so it displaces the no-op; fail-open on IO/HTTP failures.
- Added: `POST /edge-api/v1/referral/inbox/{inboxId}/accept` + `/dismiss` (ADMIN) resolve endpoints.
- Added: admin UI Accept/Dismiss buttons on EA-REF-01 + `edgeApi.acceptReferralInbox` + `dismissReferralInbox` helpers.
- Non-goal (deferred to alpha.6): outbound orgUnit rewrite so central stores referrals under the destination OU; events/tracker HTTP scan; accept-ingest into local data store.
- Added: 16 server tests + 5 admin-ui screen tests + 2 edgeApi table rows.

[1.4.0-alpha.5]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.5

## [1.4.0-alpha.4] — unreleased

Initiative 3 — referral inbox scaffolding (ADR-0027 alpha.4 slice).

- Added: V022 `referral_inbox` table with `UNIQUE (kind, source_ref)` for idempotent re-polls; partial index on pending status.
- Added: `ReferralInboxEntry` + `ReferralInboxRepository` (insertIfAbsent / findPending / markResolved).
- Added: `CentralReferralSearchClient` interface + `NoOpCentralReferralSearchClient` default (alpha.5 replaces it with an HTTP client).
- Added: `ReferralInboxScanner` service — reads the bound OU, pulls candidates, upserts into inbox. Fail-open on failures.
- Added: `ReferralInboxPollJob` Quartz job on `der.referral.inbox.cron:0 */10 * * * ?`.
- Added: `GET /edge-api/v1/referral/inbox` (any-auth) + `edgeApi.listReferralInbox` + admin UI EA-REF-01 at `/referral/inbox`.
- Added: 18 server tests + 4 admin-ui screen tests + 1 Playwright spec + 1 edgeApi table row.

[1.4.0-alpha.4]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.4

## [1.4.0-alpha.3] — unreleased

Initiative 3 — referral outbound encoding (ADR-0027 D-RHO-7 codified in alpha.3).

- Added: `ReferralPayloadEncoder` attaches `[DER-next-hop:<ou>]` marker to the DHIS2-shaped payload at publish time. Aggregate → `comment`; event/tracker/enrollment → `notes[]`.
- Changed: `JournalPublisher` takes the encoder as a constructor arg; publish uses `encoder.body(entry)`. Behaviour unchanged when the journal entry carries no `nextHopOrgUnitUid`.
- Fail-open: unexpected payload shapes log WARN and send the raw payload (ADR-0004).
- Added: 12 server tests (encoder shape coverage + publisher smoke).

[1.4.0-alpha.3]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.3

## [1.4.0-alpha.2] — unreleased

Initiative 3 — referral write-time capture (ADR-0027 D-RHO-4 slice).

- Added: `OperationJournalRepository.insert` persists `next_hop_org_unit_uid` from the record.
- Added: 5-arg overloads on `AggregateDataValueService.submit` and `EventService.submit` thread `nextHopOrgUnitUid` through to the journal entry at insert time.
- Added: `DataValueSetsController` and `EventsController` read `X-DER-Referral-Next-Hop` from the request and pass it to the service. Blank/absent → `null`.
- Changed: existing 4-arg callers continue to work — the extra parameter is additive.
- Added: 7 server tests.
- Non-goal (deferred to alpha.3): outbound encoding into DHIS2 (dataValue `comment` / event `notes`).

[1.4.0-alpha.2]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.2

## [1.4.0-alpha.1] — unreleased

Initiative 3 option A kickoff — chain-via-hub referral schema (ADR-0027).

- Added: V021 `next_hop_org_unit_uid TEXT` on `operation_journal` (nullable, partial index on non-null values, no FK to org_unit_mirror per D-RHO-3).
- Added: `OperationJournalEntry.nextHopOrgUnitUid` field with a 10-arg convenience constructor so all existing call-sites compile unchanged.
- Added: `OperationJournalRepository.markNextHop` + the `rowMapper` reads the new column.
- Added: `POST /edge-api/v1/journal/{operationId}/next-hop` (ADMIN) tags a journal entry; emits `JOURNAL_NEXT_HOP_SET` audit event through the hash chain.
- Added: `edgeApi.setJournalNextHop` admin-UI helper.
- Added: ADR-0027 (option A, journal column, advisory validation, slice-by-slice rollout).
- Added: 8 server tests + 1 edgeApi table row.

[1.4.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-1.4.0-alpha.1

## [1.3.0] — 2026-10-23

Second stable release. Bundles alphas 1.3.0-alpha.1 through 1.3.0-alpha.5 under a single tag; no code change versus 1.3.0-alpha.5.

- Initiative 10 slice B is feature-complete: device-owner config (ADR-0022) + enforcement (ADR-0023) + program-binding + import/export (ADR-0024) + reconciler scaffolding (ADR-0025) + state transitions + event/tracker ingest (ADR-0026).
- Three roadmap items deferred to point releases: Initiative 2 part 1 (DHIS2 Edge Agent server plugin), Initiative 3 option A (chain-via-hub referral), Initiative 8 part 3 (MFA). Flagged in `docs/releases/der-1.3.0.md`.
- Pilot acceptance under `docs/evaluation/evidence/phase-12/` remains open per the same policy as `der-1.2.0`.

[1.3.0]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0

## [1.3.0-alpha.5] — unreleased

Initiative 10 slice B closeout — run-state transitions + event/tracker ingest (ADR-0026). Slice B is feature-complete.

- Added: `CaptureWorkflowService.advanceRunState` + repository helpers (`findRun`, `updateRunState`, `countContributions`). State machine OPEN → AWAITING → COMPLETED driven by contribution count; idempotent on terminal states.
- Added: `WORKFLOW_RUN_COMPLETED` audit event emitted once per run on completion, participating in the ADR-0021 hash chain.
- Added: `CaptureWorkflowContributionIngest` extended to `/api/events`, `/api/tracker/events`, `/api/tracker/enrollments`. Workflow resolution sniffs programStage → program → dataSet.
- Added: ADR-0026 (state machine, event/tracker ingest, rationale for no drain-time Java merger — central DHIS2 upserts already produce the single-user-commit shape).
- Added: 20 server tests (repo + service + ingest).

[1.3.0-alpha.5]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0-alpha.5

## [1.3.0-alpha.4] — unreleased

Initiative 10 slice B — reconciler scaffolding (ADR-0025).

- Added: V020 `capture_workflow_step_contribution` table with `UNIQUE (run_id, step_id)` so re-POSTs overwrite idempotently.
- Added: `CaptureWorkflowContribution` record + `CaptureWorkflowContributionRepository` (upsert + findByRun).
- Added: `CaptureWorkflowContributionIngest` MVC afterCompletion handler on `/api/dataValueSets` — buffers the body when `X-DER-Workflow-Run` + `X-DER-Workflow-Step` headers are present and the payload maps to an enabled workflow + step ordinal. Fail-open on any error.
- Added: `GET /edge-api/v1/workflows/runs/{runId}/contributions` + `edgeApi.listWorkflowContributions` helper.
- Added: ADR-0025 (overwrite semantics, ordinal-via-header step selection, write-through ingest, no drain-time recomposition yet).
- Added: 18 server tests + 1 edgeApi table row.

[1.3.0-alpha.4]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0-alpha.4

## [1.3.0-alpha.3] — unreleased

Initiative 10 slice B — program-binding + workflow import/export (ADR-0024).

- Added: V019 relaxes `capture_workflow.bound_metadata_kind` CHECK to `('DATA_SET','PROGRAM','PROGRAM_STAGE')`.
- Added: `CaptureWorkflow.BindingKind` extended + `CaptureWorkflowService.resolveForProgram`/`resolveForProgramStage` helpers.
- Added: `DeviceOwnerEnforcementInterceptor` guards `/api/events`, `/api/tracker/events`, `/api/tracker/enrollments`; sniff order PROGRAM_STAGE → PROGRAM → DATA_SET.
- Added: `GET /edge-api/v1/workflows/{id}/export` returns canonical JSON (schemaVersion 1, ordinals in dependencies, no server-generated ids/timestamps).
- Added: `POST /edge-api/v1/workflows/import?dryRun=` (ADMIN) with validation + unknown-device scrubbing.
- Added: admin UI designer gets a binding-kind dropdown + Export/Import sections with dry-run + apply flow.
- Added: ADR-0024 (canonical shape, schemaVersion 1, device-id scrub, no bundled import).
- Added: 19 server tests + 11 admin-ui screen tests + 3 edgeApi table rows.

[1.3.0-alpha.3]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0-alpha.3

## [1.3.0-alpha.2] — unreleased

Initiative 10 slice B — device-owner enforcement (ADR-0023).

- Added: `DeviceOwnerEnforcementInterceptor` guarding `/api/dataValueSets`; rejects workflow-bound writes from non-owner devices with 403 + chained `DEVICE_OWNER_MISMATCH` audit event. Fail-open on lookup errors (ADR-0023 D-DOE-4).
- Added: `X-DER-Device-Id` request header. Client `edgeApi` attaches it automatically when a device id is persisted in localStorage.
- Added: ADR-0023 (rule, interceptor placement, fail-open behaviour, client-side header injection).
- Added: 13 server tests + 3 client tests.

[1.3.0-alpha.2]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0-alpha.2

## [1.3.0-alpha.1] — unreleased

Initiative 10 slice B kickoff — device-owner config (ADR-0022).

- Added: V018 schema — nullable `owner_device_id` FK on `capture_workflow_step` (`ON DELETE SET NULL`), partial index on non-null values.
- Added: `CaptureWorkflowStep.ownerDeviceId` + repository + controller round-trip; API accepts/returns the new JSON field.
- Added: admin UI designer gains an "Enrolled devices" reference panel with copy-friendly UUIDs so admins can bind steps via the JSON textarea.
- Added: ADR-0022 (nullable column, role-as-fallback, config-only in alpha.1 with enforcement in alpha.2+, JSON-textarea authoring with a device reference panel).
- Added: 1 server test + 4 admin-ui screen tests.

[1.3.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-1.3.0-alpha.1

## [1.2.0] — 2026-10-22

First stable release. Bundles alphas 1.2.0-alpha.1 through 1.2.0-alpha.5 under a single tag; no code change versus 1.2.0-alpha.5.

- Capture-workflow configuration (ADR-0018) · Edge device-client management + enrollment hook (ADR-0019) · Site-level analytics (ADR-0020) · Hash-chain audit + CMS-wrapped S3 uploads (ADR-0021).
- Pilot acceptance against DHIS2 2.44 under `docs/evaluation/evidence/phase-11/` is deliberately deferred to a point release — flagged in `docs/releases/der-1.2.0.md`.
- No stable `der-1.0.0` / `der-1.1.0` were cut; this is the first version-without-suffix tag in the project.

[1.2.0]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0

## [1.2.0-alpha.5] — unreleased

Initiative 8 part 2 — hash-chain audit + CMS-wrapped uploads (ADR-0021).

- Added: V017 schema — `prev_hash` + `row_hash` columns on `security_audit`, `pgcrypto` extension, BEFORE INSERT trigger that chains rows under a transaction-scoped advisory lock, backfill DO block.
- Added: `SecurityAuditVerifier` — CTE-based chain walk capped at 500 000 rows, first-break reporting (`PREV_HASH_MISMATCH` / `ROW_HASH_MISMATCH`).
- Added: `SecurityAuditController` at `/edge-api/v1/security/audit/verify` (ADMIN only).
- Added: `RemoteArchiveEncryption` — wraps the pre-upload archive with `openssl smime -encrypt -aes-256-cbc` against a recipient certificate; server never holds the private key. Independent of local-disk encryption.
- Added: `BackupWorker` now routes `local → remoteWrap → upload`.
- Added: admin UI `EAAuditVerify` (EA-AUD-01) at `/audit/verify`, Audit nav link, `verifyAuditChain` edgeApi helper.
- Added: ADR-0021 (SHA-256 hash chain, trigger-based, 500 000-row verify cap; asymmetric CMS envelope reusing openssl).
- Added: 15 server tests + 5 admin-ui tests + 1 Playwright spec + 1 edgeApi table row.

[1.2.0-alpha.5]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0-alpha.5

## [1.2.0-alpha.4] — unreleased

Initiative 7 slice A — site-level analytics (ADR-0020).

- Added: V016 schema — `analytics_facility_summary` materialised view (aggregate + event rollups per OU/period/kind) with unique index for concurrent refresh.
- Added: `ug.ac.mak.der.analytics` package — `FacilitySummaryRow` record, `AnalyticsRepository` (summary + recent rejections + last-refresh + `REFRESH MATERIALIZED VIEW CONCURRENTLY`), `AnalyticsService` thin delegate.
- Added: `AnalyticsRefreshJob` Quartz job (`@DisallowConcurrentExecution`) on `der.analytics.refresh.cron` (default every 5 min); logs outcome into `scheduled_job_run`.
- Added: `AnalyticsController` at `/edge-api/v1/analytics/**` — `GET /summary` + `GET /rejections` any-auth; `POST /refresh` ADMIN-only with structured 500 (`ANALYTICS_REFRESH_FAILED`).
- Added: admin UI `EAFacilityAnalytics` (EA-ANA-01) at `/analytics`, Analytics nav link, 3 new edgeApi helpers.
- Added: ADR-0020 (single matview, 5-min cron, no charts in slice A).
- Added: 24 server tests + 6 admin-ui tests + 1 Playwright spec + 4 edgeApi table rows.

[1.2.0-alpha.4]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0-alpha.4

## [1.2.0-alpha.3] — unreleased

Initiative 1 client half — device-client enrollment hook (ADR-0019 slice A).

- Added: `client/src/device/` package — `DeviceEnrollment.ts` (installation-UUID storage + `enrolOrRefresh` + `heartbeat`), `useDeviceEnrollment.ts` (hook with `setInterval` heartbeat), `DeviceBoot.tsx` (non-blocking status banner mounted inside AuthProvider).
- Added: `SessionDetails` now shows enrolled device id + status.
- Added: 3 new client `edgeApi` helpers (`enrollDevice`, `heartbeatDevice`, `fetchDevice`).
- Added: 26 new client tests (storage + hook + banner + edgeApi).

[1.2.0-alpha.3]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0-alpha.3

## [1.2.0-alpha.2] — unreleased

Initiative 1 — edge device-client management (ADR-0019).

- Added: V015 schema — `edge_device` + `edge_device_dependency`.
- Added: `ug.ac.mak.der.device` package — `EdgeDevice`, `EdgeDeviceDependency`, `EdgeDeviceRepository` (`upsertEnrol`, status transitions), `DeviceService` (enrol with Argon2id token hash, approve/suspend/revoke/heartbeat with outcome enums).
- Added: `DeviceController` at `/edge-api/v1/devices/**` — self-enrol + heartbeat any-authenticated-user; approve/suspend/revoke/delete + list ADMIN-gated.
- Added: admin UI `EADeviceFleet` (EA-DVC-01) at `/devices`, Devices nav link, 6 new edgeApi helpers.
- Added: 48 server tests + 13 admin-ui tests + 1 Playwright spec + 6 edgeApi table rows.
- Added: ADR-0019 (installation-UUID identity, manual admin approval, generic dependency_kind enum ready for Initiative 3 + Initiative 10 slice B).

[1.2.0-alpha.2]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0-alpha.2

## [1.2.0-alpha.1] — unreleased

Initiative 10 slice A — DER capture-workflow configuration (ADR-0018).

- Added: V014 schema — `capture_workflow`, `capture_workflow_step`, `capture_workflow_field`, `capture_workflow_dependency`, `capture_workflow_run`.
- Added: `ug.ac.mak.der.workflow` package — 5 record types, `CaptureWorkflowRepository` (@Transactional upsert), `CaptureWorkflowService` (list / get / save with version-bump-on-shape-change / resolveForDataSet / startRun).
- Added: `CaptureWorkflowController` at `/edge-api/v1/workflows/**` (ADMIN-gated writes); SecurityConfig matcher added.
- Added: admin UI `EACaptureWorkflowList` + `EACaptureWorkflowDesigner`, Workflows nav link, 5 new edgeApi helpers.
- Added: 37 server tests + 20 admin-ui tests + 2 Playwright specs.
- Added: ADR-0018 (slice A: DATA_SET bindings only, ADMIN authoring, version bump on shape change, no reconciler yet).

[1.2.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-1.2.0-alpha.1

## [1.1.0-alpha.4] — unreleased

Initiative 9 cleanup + pilot runbook §6.

- Added: `client/e2e/axe.spec.ts` (7 WCAG 2 A/AA scans) + `admin-ui/e2e/axe.spec.ts` (9 scans). Shared `assertNoAxeViolations(page)` helper in `_fixtures.ts` on both sides.
- Added: `DER_RUN_E2E=mandatory` tier in `scripts/run_all_checks.sh` — pilot cuts fail when the Playwright CLI is unavailable; dev mode (`true`) still records NOT RUN gracefully.
- Added: pilot runbook §6.0 (TLS enforcement toggle) + §6.1 (backup-encryption key provisioning, 0400 keyfile, "lose the key = irrecoverable" warning, rotation deferred to der-1.3.0+).

[1.1.0-alpha.4]: https://github.com/socaya/der-engine/releases/tag/der-1.1.0-alpha.4

## [1.1.0-alpha.3] — unreleased

Initiative 8 part 1 — security hardening (ADR-0017).

- Added: `TlsEnforcementFilter` — rejects HTTP with 426 UPGRADE_REQUIRED when `der.security.require-tls=true`; honours `X-Forwarded-Proto`; loopback exempt by default.
- Added: `PiiMasking` static helper (maskUsername / maskEmail / maskDisplayName). Applied at `BootstrapAdminProvisioner`.
- Added: `BackupEncryption` pipes `pg_dump` output through `openssl enc -aes-256-cbc -pbkdf2`; `BackupWorker` + `RestoreWorker` take it as a dependency; archives gain `.enc` suffix when encryption is on. Key material lives in a 0400 keyfile.
- Added: `der.security.require-tls`, `der.security.tls.loopback-exempt`, `der.backup.encryption.*` config properties.
- Added: 23 new tests covering mask semantics, enforcement paths, encrypt/decrypt round-trip via a fake-openssl shell script, config validation.
- Added: ADR-0017 (TLS hard-fail in prod profile, 0400 keyfile strategy, KMS deferred to der-1.3.0+).

[1.1.0-alpha.3]: https://github.com/socaya/der-engine/releases/tag/der-1.1.0-alpha.3

## [1.1.0-alpha.2] — unreleased

Initiative 4 — local approval workflows (ADR-0016).

- Added: V013 schema — `operation_journal.{requires_approval,approved_by/at,rejected_by/at,rejection_reason}` + XOR check + partial index.
- Added: `ug.ac.mak.der.approval` package — ApprovalRequirements, ApprovalRecord, ApprovalRepository, ApprovalService (outcome enum: APPROVED / REJECTED / NOT_FOUND / NOT_REQUIRED / ALREADY_DECIDED).
- Added: `OperationJournalRepository.findPendingReadyToDrain(limit)` + `markRequiresApproval(opId)`; `JournalWorker` migrates to the new query.
- Added: `AggregateDataValueService` + `EventService` mark journal rows requiring approval when the respective config flag is on.
- Added: `ApprovalController` at `/edge-api/v1/approvals/**` (REVIEWER + ADMIN for mutations).
- Added: admin UI `EAApprovalQueue` bundled into EACoreScreens.tsx, routed at `/approvals`, nav link added.
- Added: 45 server tests + 10 admin tests + 1 Playwright spec.
- Added: ADR-0016.

[1.1.0-alpha.2]: https://github.com/socaya/der-engine/releases/tag/der-1.1.0-alpha.2

## [1.1.0-alpha.1] — unreleased

Initiative 5 — edge-to-orgUnit binding (ADR-0015).

- Added: V012 schema — `edge_node.org_unit_id/display_name/path/bound_at/bound_by` + consistency check.
- Added: `ug.ac.mak.der.orgunit` package — `EdgeOrgUnitBinding`, `EdgeOrgUnitBindingRepository`, `OrgUnitBindingService`, `OrgUnitScopeInterceptor`, `OrgUnitBodyCachingFilter`, `OrgUnitWebConfig`.
- Added: `OrgUnitBindingController` — `GET`/`POST /edge-api/v1/system/org-unit` (ADMIN-gated for writes; `confirm=true` required for rebind).
- Added: EA-01 admin screen now surfaces the bound OU, offers an OU picker when unbound, and a rebind dialog when bound.
- Added: ADR-0015 (sub-tree binding, interceptor-level enforcement, no auto-purge, default max_depth=3).
- Added: 45 server tests covering the record, repository, service, interceptor, body-caching filter, and controller.

[1.1.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-1.1.0-alpha.1

## [1.0.0-rc.2] — unreleased

Addresses roadmap gaps G2/G3/G4/G5. Only G1 (pilot evidence) remains before stable.

- Added: full test suites for admin-ui `edgeApi.ts` (51 cases), `AuthContext`, `RequireAuth`, `App` (20 route cases). admin-ui Vitest coverage lifted 75/70/55/75 → 100/91/99/100.
- Added: `edgeApi.ts` coverage lifts in client (every endpoint) + Drafts alternate error-type branches + SignIn redirect-state. Client Vitest coverage lifted 97/85/84/97 → 99/94/95/99.
- Added: `DraftTest` / `DraftRepositoryTest` / `DraftControllerTest` plus branch coverage additions for `BackupWorker`, `RestoreWorker`, `RemoteArchiveStore`, `BackupController`, `RestoreController`. Server JaCoCo exclusions reduced from seven to one (`BackupWorker` only, awaiting Testcontainers-Postgres in der-1.1.0).
- Added: Playwright per-screen E2E — `client/e2e/dc-screens.spec.ts` (18 DC screens) and `admin-ui/e2e/ea-screens.spec.ts` (19 shipped EA components). Shared `_fixtures.ts` mocks baseline + per-screen endpoints via `page.route()`.
- Added: `docs/releases/der-1.0.0-rc.2.md` release note aggregating the above.

[1.0.0-rc.2]: https://github.com/socaya/der-engine/releases/tag/der-1.0.0-rc.2

## [1.0.0-rc.1] — unreleased

Phase 09 — pilot deployment release candidate (ADR-0014).

- Added: `deployment/pilot/` — install.sh / smoke_test.sh / upgrade.sh / rollback.sh / env.pilot.example / systemd / nginx / postgres bootstrap.
- Added: `docs/operations/pilot-runbook.md` — authoritative install → day-2 → troubleshoot → upgrade → rollback runbook with TLS/certbot and RPM-family adaptation.
- Added: ADR-0014 Pilot deployment topology (systemd + bare metal; no containers in rc.1).

[1.0.0-rc.1]: https://github.com/socaya/der-engine/releases/tag/der-1.0.0-rc.1

## [0.8.0-alpha.1] — unreleased

Phase 08 — NFR evaluation harness (ADR-0013).

- Added: `scripts/evaluation/` Python-stdlib-only harness (der_bench, backlog_recovery, resource_sampler, backup_integrity + run_phase_08.sh orchestrator).
- Added: `docs/evaluation/phase-08-methodology.md` operator runbook with interpretation guidance for NFR-15..19, 27, 29, 35 plus a pointer table for the design NFRs.
- Added: `docs/evaluation/evidence/phase-08/README.md` explaining the pilot bundle layout; dev-laptop numbers deliberately uncommitted.
- Added: ADR-0013 NFR evaluation harness.
- Added: 7 Python unit tests covering the measurement scripts via in-process ThreadingHTTPServer.

[0.8.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-0.8.0-alpha.1

## [0.7.0-alpha.1] — unreleased

Phase 07 — backup / restore engine (ADR-0012).

- Added: V011 schema — backup_run.{archive_path, archive_bytes, remote_key, started_at, finished_at, pg_dump_version}, restore_run.{started_at, finished_at, archive_path, kind}.
- Added: BackupWorker + RestoreWorker subprocess pipeline (pg_dump / pg_restore).
- Added: RemoteArchiveStore — plain-HttpClient S3-compatible push/pull.
- Added: BackupDrainJob Quartz job as a 15-minute safety-net on `der.backup.drain.cron`; controllers call `Scheduler.triggerJob()` on insert so admin requests run immediately rather than waiting for the next cron tick.
- Added: BackupController + RestoreController REST surfaces (ADMIN role).
- Added: multipart upload staging for RESTORE_KIND=UPLOAD.
- Added: ADR-0012 Backup and restore engine.

[0.7.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-0.7.0-alpha.1

## [0.5.0-alpha.1] — unreleased

Phase 04 — durable journal worker drains edge → central (ADR-0010).

- Added: V008 schema — operation_journal.{idempotency_key,next_attempt_at,last_response}.
- Added: JournalWorker + JournalPublisher + ResponseClassifier.
- Added: JournalDrainJob Quartz job + SchedulerConfig trigger.
- Added: JournalWorkerController (health, pause, resume).

[0.5.0-alpha.1]: https://github.com/socaya/der-engine/releases/tag/der-0.5.0-alpha.1

## [0.4.0-alpha.6] — unreleased

Phase 05 part B — custom DHIS2 app hosting (ADR-0005 FINALIZED).

- Added: V007 `installed_app` table.
- Added: `ug.ac.mak.der.apps.*` — AppInstaller, InstalledAppRepository,
  AppStaticHandler.
- Added: AppsController (install / list / enable / uninstall) with
  ADMIN gate for mutations.
- Added: `/dhis-web-<key>/**` static handler + SecurityConfig matcher.
- ADR-0005 moved from PROPOSED to ACCEPTED.

[0.4.0-alpha.6]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.6

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
