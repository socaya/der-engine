# DER 2.0.1 — stable

> **Fifth stable release.** Honest FR/NFR implementation sweep.
> Bundles alphas 2.0.1-alpha.1..3; no code change versus
> `der-2.0.1-alpha.3`. **158 of 211 requirements (75%) are verified
> DONE**; the remaining 53 are PARTIAL with specific per-item gaps
> catalogued in `docs/implementation_status.md`.

**Release label:** `der-2.0.1`
**Git tag:** `der-2.0.1`
**DHIS2 reference:** 2.44-SNAPSHOT
**Previous:** `der-2.0.1-alpha.3` (commit `07f1dc3`)

## What the sweep closed

| Alpha | Deliverable |
|---|---|
| 2.0.1-alpha.1 | `docs/implementation_status.md` catalog + strict CSV status refresh (5 DONE verified; 23 PENDING flagged) |
| 2.0.1-alpha.2 | 21 FR gaps closed — deployment lifecycle, ops admin, testability harness, dataset completeness, event version check, TEI capture surface, dep-ordered batching |
| 2.0.1-alpha.3 | 7 NFRs + 125 code-sweep DONE promotions (158/211 total) |

## New (vs 2.0.0)

### Server

- V024 dataset completion schema; V025 tracked_entity schema.
- `DatasetCompletionController` at `/edge-api/v1/aggregate/completion`.
- `TrackedEntityController` at `/edge-api/v1/tracked-entities`.
- `OperationsAdminController` at `/edge-api/v1/admin/ops/**` (users
  scope, backup trigger/verify, settings, support-bundle,
  operational report, decommission).
- `OperatorMetricsController` at `/edge-api/v1/admin/metrics`.
- `EventService.handleOne` enforces `expectedVersion` when supplied.
- `OperationJournalRepository.findPendingReadyToDrain` skips ops with
  pending `supersedes` targets.

### Operator-facing

- `scripts/deploy/{install,upgrade,rollback}.sh` + `connectivity-policy.yml`.
- `scripts/evaluation/{nfr_sweep,regression_suite}.sh`.
- `docs/evaluation/evidence/phase-15/sample-template/` — bundle shape
  template.

### Docs

- `docs/implementation_status.md` — single source of truth for
  per-FR/NFR status (158 DONE verified, 53 PARTIAL with named gaps,
  0 PENDING).
- `docs/operations/component-and-portability.md` — NFR-23/24/25/28.

## Honest status

**158 / 211 (75%) verified DONE.** 53 remain `in-progress` with
specific gaps documented. The 53 cluster into:

- **Pilot-hardware evidence runs** (18 items — NFR-02/03/04/08..13/33,
  FR-17-01..07, FR-14-06..10). Harness ships; operators run on target
  hardware.
- **Narrow extensions to existing shipped code** (26 items — specific
  detection classifications, retention knobs, enforcement tests,
  oracle fixture corpus; e.g. FR-05-10..12, FR-07-08, FR-08-06..12,
  FR-10-04/05/10, FR-11-09/10, FR-13-02..09).
- **Policy/UX extensions** (9 items — FR-02-07/09/10, FR-04-02/06/09,
  FR-09-10, FR-14-10, FR-16-07).

**None of the 53 is scoped to a new feature.** Each is either
operator-side evidence or a surgical extension to existing shipped
code.

## Test state

- **1282 server tests** pass. `mvn verify` green.
- Admin-ui: 237 tests. Client: 153 tests. Axe-core sweep clean.
- SpotBugs + Checkstyle clean.

## Upgrade from 2.0.0

1. Stop DER.
2. Deploy new artifact; Flyway runs V024 + V025 on first boot.
3. Confirm `/edge-api/v1/system/health` + `/edge-api/v1/admin/metrics`
   both answer.
4. Operators can now run `bash scripts/evaluation/nfr_sweep.sh` to
   produce the pilot acceptance evidence bundle.

## Next

Residual 53 PARTIAL rows are candidates for a focused 2.1.0 train
(reconciliation oracle corpus + option-B peer_edge + Agent-side
polling + MFA sign-in challenge). See `docs/implementation_status.md`
for per-item gaps.
