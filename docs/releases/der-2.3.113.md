# der-2.3.113 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.112`

## Headline

**Lineage drawer's response cell is now honest + fully expandable.**
The column was labelled "Error" but DER persists Central's response
envelope in `last_error` for every outcome — so a successful
`CENTRAL_ACCEPTED` row showed the OK envelope styled like a failure
and truncated with ellipsis. Fixed in R-AJ.

## 1. R-AJ — Response cell: label + state-aware + expandable

**Before**

```
| State            | Att. | Updated          | Error
|------------------|------|------------------|------------------------
| CENTRAL_ACCEPTED | 0    | 2026-11-01 20:15 | {"httpStatus":"OK",…
```

- The cell was called "Error" even when the state was ACCEPTED.
- Content was coloured danger-red for every non-null `last_error`,
  including successful OK envelopes.
- Content was single-line + ellipsis-truncated at `maxWidth: 240`;
  full text only visible via hover `title=`.
- Rejected responses were silently truncated — operators had to
  copy the title text or inspect the DOM to see the full error.

**After**

| State            | Att. | Updated          | Response                                       |
|------------------|------|------------------|------------------------------------------------|
| CENTRAL_ACCEPTED | 0    | 2026-11-01 20:15 | OK 200 · Tracker job added `(click to expand)` |
| CENTRAL_REJECTED | 0    | 2026-11-01 20:15 | Rejected 405 Method Not Allowed `(click to expand)` |

- Column renamed to **"Response"**.
- New `ResponseCell` component parses the envelope and renders a
  short summary line: `OK <code> · <message>` on success,
  `Rejected <code> <httpStatus> · <message>` on failure.
- Falls back to the raw string truncated at 120 chars when the
  envelope isn't JSON.
- Summary tone is muted on success, danger on reject. State-aware
  (not blindly keyed off `last_error` presence).
- **Full JSON always available** via a native `<details>` disclosure
  — click the summary to reveal the pretty-printed envelope in a
  bordered monospace block (max-height 220px with scroll).

Covers all five entity-type journal tables rendered by the drawer
(TEI / Enrolment / Stage event / single-row drawers / Operation
journal fallback).

## 2. Live verification

```
GET /system/health                              → 200
tsc --noEmit                                     → clean
scripts/lint/check_cross_module.sh admin-ui/src  → clean
der-server-2.3.113.jar packaged + swapped       → OK
```

## 3. Files changed

```
admin-ui/src/components/PayloadLineageDrawer.tsx     — "Error" →
                                                       "Response"
                                                     + ResponseCell
                                                       with summary +
                                                       <details> body
                                                     + summariseEnvelope
                                                     + prettyJson helpers

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.113
```

## 4. Follow-ups

- Server-side could stop persisting the OK envelope in `last_error`
  when outcome is ACCEPTED (would halve the storage for the common
  success path). The current client-side fix is non-breaking and
  works for all historical rows.
- A dedicated endpoint to fetch the full response payload lazily
  (today it's always included in the row). Not needed until a tenant
  with large payloads asks.
