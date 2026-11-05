# ADR-0036 — Data-module capture form API (workflow-scoped)

**Status:** Proposed
**Date:** 2026-11-06
**Decision owners:** socaya
**Related ADRs:** ADR-0004 (hybrid DHIS2 edge emulation),
ADR-0007 (program-rule execution at the edge),
ADR-0018 (capture-workflow config — slice A),
ADR-0019 (edge device identity),
ADR-0022 (device-owned workflow steps),
ADR-0023 (device-owner enforcement),
ADR-0027 (chain-via-hub referral),
ADR-0032 (client-user attribution),
ADR-0034 (inbound data pull),
ADR-0035 (pull-write interlock)
**DER modules touched:** Data (primary), Workflows (primary),
DHIS2 (consumer), Synchronisation (consumer),
Administration (authority)

## Context

Through V088 the DER server exposes a full **write** surface per
ADR-0004 (`/api/dataValueSets`, `/api/events`, `/api/tracker`, the
`/edge-api/v1/tracked-entities`, `/tracker/enrollments`,
`/tracker/events` family). Program-rule evaluation runs server-side
on every write per ADR-0007. ADR-0018 (slice A) introduced the
**capture-workflow** data model — multi-step captures with per-step
field scoping (`REQUIRED` / `OPTIONAL` / `READONLY` / `HIDDEN`),
step-level `COMPLETES_BEFORE` dependencies, and `capture_workflow_run`
business-keyed by `(orgUnit, period)` for DATA_SET. ADR-0022 added
`owner_device_id` to steps; ADR-0023 enforces it at write time.
Captures flowing through a workflow run already stamp
`operation_journal.workflow_run_id` for lineage.

A capture client cannot today be shown "the right form for this
operator on this device at this moment" because:

- There is **no server endpoint** that projects a workflow's current
  step into a form schema. The client would have to join
  `capture_workflow_step` × `capture_workflow_field` ×
  `metadata_data_set` × … itself.
- There is **no way to discover**, from the client, which steps are
  owned by the current device (ADR-0022) vs ownable by role, and
  therefore which fields the user should see as editable vs
  context-only.
- There is **no way to list open runs** that a given actor /
  device can pick up, or to see which runs are blocked waiting on
  another actor's step completion (ADR-0018 D14 dependency graph).
- The free-standing (non-workflow) capture case — "operator captures
  an aggregate dataSet with no workflow bound" — also needs a
  form-assembly endpoint, but as a *secondary* shape, not the
  primary.

The Data module's server surface therefore needs two tiers of form
assembly, both co-designed with the Workflows module:

1. **Workflow-run-scoped forms** (primary) — "give me the form for
   the current step of this run, as rendered from the perspective of
   this device + user, with the step's field scoping applied."
2. **Free-standing forms** (secondary) — "give me the flat form for
   this dataSet / programStage, with no workflow binding", used only
   when `CaptureWorkflowService.resolveForDataSet()` returns none.

## Decision

Add a `CaptureFormController` family under `/edge-api/v1/capture/`
in the **Data** module. The primary endpoints are run-scoped and
consult **Workflows** on every request; the secondary endpoints are
the flat-form equivalents used when no workflow applies.

### D-CAP-1 — Workflow-run-scoped is the default

A client about to render a capture form **always** calls the
run-scoped endpoint first. The server:

1. Resolves the applicable `capture_workflow` from the metadata
   binding (`DATA_SET` in slice A; `PROGRAM`, `PROGRAM_STAGE`,
   `DATA_SET_SECTION` reserved by ADR-0018 for slice B).
2. Finds or starts a `capture_workflow_run` for the business key
   (`orgUnit|period` for DATA_SET; business-key encoding for the
   slice-B kinds lands with the reconciler).
3. Picks the current step; if the run is `AWAITING` on an upstream
   dependency, the response surfaces the blocked state and the
   dependency graph instead of a form.
4. Projects the step's `capture_workflow_field` scoping onto the
   flat form shape — fields marked `HIDDEN` are omitted from the
   response, `READONLY` fields carry the prefetched value but no
   editable affordance, `OPTIONAL` + `REQUIRED` are editable with
   validation hints.
5. Stamps `ownership` in the response: `ownerRole`,
   `ownerDeviceId?`, `isMyStep` (true iff the requesting
   principal's role matches `owner_role` AND — when
   `owner_device_id` is set — the request's `X-DER-Device-Id`
   header matches). When `isMyStep` is false the form is returned
   in a read-only shape so other actors can see progress without
   being able to submit.

### D-CAP-2 — Run-scoped endpoint set (Phase 1)

```
GET /edge-api/v1/capture/runs?role=&device=&state=&limit=&cursor=
    → { runs: [{ runId, workflowId, workflowDisplayName,
                  bindingKind, bindingId, businessKey,
                  state, currentStepId, currentStepDisplayName,
                  ownerRole, ownerDeviceId?, isMyStep,
                  blockedOnStepIds?, createdAt, updatedAt }],
         nextCursor }

POST /edge-api/v1/capture/runs
      body: { workflowId, businessKey }
    → { runId, currentStepId, state }
      /* Thin facade over CaptureWorkflowService.startRun. */

GET /edge-api/v1/capture/runs/{runId}
    → { runId, workflow: {...}, steps: [...], dependencies: [...],
         currentStepId, state, blockedOnStepIds?,
         ownership: { ownerRole, ownerDeviceId?, isMyStep } }

GET /edge-api/v1/capture/runs/{runId}/form
    → See D-CAP-3 for shape; projects current step onto a form.

GET /edge-api/v1/capture/runs/{runId}/data
    → { cells: {...} | dataValues: {...},
         committedBySteps: { stepId: [fieldRef, ...] },
         lastUpdatedAt }

POST /edge-api/v1/capture/runs/{runId}/advance
      body: { reason? }
    → { runId, currentStepId, state }
      /* Advances only when the current step's field-completion
       * contract is satisfied + all COMPLETES_BEFORE deps are
       * COMPLETED. 409 with the failing reason otherwise. */
```

### D-CAP-3 — Form-projection shape (phase-invariant)

Every `/form` endpoint (run-scoped or free-standing) returns the
same envelope so the client renders one component:

```json
{
  "formType": "AGGREGATE | EVENT_STAGE | TRACKER_STAGE",
  "bindingKind": "DATA_SET | PROGRAM | PROGRAM_STAGE | DATA_SET_SECTION",
  "bindingUid": "<uid>",
  "displayName": "...",
  "ownership": {
    "ownerRole": "OPERATOR | REVIEWER | ADMIN",
    "ownerDeviceId": "<uuid>|null",
    "isMyStep": true|false
  },
  "sections": [{
    "sectionUid": "<uid>|null",
    "displayName": "...",
    "fields": [{
      "fieldRef": "<de>|<coc>    (AGGREGATE)",
      "dataElementUid": "...",
      "categoryOptionComboUid": "...|null",
      "displayName": "...",
      "valueType": "TEXT | NUMBER | ...",
      "optionSetUid": "...|null",
      "requirement": "REQUIRED | OPTIONAL | READONLY | HIDDEN",
      "mandatoryOnProgramRule": true|false,
      "prefilled": "...|null"
    }]
  }],
  "upstreamContext": [{
    "stepId": "<uid>", "stepDisplayName": "...",
    "fields": [{ "fieldRef": "...", "value": "...",
                  "committedAt": "...", "committedBy": "<uuid>" }]
  }]
}
```

`HIDDEN` fields are omitted from `sections` entirely. `READONLY`
fields are returned in `sections` with `requirement:"READONLY"` and
`prefilled` set. Fields owned by upstream *completed* steps are
grouped under `upstreamContext` so the current actor can see what
came before without those fields cluttering the editable form.

### D-CAP-4 — Free-standing (no-workflow) endpoints (Phase 2)

Used only when `CaptureWorkflowService.resolveForDataSet()` /
`resolveForProgram()` / `resolveForProgramStage()` returns none.
Clients hit them explicitly; the run-scoped endpoints never fall
through to them silently (that would hide a mis-bound workflow).

```
GET /edge-api/v1/capture/datasets/{dataSetUid}/form
GET /edge-api/v1/capture/datasets/{dataSetUid}/data
      ?orgUnit=&period=
GET /edge-api/v1/capture/programs/{programUid}/stages
GET /edge-api/v1/capture/programs/{programUid}/stages/{stageUid}/form
GET /edge-api/v1/capture/programs/{programUid}/events
      ?orgUnit=&from=&to=&limit=&cursor=
GET /edge-api/v1/capture/events/{eventUid}/detail
```

The envelope is the same as D-CAP-3 but `ownership.isMyStep` is
always `true` (no workflow gate) and `upstreamContext` is always `[]`.

### D-CAP-5 — Tracker reads (Phase 3)

Independent of the workflow run shape — a TEI's enrollments and the
events inside them are always listable regardless of which run a
given event belongs to. The Data module's capture flow for tracker
threads through these endpoints both inside and outside workflows:

```
GET /edge-api/v1/capture/trackedEntityTypes/{uid}/attributes
GET /edge-api/v1/capture/programs/{uid}/trackedEntityType
GET /edge-api/v1/capture/trackedEntities/{teiUid}/enrollments
      ?programUid=
GET /edge-api/v1/capture/enrollments/{enrollmentUid}/events
      ?programStageUid=
```

### D-CAP-6 — Device identity flows through

Every run-scoped endpoint honours the `X-DER-Device-Id` header from
ADR-0023. The header controls `ownership.isMyStep` resolution on
device-owned steps and, by extension, whether the response carries
editable fields. Missing header + device-owned step → `isMyStep =
false` + form in read-only shape (same information disclosure, no
editable affordance). This matches the write-side enforcement
contract from ADR-0023 D-DOE-3 so clients see the same outcome on
`GET /form` that they'd get on `POST /api/dataValueSets`.

### D-CAP-7 — Program rules stay dual (unchanged from Phase 1 proposal)

Write-blocking program-rule actions fire server-side via ADR-0007
on the write path (`/api/dataValueSets`, `/api/events`,
`/api/tracker`). UI-only actions (`HIDEFIELD`, `HIDESECTION`,
`HIDEPROGRAMSTAGE`, `DISPLAYTEXT`, `DISPLAYKEYVALUEPAIR`,
`CREATEEVENT`) run client-side against the mirrored rules —
`capture_workflow_field.requirement = HIDDEN` and
`programRule → HIDEFIELD` compose: a field hidden either way is
hidden; otherwise shown. The client's lightweight rule interpreter
evaluates on field-change against the field set the server returned.
No new server endpoint for pre-write rule evaluation (rejected under
the earlier draft; ADR-0007 covers the write path).

### D-CAP-8 — Error envelope

All four cases carry a structured error:

| Code                       | HTTP | Meaning |
|----------------------------|------|---------|
| `CAPTURE_PARAM_INVALID`    | 400  | missing / malformed query / body |
| `WORKFLOW_RUN_NOT_FOUND`   | 404  | runId does not exist |
| `WORKFLOW_RUN_BLOCKED`     | 409  | current step waits on `blockedOnStepIds` |
| `WORKFLOW_RUN_NOT_OWNED`   | 403  | `isMyStep` false AND client asked for the editable envelope |
| `METADATA_NOT_READY`       | 503  | mirror has not yet synced the referenced metadata |
| `DEVICE_HEADER_REQUIRED`   | 403  | step has `owner_device_id` set but no `X-DER-Device-Id` header |

`WORKFLOW_RUN_BLOCKED` always ships `blockedOnStepIds` in the body
so the client can show a "waiting on Dr Sarah's review" chip
without a second request.

### D-CAP-9 — Authorisation (Administration module)

- Reads require an authenticated session.
- A new fine-grained authority `der.capture.read` is added to the
  authority catalogue (V089). Built-in roles (ADMIN, OPERATOR,
  REVIEWER, SYNC_WORKER) receive it on upgrade through a Flyway
  seed; pre-V089 custom roles need the grant via the admin-ui
  Roles screen.
- The `isMyStep` resolution is additional and orthogonal to this
  authority — an OPERATOR with `der.capture.read` on a workflow
  whose current step requires REVIEWER sees the form in read-only
  shape (ownership gate) but is not 403'd (authority gate passes).

## Phased delivery

| # | Scope | Needs slice | Endpoints | Effort |
|---|---|---|---|---|
| **1** | Run-scoped + aggregate (DATA_SET binding only) | ADR-0018 slice A | `GET /capture/runs`, `POST /runs`, `GET /runs/{id}`, `GET /runs/{id}/form`, `GET /runs/{id}/data`, `POST /runs/{id}/advance`; `GET /capture/datasets/{uid}/form`, `GET …/data` | SMALL · ~2 days |
| **2** | Event / stage forms + list | ADR-0018 slice B PROGRAM / PROGRAM_STAGE binding (deferred) OR stand-alone | `GET /capture/programs/{uid}/stages`, `GET …/stages/{uid}/form`, `GET …/events`, `GET /events/{uid}/detail`, plus run-scoped variants for PROGRAM_STAGE bindings when slice B lands | MEDIUM · ~3 days |
| **3** | Tracker reads | — | `GET /capture/trackedEntityTypes/{uid}/attributes`, `GET /programs/{uid}/trackedEntityType`, `GET /trackedEntities/{uid}/enrollments`, `GET /enrollments/{uid}/events` | MEDIUM · ~2 days |

Program-rule pre-write evaluation stays explicitly out of scope —
revisit only if a client profile needs the server-side evaluator
exposed (ADR-0007 already covers the write path).

## Alternatives considered

- **Proxy to central for every form fetch.** Breaks ADR-0004's
  offline-first contract. Form must assemble from the DHIS2 module's
  mirror.
- **Flat form API first, workflow-scoped later.** The user's
  explicit constraint rejects this: distributed workflows are the
  primary use case, not the exception. A capture flow that defers
  workflow-awareness to later ends up with two parallel code paths
  that drift.
- **Client-side joins of `capture_workflow_*` + `metadata_*`.**
  Every client would re-implement the step-field projection + the
  ownership resolution. Centralising this on the server also gives
  the ADR-0023 device-owner enforcement a single read-side check
  mirror.
- **Dedicated client-facing rules-evaluation endpoint.** Rejected
  (rationale carried from the earlier draft; see D-CAP-7).

## Consequences

- **Workflows module becomes a required dependency** of the Data
  module's form API. The existing `CaptureWorkflowService.resolve*`
  helpers are reused; no new workflow concepts.
- **Writes still go through `/api/*`.** The run-scoped `/advance`
  endpoint only transitions the workflow state; the actual capture
  payload is still posted to the existing emulator endpoints which
  journal + drain. Clients attach `workflowRunId` on the write as
  today.
- **Slice-B readiness becomes the Phase 2 gate.** The run-scoped
  endpoint for EVENT / PROGRAM_STAGE / DATA_SET_SECTION bindings
  cannot ship until ADR-0018 slice B lands the binding kinds +
  reconciler. Phase 2 therefore ships the free-standing event-form
  endpoints first; the run-scoped variant follows slice B.
- **Device header is now mandatory for device-owned workflows** on
  reads, not just writes. Clients without a stored installation-UUID
  cannot see the editable shape of a device-owned step. This is the
  same contract as ADR-0023 D-DOE-3; clients that already send the
  header on writes get it for free.
- **Metadata-mirror readiness is explicit.** A fresh edge with no
  mirrored DHIS2 metadata returns `503 METADATA_NOT_READY`; the
  admin-ui Sync-overview already surfaces this signal.
- **Authorisation grows by one authority** (`der.capture.read`) via
  V089 Flyway; per-OU scoping remains deferred to the broader
  permission-policy initiative.
- **Test scope.** Each phase adds a controller test (8-12 cases:
  happy path, each error code in D-CAP-8, device-header flows,
  ownership resolution) plus a repository test for the
  step-field-projection logic.

## Verification

Per phase, before marking complete:

- WebMvcTest controller test covers every error code in D-CAP-8,
  the ownership-resolution matrix (owner_role match ± device match
  ± device header), and the response-shape contract.
- Repository test for the step-field projection covers
  REQUIRED / OPTIONAL / READONLY / HIDDEN scoping and the
  upstream-context grouping.
- Live-verify on the local DHIS2 2.44-SNAPSHOT:
  1. Admin defines a two-step aggregate workflow via the existing
     EACaptureWorkflowDesigner.
  2. Start a run from the client.
  3. `GET /runs/{id}/form` as the step-1 actor → editable fields
     match `capture_workflow_field` for step 1 only.
  4. Submit through `POST /api/dataValueSets` with
     `workflowRunId`; `POST /runs/{id}/advance`.
  5. `GET /runs/{id}/form` as the step-2 actor → step-1 fields
     appear under `upstreamContext`; step-2 fields are editable.
- Evidence bundle at
  `docs/evaluation/evidence/<commit>/capture-phase-<n>/`.
- Gate 33/33 PASS.
