# der-2.3.117 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.116`

## Headline

**Metadata routes consolidated, Metadata detail is now DHIS2-aware.**
`/sync/metadata` redirects to the canonical `/dhis2/metadata-sync`,
nav duplicate removed. The per-record detail page's Summary tab
grows a type-specific field block for the 17 metadata kinds DER
tracks (dataElements / dataSets / programs / programStages / …),
mirroring the fields operators actually look at in DHIS2.

## 1. R-AN — route consolidation

**Before**

- `/dhis2/metadata-sync` → `CapMetadataSync`
- `/sync/metadata` → **same** `CapMetadataSync` (nav duplicate)

Two routes rendered the identical component. Operators seeing two
"Metadata Sync" items in the sidebar wondered which was canonical.

**After**

- `/dhis2/metadata-sync` → `CapMetadataSync` (canonical, in DHIS2
  Integration group).
- `/sync/metadata` → `Navigate to="/dhis2/metadata-sync" replace`
  for bookmark compatibility.
- `sync-metadata` nav item removed from the Sync group.
- `MoreScreens` Metadata-browser footer menu now says `DHIS2 ›
  Metadata sync` (was `Sync ›`) — module boundary accurate.

## 2. R-AN — type-specific Metadata detail

`MockupMetadataDetail` (`/dhis2/metadata/:resource/:id`) previously
rendered a single generic Summary table with five rows regardless
of resource type. Now the Summary tab appends a `TypeSpecificSummary`
block whose rows reflect the DHIS2 object shape for the record's
kind:

| Resource                 | Added rows                                                  |
|--------------------------|-------------------------------------------------------------|
| `dataElements`           | Value type · Aggregation type · Domain type · Category combo · Zero-is-significant · Option set · URL |
| `dataSets`               | Period type · Category combo · Data elements · Org units · Form type · Expiry days · Open future periods |
| `programs`               | Program type · TE type · Program stages · Program rule variables · Only enroll once · Display front page list |
| `programStages`          | Program · Repeatable · Auto-generate event · Stage data elements · Stage sections · Open after enrolment |
| `programStageSections`   | Program stage · Data elements · Sort order                  |
| `organisationUnits`      | Level · Path · Parent · Open since · Closed since           |
| `organisationUnitLevels` | Level · Offline levels                                      |
| `trackedEntityTypes`     | Attributes · Min attrs required for search · Allow audit log |
| `trackedEntityAttributes`| Value type · Unique · Option set · Pattern · Confidential   |
| `optionSets`             | Value type · Options                                        |
| `categoryCombos`         | Data dimension type · Categories · Category option combos   |
| `categoryOptionCombos`   | Category combo · Category options                           |
| `validationRules`        | Operator · Period type · Importance                         |
| `programRules`           | Program · Priority · Rule actions                           |
| `programRuleVariables`   | Program · Source · Data element · TE attribute              |
| `indicators`             | Numerator · Denominator · Indicator type                    |
| `userGroups`             | Members · Managed by                                        |
| `userRoles`              | Authorities · Users                                         |

Values are extracted from the mirrored DHIS2 payload with four
tolerant helpers: `str` (plain string), `bool` ("Yes"/"No"), `num`
(numeric), `ref` (nested `{id, displayName}` → `"<name> (<id>)"`),
`arrLen` (count of array fields). Each row is omitted when its
value is absent, so partial payloads collapse gracefully.

Any resource not in the table falls through unchanged — the generic
five rows + Relationships / Rules / Raw JSON tabs still work for
every DHIS2 kind in the mirror.

## 3. Live verification

```
GET /system/health                               → 200
GET /admin/sync/metadata                         → 302 → /admin/dhis2/metadata-sync
GET /admin/dhis2/metadata                        → metadata browser
GET /admin/dhis2/metadata/dataElements/<uid>     → Summary now shows:
                                                     ID, Resource, Code,
                                                     Short name, Last updated,
                                                     Value type, Aggregation
                                                     type, Domain type,
                                                     Category combo, …
tsc --noEmit                                      → clean
cross-module lint                                 → clean
```

## 4. Files changed

```
admin-ui/src/App.tsx                             — /sync/metadata redirect
admin-ui/src/app/navigation.ts                   — sync-metadata removed
admin-ui/src/screens/Metadata.tsx                — TypeSpecificSummary
                                                   + ReactNode import +
                                                   Summary wiring
admin-ui/src/screens/MoreScreens.tsx             — RelatedMenu Metadata
                                                   sync label → DHIS2 ›

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.117
```

## 5. Follow-ups queued

- Relationships + Rules tabs could follow the same type-aware
  pattern (today they're generic). Not surfaced as a user-visible
  issue; defer until operators hit it.
- `CapMetadataSync` is still a thin "job runs list" — a future
  pass could add per-resource sync counts (deferred).
