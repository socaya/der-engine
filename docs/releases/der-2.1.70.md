# der-2.1.70 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.69`

## Headline

Final sweep of the "no cards at the top of every page" pass:
`/provisioning/users`, `/audit/events`, `/analytics`, `/apps`
and `/sync/history` detail panels converted from the
`ea-stat-strip` / `ea-kpi-grid` pattern to inline facts on the
screen header subtitle. Four unused helper components removed.

## Pages converted

### `/provisioning/users` (Users list)

Was: 3 stat cards — Total users / Administrators / Operators —
in an `ea-stat-strip`.

Now: inline on the screen-header subtitle:

```
Total users 4 · Administrators 2 · Operators 2
```

Administrators text is tone-coloured success-ink; Operators is
muted.

### `/audit/events` (Alerts & activity)

Was: `Hero` + 3-up `ea-kpi-grid` — Events / Success / Failures.

Now: `SyncStatusBar` subtitle:

```
Alerts & activity · ● 100 events
Audit stream for every security-relevant event handled by this edge.
· Success 95 · Failures 5
```

Failures line only appears when the count is > 0 and renders in
tone-danger ink.

### `/analytics` (Facility analytics)

Was: `Hero` + 2-up KPI grid (Journal entries / Entity kinds).

Now:

```
Facility analytics · ● 1,247 entries
Capture throughput for the bound organisation unit. · Entity kinds 7
```

### `/apps` (Installed apps)

Was: 3 `AppStat` cards (Installed / Enabled / Disabled).

Now: single-line subtitle under the standard header:

```
Installed 5 · Enabled 4 · Disabled 1
```

### Worker health backlog (EA-14 under /sync/worker)

Was: wrapped `ea-stat-strip--wrap` with one `ea-stat` card per
backlog state.

Now: inline tone-coloured text row:

```
PENDING 12 · IN FLIGHT 2 · CENTRAL ACCEPTED 847 · RETRYABLE 3
```

Each state picks up the same success/warning/danger ink it had
on the old card variant, so the signal is preserved — just
without the card chrome.

### EA-06 "Synchronisation jobs" summary (/sync/jobs-legacy)

Was: 4-up stat strip (Total runs / Succeeded / Failed / Other).

Now: inline subtitle, consistent with every other list page.

## Dead code removed

- `StatCard` helper in `EACoreScreens.tsx` (used only by the
  stat strips just removed).
- `AppStat` helper in `EARemainderScreens.tsx` (ditto).
- `Hero` adapter in `MoreScreens.tsx` — no call sites remain
  after the Hero → SyncStatusBar migration completed.
- `IconList`, `IconCheck`, `IconX`, `IconHash`, `sIcon` factory
  — all were used only by the removed Hero/KpiTile call sites.
- `KpiTile` dropped from the MoreScreens barrel import.

## Live assertions

```
/provisioning/users  — .ea-kpi-grid + .ea-stat-strip + .ea-dash-hero: 0
/audit/events        — ...                                          : 0
/analytics           — ...                                          : 0
/apps                — ...                                          : 0
```

Screenshots: `/tmp/der-2.1.70-analytics.png`,
`/tmp/der-2.1.70-apps.png`, `/tmp/der-2.1.70-audit.png`.
