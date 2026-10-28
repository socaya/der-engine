# der-2.1.79 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.78`

## Headline

Three cleanup items:

1. **`ScreenHeader` component** no longer depends on
   `@dhis2/ui`'s `Button`. The Refresh action uses the native
   `.ea-btn ea-btn--ghost ea-btn--sm` + `UiIcon icon="refresh"`.
2. **Filter chip row** (used by the EA-06 Sync-jobs + metadata
   history filters) de-pilled onto the quiet underline-tab
   pattern. No more soft-background rounded chips sitting at the
   top of a results page.
3. **EASettings Save button** gets the `refresh` icon + the
   standard `ea-btn--sm` sizing so it visually matches every
   other save button across the admin UI.

## 1. `ScreenHeader.tsx`

```tsx
// was
import { Button } from '@dhis2/ui';
<Button small onClick={...}>Refresh</Button>

// now
import { UiIcon } from './UiIcon';
<button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
        onClick={...}>
  <UiIcon icon="refresh" size={14} />
  <span>Refresh</span>
</button>
```

The three remaining `@dhis2/ui` imports in the entire admin UI
are now: `Button` + `InputField` on SignIn, and `CircularLoader`
inside `LoadingBlock`. Everything else routes through the DER
native vocabulary.

## 2. `.ea-filter-chip` CSS — underline-tab style

### Before

```
┌─────────┐  ┌──────────┐  ┌──────────┐
│ All     │  │ Running  │  │ Failed   │   ← pill-shaped chips with
└─────────┘  └──────────┘  └──────────┘      soft backgrounds and borders
```

### After

```
──Outcome──  All   Running   Failed   ← underline-tab, border below strip
                                        active tab carries a navy underline
```

CSS collapsed:

```css
.ea-filter-chip {
  padding: 6px 2px;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--der-ink-500);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: -1px;
}
.ea-filter-chip--active {
  color: var(--der-navy-700);
  font-weight: 600;
  border-bottom-color: var(--der-primary);
}
.ea-filter-chips {
  border-bottom: 1px solid var(--der-border-subtle);
}
```

Matches the main sidebar + section-tabs vocabulary — one visual
pattern for navigational filters across every DER screen.

## 3. EASettings Save button

- Icon prefix: `refresh`
- Size: `.ea-btn--sm` (was default)
- Everything else unchanged.

Matches the Save button on `/sync/schedule`, Pull-metadata on
`/sync`, Push-data on `/sync`, Save connection on `/dhis2`.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.79 JAR built
Server serves 2.1.79           ✓
```
