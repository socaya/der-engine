# der-2.1.81 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.80`

## Headline

Two cleanups:

1. **`@dhis2/ui` + all `@atlaskit/*` dependencies removed from
   `admin-ui/package.json`.** Zero source-code references remain
   from the 2.1.80 migrations, so the package.json entries are
   dead weight. 13 top-level dependencies removed; `npm install`
   is faster, lockfile is smaller, security surface shrinks.
2. **React hooks error #310 fixed.** Three pages added `usePaged`
   *after* an `if (!rows) return <LoadingBlock>` early return —
   the hook count changed between the first render (loading) and
   the second (loaded), triggering React's hook-order safety
   trap. Lifted the hook calls above the early returns.

## 1. Dependency sweep

Removed from `admin-ui/package.json → dependencies`:

```
@atlaskit/button, @atlaskit/css-reset, @atlaskit/form,
@atlaskit/heading, @atlaskit/icon, @atlaskit/menu,
@atlaskit/page-layout, @atlaskit/section-message,
@atlaskit/side-navigation, @atlaskit/spinner,
@atlaskit/textfield, @atlaskit/tokens,
@dhis2/ui
```

All 13 were already orphaned —
`grep -rn "from '@dhis2/ui'" admin-ui/src → 0 hits`,
`grep -rn "from '@atlaskit" admin-ui/src → 0 hits`.

Admin UI dependencies now:

```
"dependencies": {
  "react":            "^18.3.1",
  "react-dom":        "^18.3.1",
  "react-router-dom": "^6.28.0"
}
```

Three production dependencies — React core + the router.

Verified:
- `npm install` succeeds, lockfile regenerated.
- `tsc -b && vite build` succeeds (no missing types).
- JAR packaged and relaunched; UI serves normally.
- Login + sweep of 11 pages: 0 page errors.

## 2. React error #310 — hook-order violation

### Root cause

Three screens looked like this:

```tsx
if (err) return <ErrorBlock>…</ErrorBlock>;
if (!rows) return <LoadingBlock />;
const paged = usePaged(rows, 25);  // ← conditional!
```

On the first render `rows == null` so `<LoadingBlock>` returned
before `usePaged` ran. On the second render (after the fetch
resolved) `usePaged` *did* run, so React saw a different number
of hooks between renders and threw.

### Fix

Moved every `usePaged` call above the early returns:

```tsx
const paged = usePaged(rows ?? [], 25);  // always runs
if (err) return <ErrorBlock>…</ErrorBlock>;
if (!rows) return <LoadingBlock />;
```

Pages fixed:

- `MockupDeviceFleet` (`/devices`)
- `MockupApprovalQueue` (`/approvals`)
- `MockupReferralInbox` (`/referral/inbox`)

### Playwright verification

```
Sweep 11 screens post-fix:
  /sync/attention, /sync/metadata, /sync/data, /sync/history,
  /sync/schedule, /devices, /approvals, /referral/inbox,
  /workflows, /dhis2/metadata, /dhis2/compat
  → page errors: 0 (was 3 × Minified React error #310 in 2.1.80)
```

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.81 JAR built
Server serves 2.1.81           ✓
Playwright 11-page sweep       ✓ 0 pageerror events
```
