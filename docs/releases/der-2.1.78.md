# der-2.1.78 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.77`

## Headline

Two changes:

1. **Metadata category** is now a dropdown on the same filter
   line as the resource picker + search box, not a dedicated
   horizontal tab strip. Compact, same signal.
2. **`/sync/schedule` fully implemented** — modern table of
   scheduled flows with icon + name + description, plain-English
   schedule + raw cron, last-run status, and a per-row kebab
   menu carrying Run now / Edit expression / Copy expression /
   View history.

## 1. Metadata — Category dropdown replaces tab strip

### Before

```
Metadata
Read-only mirror · 2,541 items across 45 resources · …

[ Aggregate (361) ] [ Tracker (179) ] [ Rules & Validation (1,179) ]
[ Organisation (518) ] [ Options (87) ] [ Analytics (193) ]
[ Administration / Other (24) ]

┌─────────────────────────────────────────────────────────────┐
│ [Resource picker ▼] [N mirrored] [Search …] N items         │
└─────────────────────────────────────────────────────────────┘
```

Seven horizontal tabs took a full line even though only one was
active at a time; operators pointed out the signal was already
captured by the counts in the `<optgroup>` dropdown.

### After

```
Metadata
Read-only mirror · 2,541 items across 45 resources · …

┌───────────────────────────────────────────────────────────────┐
│ [Category ▼] [Resource ▼] [Search …] N items                  │
│  Aggregate (361)                                              │
│  Tracker (179)                                                │
│  Rules & Validation (1,179)                                   │
│  Organisation (518)                                           │
│  Options (87)                                                 │
│  Analytics (193)                                              │
│  Administration / Other (24)                                  │
└───────────────────────────────────────────────────────────────┘
```

- `select[data-test="metadata-category"]` sits inline with the
  existing resource picker + search.
- Category change filters the resource dropdown to just that
  domain's resources (unchanged behaviour; just the picker UI
  changes shape).
- `data-test="metadata-domain-*"` tabs removed.

## 2. `/sync/schedule` — full implementation

### Columns

| Column | Content |
|---|---|
| Icon | `UiIcon` matching the flow (metadata / push / analytics / referral / backup / compat / drift) |
| Flow | Plain-English title + one-line description |
| Runs | `describeCron(value)` plain-English schedule + raw cron below |
| Last run | `fmtAgo(startedAt)` of the most recent run of this flow |
| Status | `<Status tone>` marker: **Never run / Running / Succeeded / Failed** |
| ⋮ | Row kebab menu |

### Per-row kebab menu (RowMenu)

| Action | Behaviour |
|---|---|
| **Run now** | Calls `edgeApi.triggerJob(jobNameForKey(cronKey))`. After 1.5 s refreshes the Last-run cell. Row shows a transient ✓ Triggered confirmation. |
| **Edit expression / Hide expression** | Toggles an inline `<input>` row underneath. The cron value is wired to `s.cron[cronKey]` on change; **Save schedule** in the header persists. |
| **Copy expression** | `navigator.clipboard.writeText(value)` — raw Quartz expression goes to the clipboard. |
| **View history** | Deep-links to `/sync/history?jobName={JOB_NAME}` so the operator sees every previous run of that flow in context. |

### Flow key → Quartz job name map

```ts
sync.metadata      → METADATA_SYNC_FULL
sync.data | journal.drain → JOURNAL_WORKER_DRAIN
analytics.refresh  → ANALYTICS_REFRESH
referral.inbox     → REFERRAL_INBOX_POLL
backup.rotate      → BACKUP_ROUTINE_DRAIN
compat.refresh     → COMPAT_REFRESH
drift.snapshot     → DRIFT_SNAPSHOT
```

Flows with no matching job (future / disabled) still get Edit /
Copy actions but Run-now and View-history are hidden from their
menu.

### Row click → expand expression editor

Clicking the row body toggles the same inline `<input>` row as
"Edit expression" from the menu. Clicking inside the input or
the kebab button no longer propagates the row click.

### Last-run cell

Populated by `Promise.all` of `edgeApi.listJobs(1, JOB_NAME)` on
mount. Row shows the latest run via tone-coloured marker + "N
ago" text. Running jobs render *Running* in info-ink.

### Empty state

If `s.cron` is empty (fresh install / build with no cron
defaults), the page renders the standard DER `<EmptyBlock>`:

```
▌ [grid]  No scheduled flows
▌         This build has no cron entries configured. Add them
▌         under Settings or recompile with der.*.cron defaults.
```

## Live assertions

```
/dhis2/metadata:
  old domain tabs count:  0 (removed)
  category options:
    ["Aggregate (361)", "Tracker (179)",
     "Rules & Validation (1,179)", "Organisation (518)",
     "Options (87)", "Analytics (193)",
     "Administration / Other (24)"]

/sync/schedule:
  schedule rows:          1
  row-menu kebabs:        1
  first row menu items:   ["Run now", "Edit expression",
                           "Copy expression", "View history"]
```

Screenshot `/tmp/der-2.1.78-schedule.png` — the Schedule page
reads:

```
Schedule · ● 1 scheduled flow                    [↻ Save schedule]
Background flows that keep DER aligned with Central DHIS2.
· Edit the cron expression per row, run any flow now, or jump to its history.

Scheduled flows
┌───┬──────────────────────────────────┬─────────────┬──────────┬──────────┬───┐
│ ▦ │ Pull latest metadata             │ Every 5 min │ 8h ago   │ ✓ Succ…  │ ⋮ │
│   │ Mirror DHIS2 metadata (data …)   │ 0 */5 * * *?│          │          │   │
└───┴──────────────────────────────────┴─────────────┴──────────┴──────────┴───┘
```
