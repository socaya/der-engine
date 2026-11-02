# der-2.3.106 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.105`

## Headline

**Data Queue moved under the Data module.** Operators find the
outbound record list where they look for data — not nested under
Sync. `/sync/data` + `/sync/data/:operationId` redirect to the new
canonical paths so bookmarks keep working.

## 1. R-AA — Data Queue relocation

**Routes**

| Path                             | 2.3.105                    | 2.3.106                                 |
|----------------------------------|----------------------------|-----------------------------------------|
| `/sync/data`                     | `MockupDataQueues`         | **Navigate → `/data/queue` (301-equiv)** |
| `/sync/data/:operationId`        | `MockupDataDetail`         | **Navigate → `/data/queue/{id}` (SyncDataLegacyRedirect preserves the uid)** |
| `/sync/queues`                   | Navigate → `/sync/data`    | Navigate → `/data/queue`                |
| `/data/queue` *(new)*            | —                          | `MockupDataQueues`                      |
| `/data/queue/:operationId` *(new)* | —                        | `MockupDataDetail`                      |

**Navigation**

- `sync-data` nav item removed from the **Sync** group.
- `data-queue` nav item added to the **Data** group between Tracker
  and Drafts: *Overview · Aggregate · Events · Tracker · Queue · Drafts
  · Referrals · Maintenance*.

**Call-site rewrites**

Every outbound link from the admin UI that pointed at `/sync/data`
or `/sync/data/{opId}` has been rewritten to the Data path:

```
DataQueues.tsx            — navigate(/data/queue/{id})
                            BackLink → /data/queue
                            rowMenu "Open details"
DataEvents.tsx            — "Sync queue" header button
                            chipShape → "Pending push" / "Sending" /
                            "Retrying" / "Approval" states
DataAggregate.tsx         — same as DataEvents
DataTracker.tsx           — same
DataManagement.tsx        — metrics-row inline link + per-type navigate
MoreScreens.tsx           — quick-link in management toolbar
SyncHistory.tsx           — per-op "Open" link
WorkflowRunDetail.tsx     — manifest-table state-chip jump
```

Legacy comments in `shared.tsx` and `CapabilityScreens.tsx` keep
their `/sync/data` prose for historical context (ADR / release-note
references); the live routes are the authoritative moved targets.

## 2. Live verification

```
GET /admin/sync/data            → 401 (SPA shell; redirects client-side)
GET /admin/data/queue           → 401 (same shell, new canonical path)
                                — both routes mount cleanly post-swap
tsc --noEmit                    → clean
```

## 3. Files changed

```
admin-ui/src/App.tsx                                — new /data/queue
                                                      routes + /sync/data
                                                      redirects +
                                                      SyncDataLegacyRedirect
admin-ui/src/app/navigation.ts                      — nav move
admin-ui/src/screens/{DataAggregate,DataEvents,
     DataTracker,DataQueues,DataManagement,
     MoreScreens,SyncHistory,
     workflow/WorkflowRunDetail}.tsx                 — path rewrites

VERSION / server/pom.xml / admin-ui/package.json
                           / sw.js                   — 2.3.106
```

## 4. Follow-up queued

**Cross-module link audit** — the user flagged that modules should
not cross-link freely except via explicit context affordances. Full
audit of ~85 inter-module links is complete; a focused plan to
tighten them follows in 2.3.107+.

Headline findings:

- **Data Queue move** (shipped here) was the biggest offender.
- **Data → Workflows run drill** (`/workflows/monitoring/runs/{runId}`
  from ScopedFilterChip + row Link) is the next big pattern — happens
  from DataAggregate / DataEvents / DataTracker / DataAggregateDetail.
  Likely kept as explicit "View run" affordance but formalised.
- **Network → /sync/settings** (`Network.tsx:174`) is the one truly
  misplaced primary action — Sync owns its own config.
- **Metadata header actions** → `/sync/metadata` + `/sync/history`
  from `MoreScreens.tsx` — those are legitimate related-work hints
  but should be labelled as such.

See the audit summary in the next release plan.
