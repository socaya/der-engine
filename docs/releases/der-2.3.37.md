# der-2.3.37 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.36`

## Headline

**Structured `suggestedValue` on validation issues.** Replaces the
regex ASSIGN-value extractor the client was using with a first-class
field on the issue record. The field survives any future tweaks to
the human-readable issue message.

## 1. Schema (V063)

```sql
ALTER TABLE der.workflow_validation_issue
    ADD COLUMN suggested_value TEXT;
```

Null for every non-ASSIGN issue; populated for ASSIGN with the value
the program-rule evaluator computed.

## 2. Server

- `ProgressiveValidator.Issue` grows a `suggestedValue` component.
  The old 7-arg constructor is kept as a convenience overload so
  non-ASSIGN call sites (SHOWERROR, HIDEFIELD, SETMANDATORYFIELD,
  …) don't need to change.
- `ProgramRuleEvaluator.assignIssue` now writes the resolved value
  into the structured field in addition to the message string.
- `rewritePersistedIssues` writes the column; `findForRun` reads it.
- `WorkflowRunController` adds `suggestedValue` to the API payload.

## 3. Client

- `ValidationIssue` interface (client + admin-ui) gains an optional
  `suggestedValue: string | null`.
- `useRunValidation` prefers the structured value; falls back to the
  message-text parser for pre-V063 issue rows so operators who
  upgrade mid-run see no regression.
- `RunValidation` admin page renders `→ <value>` after the field
  reference when the structured value is present.

## 4. Verified live

```
Seed synthetic ASSIGN rule (data_expression='77', target 'DE_TARGET')
Trigger via contribution of #{trigger}
GET /workflows/runs/{runId}/validation
  → issues: 1
    PROGRAM_RULE_ASSIGN suggestedValue= 77      ✓

client/npm test                   ✓ 158/158 (+1 fallback coverage)
server/CaptureWorkflowControllerTest  ✓ 20/20
```

## 5. Files changed

```
database/migrations/V063__workflow_validation_suggested_value.sql    (new)
server/.../workflow/ProgressiveValidator.java        — Issue.suggestedValue
                                                        + INSERT/SELECT columns
server/.../workflow/ProgramRuleEvaluator.java        — assignIssue stores value
server/.../web/WorkflowRunController.java            — API payload
client/src/api/edgeApi.ts                            — ValidationIssue.suggestedValue
client/src/hooks/useRunValidation.ts                 — prefer structured, keep regex fallback
client/src/hooks/useRunValidation.test.tsx           — + legacy-fallback test
client/src/screens/AggregateEntry.test.tsx           — fixture carries suggestedValue
client/src/screens/DC06to17.test.tsx                 — fixture carries suggestedValue
admin-ui/src/api/edgeApi.ts                          — ValidationIssue.suggestedValue
admin-ui/src/screens/workflow/RunValidation.tsx      — renders → <value> on the issue
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.37
```
