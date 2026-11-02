# der-2.3.80 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.79`

## Headline

**R-B — the three highest-value cross-module wires: Sync → DHIS2
metadata, Workflows ↔ Sync, Workflows ↔ Data.**

## 1. Shared primitives

Two new helpers in `screens/shared.tsx`:

- **`metadataResourceForEntity(entityType)`** — maps a conflict's
  `entityType` (`EVENT`, `TRACKED_ENTITY`, `AGGREGATE`, …) to the
  DHIS2 Web-API resource key that defines it (`programs`,
  `trackedEntityTypes`, `dataSets`, …). Returns `null` for generic
  types with no meaningful metadata counterpart.
- **`<ScopedFilterChip />`** — persistent chip rendered under a
  list screen's status bar when it's reached via a cross-module
  filter URL. Shows the originating scope, an "Open run" link
  back, and a Clear button. A quiet hint explains that row-level
  filtering lands with **R-A-data** (schema follow-up).

## 2. R-B/1 — Sync Attention → DHIS2 metadata

### Metadata screen (`/dhis2/metadata`)

Reads `?resource=X` on load and preselects both the resource tab
and its parent domain so the user lands on the exact schema that
failed to sync.

### Conflict detail (`/sync/attention/:operationId`)

New **"DHIS2 metadata"** action button alongside Accept/Reject.
Only renders when the entity type has a resource mapping. Example
flow: an admin opens a failed `EVENT` operation → clicks the chip →
lands on `/dhis2/metadata?resource=programs` → inspects the program
schema that defines the event.

## 3. R-B/2 — Workflows ↔ Sync (filter chip)

`WorkflowRunDetail` action buttons now carry
`?workflowRunId=:runId`:

- **Sync queue** → `/sync/data?workflowRunId=:runId`
- **Sync attention** → `/sync/attention?workflowRunId=:runId`

Both destinations (`MockupDataQueues`, `MockupConflictList`) read
the param and surface a `ScopedFilterChip` at the top of the page.
The chip's "Open run" link closes the loop back to the originating
run; "Clear" drops the scope and reloads without it.

Server-side filtering isn't wired yet — the chip is honest about
this ("Row-level filtering lands with R-A-data…"), so admins know
why the full list is still shown while the context stays visible.

## 4. R-B/3 — Workflows ↔ Data

`WorkflowRunDetail` adds a third exit:

- **Drafts** → `/data/drafts?workflowRunId=:runId`

`CapDrafts` reads the param and renders the same
`ScopedFilterChip`. Opens the two-way wire between Workflows and
the Data module without any schema changes.

## 5. Files changed

```
admin-ui/src/screens/shared.tsx                          — metadataResourceForEntity,
                                                             ScopedFilterChip
admin-ui/src/screens/Metadata.tsx                        — ?resource=X deep-link
admin-ui/src/screens/MoreScreens.tsx                     — Conflict detail
                                                             DHIS2 metadata button;
                                                             Conflict list chip
admin-ui/src/screens/DataQueues.tsx                      — Sync data queue chip
admin-ui/src/screens/CapabilityScreens.tsx               — Drafts chip
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx      — ?workflowRunId=
                                                             exits (sync/data,
                                                             sync/attention,
                                                             data/drafts)
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.80
```

## 6. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.80 bundle (810 ms)
cd admin-ui && npm test                     ✓ 245/249 pass (4 pre-existing
                                              CWF-01 RowMenu delete failures
                                              unrelated)
```

## 7. Follow-ups

- **R-A-data (sequenced next)** — schema upgrade adding
  `workflow_run_id` on `operation_journal` and `drafts` so the
  chips become genuine row filters instead of scope markers.
- **R-C** — nav balance + Snapshots relocation (P2-6, P2-7).
- Pre-existing CWF-01 RowMenu delete tests.
