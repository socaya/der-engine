# der-2.3.21 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.20`

## Headline

**`d2:*` function library + `V{...}` context variables** land in the
program-rule evaluator. The handful of DHIS2 helpers that cover the
vast majority of real-world rules now evaluate end-to-end, so date-
comparison, length, substring and arithmetic rules fire against the
merged payload like their SHOWERROR siblings already did.

## 1. Added

### `V{...}` context variables

| Token | Resolves to |
|---|---|
| `V{current_date}` / `V{today}` | today in `yyyy-MM-dd` |
| anything else | `null` (no event-date / enrollment-date meaning in the DER merge model) |

### `d2:*` functions

| Function | Behaviour |
|---|---|
| `d2:daysBetween(a,b)` | `ChronoUnit.DAYS` between two `yyyy-MM-dd` dates (tolerates ISO instants by trimming to 10 chars) |
| `d2:weeksBetween` / `d2:monthsBetween` / `d2:yearsBetween` | same, different unit |
| `d2:length(s)` | character count |
| `d2:left(s, n)` / `d2:right(s, n)` | leading / trailing `n` chars |
| `d2:floor(x)` / `d2:ceil(x)` / `d2:round(x)` | numeric rounding |
| `d2:modulus(a, b)` | `a % b` |
| `d2:zing(x)` | `max(0, x)` — zero if negative |
| `d2:oizp(x)` | `1` if `x > 0` else `0` |
| `d2:count(#{var})` | `1` if payload has the var, else `0` (flat-merge equivalent of repeated-event count) |
| `d2:zpvc(a, b, …)` | count of non-blank values |
| `d2:concatenate(a, b, …)` | string join |
| other `d2:*` | returns `null`, rule falls back to the same safe `null`-handling the pre-existing path already had |

`null` returns from the function layer flow through `compare()` which
already treats either side being `null` as `false`, so unparseable or
unsupported sub-expressions never crash — the rule just goes dormant.

### Argument splitter

`splitArgs(s)` splits function arguments at top-level commas and
respects `(…)` nesting + quoted strings so
`d2:concatenate(#{a}, d2:left(#{b},3))` parses cleanly.

## 2. Verified live

Picked a real Hepatitis rule from the mirror:

```
rule   RmJGs3AibzL / IrJeSjCJnH1
       Hep: Treatment start date cannot be in the future
cond   d2:hasValue(#{v4…treatment_start_d})
       && d2:daysBetween(V{current_date}, #{v4…treatment_start_d}) > 0
action SHOWERROR · content: "Hepatitis treatment start date cannot
                              be in the future."
```

Scenarios:

```
Case A  treatment_start = today + 30d  → d2:daysBetween > 0
        → PROGRAM_RULE_SHOWERROR fires ✓  "cannot be in the future"
Case B  treatment_start = today − 30d  → d2:daysBetween < 0
        → rule dormant                 ✓  no "future" error
```

Case A also surfaces an unrelated `PROGRAM_RULE_SETMANDATORYFIELD`
for the SVR12 result — the correct behaviour: once treatment started
on any date, the SVR12 result is mandatory under a sibling rule.

## 3. Files changed

```
server/.../workflow/ProgramRuleEvaluator.java   — + CONTEXT_VAR + D2_FN patterns,
                                                  resolveContext(), callD2(),
                                                  splitArgs(), date / string / math
                                                  helpers
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.21
```

## 4. What this still doesn't do

- Nested conditional functions (`d2:condition(expr, trueV, falseV)`) —
  needs ternary evaluation path.
- `d2:lastEventDate` / `d2:minutesBetween` / variable scope helpers
  (`CALCULATED_VALUE`, `TEI_ATTRIBUTE_PREVIOUS_EVENT` …) — depend on
  event-history semantics outside the current DER merge model.
- Pilots stress-testing the function library may surface rules whose
  parsing drops silently — the `LOG.debug` line already logs those
  cases to tracing, so operators can request a fix with the exact
  condition text.

## 5. Build + test

```
mvn test -Dtest='MetadataSyncService*,CaptureWorkflowControllerTest'   ✓ 42/42
mvn -q -DskipTests package                                             ✓ 2.3.21 JAR
Live d2:daysBetween E2E (future + past)                                ✓
```
