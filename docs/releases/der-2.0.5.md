# der-2.0.5 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.4`

## Headline

DHIS2-integration overhaul: new editable central-connection page, a
dedicated DHIS2 Overview as the sidebar landing, real OU filter
metadata (levels / groups / group sets) sourced from the connected
DHIS2 instance, and a proper single-select OU picker.

## Changes

### Backend
- `V029__dhis2_connection_config.sql` — new singleton table
  `der.dhis2_connection_config` for the editable connection payload.
- `Dhis2ConnectionConfig` + `Repository` + `Dhis2ConnectionController`
  exposing `GET` and `PUT` `/edge-api/v1/admin/dhis2-connection` with
  SecretEnvelope-sealed password / PAT at rest. Secrets round-trip as
  the `***` sentinel so the admin UI never sees cleartext.
- `Dhis2ApiProxyController` now **enabled by default**
  (`der.dhis2.proxy.enabled=true`) so OU levels / groups / group sets
  reach the UI; `organisationUnitGroups` and `organisationUnitGroupSets`
  added to the default allow-list.

### Admin UI
- New `MockupDhis2Overview` component at `/integration` — primary
  entry for the DHIS2 sidebar group. Shows reachability, OU binding,
  compat profile, drift status, plus 8 sub-module tiles.
- `NAV_GROUPS.integration.primaryId` flipped from `compat` →
  `dhis2-overview`.
- `CapCentralConnection` rebuilt as a 3-section editable form
  (Connection / Compatibility / Proxy) with password + PAT fields.
- `CapOrgUnitBinding` OU picker is now a plain single-select dropdown
  (was a `size=10` listbox); filter dropdowns now populate from the
  real DHIS2 `/api/organisationUnitLevels`,
  `/api/organisationUnitGroups` and `/api/organisationUnitGroupSets`.
- `edgeApi` additions: `listOrgUnitLevels`, `readDhis2Connection`,
  `writeDhis2Connection`.

## Verification

- 244 / 244 admin-ui tests passing.
- Live-verified: `/api/organisationUnitLevels` returns the 4 real
  levels (National / District / Locality / Health Facility); groups
  endpoint returns 27 groups; PUT connection persists + reads back
  with masked secrets.

Evidence: `docs/evaluation/evidence/alpha.16-dhis2-overhaul/`.
