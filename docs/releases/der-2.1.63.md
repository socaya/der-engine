# der-2.1.63 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.62`

## Headline

Icons across sub-navigation + page actions, plus the metadata
incremental-sync roadmap (see §4 — implementation lands in
`der-2.2.0`).

## 1. Section Tabs — now carry icons

Every sub-nav tab inside a Section Tabs strip renders a 14 px
line-SVG icon alongside its label. This gives operators a
consistent visual anchor as they scan between sibling screens
inside a module.

Icons registered (via `UiIcon` component):

| Module | Tab | Icon |
|---|---|---|
| Sync | Overview | overview |
| Sync | Metadata Sync | metadata |
| Sync | Data Queue | data-queue |
| Sync | Attention | attention |
| Sync | Sync Worker | worker |
| Sync | Schedule | schedule |
| Sync | History | history |
| Sync | Settings | settings |
| System | Health | health |
| System | Metrics / Analytics | analytics |
| System | Storage | storage |
| System | Diagnostics | diagnostics |
| System | Evaluation | evaluation |
| Security & Audit | Audit trail | audit |
| Security & Audit | Security events | attention |
| Security & Audit | Backup | backup |
| Security & Audit | Restore | restore |
| Security & Audit | Recovery | recovery |
| DHIS2 | Overview | overview |
| DHIS2 | Organisation unit | health |
| DHIS2 | Compatibility | diagnostics |
| DHIS2 | Metadata | metadata |

CSS: `.ea-section-tab { gap: 8px }`; icons at 85 % opacity when
inactive, 100 % on the active tab.

## 2. Primary action buttons — now show the action icon

The "Pull metadata" button now carries a down-arrow glyph; "Push
data" carries an up-arrow. Both are already the first thing an
operator reads on `/sync` — the icon makes direction explicit at
a glance (even on small screens where the label truncates).

Also iconed:

- `+ Add user` → plus
- `/dhis2/metadata` → Metadata sync (pull) + Metadata drift (drift)
- Capability pages' "Pull metadata" → pull

Global `.ea-btn` rule now sets `gap: 6px` so every button with an
icon-text pair spaces consistently.

## 3. 404 "Run not found" (follow-up on 2.1.62)

Playwright re-confirmed `/admin/sync/history/4789` resolves in a
cache-busted browser session:

```
run 4789 h1: 📦 Metadata pullSucceeded
run 4789 "Run not found" in body: false
bundle: /admin/assets/index-CSHAx5is.js (2.1.62 build)
```

If any browser still shows "Run not found" after 2.1.62, it is
loading a cached pre-2.1.62 bundle — hard-reload (`Ctrl/Cmd +
Shift + R`) or clear the admin asset cache.

## 4. Metadata incremental sync — roadmap

The question *"How do we only pull new metadata changes and track
deletions?"* calls out a real gap in the current implementation.
Documenting the plan here so the change lands with context.

### Current behaviour (`MetadataSyncService.syncAll`)

- **Pull is full every time** — each resource is fetched with
  `?fields=:all&paging=false`, no `lastUpdated` filter. On a
  874-item snapshot, that's ~2–6 s per pull.
- **Mirror is upsert** — rows that still exist upstream get their
  values refreshed; new rows get inserted. Updates work.
- **Deletions upstream are *not* propagated.** The code comment
  states: *"mirror tables are an append-plus-upsert; nothing is
  deleted even if the central no longer has a row, so Phase 05
  can quarantine affected operations without losing provenance."*
  This means orphans accumulate.
- **Snapshot stamping** — every row carries a `snapshot_id` so
  drift detection *can* identify which rows weren't touched by
  the latest sync. We don't yet act on that information.

### Target behaviour (`MetadataSyncService.syncIncremental`)

1. **Record `last_successful_pulled_at` per resource.** Reading
   from `der.metadata_snapshot` where `outcome='SUCCESS'`
   `ORDER BY started_at DESC LIMIT 1` already gives this
   edge-wide; a per-resource column lets a 404 on one endpoint
   not block others.
2. **Use DHIS2's `filter=lastUpdated:gte:<timestamp>` on every
   resource endpoint.** DHIS2 2.44 supports this across the
   metadata API. The request shrinks from ~5 KB per resource to
   just the delta (usually 0 KB after the first full pull).
3. **Pull `/api/deletedObjects?lastUpdated=<timestamp>` once per
   sync** — DHIS2 returns `{klass, uid}` pairs for every object
   deleted since the given timestamp. Delete the corresponding
   rows from the DER mirror after they're confirmed gone.
4. **Keep the snapshot stamp.** The orphans query
   (`WHERE snapshot_id < current_snapshot`) remains the belt-and-
   braces integrity check: anything on the mirror that neither
   the delta pull refreshed nor `/deletedObjects` deleted is
   flagged for operator review on the Drift page.
5. **Preserve a periodic full-pull fallback** (daily at 03:00) so
   DHIS2 bugs in the `deletedObjects` endpoint can't permanently
   diverge the mirror. Operators can also force a full pull from
   the sync screen.

### What "100% match" means

With steps 1–5 in place:

| Change upstream | DER's response |
|---|---|
| New resource added | Picked up on next incremental pull (`lastUpdated:gte`). |
| Existing resource edited | Picked up on next incremental pull (same filter). |
| Resource deleted | Mirror row removed via `/deletedObjects` sweep. |
| Soft-delete / tombstone | DHIS2 reports via `/deletedObjects` just like a hard delete. |
| DHIS2 API error | Full-pull fallback at 03:00 reconciles any missed delta. |
| Operator forces full pull | Current behaviour — one-shot reconciliation. |

### Scope / plan

The incremental pull is a server-side change
(`MetadataSyncService`, `MetadataMirrorRepository`,
`ExtendedMirrorRepository`) + a V-migration adding
`last_pulled_at` to `der.metadata_snapshot`. It will ship as
**`der-2.2.0`** (minor version — new behaviour, not a UI tweak)
with full test coverage of the delta + deletion paths against the
local 2.44 instance.

Nothing in 2.1.x changes while that lands; the current full-pull
semantics remain safe (just not maximally efficient).
