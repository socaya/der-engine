# der-2.3.34 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.33`

## Headline

**Capture screens honour program-rule actions.** `AggregateEntry`
(DC-07) and `EventNew` (DC-09 / DC-14) now subscribe to the §35
evaluator's output via the `useRunValidation` hook shipped in
2.3.30. `HIDEFIELD` hides the input, `ASSIGN` pre-fills it, the
validation banner summarises blocking issues + warnings + follow-up
cues. Closes the loop end-to-end.

## 1. Trigger

A capture screen enters "run-aware" mode when invoked with
`?runId=<uuid>` in the URL. Example:

```
/aggregate/entry?runId=<uuid>&dataSet=DS&orgUnit=ou&period=2026Q1
```

Without `runId` the screens render exactly as before — no new
network traffic, no behavioural change for pilots not yet routing
through the workflow queue.

## 2. AggregateEntry (DC-07)

- `useRunValidation(runId)` loaded once per screen mount.
- `RunValidationBanner` renders above the grid under
  `data-test="aggregate-entry-validation"`.
- Row-level behaviour:
  - `hiddenFields.has(dataElement)` → renders a dim "hidden by rule"
    row (`data-test="aggregate-row-hidden-<de>"`) with no input.
  - `assignedValues.get(dataElement)` → prefills the input with a
    tinted background + a "suggested by rule" hint. Operator can
    still type to override; `edits[de]` wins over suggested value.
- Submit folds assigned values into the submission unless the
  operator typed over them. Hidden fields never ship.
- Save button activates on either `edits > 0` OR
  `assignedValues > 0` so a workflow that only pre-fills is still
  savable.

## 3. EventNew (DC-09 / DC-14)

Single-DE/value form:
- `deHidden` → the value row is replaced with a "hidden by program
  rule" notice (`data-test="event-new-de-hidden"`).
- `deAssigned` → the value input prefills with the suggested value
  (`data-test="event-new-value-hint"`).
- Submit emits an empty `dataValues[]` when the DE is hidden; emits
  the effective value (edit or suggested) otherwise.
- Banner at `data-test="event-new-validation"`.

## 4. Verified

```
Capture integration test (AggregateEntry):
  mocked runValidation returns HIDEFIELD + ASSIGN
    hidden row rendered                                      ✓
    hidden-row input absent                                  ✓
    assigned value appears in input + hint rendered          ✓
    submit payload includes ASSIGN, excludes HIDDEN          ✓

client/npm test                                              ✓ 156/156 (+1)
client/npm run build                                         ✓
```

## 5. Files changed

```
client/src/screens/AggregateEntry.tsx         — useRunValidation,
                                                  RunValidationBanner,
                                                  hidden-row / assign-row,
                                                  submit merge + button gate
client/src/screens/AggregateEntry.test.tsx    — + hide/assign/submit integration test
client/src/screens/EventNew.tsx               — single-DE hide/assign + banner
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.34
```

## 6. Follow-ups

- Enrollment + tracker-stage screens (EnrollmentCreate,
  tracker-stage new-event) still need the same wiring. Scope kept
  tight on purpose — these screens have different form shapes and
  will land as a dedicated release.
- Replace the regex ASSIGN-value extraction in the hook with a
  structured `suggestedValue` field on the server-side issue
  payload. Lower-risk, bigger follow-up.
