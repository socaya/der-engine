# der-2.0.6 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.5`

## Headline

Cascade-filter fix for the OU binding form.

## Changes

- `MetadataListController.organisationUnits` now honours DHIS2
  web-API-style `filter=field:op:value` query parameters. Supported
  fields: `level`, `displayName`, `parent.id`,
  `organisationUnitGroups.id` (reads group ids out of the mirrored
  JSONB payload). AND semantics across repeated `filter=` params.
  Unknown fields pass through so a typo yields a response, not a 400.
- `CapOrgUnitBinding` bumps `pageSize` 200 → 1000 (small facility
  corpus) and now reloads when the group-set filter changes.

## Why

Before this release, the local DHIS2 emulator at
`/api/organisationUnits` silently ignored the `filter=` parameter and
returned the first `pageSize` OUs of the full 484-row mirror no
matter what the UI selected. "Organisation unit · 200 matches" never
budged.

## Verification (live, Mauritius corpus)

| Filters                           | Result |
|-----------------------------------|-------:|
| none                              |    484 |
| `level=1` (National root)         |      1 |
| `level=4` (Health Facility)       |    278 |
| `displayName ilike 'medcare'`     |      1 |
| `level=4 + ilike 'baie'`          |      7 |
