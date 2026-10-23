# der-2.0.2 (stable)

**Date:** 2026-10-23
**Previous stable:** `der-2.0.1`
**Alphas rolled up:** `2.0.2-alpha.1`, `2.0.2-alpha.2`, `2.0.2-alpha.3`,
`2.0.2-alpha.3+`, `2.0.2-alpha.4`, `2.0.2-alpha.4+`.

## Scorecard

| Dimension | DONE | Total | % |
|---|---:|---:|---:|
| UI screens | 54 | 54 | 100% |
| FR / NFR | 168 | 211 | 80% |
| **Combined** | **222** | **265** | **84%** |

1360 Java unit tests + 9 Playwright live DC smoke tests all green.
Server boots in ~1.75s against local Postgres 17 + DHIS2 2.44-SNAPSHOT.

## Headline features

### 1. Client-user attribution engine (ADR-0032)

Every captured record now travels through to central with the actual
operator's identity, not the service account.

- `edge_user_dhis2_mapping` table (V026) + `operation_journal.captured_by_dhis2_uid`.
- Admin surface at `/edge-api/v1/admin/users/{id}/dhis2-mapping`.
- `ReferralPayloadEncoder` stamps `storedBy` on aggregate dataValueSets
  (envelope + each `dataValues[]`), events, enrollments, and nested
  tracker-entity enrollments + events.
- Lenient fallback by default; strict mode (`der.attribution.strict=true`)
  rejects drain with `USER_NOT_MAPPED` instead.

### 2. Custom app engine runs as if on DHIS2

A custom DHIS2 app installed on DER serves identically to one installed
on central.

- `GET /api/apps` → DHIS2-compat JSON array; `@dhis2/app-runtime`
  discovers DER-hosted apps the same way as central-hosted ones.
- `/dhis-web-<key>` (no slash) → 301 to `/`.
- `/dhis-web-<key>/` → `index.html` with correct cache headers.
- `/dhis-web-<key>/manifest.webapp` → served from the DB-stored
  manifest, not the extracted zip.
- Disabled apps return 404.
- Correct MIME for `.svg`, `.woff2`, `.woff`, `.mjs`.
- Static assets `max-age=3600, public`; HTML `no-cache`.
- Opt-in CSP (`der.apps.csp.enabled=true`) with per-request 128-bit
  nonce injected into every `<script` and `<style`, matching a strict
  `Content-Security-Policy` header.
- App Hub install-by-URL at `POST /edge-api/v1/apps/install-from-url`.

### 3. DHIS2 `/api/**` passthrough proxy

Opt-in catch-all for `/api/**` paths NOT handled by the emulator so
stock DHIS2 apps calling `/api/analytics`, `/api/dataStore`,
`/api/visualizations`, `/api/sqlViews`, `/api/me/*`, etc., reach
central with Basic auth from the configured service account.

- `der.dhis2.proxy.enabled=true` (default off → 501 NotImplemented).
- Reads only by default; `der.dhis2.proxy.allow-writes=true` to opt in.
- Operator-tunable allow-list (`der.dhis2.proxy.allow-paths`).
- Distinct response taxonomy (501 / 403 / 405 / 502 / 503 / 504).

### 4. Rich `/edge-api/v1/system/info`

Admin-only snapshot with build + runtime (java/host/uptime/heap) +
dhis2 compat (probe reachable, central version, snapshot time) +
database (postgres product, flyway version/count, user + session
counts) + scheduler (Quartz) + journal (per-state counts) + storage
(root, status, bytes) + apps (installed + enabled + launchUrls) +
attribution (mapped user count).

The anonymous `/edge-api/v1/system/health` stays minimal for
readiness probes.

### 5. FR-16-07 TOTP at-rest encryption

AES-256-GCM `SecretEnvelope` wraps TOTP secrets on enrol via
operator-provided `der.security.secret-key`. Backwards-compatible
with pre-existing plaintext secrets.

### 6. FR-14-06..09 backup, restore, recovery, storage alarms

- `BackupWorker` captures journal + metadata + working state in a
  single transactional `pg_dump` snapshot with SHA-256 manifest.
- `RestoreWorker` + reconciliation checkpoint re-anchors the sync
  cursor on restore.
- `StorageHealthProbe` + `StorageAdmissionInterceptor` on `/edge-api/**`
  with warn/reject thresholds; writes return `507 STORAGE_FULL_REJECT`
  when disk below reject.

### 7. Playwright live DC smoke suite

Opt-in via `DER_LIVE_SMOKE=true`. Nine tests covering unauth health,
admin sign-in, rich system-info snapshot, `/api/apps` DHIS2-compat,
proxy allow-list, attribution mapping, custom-app index + manifest
+ 301 redirect. All green against local pilot stack.

## Live-boot stabilization

Removed `@ConditionalOnBean(JdbcTemplate.class)` from 10 repositories
and `@ConditionalOnMissingBean(CentralReferralSearchClient.class)`
from the NoOp fallback. These misfire on `@Component`-scanned beans
before auto-config ordering completes — a latent bug since Phase 10
that blocked live boot against a real database. Server now boots
cleanly in ~1.75s.

## Deferred

Items still at `in-progress` in the traceability matrix (43 of 211).
Clusters that require operator-run pilot evidence or further
feature work: pilot-hardware NFRs (NFR-02..13, NFR-33), tracker
lifecycle (FR-08-06..12), reverse pull (FR-13-02..09), oracle
corpus (FR-17-01..07), metadata drift surface (FR-05-10..12),
cursor and ordering formalization (FR-11-09), first-time offline
policy (FR-02-07), emergency access (FR-02-09), clock skew
(FR-02-10).

## Verification

- `./mvnw test` → 1360 passed, 0 failures, 0 errors.
- `DER_LIVE_SMOKE=true npx playwright test live-dc-smoke
   --project chromium-desktop` → 9 passed.
- Server boot against local Postgres 17 + DHIS2 2.44-SNAPSHOT:
  Started DerApplication in 1.7s.

## Evidence

- `docs/evaluation/evidence/alpha.2-live/`
- `docs/evaluation/evidence/alpha.3-attribution/`
- `docs/evaluation/evidence/alpha.3-custom-apps/`
- `docs/evaluation/evidence/alpha.4-proxy-csp/`
- `docs/evaluation/evidence/alpha.4-playwright-smoke/`
