# der-2.0.4 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.3`

## Headline

Small focused release fixing the organisation-unit binding bug reported
after `der-2.0.3`, plus a filter upgrade to the bind form.

## Fixes

- **OU bind did not persist.** `EdgeOrgUnitBindingRepository.write()`
  issued an `UPDATE der.edge_node ...` with no WHERE; on a brand-new
  install the singleton row did not exist and the UPDATE silently
  affected 0 rows. The service still returned `{bound:true}` to the
  caller but a subsequent read saw `{bound:false}`. Fixed by issuing
  an INSERT of the singleton row when the UPDATE returns 0 rows.

## Improvements

- Bind form now has filters by **Level**, **Group** and **Group set**
  plus a live **Search** box, with a scrollable listbox that shows
  level + code hints. Addresses operator feedback that picking from a
  484-OU dropdown was impractical.
- `edgeApi.listOrgUnits({ level, groupId, parentId, query, page, pageSize })`
  composes the DHIS2 `/api/organisationUnits` filter string server-side.
- `edgeApi.listOrgUnitGroups()` and `listOrgUnitGroupSets()` added.
- `OrgUnitRow` now includes `code`, `parent`, `organisationUnitGroups`.

## Verification

- 244 / 244 admin-ui tests passing.
- 1382 / 0 / 0 server tests passing including
  `EdgeOrgUnitBindingRepositoryTest` (8).
- Live-verified: POST `/edge-api/v1/system/org-unit` followed by GET
  returns the bound state on a fresh database.

Evidence: `docs/evaluation/evidence/alpha.15-oubind/`.
