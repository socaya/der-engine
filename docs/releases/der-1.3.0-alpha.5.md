# DER 1.3.0-alpha.5 — Initiative 10 slice B closeout: state transitions + event/tracker ingest

> **Scope:** Closes the three outstanding slice B items — run-state
> transitions, "reconciler" (reduced to a completion signal — DHIS2
> performs the merge via upsert; see ADR-0026), and event/tracker
> contribution ingest. Slice B is feature-complete.

**Release label:** `der-1.3.0-alpha.5`
**Git tag:** `der-1.3.0-alpha.5`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

### Run-state transitions (ADR-0026 D-RST-1 / 2 / 3)

- `CaptureWorkflowService.advanceRunState(runId)` — counts
  contributions, drives the state machine
  `OPEN → AWAITING → COMPLETED`. Idempotent on `COMPLETED` /
  `REJECTED`.
- `CaptureWorkflowRepository` gains `findRun(runId)`,
  `updateRunState(runId, state, updatedAt)`, `countContributions(runId)`.
- `WORKFLOW_RUN_COMPLETED` audit event emitted exactly once per run
  on the `OPEN|AWAITING → COMPLETED` transition. Event participates
  in the ADR-0021 hash chain via the existing trigger.

### Event + tracker ingest (ADR-0026 D-RST-4)

- `CaptureWorkflowContributionIngest.shouldIngest()` extended to
  `/api/events`, `/api/tracker/events`, `/api/tracker/enrollments`.
  Sniff order inside the payload mirrors the enforcement
  interceptor: `programStage` first, then `program`, then (for
  `dataValueSets`) `dataSet`.
- No new tables — events + tracker contributions reuse the alpha.4
  `capture_workflow_step_contribution` buffer.

### Why no drain-time Java merger

ADR-0025 originally envisaged a drain-time service that composes
contributions into a single DHIS2 write. On closer reading of the
existing pipeline, each contribution already flows through the
normal data path (orgUnit scope, device-owner enforcement, the
`AggregateDataValueService` → `OperationJournal` chain). Central
DHIS2 upserts the merged state at drain time via its native
`(dataElement, orgUnit, period, coc, aoc)` constraint — the end
state is identical to a single-user commit, which is the stated
requirement. ADR-0026 D-RST-5 records this rationale. The state
machine + completion audit are what remained.

## Behaviour

```
POST /api/events  { "program": "p1", ... }
    X-DER-Workflow-Run:  "clinic-A-2026-W42"
    X-DER-Workflow-Step: "0"
    ↳ (existing interceptors)
    ↳ CaptureWorkflowContributionIngest.afterCompletion
         resolveWorkflow → sniff programStage → program → dataSet
         startRun(w.id, "clinic-A-2026-W42", actor) → run
         UPSERT contribution(run.id, step.id, ...)
         advanceRunState(run.id):
             contributions == steps.size  → COMPLETED (returns true)
                                          + audit WORKFLOW_RUN_COMPLETED
             contributions > 0 && state=OPEN → AWAITING
```

| Run state | Trigger |
|---|---|
| OPEN | run just started by `startRun`, no contributions yet |
| AWAITING | first contribution ingested |
| COMPLETED | contribution count ≥ step count |
| REJECTED | reserved — not emitted in alpha.5 |

## Test state

- **1181 server tests** pass (was 1161 + 20 new: 6 repository + 7
  service + 7 ingest). `mvn verify` green.
- Admin-ui: unchanged (223 tests, 100/90.68/97.82/100).
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred post-slice-B)

- `REJECTED` transition / rejection UI.
- Programmatic re-open of a `COMPLETED` run.
- Per-step payload diffing / conflict detection on re-POST.
- Tracker-specific business-key inference (operators set
  `X-DER-Workflow-Run` explicitly).
- Lifecycle webhooks on state transitions.
- Initiative 2 part 1 (DHIS2 Edge Agent server plugin).
- Initiative 3 option A (chain-via-hub referral).
- Initiative 8 part 3 (MFA).

## Promotion path

Slice B is now complete. The remaining 1.3.0 initiatives (2, 3, 8)
have independent scopes and can land in alpha.6+ in any order, or
be rolled into a stable `der-1.3.0` as-is.
