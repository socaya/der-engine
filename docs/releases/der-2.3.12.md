# der-2.3.12 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.11`

## Headline

**Conflict detection on contribution merge (spec §12 + §48–§50).**
When two steps contribute divergent values for the same logical
identity, the coordinator stops the run from completing until an
operator resolves the conflict. Resolve → run auto-completes +
compiled payload lands in `operation_journal`.

## 1. Schema (V057)

```sql
CREATE TABLE der.workflow_conflict (
  conflict_id         UUID PRIMARY KEY,
  run_id              UUID NOT NULL REFERENCES capture_workflow_run,
  canonical_revision  INT NOT NULL,
  category            VALUE_CONFLICT | EVENT_DATA_VALUE_CONFLICT |
                      TEI_ATTRIBUTE_CONFLICT | RELATIONSHIP_CONFLICT |
                      IDENTITY_CONFLICT | COMPLETION_CONFLICT,
  identity_key        TEXT NOT NULL,
  identity_json       JSONB NOT NULL,
  versions            JSONB NOT NULL,
  status              PENDING_REVIEW | RESOLVED_AUTOMATICALLY
                      | RESOLVED_MANUALLY | DISMISSED,
  resolution_strategy TEXT,
  resolution_value    JSONB,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  detected_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  UNIQUE (run_id, identity_key)
);
```

Re-detect is idempotent via `(run_id, identity_key)` UNIQUE.

## 2. ConflictDetector service

Scans all contributions for a run and emits one conflict row per
divergent identity. Three identity shapes in 2.3.12:

### AGGREGATE_CELL
```
(dataElement, categoryOptionCombo, attributeOptionCombo, orgUnit, period)
```
Different values on the same cell → VALUE_CONFLICT.

### EVENT_DATA_VALUE
```
(event UID, dataElement)
```
Only tracked when event payload carries an explicit `event` UID
— the within-event field-level merge path (§2.3.1) stays untouched.

### TEI_ATTRIBUTE
```
(trackedEntity, attribute UID)
```

Spec §12 rule applied: identical values → no conflict (same-value
dedup); different values → PENDING_REVIEW.

## 3. Coordinator integration

```java
contribute() {
  ...
  revision = upsertCanonicalState(...)
  conflicts.detect(runId, revision, all)         // ← new
  hasPendingConflicts = conflicts.hasPending(runId)
  if (allComplete(readiness) && !hasPendingConflicts) {
    completeRun(...)                              // write to journal
  }
}
```

New `tryComplete(runId)` method exposed so after a conflict is
resolved the UI can trigger completion.

## 4. API (spec §69)

```
GET  /edge-api/v1/workflows/runs/{runId}/conflicts
     → { runId, pending, conflicts: [...] }

POST /edge-api/v1/workflows/runs/{runId}/conflicts/{conflictId}/resolve
     { strategy: "LATEST_WINS" | "EARLIEST_WINS" | "MANUAL" | "DISMISSED",
       value:    <chosen value as JSON> }
     → { conflictId, resolved: true, runCompleted: boolean }
```

Resolve returns `runCompleted=true` when it was the last pending
conflict and all steps had already contributed — the run transitions
to COMPLETED and emits the compiled payload in the same request.

## 5. Verified live — full lifecycle

```
seed workflow (2 steps on same (DE, CoC))
openRun                                          → OPEN

step 0 contributes value=10                      → AWAITING
step 1 contributes value=24 (same cell)          → AWAITING (not COMPLETED)
                                                    completed=false

GET /conflicts
  pending=1  conflicts=1
  category=VALUE_CONFLICT  status=PENDING_REVIEW
  identity={"kind":"AGGREGATE_CELL","dataElement":"DE_MALARIA",
            "categoryOptionCombo":"F_5_14"}
  versions: 2 — values=[10, 24]

POST /conflicts/{id}/resolve strategy=LATEST_WINS value=24
  resolved=true  runCompleted=true

GET /runs/{runId}
  state=COMPLETED  submissionJournalOpId=2c5649dc  ✓

GET /conflicts
  pending=0  total=1
  conflict[0].status=RESOLVED_MANUALLY  strategy=LATEST_WINS  ✓
```

## 6. Files changed

```
database/migrations/V057__workflow_conflicts.sql                    (new)
server/.../workflow/ConflictDetector.java                            (new)
server/.../workflow/WorkflowRunCoordinator.java                      — detector wire-in; blocks completion while PENDING_REVIEW; tryComplete()
server/.../web/WorkflowRunController.java                            — GET /conflicts + POST /conflicts/{id}/resolve
VERSION / server/pom.xml / admin-ui/package.json / sw.js             — bumped to 2.3.12
```

## 7. What this doesn't do yet (deferred per spec)

| Spec section | Status |
|---|---|
| §48 DELETE_UPDATE_CONFLICT | queued |
| §48 CREATE_CREATE_CONFLICT | queued |
| §48 DUPLICATE_ENTITY_CONFLICT | queued |
| §48 METADATA_VERSION_CONFLICT | needs metadata-snapshot layer first |
| §48 WORKFLOW_STATE_CONFLICT / COMPLETION_CONFLICT | needs richer state model |
| §48 ACCESS_CONFLICT | needs run-time access check hooks |
| §50 Auto-resolution policies (LATEST_WINS auto, FIELD_LEVEL_MERGE auto) | configurable per workflow — later |
| Conflict UI | own stream (2.3.13+) |

Three identity shapes covered now (aggregate cell, event data value,
TEI attribute) are the ones a facility actually hits in production
aggregate + tracker + event flows.

## 8. Next

**2.3.13** — form-based workflow designer: section + device pickers
replacing the raw JSON textarea so operators compose workflows
without pasting UIDs.

## Build + test

```
tsc -b && vite build                       ✓ 90 modules
./mvnw -q -DskipTests clean package        ✓ 2.3.12 JAR + V057 applied
End-to-end conflict sweep                  ✓ divergent → PENDING → resolve → COMPLETED
WorkflowCompilerTest                       ✓ 14/14
```
