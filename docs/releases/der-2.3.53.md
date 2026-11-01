# der-2.3.53 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.52`

## Headline

**Enrolment layer visible on tracker workflows — program sections,
TEA display names, and professional field editor.** Tracker programs
now surface their enrolment form (and its named sections) as service
points, with correct display names and a tabular field editor that
exposes the full server-side behaviour vocabulary.

## 1. Enrolment as a service point (tracker programs)

The wizard previously skipped the enrolment layer, so tracker
workflows started at stage 1 and operators couldn't model
"Register / Enrol" as its own step.

- New `Breakable` kinds `ENROLLMENT_FORM` and `PROGRAM_SECTION`.
- `fetchEnrolmentBreakables(programId)` prepends an **Enrolment**
  row for any `WITH_REGISTRATION` program and appends each
  `programSection` as a nested child (sorted by `sortOrder`).
  Returns `[]` for event programs.
- Mutual exclusion generalised: ticking a parent clears its
  children (and vice-versa) for both
  `PROGRAM_STAGE ↔ PROGRAM_STAGE_SECTION` and
  `ENROLLMENT_FORM ↔ PROGRAM_SECTION`.
- `kindLabel` / `kindIcon` extended: *Enrolment* →
  `enrollment` icon; *Enrolment section* → new dedicated
  `program-section` DER glyph (enrolment clipboard with a
  highlighted inner section).

## 2. Program sections mirrored into the DER catalog

The mirror didn't sync `/api/programSections` at all and had no
read endpoint for them, so section UIDs listed on a program
couldn't be resolved to names.

- `MetadataSyncService.CATALOG_RESOURCES` now includes
  `programSections`; each metadata sync pulls them.
- `MetadataListController` serves `/api/programSections` and
  `/api/programSections/{uid}` from `der.metadata_catalog_item`.
- Client resolves names + `sortOrder` by paging
  `/api/programSections?pageSize=500` and filtering by
  `payload.program.id` (the mirror ignores DHIS2 `fields=` /
  `filter=` / `paging=`).

Verified post-sync against the local DHIS2:

```
SELECT dhis2_uid, display_name
  FROM der.metadata_catalog_item WHERE resource='programSections';
  dhis2_uid   | display_name
--------------+--------------
 S87IJU8vibK  | Demographics
 LA4ZV48SGqQ  | Program Data
```

## 3. TEA display names fixed

Enrolment field candidates were showing raw DHIS2 UIDs because the
client was reading `trackedEntityAttribute.displayName` from the
nested TEA ref (which DHIS2 doesn't populate). `programTeaFields`
now reads the pTEA wrapper's `displayName` / `name` first, falling
back to the ref or UID.

`programSectionTeaFields` fetches `/api/programSections/{uid}` for
the section's own TEA list, intersects with the program's TEAs so
names + mandatory flags carry over, and preserves the section's
attribute order.

## 4. Fields editor — professional row layout

The dense CSS-grid pill list was replaced by a `.ea-table--dense`
with three columns:

| Include | Field | Behaviour |
|---|---|---|
| checkbox | name + "Mandatory upstream in DHIS2" hint for `compulsory` fields | REQUIRED / OPTIONAL / **READONLY** / **HIDDEN** |

- Behaviour select now exposes the full server vocabulary (the
  server has supported `READONLY` / `HIDDEN` since V045, but the
  wizard only ever offered Required / Optional).
- Row header shows `N fields · N included` plus bulk
  **Include all** / **Clear** buttons.
- Unticked rows dim (`opacity: 0.55`).
- `coerceReq()` normalises legacy edit-mode payloads.

## 5. Order column moves right

The `#` + ↑/↓ controls now trail the Fields column instead of
leading the row, so the Service Point name is the primary column
and ordering is a trailing action.

## 6. Files changed

```
server/src/main/java/.../metadata/MetadataSyncService.java     — + programSections
server/src/main/java/.../dhis2emulator/MetadataListController.java — + /api/programSections
                                                                      + /api/programSections/{uid}
admin-ui/src/components/UiIcon.tsx                              — + program-section glyph
admin-ui/src/screens/workflow/wizardMetadata.ts                 — Breakable gains
                                                                   ENROLLMENT_FORM + PROGRAM_SECTION;
                                                                   fetchEnrolmentBreakables();
                                                                   programTeaFields reads wrapper name;
                                                                   programSectionTeaFields.
admin-ui/src/screens/workflow/WorkflowForm.tsx                  — mutual-exclusion handles enrolment
                                                                   parent/child; kindLabel + kindIcon;
                                                                   fields rendered as .ea-table;
                                                                   READONLY / HIDDEN options;
                                                                   coerceReq; Order column trails.
admin-ui/src/styles.css                                         — .ea-wf-fields-table + columns.
VERSION / server/pom.xml / admin-ui/package.json / sw.js         — 2.3.53
```

## 7. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.53 bundle
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.53.jar
# Live-verified against the macOS dev stack:
#   restarted server → /edge-api/v1/system/health reports 2.3.53
#   POST /edge-api/v1/sync/metadata → status OK, snapshotId=54
#   der.metadata_catalog_item: 2 rows for programSections (PEP demog + prog data)
```

## 8. Follow-ups

- Drag-and-drop reorder for service points (alternative to ↑/↓).
- Server-side `/field-candidates` support for `ENROLLMENT_FORM` and
  `PROGRAM_SECTION` so the client doesn't go directly to
  `/api/programs/{id}` and `/api/programSections/{id}`.
- Keyboard navigation on the inner-sidebar rail (Up/Down + Home/End).
