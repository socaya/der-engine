# der-2.0.22 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.21`

## Headline

Metadata screen rename and consolidation. The sidebar entry and
hero are now plain **"Metadata"**, and the two DER-side metadata
activities (sync and drift) surface directly as hero actions on
that screen so operators can jump into them without hunting the
sub-nav.

## Changes

### Metadata screen (`/admin/dhis2/metadata`)
- Sidebar label `"Metadata browser"` → `"Metadata"`.
- Hero title `"Metadata browser"` → `"Metadata"`.
- Hero copy clarifies the DER posture: *read-only mirror; DHIS2
  owns metadata; DER does not create, update or delete it*.
- Added two hero action buttons:
  - **Metadata sync** → `/admin/dhis2/metadata-sync`
  - **Metadata drift** → `/admin/dhis2/metadata-drift`
- No change to the resource picker, counts, table, drawer or
  search — same 45-resource browser from der-2.0.20.

### Navigation
`admin-ui/src/app/navigation.ts` — DHIS2 group item id `metadata-mirror`
label renamed. Routes unchanged; the sub-nav still exposes
`Metadata · Metadata drift · Metadata sync` as discoverable tabs
for direct deep-linking.

### No CRUD, by design
Metadata authoring stays in DHIS2 Core. DER mirrors it and
performs edge-side activities **on** the mirror — sync (pull from
central) and drift detection (compare fingerprints). The hero
copy makes that posture explicit.

## Live assertions

| Check                              | Observed                                           |
|------------------------------------|----------------------------------------------------|
| Hero title                         | "Metadata" (was "Metadata browser")                |
| Hero copy                          | "Read-only mirror …DER does not create, update or delete" |
| Sub-nav tabs                       | Overview · Connection · Organisation unit · Compatibility · **Metadata** · Metadata drift · Metadata sync |
| Legacy label present               | No — "Metadata browser" removed everywhere          |
| Sync button route                  | `/admin/dhis2/metadata-sync` (200)                 |
| Drift button route                 | `/admin/dhis2/metadata-drift` (200)                |

Evidence under `docs/evaluation/evidence/alpha.35-der-2.0.20/`:
`VMETA-renamed.png`, `VMETA-drift.png`, `VMETA-sync.png`.

## Build-base note

The admin-ui bundle must be built with `DER_ADMIN_UI_BASE=/admin/`
when packaged into the server JAR. Without that, `index.html`
references `/assets/*` (root-relative), the server returns 401
for those paths, and the shell cannot boot. ADR-0033 already
documented this; captured here as a reminder because an
intermediate build during 2.0.21 verification hit it.
