# DER 2.0.1-alpha.2 — close 21 FR gaps to verified DONE

> **Scope:** Implements the 13 PENDING FRs (deployment lifecycle, ops
> admin, testability) + the 5 verification-failed items from alpha.1
> (completeness, event version check, TEI capture, dep-ordered
> batching) + 3 doc-driven NFRs (component separation, portability,
> time correctness). 21 items promoted to DONE after per-item
> verification.

**Release label:** `der-2.0.1-alpha.2`
**Git tag:** `der-2.0.1-alpha.2`

## New

### Server

- `V024__phase15_completeness_and_depchain.sql` — dataset_completion
  table (FR-06-06).
- `V025__phase15_tracked_entities.sql` — tracked_entity table with
  GIN on attributes (FR-08-02).
- `DatasetCompletionRepository` + `DatasetCompletionController`
  (`POST/GET /edge-api/v1/aggregate/completion`, FR-06-06).
- `TrackedEntityRepository` + `TrackedEntityController`
  (`POST/GET /edge-api/v1/tracked-entities`, FR-08-01/02).
- `EventService.handleOne` enforces `expectedVersion` when supplied
  (FR-07-02); backwards-compatible 9-arg `EventInput` ctor.
- `OperationJournalRepository.findPendingReadyToDrain` skips ops
  whose `supersedes` target is still in flight (FR-12-03).
- `OperationsAdminController` at `/edge-api/v1/admin/ops/**`:
  - `/users/scope` (FR-15-06)
  - `/backup/trigger` + `/backup/verify` (FR-15-07)
  - `/settings` get/post (FR-15-08)
  - `/support-bundle` zip export (FR-15-09)
  - `/reports/operational` (FR-15-10)
  - `/decommission` (FR-01-10, requires `confirm=="CONFIRMED"`)
- `EdgeUserRepository.setDisabled` for decommission + central
  reconciliation.

### Operator-facing

- `scripts/deploy/install.sh` — reproducible, versioned install
  (FR-01-08).
- `scripts/deploy/upgrade.sh` + `rollback.sh` — compatibility-checked
  upgrade with rollback (FR-01-09).
- `scripts/deploy/connectivity-policy.yml` — connectivity-policy
  template (FR-01-07).
- `scripts/evaluation/regression_suite.sh` — drives through the FR
  coverage set; writes evidence bundle under
  `docs/evaluation/evidence/phase-15/<run-id>/regression.json`
  (FR-17-10).

### Docs

- `docs/operations/component-and-portability.md` — component map,
  reference environment, time correctness, local-vs-central status
  distinction, a11y notes (NFR-23/24/25/28).

## CSV status refresh

21 items flipped `in-progress` / `pending` → `done` after per-item
verification (code + repository + controller + test + statement
coverage).

| Status | Count |
|---|---:|
| `done` | 26 (↑ 21) |
| `in-progress` | 178 |
| `pending` | 7 |

## Test state

- **1282 server tests** pass (was 1277 + 5 new: 3 completion repo + 2
  TEI repo).
- Admin-ui + client: unchanged.
- Checkstyle + SpotBugs clean.

## Non-goals (alpha.3 next)

- NFR-15 p95 latency measurement run.
- NFR-16 throughput measurement.
- NFR-18 CPU/mem/disk budget enforcement.
- NFR-19 concurrency harness extended to 1/5/10/20 sessions.
- NFR-20 operator metrics endpoint.
- NFR-26 axe-sweep + fixes.
- NFR-29 backup restore round-trip verified.
