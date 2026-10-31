# der-2.3.11 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.10`

## Headline

**Workflow Run Coordinator + Submission Orchestrator.**
Multi-user, multi-device, multi-step workflows now execute end-to-end
on DER — spec §27–§33 and §43 land in this release.

A run opens, operators contribute per step from different devices,
the coordinator enforces dependencies, the merge engine
(`WorkflowCompiler`) materialises a canonical state after each
contribution, and when every step is complete the compiled
DHIS2-shaped payload lands in `operation_journal` for the
`JournalPublisher` to push to central DHIS2.

Aligned with
`docs/requirements/DER_Workflow_Module_Comprehensive.md`.

## 1. Schema

### V055 — run submission tracking

```sql
ALTER TABLE der.capture_workflow_run
  ADD COLUMN submission_journal_op_id  UUID
      REFERENCES operation_journal(operation_id) ON DELETE SET NULL,
  ADD COLUMN submission_error          TEXT;
```

### V056 — canonical state (spec §11.2)

```sql
CREATE TABLE der.canonical_workflow_state (
  run_id         UUID PRIMARY KEY REFERENCES capture_workflow_run,
  revision       INT NOT NULL DEFAULT 1,
  payload        JSONB NOT NULL,
  completeness   TEXT NOT NULL CHECK IN ('EMPTY','PARTIAL','COMPLETE'),
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contributor_user_id   UUID,
  last_contributor_device_id UUID
);
```

The journal (`operation_journal`) is the durable history; the
canonical state is the current merged view.

## 2. New service — `WorkflowRunCoordinator`

```java
openRun(workflowId, businessKey, actor)                        // §7.2
contribute(runId, stepId, payloadJson, submittedBy, deviceId)  // §9 participation
markRejected(runId, reason, actor)
computeReadiness(workflow, contributions)                      // §27, §30
readCanonicalState(runId)                                      // §11.2
```

### Readiness states (spec §30 subset)

```
BLOCKED       — dependency not satisfied
READY         — can be contributed
COMPLETE      — contribution received
```

Future extensions for IN_PROGRESS / PARTIALLY_COMPLETE land when the
UI differentiates "in progress" from "complete".

### Dependency enforcement (spec §28)

A step can only be contributed when every `COMPLETES_BEFORE`
predecessor has already contributed. Violation → **409 STEP_BLOCKED**
naming the blocker.

### Merge → materialise → submit

```
contribute()
   ├─ validate step belongs to workflow
   ├─ enforce dependency readiness
   ├─ upsert contribution
   ├─ WorkflowCompiler.compile(workflow, allContributions)
   ├─ upsert canonical_workflow_state (revision++)
   ├─ computeReadiness()
   ├─ if all steps COMPLETE:
   │    ├─ write OperationJournalEntry (PENDING)
   │    ├─ stamp submissionJournalOpId on run
   │    └─ run.state = COMPLETED
   └─ publish WorkflowStepReadyEvent for each newly READY step
```

### Entity type mapping (spec §13/§19/§25)

```java
DATA_SET                → AGGREGATE_DATA_VALUE
PROGRAM                 → TRACKED_ENTITY
PROGRAM_STAGE | SECTION → PROGRAM_STAGE_EVENT
```

## 3. New API — `WorkflowRunController` (spec §69)

```
POST /edge-api/v1/workflows/{workflowId}/runs
  { businessKey }                                              authenticated

POST /edge-api/v1/workflows/runs/{runId}/steps/{stepId}/contribute
  { payload: "<json string>", deviceId: UUID }                 authenticated

POST /edge-api/v1/workflows/runs/{runId}/reject
  { reason: "<non-blank>" }                                    authenticated

GET  /edge-api/v1/workflows/runs/{runId}                       authenticated
GET  /edge-api/v1/workflows/runs/{runId}/canonical             authenticated
GET  /edge-api/v1/workflows/runs/{runId}/readiness             authenticated
```

### Security

Catalogue CRUD stays ADMIN. The run endpoints are operator-level —
any authenticated user with a device may open a run, contribute, or
reject.

## 4. Local event bus (spec §33)

Two Spring `ApplicationEventPublisher` events emitted:

```java
WorkflowStepReadyEvent    (workflowId, runId, stepId)
WorkflowRunCompletedEvent (workflowId, runId, submissionJournalOpId)
```

Consumers wire via `@EventListener` — the UI event stream + queue
service + rule engine all plug in here when they land.

## 5. Verified live — end-to-end run

Scenario: aggregate ANC workflow, 2 DATASET_SECTION steps, step 1
depends on step 0 COMPLETES_BEFORE.

```
openRun …                                   → 200 OPEN           ✓
contribute step 1 BEFORE step 0             → 409 STEP_BLOCKED   ✓
readiness before any contribution:
  step0 = READY, step1 = BLOCKED            ✓
contribute step 0                           → 200 completed=false
  run.state = AWAITING
  readiness: step0=COMPLETE, step1=READY    ✓
canonical state: revision=1 completeness=PARTIAL
  payload.dataValues.length = 1             ✓
contribute step 1                           → 200 completed=true
  run.state = COMPLETED
  submissionJournalOpId = 3b1fb4de…         ✓
canonical state: revision=2 completeness=COMPLETE
  payload.dataValues.length = 2             ✓
operation_journal: PENDING row at op 3b1fb4de created
  for JournalPublisher pickup               ✓
```

The compiled payload from `WorkflowCompiler` (14 tests, all 9 section
kinds) lands directly in the DHIS2 outbound queue — no handwritten
glue between the merge engine and the sync surface.

## 6. Files changed

```
database/migrations/V055__workflow_run_submission.sql         (new)
database/migrations/V056__canonical_workflow_state.sql        (new)
server/.../workflow/CaptureWorkflowRun.java                   — + submissionJournalOpId, submissionError + 9-arg legacy ctor
server/.../workflow/CaptureWorkflowRepository.java            — SELECT/mapper new cols; setRunSubmission helper
server/.../workflow/CaptureWorkflowService.java               — findRunById + contributionsForRun; @Autowired on primary ctor
server/.../workflow/WorkflowRunCoordinator.java               (new)
server/.../web/WorkflowRunController.java                     (new)
server/.../security/SecurityConfig.java                       — /workflows/runs/** operator-level
VERSION / server/pom.xml / admin-ui/package.json / sw.js      — bumped to 2.3.11
```

## 7. What this doesn't do yet (deferred per spec)

| Deferred piece | Target |
|---|---|
| §48–50 conflict detection + resolution | 2.3.12 (now that canonical state exists) |
| §35 program rule execution | own stream |
| §37–42 metadata snapshot + versioning | own stream |
| §36 progressive validation | own stream |
| §62–63 peer-to-peer workflow exchange | own stream |
| §51–52 queue + assignment UI | own stream |

The coordinator is the keystone — everything above hooks into it via
events (`workflow.step.ready`, `workflow.run.completed`) or by
reading the canonical state.

## 8. Next

- **2.3.12** — conflict detection on contribution merge (spec §12 +
  §48): when two steps supply divergent values for the same
  `(DE, CoC, AOC, OU, period)` or `(event, DE)` identity, mark the
  canonical state `CONFLICTED` and expose a resolution UI.
- **2.3.13** — form-based workflow designer replacing the raw JSON
  textarea.

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.11 JAR + V055 + V056 applied
End-to-end run coordinator sweep           ✓ open → block → contribute × 2 → compile → journal write
WorkflowCompilerTest                       ✓ 14/14
```
