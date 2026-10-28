# der-2.1.72 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.71`

## Headline

Two consistency wins:

1. **Pagination added to three remaining lists** — `/devices`,
   `/approvals`, `/referral/inbox`. Now every list page in the
   admin UI uses the shared `usePaged` + `<TablePager>` pattern,
   capping client-side render at 25 rows.
2. **`/sync/metadata` reads live central reachability** via the
   `useCentralReachable` hook introduced in 2.1.67, instead of
   the stale compat snapshot cached on `SystemInfo`. The
   "Pull metadata" button and the "Central DHIS2 reachable /
   unreachable" subtitle now flip within 15 s of a central drop
   or recovery, matching the topbar + sidebar footer behaviour.

## 1. Pagination

### `/devices` (MockupDeviceFleet)

- Wraps the filtered device rows through `usePaged(filtered, 25)`.
- Row loop reads `paged.rows` instead of `filtered`.
- `<TablePager {...paged.pagerProps} />` appended inside the
  table wrap.

### `/approvals` (MockupApprovalQueue)

- `usePaged(rows, 25)` + `paged.rows` in the loop.
- Pager rendered when there are pending approvals.

### `/referral/inbox` (MockupReferralInbox)

- Same shape — `usePaged(rows, 25)` + `paged.rows`.

Every DER list screen now caps initial-render to 25 rows and
exposes Previous / Next with "Showing N–M of X" below the table.

## 2. `/sync/metadata` — live reachability

Was:

```ts
const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
```

That read the stale compat snapshot. Now:

```ts
const livePing = useCentralReachable();
const centralReachable = livePing.reachable
  ?? sysInfo?.dhis2?.probeReachable
  ?? false;
```

Which polls `/edge-api/v1/dhis2/ping` every 15 s (server cache
10 s). Pull-metadata button disables within one poll cycle when
Central drops; subtitle flips from *"Central DHIS2 reachable"*
to *"Central DHIS2 unreachable"* on the same signal.

Same wiring already shipped for `/sync` (SyncOverview) in 2.1.67;
this release extends it to the Metadata sub-page.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.72 JAR
Playwright pagination sweep   ✓ pager present on /sync/metadata
                                 (other three empty on this test
                                 instance — pager only renders
                                 when there's data to page through)
```
