# der-2.3.29 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.28`

## Headline

**Snapshot diff UI** on top of the V060 per-UID endpoint, plus a
sweep over the workflow pages that still rendered a bare `<h1>` — now
every workflow / metadata screen uses the shared `ea-screen-header`
pattern.

## 1. SnapshotDiff page

`/admin/metadata/snapshots/:a/diff/:b`:

- Headline counters table (five resources × delta column).
- Per-UID picker — resource dropdown + three colour-coded groups
  (Added / Removed / Changed) with resolved display names.
- Capped at 100 entries per group with a "…and N more" footer so
  programs that gained hundreds of rules don't bloat the DOM.

Linked from the Snapshots list via a new **Compare** column — every
non-latest snapshot gets a `vs #<latest>` link.

## 2. Header consistency

- `WorkflowQueue` → wraps title + stream badge in `ea-screen-header`.
- `RunValidation` → `ea-screen-header` with "← Back to queue" in the
  header-right slot (previously a bare link above the title).
- `SnapshotList` → `ea-screen-header` + table switched to
  `ea-table--dense`.

Together with the wizard restyle in 2.3.27, every workflow / metadata
screen now shares the same header + card + form idiom.

## 3. Verified live

```
snapshot list "vs #<latest>" column    ✓ 47 links rendered
/snapshots/45/diff/48                  ✓ heading, 5 counter rows,
                                           Added group rendered
no page errors                         ✓
```

## 4. Files changed

```
admin-ui/src/api/edgeApi.ts                           — snapshotCounterDiff,
                                                        snapshotResourceDiff,
                                                        SnapshotDiffCounters,
                                                        SnapshotResourceDiff
admin-ui/src/screens/metadata/SnapshotDiff.tsx        (new)
admin-ui/src/screens/metadata/SnapshotList.tsx        — ea-screen-header + Compare column
admin-ui/src/screens/workflow/WorkflowQueue.tsx       — ea-screen-header
admin-ui/src/screens/workflow/RunValidation.tsx       — ea-screen-header
admin-ui/src/App.tsx                                  — /metadata/snapshots/:a/diff/:b
admin-ui/src/styles.css                               — ea-diff-group[--success/--error/--warning]
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.29
```

## 5. Build + test

```
tsc -b && vite build             ✓
mvn -q -DskipTests package       ✓ 2.3.29 JAR
Diff smoke sweep                 ✓ list column + /diff page
```
