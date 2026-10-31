# der-2.3.14 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.13`

## Headline

**Guided workflow wizard — authoring without UIDs, enums or JSON.**
`/admin/workflows/new` now opens a three-step wizard that reads
DataSets, Programs and their stages/sections directly from DHIS2 by
name. Operators pick what they are capturing; the system fills in the
technical fields (`sectionKind`, `sectionRef`, dependency chain).

The technical designer (raw form + Advanced JSON) stays at
`/admin/workflows/:id` for editing existing workflows and for power
users.

## 1. The three steps

### Step 1 — Type

Three radio cards:

| Card | Produces |
|---|---|
| Aggregate reporting form | `boundMetadataKind=DATA_SET`, section-level steps |
| Event program | `boundMetadataKind=PROGRAM` (WITHOUT_REGISTRATION), one `EVENT_INSTANCE` step |
| Tracker program | `boundMetadataKind=PROGRAM` (WITH_REGISTRATION), one `PROGRAM_STAGE` step per stage |

### Step 2 — What

Workflow name field + searchable radio list of metadata, loaded by
name only:

```
Aggregate → GET /api/dataSets?fields=id,displayName&paging=false
Event    → GET /api/programs?filter=programType:eq:WITHOUT_REGISTRATION
Tracker  → GET /api/programs?filter=programType:eq:WITH_REGISTRATION
```

The user never sees or types a UID.

### Step 3 — Who

Breakable parts of the chosen metadata, loaded by name:

```
Aggregate → GET /api/dataSets/{id}?fields=id,displayName,sections[id,displayName]
Tracker   → GET /api/programStages?filter=program.id:eq:{id}&fields=id,displayName
Event     → single row (the event program itself)
```

One row per breakable with:
- **Include** checkbox (uncheck to skip),
- **Role** dropdown (Capture operator / Reviewer / Administrator),
- **Device** dropdown (populated from `/edge-api/v1/devices`).

The order rows appear is the capture order; the wizard emits a linear
`COMPLETES_BEFORE` dependency chain so step N can start once step N-1
is complete.

## 2. Payload construction

```typescript
buildWorkflowPayload({ displayName, type, metadata, steps })
  → saveWorkflow({
      displayName,
      boundMetadataKind: type==='AGGREGATE' ? 'DATA_SET' : 'PROGRAM',
      boundMetadataId:   metadata.id,
      enabled: true,
      steps:         <one CAPTURE step per included breakable>,
      dependencies:  <linear COMPLETES_BEFORE chain>,
    })
```

Each step gets a `crypto.randomUUID()` stepId client-side so
dependency references are concrete UUIDs (no server-side placeholder
resolution needed).

## 3. Verified live

End-to-end sweep against the running 2.3.14 build with a
`WITH_REGISTRATION` tracker program from the local DHIS2 2.44 mirror:

```
Step 1  type cards render               ✓  aggregate · event · tracker
Step 2  programs loaded                 ✓  31 tracker programs listed
          search filter "HIV Pro"       ✓  narrows to 1
Step 3  stage rows loaded               ✓  50 program-stage rows
          include-check + role picker   ✓  REVIEWER on step 2
Save    POST /workflows                 ✓  200, redirected to /:id
          boundMetadataKind             ✓  PROGRAM
          boundMetadataId               ✓  ZpnlInpnyt5
          step 0 sectionKind            ✓  PROGRAM_STAGE
          step 1 sectionKind + role     ✓  PROGRAM_STAGE / REVIEWER
          dependencies.length           ✓  1 COMPLETES_BEFORE
pageerrors                              ✓  0
```

## 4. Files

```
admin-ui/src/screens/workflow/WorkflowWizard.tsx    (new)
admin-ui/src/screens/workflow/wizardMetadata.ts     (new) — DHIS2 fetchers + payload builder
admin-ui/src/styles.css                             — ea-wizard-* styles
admin-ui/src/App.tsx                                — /workflows/new → WorkflowWizard
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.14
```

## 5. What this does NOT do yet

- **Edit via wizard.** Opening an existing workflow still lands in the
  technical designer. Round-tripping an existing `boundMetadataId` +
  `sectionRef` set back into "picked by name" needs metadata lookups
  on load — deferred so this release can ship.
- **Section-kind nuance.** Trackers always use `PROGRAM_STAGE` (whole
  stage per step). `PROGRAM_STAGE_SECTION` splitting lands when the
  wizard offers a two-level checklist.
- **Field-level selection.** The wizard emits `fields: []` on every
  step — the server treats that as "capture all fields in the
  section/stage". Field-level opt-in is a future UI panel.
- **Cross-step dependency topology.** Today the wizard emits a strict
  linear chain. Operators who need parallel capture paths still use
  the technical designer's dependency editor.

## 6. Build + test

```
tsc -b && vite build                     ✓
mvn -q -DskipTests package               ✓ 2.3.14 JAR
End-to-end wizard sweep                  ✓ pick → save → canonical shape
admin-ui unit tests                      240/244 (4 pre-existing baseline failures
                                           unrelated to this diff)
```
