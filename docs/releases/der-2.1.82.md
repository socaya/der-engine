# der-2.1.82 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.81`

## Headline

Button-polish pass. Every Refresh / Probe / Save button that
survived the earlier icon sweeps now carries a `UiIcon` prefix
and a `.ea-btn-spinner` for the loading state, so the UI's
button vocabulary is uniform across every screen.

## Changes

### 1. SyncHistory + DataQueues Refresh buttons

- `/sync/history` filter-row Refresh button → `UiIcon icon="refresh"` + span.
- `/sync/data` filter-row Refresh button → same treatment.

Both buttons live inside a 6+ field filter strip and were
previously text-only. The icon doubles as a visual rotation
affordance.

### 2. Central-connection form

Both action buttons on `CapCentralConnection` (`/dhis2/connection`):

- **Probe now** → `UiIcon icon="refresh"` + `.ea-btn--sm` sizing
  (was default size, text only).
- **Save connection** → `UiIcon icon="refresh"` in the idle
  state, `.ea-btn-spinner` while saving. `.ea-btn--sm` sizing.

### 3. Workflow designer Save button

`EACaptureWorkflowDesigner` save button was a bare `<button>`
with no DER class — now `.ea-btn.ea-btn--primary` with a
`refresh` icon in the idle state and the inline spinner while
saving. Matches every other primary save surface.

## Button pattern — now fully uniform

Every destructive / mutating action in the admin UI follows the
same shape:

```tsx
<button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
        disabled={busy}
        onClick={handler}>
  {busy ? <span className="ea-btn-spinner" /> : <UiIcon icon="…" size={14} />}
  <span>{busy ? 'Doing…' : 'Do thing'}</span>
</button>
```

- `.ea-btn-spinner` tone-inherits from `currentColor` so it
  looks right on primary (white), ghost (dark navy), danger
  (red) variants.
- Icon size 14 px throughout matches the button text leading.
- Button text wrapped in `<span>` so the gap between icon and
  text stays consistent (`.ea-btn` has `gap: 6px`).

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.82 JAR built
Server serves 2.1.82           ✓
```
