# DER 1.3.0-alpha.4 — Initiative 10 slice B: reconciler scaffolding

> **Scope:** Builds the substrate the drain-time reconciler will
> stand on. Per-step payloads from `/api/dataValueSets` writes carrying
> workflow headers are now buffered into a new
> `capture_workflow_step_contribution` table. Drain-time
> recomposition is **not** in this alpha — that ships in alpha.5+.

**Release label:** `der-1.3.0-alpha.4`
**Git tag:** `der-1.3.0-alpha.4`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V020** —
  `capture_workflow_step_contribution` table with `(contribution_id,
  run_id, step_id, payload JSONB, submitted_by, submitted_device_id,
  submitted_at)` and `UNIQUE (run_id, step_id)` so re-POSTs overwrite
  idempotently. FKs cascade through runs + steps; device FK is
  `ON DELETE SET NULL`.
- `ug.ac.mak.der.workflow.CaptureWorkflowContribution` record +
  `CaptureWorkflowContributionRepository` (`upsert`, `findByRun`).
- `CaptureWorkflowContributionIngest` — Spring MVC `afterCompletion`
  handler. When a POST/PUT/PATCH on `/api/dataValueSets` returned
  2xx AND the request carried `X-DER-Workflow-Run` +
  `X-DER-Workflow-Step` headers AND the payload's `dataSet` matches
  an enabled workflow AND the ordinal maps to a real step — persist
  the raw body as a contribution. Fail-open on any error
  (ADR-0025 D-REC-7).
- `GET /edge-api/v1/workflows/runs/{runId}/contributions` — any
  authenticated user; returns the per-run contribution list without
  the raw JSON payload (metadata only; payload drill-in lands with
  the reconciler UI).
- `edgeApi.listWorkflowContributions(runId)` helper.
- ADR-0025 locks in: `UNIQUE (run_id, step_id)` overwrite semantics,
  ordinal-via-header step selection, write-through ingest, no
  drain-time recomposition yet.

## Behaviour

```
POST /api/dataValueSets  { "dataSet": "ds1", … }
    X-DER-Workflow-Run:  "ou1-2026-10"
    X-DER-Workflow-Step: "0"
    X-DER-Device-Id:     "<uuid>"
    ↳ OrgUnitScopeInterceptor (unchanged)
    ↳ DeviceOwnerEnforcementInterceptor (ADR-0023)
    ↳ dataValueSet controller (unchanged — write happens here)
    ↳ CaptureWorkflowContributionIngest.afterCompletion
         resolveForDataSet("ds1") → workflow w
         ordinal 0 → step s
         startRun(w.id, "ou1-2026-10", actor) → run
         UPSERT contribution(run.id, s.id, body, actor, device, now)
```

| Request shape | Hook outcome |
|---|---|
| no workflow headers | no-op (pre-slice-B flow) |
| step header isn't an int | no-op + WARN |
| `dataSet` not in payload | no-op |
| workflow lookup empty | no-op |
| ordinal doesn't map to a step | no-op + WARN |
| handler returned non-2xx | no-op |
| handler threw | no-op |
| all preconditions met | contribution upserted |

## Test state

- **1161 server tests** pass (was 1143 + 18 new: 4 repository + 14
  ingest). `mvn verify` green.
- **223 admin-ui tests** pass (was 222 + 1 edgeApi row). Vitest at
  **100 / 90.68 / 97.82 / 100** — thresholds unchanged.
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.5+)

- Drain-time recomposition — the actual reconciler logic that merges
  contributions into a single DHIS2 write.
- Event + tracker ingest hooks — needed when their reconcilers
  ship.
- Payload diff / conflict detection on re-POST (today's semantics is
  plain overwrite via the UNIQUE constraint).
- Admin UI drill-into-contribution-payload (ships with the
  reconciler UI).
- Signed / notarised contributions.
- Workflow run state transitions tied to contribution counts
  (ships with recomposer).
- Initiative 2 part 1 server plugin, Initiative 3 referral,
  Initiative 8 part 3 MFA.

## Promotion path

`der-1.3.0-alpha.4` → alpha.5 (drain-time reconciler + run-state
transitions + event/tracker ingest hooks) → alpha.6+ (Initiative
2/3/8) → stable `der-1.3.0`.
