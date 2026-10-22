# ADR-0015: Edge-to-orgUnit binding

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0004 (hybrid edge), ADR-0006 (compat engine),
  ADR-0014 (pilot deployment), post-1.0 roadmap Initiative 5

## Context

`der-1.0.0-rc.2` ships with no orgUnit binding on the edge. The
`edge_node` singleton in `V001` records `display_name` and `site_name`
only; any aggregate / event / tracker write is accepted regardless of
its `orgUnit` payload. For a pilot clinic, this is wrong — one edge
should serve exactly one site (or one site plus its outreach posts),
and writes targeting a different site should be rejected before they
hit the journal.

The post-1.0 roadmap scopes this as Initiative 5 (`der-1.1.0`).

## Decision

An edge is bound to **exactly one orgUnit sub-tree** at provisioning
time. The binding carries the DHIS2 orgUnit's `id`, `displayName`, and
`/path` (ancestor chain). All business writes to `/api/*` are
intercepted and rejected with HTTP 403 if their `orgUnit` is not under
the bound sub-tree.

### Scope: sub-tree, not leaf

Pilot clinics typically have outreach posts beneath them in the DHIS2
hierarchy. A leaf-only binding would force a separate edge per outreach
post, which is not operationally realistic for low-resource sites.
Sub-tree binding matches how DHIS2 itself scopes user orgUnit auth
(`CurrentUserService.getCurrentUserOrgUnitPath()` prefix match).

### Enforcement at interceptor level, not service

The guard runs as a Spring MVC `HandlerInterceptor` applied to
`/api/**` and the writeable `/edge-api/v1/**` paths. Service-layer
checks would miss the ADR-0005 custom DHIS2 apps served at
`/dhis-web-<key>/**` which bypass DER's own service layer. The
interceptor is the single choke-point.

### Rebind requires explicit confirmation + audit

An admin can rebind to a different orgUnit via `POST
/edge-api/v1/system/org-unit` with `{confirm: true}`. The server
writes a `security_audit` entry and does **not** purge pre-rebind
data — operators triage pre-rebind rows manually from an admin
screen before enabling writes under the new OU. (Automatic data
purge is out of scope for the first slice; add in `der-1.2.0` if
pilots request it.)

### Default `max_depth` cap: 3

The guard allows writes to the bound OU and up to **3 levels of
descendants** by default (overridable via
`der.security.org-unit.max-depth`). This matches most African MoH
hierarchies (country → region → district → facility → outreach post);
a facility-level binding covers its outreach posts without opening up
the whole district.

## REST surface

- `GET /edge-api/v1/system/org-unit` — current binding.
- `POST /edge-api/v1/system/org-unit` — initial bind (first-boot) or
  rebind (`confirm=true` required). ADMIN role.
- The DHIS2-shaped read `/api/organisationUnits?paging=false&fields=id,displayName,path,level`
  (already served) powers the OU picker in EA-01.

## Error shape

Guard rejects return HTTP 403 with:

```json
{
  "code": "OU_OUT_OF_SCOPE",
  "message": "orgUnit {id} is not under the bound sub-tree {path}",
  "boundOrgUnitId": "<id>",
  "boundOrgUnitPath": "/.../.../.../..."
}
```

## Not in scope

- Multi-OU edges (second parallel binding) — a device/user can only
  belong to one site per the project proposal.
- Automatic data purge on rebind — manual triage via admin UI.
- Metadata-level restriction (e.g. "this dataset is not assigned to
  this OU") — that's DHIS2's own authorisation layer and the mirror
  reflects it.
- Enforcement on `/dhis-web-<key>/**` static assets (ADR-0005 apps
  don't make writes to `/api/*` through DER's interceptor; they POST
  directly, so the interceptor still catches them).

## Consequences

- First-boot requires the admin to pick an OU before any write
  endpoint accepts traffic. EA-01 adds a tree picker; writes return
  412 PRECONDITION_FAILED until the binding is set.
- The guard adds a sub-tree-path prefix check to every writeable
  request. The check is a `String.startsWith()` on `edge_node.org_unit_path`
  — O(1) overhead per request.
- `V012__phase10_orgunit_binding.sql` ALTERs `edge_node` with
  nullable columns so existing deployments can upgrade; the server
  rejects writes until a binding is set. Phase 09 pilot operators
  must run the EA-01 picker before accepting commits.
