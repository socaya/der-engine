# der-2.3.20 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.19`

## Headline

**SETMANDATORYFIELD actions now gate completion.** The §35 program-
rule evaluator (2.3.18) + the mirror fix (2.3.19) that unlocked real
action types means DER now has 176 live `SETMANDATORYFIELD` rules
sitting on the mirror. This release wires that action into the §36
validation pipeline — when a rule's condition fires and the targeted
field isn't present in the merged payload, a
`PROGRAM_RULE_SETMANDATORYFIELD` ERROR issue blocks completion until
the operator captures the value.

## 1. Change

```java
// ProgramRuleEvaluator.toIssue(...)
case "SETMANDATORYFIELD" -> mandatoryIssue(runId, rule, action, values);

private ProgressiveValidator.Issue mandatoryIssue(..., Map<String,String> values) {
    final String targetUid = action.dataElementUid() != null
            ? action.dataElementUid() : action.trackedEntityAttributeUid();
    if (targetUid == null) return null;
    final String current = values.get(targetUid);
    if (current != null && !current.isBlank()) return null;   // already captured
    return new Issue(..., "PROGRAM_RULE_SETMANDATORYFIELD",
                     Severity.ERROR,
                     "Field '" + targetUid + "' is mandatory under rule '"
                       + rule.displayName() + "' …",
                     targetUid);
}
```

Semantics:

- Rule's condition evaluates to `true` → mandatory check runs.
- Target field present in the merged payload → no issue (silent pass).
- Target field missing → ERROR, run stays AWAITING.

The emitted field reference carries the DHIS2 UID so the client can
focus the right input when it surfaces the issue in-line.

## 2. Verified live

Pulled a real rule from the resynced mirror:

```
rule   RmJGs3AibzL / xen7G2HSL8y
       Hep: Treatment regimen required when HCV RNA reactive
cond   d2:hasValue(#{hcv_rna}) && #{hcv_rna} == 'reactive'
var    hcv_rna → DE iHCzDVroYHD
action SETMANDATORYFIELD · targetField = xsedz5jNxFd
```

Three scenarios against a workflow bound to the Hepatitis program:

```
Case 1  contribute hcv_rna=reactive, mandatory field MISSING    ✓ errorCount=1
                                                                  PROGRAM_RULE_SETMANDATORYFIELD
Case 2  contribute hcv_rna=reactive, mandatory field PRESENT    ✓ errorCount=0
Case 3  contribute hcv_rna=negative (rule inert)                ✓ errorCount=0
```

The validation API + queue surface are unchanged — the new issue code
flows through the existing `/workflows/runs/:runId/validation` and
`validationErrorCount` queue path.

## 3. Files changed

```
server/.../workflow/ProgramRuleEvaluator.java    — SETMANDATORYFIELD action handler,
                                                   toIssue(..., values) signature,
                                                   javadoc action table updated
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.20
```

## 4. Build + test

```
mvn test -Dtest='MetadataSyncService*,CaptureWorkflowControllerTest'  ✓ 42/42
mvn -q -DskipTests package                                            ✓ 2.3.20 JAR
Live SETMANDATORYFIELD E2E (3 scenarios)                              ✓
```
