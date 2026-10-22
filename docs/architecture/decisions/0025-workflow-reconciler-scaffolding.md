# ADR-0025 — Capture-workflow reconciler scaffolding

- **Status:** Accepted (Phase 12 / der-1.3.0-alpha.4)
- **Related:** ADR-0018 (capture-workflow config), ADR-0022 (device
  owners), ADR-0023 (enforcement), ADR-0024 (binding + import/export)
- **Roadmap:** Initiative 10 slice B — "event/tracker reconciler"

## Context

The capture-workflow data model has let admins compose multi-step
flows since alpha.1 of 1.2.0, and alpha.3 of 1.3.0 widened the
binding to PROGRAM / PROGRAM_STAGE. What remains for slice B is the
"re-align at drain time" story from the project proposal: capture a
dataValueSet across N steps, keep the DHIS2-visible outcome a single
unified write.

The hard part isn't the final merge — it's **buffering** the per-step
contribution so the reconciler has something to re-align. Alpha.4
ships only the buffer and ingest hook; drain-time recomposition
lands in a later alpha when run-state transitions are specified.

## Decisions

### D-REC-1 — `capture_workflow_step_contribution` buffers per-step payloads

V020 creates:

```
contribution_id    UUID PK
run_id             UUID NOT NULL FK → capture_workflow_run(run_id) ON DELETE CASCADE
step_id            UUID NOT NULL FK → capture_workflow_step(step_id) ON DELETE CASCADE
payload            JSONB NOT NULL
submitted_by       UUID NULL FK → edge_user(user_id)
submitted_device_id UUID NULL FK → edge_device(device_id) ON DELETE SET NULL
submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (run_id, step_id)
```

The `UNIQUE (run_id, step_id)` constraint makes the contribution
*append-with-replace per step*. Capturing the same step twice
overwrites the earlier contribution — mirroring how DHIS2 treats
dataValueSets that re-POST.

### D-REC-2 — Ingest hook: write-through, not blocking

After `OrgUnitScopeInterceptor` and `DeviceOwnerEnforcementInterceptor`
let the request through, a new post-handler service
(`CaptureWorkflowContributionIngest`) records a contribution row
asynchronously (within the request's transaction, but logically
"after" the controller) when:

- The request path is `/api/dataValueSets` (alpha.4 scope — event /
  tracker ingest extends in alpha.5 alongside their reconcilers).
- A workflow applies to the payload's `dataSet`.
- The request includes a `X-DER-Workflow-Run` header with a
  business-key for the run. Operators who don't send the header are
  running the pre-workflow flow; capture succeeds, no contribution
  is recorded.

### D-REC-3 — Business-key ownership stays with the caller

The run's `business_key` is caller-chosen (e.g. an orgUnit + period
tuple for aggregate flows). The ingest uses
`CaptureWorkflowService.startRun(workflowId, businessKey, actor)` so
re-POSTs land on the same run row — matching the idempotent service
contract from alpha.1.

### D-REC-4 — Step selection: ordinal from the header

The hook needs to know *which* step the payload belongs to. Alpha.4
reads an `X-DER-Workflow-Step` header carrying the step's ordinal
(0-indexed int). Later alphas may infer the step from field-set
intersection, but ordinal-via-header keeps the contract explicit and
testable now.

### D-REC-5 — No drain-time recomposition yet

The reconciler itself (merging contributions into a single DHIS2
write at drain time) ships in alpha.5+. Alpha.4 strictly builds the
substrate.

### D-REC-6 — Admin UI shows contributions per run

The existing `/workflows/:id/runs` list gains a per-run expansion
that lists each step's contribution with timestamp + submitter. Pure
read; no action buttons.

### D-REC-7 — Fail-open on contribution-write failures

If the hook can't persist the contribution (DB down, workflow gone,
step id mismatch), the API response is unchanged — the dataValueSet
POST still returns its original result and the caller sees no
degradation. We log WARN. This preserves ADR-0004 (capture is always
available).

## Non-goals

- Drain-time recomposition / merge.
- Event + tracker ingest hooks (alpha.5+ with their reconcilers).
- Payload diffing / conflict detection on re-POST — plain overwrite
  via the UNIQUE constraint.
- Signed / notarised contributions.
- Streaming / websocket contribution notifications.
- Admin UI drill-into-contribution-payload — alpha.4 shows timestamp
  + submitter metadata, not the raw JSON (that lands with the
  reconciler UI).

## Consequences

- V020 is an additive migration with no backfill — existing runs
  retain their current state and gain zero contribution rows.
- The new headers are **optional**. Pre-slice-B clients continue to
  work unchanged.
- Workflow runs that never receive contributions remain in `OPEN`
  state forever (same as today). State transitions tied to
  contributions ship with the drain-time recomposer.
- `UNIQUE (run_id, step_id)` makes re-POSTs cheap and idempotent at
  the schema level — the hook doesn't need to pre-check.
