# der-2.3.17 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.16`

## Headline

**Progressive validation (spec §36).** Every contribution to a
workflow run now runs through a validator that persists its findings
alongside the canonical state. ERROR-severity issues block completion
and surface as a red issue count on the operator queue; a per-run
`/workflows/runs/:runId/validation` page lists everything that needs
fixing.

## 1. Schema

### V058 — `workflow_validation_issue`

```sql
CREATE TABLE der.workflow_validation_issue (
  issue_id   UUID PRIMARY KEY,
  run_id     UUID NOT NULL REFERENCES capture_workflow_run,
  step_id    UUID REFERENCES capture_workflow_step,
  code       TEXT NOT NULL,
  severity   ERROR | WARNING | INFO,
  message    TEXT NOT NULL,
  field_ref  TEXT,
  detected_at TIMESTAMPTZ
);
```

Each validator pass clears the run's issue rows and reinserts the
current findings. Fixed issues disappear automatically.

## 2. `ProgressiveValidator`

Three rule categories in v1:

| Code | Severity | Fires when |
|---|---|---|
| `REQUIRED_FIELD_MISSING` | ERROR | Step declares a field with `requirement=REQUIRED` but no key with that `dataElement` / `attribute` / `trackedEntityAttribute` UID appears anywhere in the contribution payload. |
| `DUPLICATE_CONTRIBUTION` | WARNING | The same step has been contributed more than once. The latest wins; earlier are superseded. |
| `EMPTY_PAYLOAD` | WARNING | The payload is a JSON object with no data value, event, or attribute keys. |

The validator walks the payload tree so it works for any of the 16
section-kind shapes without extra parsers per domain.

## 3. Wiring

```
WorkflowRunCoordinator.contribute() → …
    conflicts.detect(...)
    issues = validator.validateRun(w, runId, all)
    hasErrors = any issue severity == ERROR
    if allComplete && !pendingConflicts && !hasErrors → completeRun()
    else → run.state = AWAITING
```

ERROR-severity issues now gate completion alongside pending
conflicts. `tryComplete()` re-runs the validator so that resolving a
conflict re-checks fields before letting the run finalise.

## 4. API

```
GET /edge-api/v1/workflows/runs/{runId}/validation
→ 200
{
  "runId": "<uuid>",
  "errorCount": 1,
  "issues": [
    { "issueId": "<uuid>", "runId": "<uuid>",
      "stepId": "<uuid>", "code": "REQUIRED_FIELD_MISSING",
      "severity": "ERROR",
      "message": "Required field 'DE_PATIENT_ID' is missing …",
      "fieldRef": "DE_PATIENT_ID" }
  ]
}

GET /edge-api/v1/workflows/queue
→ 200
{
  "rows": [
    { …, "validationErrorCount": 1 }
  ]
}
```

Both authenticated-level. Queue rows now carry
`validationErrorCount` so the inbox can render a red issue badge
without a second round-trip.

## 5. UI

- **Queue** — new "Issues" column. When `validationErrorCount > 0`,
  renders a red pill linking to the run's validation page.
- **Run validation page** — `/admin/workflows/runs/:runId/validation`.
  Shows the back link, run short-id, blocking-issues count, then
  three severity sections (Errors / Warnings / Info) each listing
  code, human message, and field reference where relevant.

## 6. Verified live

```
Phase A  workflow with REQUIRED field + run         ✓ opened
Phase B  contribute missing DE_PATIENT_ID           ✓ errorCount=1
                                                      REQUIRED_FIELD_MISSING
Phase C  GET /validation                            ✓ 1 ERROR issue
Phase D  /admin/workflows/runs/:id/validation       ✓ error section rendered
                                                      REQUIRED-missing <li> shown
Phase E  re-contribute with DE_PATIENT_ID present   ✓ errorCount=0
                                                      issues cleared
pageerrors                                          ✓ 0
```

## 7. Files changed

```
database/migrations/V058__workflow_validation_issues.sql    (new)
server/.../workflow/ProgressiveValidator.java               (new)
server/.../workflow/WorkflowRunCoordinator.java             — validate on contribute + tryComplete
server/.../web/CaptureWorkflowController.java               — queue carries validationErrorCount
server/.../web/WorkflowRunController.java                   — GET /runs/{runId}/validation
server/.../web/CaptureWorkflowControllerTest.java           — new MockBeans for coordinator + validator
admin-ui/src/api/edgeApi.ts                                 — runValidation(), ValidationIssue
admin-ui/src/screens/workflow/WorkflowQueue.tsx             — Issues column + red pill
admin-ui/src/screens/workflow/RunValidation.tsx             (new)
admin-ui/src/App.tsx                                        — /runs/:runId/validation route
admin-ui/src/styles.css                                     — ea-validation-* + ea-pill--error
VERSION / server/pom.xml / admin-ui/package.json / sw.js    — 2.3.17
```

## 8. Build + test

```
mvn test -Dtest=CaptureWorkflowControllerTest     ✓ 20/20
tsc -b && vite build                              ✓
End-to-end validation sweep                       ✓ create → contribute → inspect → fix → re-contribute
admin-ui unit tests                               241/245 (4 pre-existing baseline failures)
```

## 9. What this still doesn't do

- Section-aware field extraction (today's extractor walks the whole
  payload tree; `fields: []` on a step still means "no requirement
  check"). As operators configure field-level requirements through
  the wizard, those requirements flow into REQUIRED_FIELD_MISSING.
- DHIS2 value-type validation (e.g. "age must be an integer in
  range"). Lands with program-rule execution in 2.3.18.
- UI inline on the capture screens — right now the operator sees
  issues only on the admin queue + run page. The client capture
  screens will surface them inline when the field-level selector in
  the wizard is wired through.
