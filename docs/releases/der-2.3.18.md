# der-2.3.18 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.17`

## Headline

**Program-rule execution (spec §35).** DER now evaluates DHIS2
program rules against the merged contribution payload on every
`contribute()`. Rules that fire with `SHOWERROR` or `SHOWWARNING`
actions land as `ProgressiveValidator` issues in the same bucket as
the §36 checks, so operators see rule findings in-line on the
`/workflows/queue` red issue pill and on the run-validation page.

## 1. New service — `ProgramRuleEvaluator`

Loads program rules + rule variables from the metadata mirror
(`der.metadata_program_rule`, `der.metadata_program_rule_action`,
`der.metadata_catalog_item` where `resource='programRuleVariables'`),
evaluates each rule's condition against the current payload, and
emits one validation issue per firing action.

### Supported expression grammar (v1)

```
d2:hasValue(#{UID})            — true iff payload has a non-blank
                                  value for that variable/UID
#{UID}  /  A{UID}              — resolves to the field value
#{var}                         — resolves via programRuleVariable name
                                  mapping (name → dataElement UID)
== != <= >= < >                — numeric or lexical comparison
&&  ||                         — short-circuiting logic
!                              — negation (prefix)
(…)                            — grouping
true / false                   — literals
```

Unparseable fragments → the rule is skipped (logged at `DEBUG`), never
a crash. Rules that reference a value DER does not have in the current
payload → `d2:hasValue` returns false, so dependent comparisons short-
circuit cleanly.

### Supported actions

| DHIS2 action type | ProgressiveValidator mapping |
|---|---|
| `SHOWERROR` | `PROGRAM_RULE_SHOWERROR` · severity ERROR |
| `SHOWERRORONCOMPLETE` | `PROGRAM_RULE_SHOWERRORONCOMPLETE` · severity ERROR |
| `SHOWWARNING` | `PROGRAM_RULE_SHOWWARNING` · severity WARNING |
| `WARNINGONCOMPLETE` | `PROGRAM_RULE_WARNINGONCOMPLETE` · severity WARNING |
| others (HIDEFIELD, ASSIGN, CREATEEVENT, …) | skipped — a follow-up |

The issue carries the action's `content` as the operator-visible
message and the action's `dataElement`/`trackedEntityAttribute` as the
field reference.

## 2. Wiring

```
WorkflowRunCoordinator.contribute() → …
  issues  = ProgressiveValidator.validateRun(...)   (§36 rules)
  issues += ProgramRuleEvaluator.evaluate(...)      (§35 rules)
  rewritePersistedIssues(runId, issues)
  if any ERROR → run stays AWAITING
```

ERROR-severity rule findings gate completion exactly like the §36
findings do, so a workflow bound to a program that fires SHOWERROR
can't finalise until the operator reworks the contribution.

## 3. Verified live

Seeded a synthetic rule straight into the mirror
(`metadata_program_rule` + `metadata_program_rule_action` + a
`programRuleVariables` catalog row) so the test does not depend on
upstream mirror having action-type data:

```
rule       cond: d2:hasValue(#{cd4}) && #{cd4} <= 100
action     SHOWERROR · "CD4 is critically low — route to AHD pathway"
variable   cd4 → DE_CD4

Phase A  workflow + run opened                  ✓
Phase B  contribute CD4=80  (triggers rule)     ✓ errorCount=1
                                                 [ERROR] PROGRAM_RULE_SHOWERROR
                                                 "CD4 is critically low …"
Phase C  re-contribute CD4=500 (safe)           ✓ errorCount=0 · issues cleared
```

## 4. Files changed

```
server/.../workflow/ProgramRuleEvaluator.java    (new)
server/.../workflow/ProgressiveValidator.java    — + programRules.evaluate(…)
                                                   constructor arg
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.18
```

The validation API surface is unchanged — rule findings flow through
the same `GET /workflows/runs/:runId/validation` and queue
`validationErrorCount` paths the §36 release already exposed.

## 5. What this does NOT do yet

- **HIDEFIELD / ASSIGN / CREATEEVENT / SETMANDATORY actions.**
  Need a client surface that can actually hide a field or auto-fill
  one; lands with the field-level selector UI.
- **`d2:*` function library.** v1 is `d2:hasValue` only. Common ones
  like `d2:daysBetween`, `d2:floor`, `d2:left`, `d2:count` will land
  as the pilots exercise more rules.
- **Mirror action-type gap.** The current `MetadataSyncService` fetch
  stores `UNKNOWN` for `action_type` on real DHIS2 2.44 data because
  the upstream `fields=` filter doesn't descend into
  `programRuleActions`. Fix is to re-fetch each rule's actions
  individually — tracked as a follow-up on
  `MetadataSyncService.importProgramRules`. Once that lands, the
  evaluator picks up live rules without further code changes.

## 6. Build + test

```
mvn -q -DskipTests package                       ✓ 2.3.18 JAR
mvn test -Dtest=CaptureWorkflowControllerTest    ✓ 20/20
End-to-end rule sweep                            ✓ seed → trigger → clear
admin-ui unit tests                              241/245 (4 pre-existing baseline failures)
```
