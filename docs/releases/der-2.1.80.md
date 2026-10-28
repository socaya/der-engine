# der-2.1.80 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.79`

## Headline

The last two `@dhis2/ui` consumers are gone. The admin UI is
now **zero `@dhis2/ui` imports** — fully native DER vocabulary
from sign-in through every module page.

## Changes

### 1. SignIn — native inputs + button

```tsx
// was
import { Button, InputField } from '@dhis2/ui';
<InputField label="Username" value={username}
            onChange={({ value }) => setUsername(value ?? '')}
            autoComplete="username" placeholder="der-admin" required dense />
<Button primary type="submit" loading={submitting}>Sign in</Button>

// now
<div className="ea-field">
  <label className="ea-field-label" htmlFor="sign-in-username">
    Username <span className="ea-field-required">*</span>
  </label>
  <input id="sign-in-username" className="ea-input"
         value={username} onChange={(e) => setUsername(e.target.value)}
         autoComplete="username" placeholder="der-admin" required />
</div>
<button type="submit" className="ea-btn ea-btn--primary"
        disabled={submitting || !username || !password}>
  {submitting && <span className="ea-btn-spinner" />}
  <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
</button>
```

- `.ea-field-required` → tiny red `*` after the label.
- `.ea-btn-spinner` → inline CSS spinner using tone-coloured
  `currentColor` border, so it inherits the button's text tone
  (white on primary, dark on ghost, etc.).

### 2. LoadingBlock — native spinner

```tsx
// was
import { CircularLoader } from '@dhis2/ui';
<CircularLoader small />

// now
<span className="ea-loading-spinner" />
```

`.ea-loading-spinner` is 18 × 18 px, borrows the DER border
colour for the dim ring and `--der-primary` for the moving arc.
Matches the button spinner but at reading-text size.

## Live assertion

```
grep -rn "from '@dhis2/ui'" admin-ui/src → 0 hits
```

Playwright sign-in sweep:

```
username input (ea-input)        : present
password input (ea-input)        : present
submit button (ea-btn--primary)  : present
post-login redirect              : /admin (Workspace)
```

Screenshot `/tmp/der-2.1.80-signin.png` confirms login completes
end-to-end and the Workspace renders normally.

## Bundle size

Dropping `@dhis2/ui` Button + InputField + CircularLoader
from the main bundle:

```
2.1.79: dist/assets/index-BDwRri8Q.js  599.39 kB │ gzip: 152.49 kB
2.1.80: dist/assets/index-dRzUEevy.js  564.27 kB │ gzip: 142.18 kB
         ──────────                   ─────────   ───────────────
Δ                                      -35 kB      -10 kB gzip
```

The `@dhis2/ui` dependency itself still sits in
`admin-ui/package.json` for now — can be removed in a future
release once the e2e test harness is confirmed independent of
it. All references in source code are gone, so dropping the
dependency is a one-line package.json change.

## Full visual contract

Every DER screen now renders through one vocabulary:

- `SyncStatusBar` headers
- `UiIcon` glyphs
- `Status` markers (icon + tone-coloured text)
- `.ea-chip` tokens (dot + tone-coloured text, no fill)
- `.ea-btn` buttons (with icon prefix where sensible)
- `.ea-state-block` empty / error / offline blocks
- `.ea-section-tabs` section-tab strips (with icons)
- `.ea-filter-chip` underline-tab filter strips
- `.ea-input`, `.ea-field` native form fields
- `.ea-table ea-table--dense` tables
- `.ea-def-list` definition lists
- `.ea-panel` panels

No external component library needed for anything an operator
can see — the admin UI is self-contained inside DER's own
primitives.
