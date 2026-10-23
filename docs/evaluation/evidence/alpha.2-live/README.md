# der-2.0.2-alpha.2 — live integration evidence

**Captured:** 2026-10-23
**Edge:** `localhost:8085` (DER 2.0.2-alpha.2-SNAPSHOT, Java 21.0.10)
**Central:** `localhost:8080/dhis` (DHIS2 2.44-SNAPSHOT)
**Database:** PostgreSQL 17.10, schema `der`, Flyway at V025 (26 migrations)

## Boot sequence (what worked)

1. `set -a; source .env.local; set +a` exports DB + session + DHIS2 creds.
2. `java -jar der-server-2.0.2-alpha.2-SNAPSHOT.jar` → Tomcat on 8085.
3. Flyway: `Schema "der" is up to date` (no migrations pending).
4. SpringBoot ApplicationContext initialized **in 1.661s** after
   stabilization fixes (see "Fixes applied" below).

## Fixes applied during stabilization

Before alpha.2 could boot against a real database, 10 `@Repository`
and 1 `@Component` carried `@ConditionalOnBean(JdbcTemplate.class)` /
`@ConditionalOnMissingBean(...)` conditions. These evaluate before
auto-config ordering completes, so Spring Boot's documentation warns
against using them on application beans. Live boot failed in a chain
of `UnsatisfiedDependencyException` at startup.

| File | Fix |
|---|---|
| `orgunit/EdgeOrgUnitBindingRepository.java` | removed `@ConditionalOnBean(JdbcTemplate.class)` |
| `security/SecurityAuditVerifier.java` | ditto |
| `workflows/referral/ReferralInboxRepository.java` | ditto |
| `workflows/aggregate/DatasetCompletionRepository.java` | ditto |
| `workflows/tracker/TrackedEntityRepository.java` | ditto |
| `workflow/CaptureWorkflowRepository.java` | ditto |
| `workflow/CaptureWorkflowContributionRepository.java` | ditto |
| `device/EdgeDeviceRepository.java` | ditto |
| `analytics/AnalyticsRepository.java` | ditto |
| `approval/ApprovalRepository.java` | ditto |
| `workflows/referral/NoOpCentralReferralSearchClient.java` | removed `@ConditionalOnMissingBean(...)` so the fallback always registers; the HTTP variant is `@Primary` + `@ConditionalOnProperty` |

Pre-existing bug — latent since Phase 10 (`5097399`). Only surfaces
when the server actually starts against a live Postgres with
component-scanned repositories. Unit-test suite passed because
`@WebMvcTest` slices skip the DI graph that triggers the conditions.

## Live probes

| Probe | Status | Latency | Evidence |
|---|---|---|---|
| `GET /edge-api/v1/system/health` (unauth) | 200 OK | &lt;10ms | `system-health.json` |
| `POST /edge-api/v1/auth/sign-in` (bootstrap admin) | 200 OK, session cookie issued | ~70ms | — |
| `GET /edge-api/v1/system/storage` (admin) | 200 OK, `status=OK`, 785.4 MB free | &lt;10ms | `system-storage.json` |
| `GET /edge-api/v1/compat` (admin) | 200 OK, probe reachable, 2.44-SNAPSHOT confirmed | ~2.6s | `compat.json` |

### Compat engine highlights

- `probeReachable: true`
- `centralVersion: "2.44-SNAPSHOT"` (matches `der.dhis2.compatibility.pinned-version`)
- `profileName: "V2_44"`
- `capabilities.trackerApi: "TRACKER_ONLY"`
- `capabilities.importSummaryShape: "TRACKER_IMPORT_REPORT"`
- `capabilities.webMessageShape: "DHIS2_2_44"`

## Gaps surfaced

- **FR-16-07 at-rest encryption not yet applied operationally** —
  bootstrap admin's TOTP secret (if enrolled) will store plaintext
  until operator sets `der.security.secret-key`. Alpha.2 adds the
  envelope infrastructure; alpha.3 should document key-rotation
  runbook + CLI.
- **FR-14-09 storage alarm thresholds use defaults** — 512 MiB warn /
  128 MiB reject on this host. Operators should override via
  `der.storage.warn-bytes` and `.reject-bytes` for production.
- **Metadata sync endpoint responded empty** — `GET /sync/metadata`
  returned no body. Scheduler cadences in `der.sync.*.cron` fire on
  cron schedule only; alpha.3 should expose a `POST /sync/metadata/run`
  idempotent trigger for operator-initiated sync.
- **No DC-side user attribution yet.** The single
  `DER_DHIS2_USER=admin` service account owns ALL outbound submissions
  — the client user who actually captured the data is not propagated.
  **See ADR-0032 (`docs/architecture/decisions/0032-...md`) for the
  attribution engine plan.**

## Next steps

- Playwright DC smoke suite: once UI is served (served from
  `client/dist/` by DER), capture auth + navigation + aggregate entry
  as HAR + axe reports.
- Implement ADR-0032 client-user attribution engine in alpha.3.
