# ADR-0026 — Workflow run-state transitions + event/tracker ingest

- **Status:** Accepted (Phase 12 / der-1.3.0-alpha.5)
- **Related:** ADR-0018, ADR-0022, ADR-0023, ADR-0024, ADR-0025
- **Roadmap:** Initiative 10 slice B — closes the "event/tracker
  reconciler" item from the roadmap

## Context

Alpha.4 shipped the contribution buffer and the aggregate ingest
hook. Two gaps remained:

1. Workflow runs never leave `OPEN` — the state machine is defined
   in the schema but has no transition logic.
2. Only `/api/dataValueSets` has a contribution hook. Event / tracker
   writes bypass the buffer.

The project proposal frames the reconciler as "re-align captured
data so central DHIS2 sees exactly the shape of a single-user
commit." Because the alpha.4 ingest routes each step's contribution
through the existing data pipeline (OrgUnitScopeInterceptor,
AggregateDataValueService, OperationJournal), **DHIS2 already receives
one dataValueSet POST per contribution and performs the merge via
`(dataElement, orgUnit, period, coc, aoc)` upsert**. There is no
need for a drain-time Java merge — the end state at central is
identical to a single-user commit, which is the stated requirement.

What *is* missing: an authoritative signal that a workflow run is
done. That's the state transition this alpha ships.

## Decisions

### D-RST-1 — State machine: OPEN → AWAITING → COMPLETED

Transitions are driven by contribution counts, not explicit calls:

| From | Trigger | To |
|---|---|---|
| OPEN | first contribution ingested | AWAITING |
| AWAITING | all steps have a contribution | COMPLETED |
| COMPLETED | re-POST (new contribution for an existing step) | COMPLETED (idempotent) |

`REJECTED` remains defined by the schema but is reserved for a
future `/api/workflows/runs/{id}/reject` flow — out of scope for
alpha.5.

### D-RST-2 — Transition fires inside the ingest hook, same transaction

After `contributions.upsert(...)`, the hook calls
`CaptureWorkflowService.advanceRunState(runId)`. Both writes share
the servlet request's transaction so a partial failure rolls back
to a consistent state.

### D-RST-3 — Audit event WORKFLOW_RUN_COMPLETED on OPEN|AWAITING → COMPLETED

Emits exactly once per run (the service checks the current state
before writing). The event participates in the ADR-0021 hash chain
via the trigger — no new audit code.

### D-RST-4 — Event + tracker ingest reuses the alpha.4 hook

`CaptureWorkflowContributionIngest.shouldIngest()` widens to:

- `/api/dataValueSets` — sniff `dataSet` (unchanged).
- `/api/events` — sniff `event.programStage` first, then `event.program`.
- `/api/tracker/events` — same as `/api/events`.
- `/api/tracker/enrollments` — sniff `program`.

The business-key for events is the request's
`X-DER-Workflow-Run` header, same as aggregate. Callers that don't
set the header remain pre-slice-B (no contribution, no state
transition).

### D-RST-5 — Admin UI shows the state badge

The runs list (already rendered under the designer) gets a small
per-row state tag. Pure UI; no new endpoint.

## Non-goals

- Drain-time Java merge of contributions (central DHIS2 already does
  this via upsert; see Context above).
- `REJECTED` transition / rejection UI.
- Per-step reconciler payload diffing.
- Programmatic re-open of a COMPLETED run.
- Workflow lifecycle hooks (webhooks on state transition).
- Tracker-specific business-key inference (TEI UID vs. enrollment
  UID) — operators set `X-DER-Workflow-Run` explicitly.

## Consequences

- No schema change for alpha.5 — all new behaviour is in the
  service + ingest hook.
- Runs that existed before alpha.5 retain `OPEN` state and only
  advance when new contributions arrive. Pre-existing contributions
  that completed a run won't retroactively transition it — operators
  who want retroactive advancement run a one-shot batch
  (undocumented, not in scope).
- Hash-chain audit grows by one row per workflow completion;
  negligible at pilot volumes.
