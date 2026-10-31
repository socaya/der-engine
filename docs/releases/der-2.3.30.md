# der-2.3.30 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.29`

## Headline

**Client capture surface for program-rule actions.** The device-side
client now has a reusable `useRunValidation(runId)` hook + a drop-in
`RunValidationBanner` that react to the issue codes the §35 evaluator
emits — `PROGRAM_RULE_HIDEFIELD` hides inputs, `PROGRAM_RULE_ASSIGN`
pre-fills them, `PROGRAM_RULE_CREATEEVENT` shows a cue banner.

## 1. New client API + hook

```typescript
// client/src/api/edgeApi.ts
export function runValidation(runId: string):
    Promise<{ runId; errorCount; issues: ValidationIssue[] }>;

// client/src/hooks/useRunValidation.ts
export function useRunValidation(runId: string | null | undefined,
                                   opts?: { pollMs?: number }):
    RunValidationState;

interface RunValidationState {
  issues:         ValidationIssue[];
  errorCount:     number;
  hiddenFields:   Set<string>;           // from PROGRAM_RULE_HIDEFIELD / HIDESECTION
  assignedValues: Map<string, string>;   // from PROGRAM_RULE_ASSIGN
  createEventCues: ValidationIssue[];    // from PROGRAM_RULE_CREATEEVENT
  loading:        boolean;
  error:          string | null;
}
```

- 10 s poll by default; overridable per screen.
- `hiddenFields` and `assignedValues` derive from the issue list in a
  `useMemo` so capture screens can `if (!hiddenFields.has(uid))` /
  `value = assignedValues.get(uid) ?? localValue` without extra
  computation per render.
- `assignedValues` extracts the suggested value from the server's
  message text (`value '<v>'` / `assigns '<v>'`) — lightweight
  contract until the server starts shipping the computed value as a
  structured field on the issue.

## 2. `RunValidationBanner`

```tsx
<RunValidationBanner state={state} testId="anc-run-banner" />
```

Renders:
- "N blocking issues" (red) when `errorCount > 0`.
- "N warning(s)" (yellow) for the WARNING tier.
- "N follow-up event(s) suggested" (blue) with the first 3 cue
  messages inline.

Returns `null` when there's nothing to flag → zero visual noise for
clean runs.

Styles live under `.run-validation-banner.is-{error|warning|info}` in
`client/src/styles.css` with the same soft-tint-plus-left-stripe
pattern the admin UI uses for the per-run validation page.

## 3. Verified

```
useRunValidation unit tests          ✓ 2/2
client full test suite               ✓ 155/155
tsc -b && vite build                 ✓ (10 KB larger — one hook, one component)
```

Capture screens haven't been wired yet in this release (DC-07
AggregateEntry, DC-09 EventNew, DC-13 EnrollmentCreate, DC-14 tracker
events) — the hook + banner are the primitives those screens will
import once the design decisions for inline hidden-field + pre-filled-
value rendering settle.

## 4. Files changed

```
client/src/api/edgeApi.ts                  — runValidation() + ValidationIssue
client/src/hooks/useRunValidation.ts       (new)
client/src/hooks/useRunValidation.test.tsx (new)
client/src/components/RunValidationBanner.tsx (new)
client/src/styles.css                      — .run-validation-banner tiers
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.30
```

## 5. Follow-up

- Thread `useRunValidation` into the aggregate / event / tracker
  capture screens. Each will decide its own policy for ASSIGN
  (silent pre-fill vs. prompt).
- Replace the regex-based value extraction with a structured
  `suggestedValue` field on the issue payload.
