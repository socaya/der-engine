# DER 1.1.0-alpha.1 — Initiative 5: edge-to-orgUnit binding

> **Scope:** First slice of the post-1.0 roadmap. Ships ADR-0015
> (edge-to-orgUnit binding) with a schema change, server-side guard
> interceptor, admin-UI picker on EA-01, and 45 new server tests.
> This release depends on stable `der-1.0.0` landing from
> `der-1.0.0-rc.2` after the pilot acceptance bundle (G1) clears.

**Release label:** `der-1.1.0-alpha.1`
**Git tag:** `der-1.1.0-alpha.1`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- **ADR-0015 Edge-to-orgUnit binding** — accepted. Sub-tree binding
  (not leaf), interceptor-level enforcement, no auto-purge on rebind,
  default `max_depth=3`.
- **V012 schema:** adds `org_unit_id`, `org_unit_display_name`,
  `org_unit_path`, `org_unit_bound_at`, `org_unit_bound_by` to
  `edge_node` + a consistency check constraint.
- `ug.ac.mak.der.orgunit` package:
  - `EdgeOrgUnitBinding` record.
  - `EdgeOrgUnitBindingRepository` — reads + writes the binding;
    resolves OU `path` / `displayName` from `metadata_organisation_unit`.
  - `OrgUnitBindingService` — handles bind / rebind + sub-tree +
    depth checks.
  - `OrgUnitScopeInterceptor` — Spring MVC HandlerInterceptor
    enforcing the ADR-0015 guard on `/api/dataValueSets`,
    `/api/events`, `/api/tracker/**` write methods.
  - `OrgUnitBodyCachingFilter` — wraps guarded POST/PUT/PATCH
    requests so the interceptor can read the body without starving
    downstream `@RequestBody` binding.
  - `OrgUnitWebConfig` — wires the interceptor into Spring MVC.
- `OrgUnitBindingController` — `GET /edge-api/v1/system/org-unit`
  (any authenticated role), `POST` (ADMIN only, with `confirm=true`
  required for rebind).
- Admin UI EA-01 now shows the bound OU; if unbound, surfaces an
  OU picker that reads from `/api/organisationUnits`; if bound,
  surfaces a rebind dialog that requires an explicit confirm
  checkbox.
- 3 new `edgeApi` helpers on the admin-ui side:
  `getOrgUnitBinding`, `bindOrgUnit`, `listOrgUnits`.

## Configuration

| Property | Default | Purpose |
|---|---|---|
| `der.security.org-unit.max-depth` | `3` | Max descendants from the bound OU allowed by the guard. |

## Error shape

```json
HTTP 412 (unbound):
{ "code": "OU_NOT_BOUND",
  "message": "edge is not bound to an orgUnit; admin must call POST /edge-api/v1/system/org-unit" }

HTTP 403 (out of scope):
{ "code": "OU_OUT_OF_SCOPE",
  "message": "orgUnit X is not under the bound sub-tree /root/Y",
  "boundOrgUnitId": "Y",
  "boundOrgUnitPath": "/root/Y" }
```

## Test state

- **927 server tests** pass (was 835 + 45 orgUnit, net +92 after
  rebalancing).
- Admin-ui at **145 tests, 100/91.46/99.18/100** (was 136 /
  100/91/99/100).
- `mvn verify` green; SpotBugs + Checkstyle clean; JaCoCo per-class
  limits met.

## Deliberate non-goals

- No automatic purge of pre-rebind data; admin triages via EA-01.
- No multi-OU binding (one edge serves exactly one sub-tree).
- No DHIS2-side metadata restriction (DHIS2's own authz is
  separate; the mirror reflects it).
- No enforcement on ADR-0005 `/dhis-web-<key>/**` static assets
  (those apps don't POST through DER's interceptor).

## Promotion path

`der-1.1.0-alpha.1` → `der-1.1.0-alpha.2` (Initiative 4 approval
workflows) → `der-1.1.0-alpha.3` (Initiative 8 part 1 security
hardening) → stable `der-1.1.0`.
