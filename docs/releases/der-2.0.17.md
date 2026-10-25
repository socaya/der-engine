# der-2.0.17 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.16`

## Headline

Big release:

1. Real DER footprint reporting (not host-volume utilisation).
2. Comprehensive DHIS2 2.41+ metadata sync — 32 collections.
3. Metadata browser that renders every mirrored resource.
4. `/dhis2/*` URL layout for the integration group.
5. Workspace card density trim.

## Backend

- **`V030__metadata_catalog_item.sql`** — generic
  `der.metadata_catalog_item` table, singleton-per-(resource,uid)
  with full JSONB payload. Covers the long tail of DHIS2 metadata
  that doesn't warrant a dedicated mirror table.
- **`MetadataCatalogRepository`** — `upsert(resource, rows,
  snapshotId)` + `counts()`.
- **`MetadataSyncService.CATALOG_RESOURCES`** — declarative list of
  32 DHIS2 collections pulled on every sync run:
  optionSets, optionGroups, optionGroupSets, categoryCombos,
  categoryOptions, categoryOptionGroups, categoryOptionGroupSets,
  programIndicators, programRuleVariables, programStageSections,
  programNotificationTemplates, relationshipTypes, indicators,
  indicatorTypes, indicatorGroups, indicatorGroupSets, legendSets,
  constants, predictors, predictorGroups, dataElementGroups,
  dataElementGroupSets, validationRules, validationRuleGroups,
  validationNotificationTemplates, organisationUnitGroups,
  organisationUnitGroupSets, organisationUnitLevels, userGroups,
  userRoles, attributes, documents.
  Best-effort: a 404 on an individual endpoint logs WARN and the
  sync continues.
- **`MetadataListController`** — gains 32 catalog-backed
  `@GetMapping` paths serving the catalog table in DHIS2-shape
  (`/api/{resource}` and `/api/{resource}/{uid}`) so clients can
  page + inspect every resource through the standard DHIS2 web-API.
- **`EdgeSystemInfoController.storageMap()`** — adds
  `derDataRootBytes` (sum of `du` under `der.storage.root`) and
  `derDbSchemaBytes` (`pg_total_relation_size` sum over `der.*`)
  so clients can report DER's actual footprint instead of host-
  volume utilisation.

## Admin UI

- **MockupMetadata** rebuilt — 32-pill horizontal tab strip with
  per-resource counts, searchable table (name / code / short name /
  lastUpdated / mirror status) and a right drawer showing the full
  JSONB payload. Lives at `/dhis2/metadata`.
- **Workspace Resource usage ring** — renamed from `Storage` to
  `DER FOOTPRINT`; percent computed from (derDataRootBytes +
  derDbSchemaBytes) / totalBytes rather than whole-volume
  utilisation.
- **Workspace System components panel** — 2-col grid variant;
  7 subsystems fit in roughly half the vertical space.
- **Workspace Recent activity panel** — dedupes adjacent same-type
  entries (`SIGN_IN_SUCCESS × N`) with first + last timestamps.
- **`/dhis2/*` URL layout** — NAV_GROUPS.integration items point
  to `/dhis2`, `/dhis2/connection`, `/dhis2/organisation-unit`,
  `/dhis2/compat`, `/dhis2/compat-history`, `/dhis2/metadata`,
  `/dhis2/metadata-drift`, `/dhis2/program-rules`,
  `/dhis2/metadata-sync`. Legacy `/integration/*`, `/compat*`,
  `/metadata`, `/sync/drift` continue to work as aliases.

## Verification

- 244 / 244 admin-ui tests passing.
- Live Mauritius DHIS2 2.44-SNAPSHOT catalog populated:
  programRuleVariables 398, programIndicators 158, optionSets 87,
  indicators 32, organisationUnitGroups 27, relationshipTypes 16,
  userGroups 10, organisationUnitLevels 4, organisationUnitGroupSets
  3, attributes 3, indicatorTypes 2, categoryCombos 1,
  categoryOptions 1, indicatorGroups 1,
  programNotificationTemplates 1, userRoles 1.
- Storage block now reports `derDataRootBytes ~635 B` +
  `derDbSchemaBytes ~13 MB`; Workspace ring reads **1 %** (was 99 %).
- Metadata browser renders 32 tabs; snap at
  `docs/evaluation/evidence/alpha.28-metadata-browser/MB-browser.png`.
