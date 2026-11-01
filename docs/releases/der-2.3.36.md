# der-2.3.36 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.35`

## Headline

**EnrollmentCreate (DC-13) honours program-rule actions.** Completes
the DC-level program-rule story — aggregate (2.3.34 AggregateEntry),
event (2.3.34 EventNew) and now enrollment all react to HIDEFIELD /
ASSIGN / CREATEEVENT when invoked with `?runId=<uuid>`.

## 1. Behaviour

Trigger: `/tracker/<program>/enroll?runId=<uuid>&attributes=TEA_A,TEA_B,TEA_C`.

- `useRunValidation(runId)` + `RunValidationBanner` as in
  AggregateEntry / EventNew.
- `attributes=` query param drives a dynamic list of
  tracked-entity-attribute inputs. Each attribute UID becomes a row:
  - If the server emits `PROGRAM_RULE_HIDEFIELD` for that UID →
    the row collapses to a muted "hidden by program rule" line
    (`data-test="enroll-attr-hidden-<uid>"`) and nothing is sent on
    submit.
  - If `PROGRAM_RULE_ASSIGN` emits a suggested value for the UID →
    the input prefills with a tinted background + a "suggested by
    rule" hint. Operator edits win over the suggestion.
- Submit payload builds the DHIS2 tracker body with both the TEI's
  top-level `attributes` and the enrollment's inner `attributes`
  (DHIS2 2.42+ import semantics).

Submit filters:
```
merged = { ...assignedValues (minus hidden), ...operatorEdits }
output = merged where key not in hiddenFields and value != ""
```

## 2. Verified

```
DC06to17.test.tsx EnrollmentCreate DC-13 › program-rule actions …   ✓
  hidden attribute renders as hidden line                           ✓
  autofilled attribute carries suggested value + hint               ✓
  submit body contains TEA_AUTO + TEA_OPEN                          ✓
  submit body does NOT contain TEA_HIDE                             ✓
client/npm test                                                     ✓ 157/157 (+1)
client/npm run build                                                ✓
```

## 3. Files changed

```
client/src/screens/EnrollmentCreate.tsx     — useRunValidation,
                                                dynamic attribute inputs via
                                                ?attributes=UID1,UID2,UID3,
                                                hide/assign/submit merge,
                                                RunValidationBanner
client/src/screens/DC06to17.test.tsx        — + attribute hide/assign/submit test
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.36
```

## 4. Follow-ups

Still outstanding on the DC capture surface:
- Metadata-driven attribute list (pull TEA UIDs from the program via
  `/api/programs/{id}?fields=…`) instead of `?attributes=` query
  param. Short-term, pilots pass the UID list in the deep-link URL.
- Tracker-stage events already pick up the hook via EventNew
  (2.3.34). Enrollment ↔ event sequencing (DC-14 stage events
  under a specific run) is unchanged.
