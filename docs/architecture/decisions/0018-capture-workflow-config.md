# ADR-0018: DER capture-workflow configuration (slice A)

- Status: **ACCEPTED (slice A — minimum viable schema + designer)**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0004 (hybrid edge), ADR-0006 (compat engine),
  ADR-0007 (program rules), ADR-0010 (journal worker),
  ADR-0016 (approval workflows), post-1.0 roadmap Initiative 10

## Context

The project proposal frames "distributed DHIS2 workflows" as the
core problem: capture is split across people/roles that DHIS2's own
metadata model does not express. The post-1.0 roadmap scopes this as
Initiative 10 — the largest single initiative in the plan.

ADR-0016 (approval) landed the simplest shape of "hold the drain
until a human says OK." Initiative 10 is the general case: multi-step
capture, per-step field scoping, cross-step dependencies, and a
drain-time reconciler that projects the local multi-step state onto
DHIS2's native shape.

This ADR commits to **slice A** only: the data model + the
authoring surface + the first-step hand-off semantics. Device-level
owners, cross-metadata-root bindings, the event/tracker reconciler,
and workflow import/export are **slice B** (`der-1.3.0`).

## Decisions (slice A pre-approved per roadmap)

| # | Decision | Chosen |
|---|---|---|
| D13 | Workflow binding granularity | Only `DATA_SET` in slice A. The schema reserves `PROGRAM`, `PROGRAM_STAGE`, `DATA_SET_SECTION` for slice B. |
| D14 | One workflow per DHIS2 root? | Yes — single root per workflow in slice A. |
| D15 | Workflow authoring role | `ADMIN` only in slice A. Dedicated `WORKFLOW_DESIGNER` role deferred to slice B. |
| D16 | Reconciler failure semantics | Stay `OPEN` and surface in conflict review (reuses ADR-0009). No lossy drain in slice A. |
| D17 | Workflow versioning | In-flight runs keep the old definition; the edit creates a new workflow version row. Mid-flight migration never happens automatically. |
| D18 | Workflow export/import | Deferred to slice B. |
| D19 | Workflow handling when DHIS2 metadata changes | Grace-period: open runs tolerate the change for 30 days (per compat snapshot), then abort to `CONFLICT_REVIEW`. |

## Schema (V014)

Five tables. Every row owned by `edge_node.edge_id` (singleton; no
tenancy).

```sql
capture_workflow (
    workflow_id          UUID PRIMARY KEY,
    display_name         TEXT NOT NULL,
    bound_metadata_kind  TEXT CHECK IN ('DATA_SET'),  -- slice A only
    bound_metadata_id    TEXT NOT NULL,
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    version              INT NOT NULL DEFAULT 1,
    created_at, updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES edge_user(user_id)
);

capture_workflow_step (
    step_id       UUID PRIMARY KEY,
    workflow_id   UUID NOT NULL REFERENCES capture_workflow(workflow_id) ON DELETE CASCADE,
    ordinal       INT NOT NULL,
    display_name  TEXT NOT NULL,
    owner_role    TEXT NOT NULL CHECK IN ('ADMIN','OPERATOR','REVIEWER'),
    step_kind     TEXT NOT NULL CHECK IN ('CAPTURE','REVIEW','APPROVE','DISPATCH'),
    UNIQUE (workflow_id, ordinal)
);

capture_workflow_field (
    step_id      UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    field_ref    TEXT NOT NULL,  -- "<dataElement>.<coc>" for aggregate
    requirement  TEXT NOT NULL CHECK IN ('REQUIRED','OPTIONAL','READONLY','HIDDEN'),
    PRIMARY KEY (step_id, field_ref)
);

capture_workflow_dependency (
    step_id             UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    depends_on_step_id  UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    dependency_kind     TEXT NOT NULL CHECK IN ('COMPLETES_BEFORE'),  -- slice A only
    PRIMARY KEY (step_id, depends_on_step_id)
);

capture_workflow_run (
    run_id            UUID PRIMARY KEY,
    workflow_id       UUID NOT NULL REFERENCES capture_workflow(workflow_id),
    workflow_version  INT NOT NULL,
    business_key      TEXT NOT NULL,  -- orgUnit/period for DATA_SET
    current_step_id   UUID REFERENCES capture_workflow_step(step_id),
    state             TEXT NOT NULL CHECK IN ('OPEN','AWAITING','COMPLETED','REJECTED'),
    created_at, updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES edge_user(user_id),
    UNIQUE (workflow_id, workflow_version, business_key)
);
```

The `UNIQUE (workflow_id, workflow_version, business_key)` prevents
duplicate runs for the same org-unit/period under the same workflow
version.

## Service surface (slice A)

- `CaptureWorkflowService.list()` — returns all workflows.
- `CaptureWorkflowService.get(workflowId)` — one workflow + its
  steps + fields + dependencies.
- `CaptureWorkflowService.save(workflow)` — upsert the whole
  bundle. Bumps `version` when the step/field/dependency shape changes.
- `CaptureWorkflowService.resolveForDataSet(dataSetId)` — returns the
  enabled workflow bound to this dataSet, if any.
- `CaptureWorkflowService.startRun(workflowId, businessKey, actor)` —
  creates a run row at state=OPEN, current_step_id = first step.

Slice A does **not** advance runs through steps or project them
onto the journal — that's wired by slice B.

## REST surface

```
GET  /edge-api/v1/workflows                      ADMIN+
POST /edge-api/v1/workflows                      ADMIN
GET  /edge-api/v1/workflows/{id}                 ADMIN+
PUT  /edge-api/v1/workflows/{id}                 ADMIN
DELETE /edge-api/v1/workflows/{id}               ADMIN
GET  /edge-api/v1/workflows/{id}/runs            ADMIN+
```

## Admin UI (slice A)

Two new screens bundled into `EACoreScreens.tsx`:

- `EACaptureWorkflowList` (EA-CWF-01) at `/workflows` — catalogue
  with create / enable-toggle / delete.
- `EACaptureWorkflowDesigner` (EA-CWF-02) at `/workflows/:id` —
  edit metadata binding (DATA_SET only in slice A), add/edit/
  remove steps, add/remove dependencies. Field pane is a simple
  JSON textarea in slice A (the structured UI lands in slice B).

## Not in scope (slice B promises)

- Device-level step owners (needs Initiative 1).
- Event / tracker / section bindings.
- Reconciler that projects multi-step state onto DHIS2 shape.
- Workflow export/import JSON format.
- DC-CWF device-client screens.
- Structured per-step field editor.
- Dependency kinds other than `COMPLETES_BEFORE` (`VALUE_EQ`,
  `VALUE_GT`, `ANY_VALUE`).

## Consequences

- `der-1.2.0-alpha.1` ships the data model + authoring surface but
  **no behavioural change** to writes: the drain still goes through
  the existing journal + ADR-0016 approval path. Slice B wires the
  reconciler into the drain.
- Admins can start modelling workflows now and iterate on them
  before slice B lands.
- The schema is backwards-compatible — existing deployments pick
  up the empty tables with zero migration risk.
