# DER 0.4.0-alpha.2 — Phase 03.5, aggregate writes + durable journal rows

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** aggregate dataValueSets write path end-to-end; operation_journal entries created atomically so Phase 04's worker has something to drain. **Architecture:** hybrid per [ADR-0004](../architecture/decisions/0004-hybrid-dhis2-edge-emulation.md).

**Release label:** `der-0.4.0-alpha.2`
**Git tag:** `der-0.4.0-alpha.2`
**Maven artifact:** `ug.ac.mak.der:der-server:0.4.0-SNAPSHOT`
**Pinned DHIS2 reference:** `2.44-SNAPSHOT`
**Supersedes:** `der-0.4.0-alpha.1` (which was read-only)

## New in this release

| Area | Deliverable |
|---|---|
| Schema | `V003__phase03_5_aggregate_writes_and_journal.sql` — `aggregate_data_value` (compound-key unique, `value_version` optimistic-lock) + `operation_journal` (state machine). |
| Domain | `AggregateDataValue`, `OperationJournalEntry` records in `ug.ac.mak.der.workflows.aggregate`. |
| Repositories | `AggregateDataValueRepository` (Postgres `RETURNING` upsert + `existsById`), `OperationJournalRepository` (JSONB payload passthrough). |
| Service | `AggregateDataValueService` validates every row against the metadata mirror then atomically (`@Transactional`) writes the value AND a PENDING journal row (FR-09-02 atomic outbox). |
| Controller | `POST /api/dataValueSets` accepts DHIS2 2.44 dataValueSets envelope with per-row category/attribute combo overrides. Response is DHIS2 2.44 `ImportSummary` shape (`status / importCount / conflicts / responseType`). |
| Sync status | `SyncStatusService` now consults `AggregateDataValueRepository.existsById` and returns `LOCALLY_COMMITTED` for real rows; placeholder `UNKNOWN` elsewhere. |
| Audit | `AGGREGATE_WRITE_SUCCESS` / `AGGREGATE_WRITE_REJECTED` per row, with compound key + reason. |

## Live-verified behaviour (end-to-end)

With DER on this host pointed at the running DHIS2 2.44-SNAPSHOT:

- Sign-in via DER_SESSION cookie: 200.
- `POST /api/dataValueSets` with real `dataElement` + `orgUnit` from the mirror:
  - First submission → `status=SUCCESS, imported=1, ignored=0, conflicts=[]`.
  - Resubmit same compound key → `status=SUCCESS, imported=1` (upsert; DB row's `value_version` incremented to 2).
  - Type-mismatched value (`not-numeric-at-all` for `INTEGER_ZERO_OR_POSITIVE`) → `status=WARNING, imported=0, ignored=1, conflicts=[{object:"<compound>", value:"value '...' is not an integer"}]`.
- DB state after the above three POSTs:
  - `aggregate_data_value`: 1 row, `value_version=2`.
  - `operation_journal`: 2 PENDING rows for `AGGREGATE_DATA_VALUE` (one per successful POST; dedupe by compound key is Phase 04).
- `GET /edge-api/v1/records/aggregate_data_value/{value_id}/sync-status` on the stored row → `status=LOCALLY_COMMITTED`.
- `GET /edge-api/v1/records/aggregate_data_value/{random}/sync-status` → `status=UNKNOWN`.

Evidence JSON: `docs/evaluation/evidence/phase-03/<commit>/live-aggregate.json`.

## Test state

- Server `./mvnw verify`: **291/291 tests PASS**, JaCoCo **100% line + 100% branch** across every included package, SpotBugs clean (16 reviewed suppressions in `server/quality/spotbugs-exclude.xml`), Checkstyle clean.
- Flyway V001 + V002 + V003 applied cleanly against the live local `der` database.
- Client Vitest: unchanged from alpha.1 (59/59; 100% line / 100% function / 100% statement / 92.25% branch — threshold still 90% for the alpha, raised back to 100% when the stable `der-0.4.0` cuts).

## Spec deviations (continuing)

1. DHIS2 version pin remains `2.44-SNAPSHOT` (ADR-0002). Phase 09 re-pin to a GA still required.
2. Client branch-coverage threshold is still 90% (vs project default 100%). Will raise to 100% for stable `der-0.4.0` once Phase 03.6 writes give those UI paths real exercise.

## Deliberate non-goals (still out of scope)

- **Event writes** (`POST /api/events`) and **tracker writes** (`POST /api/tracker`) — Phase 03.6.
- **Journal worker** that drains PENDING → IN_FLIGHT → CENTRAL_ACCEPTED — Phase 04.
- **Program-rule execution** — Phase 03.6.
- **Category-option-combo validity** against the metadata — Phase 03.6.
- **Period format validation** (e.g. `2026Q1` parse) — Phase 03.6.
- **Custom DHIS2 app hosting** — Phase 05 per [ADR-0005](../architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md).
- **Shared-visibility E2E across two LAN clients** — depends on reading via `GET /api/dataValueSets`, which is Phase 03.6.
- **Playwright E2E / OWASP scan** — unchanged opt-in.

## Reproducing

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine && git checkout der-0.4.0-alpha.2
psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql
cp .env.local.example .env.local  # fill in secrets

set -a; source .env.local; set +a
bash scripts/run_all_checks.sh

# Boot and submit:
java -jar server/target/der-server-0.4.0-SNAPSHOT.jar &
# wait for V003 to apply
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$DER_BOOTSTRAP_ADMIN_USERNAME\",\"password\":\"$DER_BOOTSTRAP_ADMIN_PASSWORD\"}"
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/sync/metadata | jq .
# Pick real IDs out of the mirror and submit a dataValueSet:
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/api/dataValueSets \
  -H 'Content-Type: application/json' \
  -d '{"dataValues":[{"dataElement":"<real-de>","orgUnit":"<real-ou>","period":"2026Q1","value":"42"}]}' | jq .
```
