# ADR-0002: Pin a single DHIS2 patch for the DER baseline

- Status: **SUPERSEDED BY ADR-0006 (dynamic compatibility engine) on 2026-10-22**
- Original status: ACCEPTED (with documented deviation)
- Date decided: 2026-10-21
- Deciders: socaya
- Related requirements: FR-04-04, FR-04-10, FR-05-08, FR-12-04, NFR-22, NFR-35
- Related ADRs: ADR-0003 (architecture option A)

## Context

DER-ENG-001 §1 and §3 and `docs/README.md` prescribe pinning **one 2.43.x
patch** of DHIS2 for the baseline. The dev reference instance available for
Phase 01 (Tomcat 10 + PostgreSQL 17 on this engineering workstation) runs an
extended `2.44-SNAPSHOT` build (`dhis-service-core-2.44-SNAPSHOT.jar`,
revision `59b9127`, build time 2026-08-19T23:39:17.000, config comment
*"2.44-extended-2026.05 build"*).

Phase 01's exit criterion is **proof against a running supported DHIS2 instance**.
Pinning 2.43.1 when the only reachable instance is 2.44-SNAPSHOT would make
Phase 01's live verification impossible; pinning the running version makes the
proof real but widens the gap to the long-term "2.43+" target.

## Decision

**Pin `dhis2.reference.version = 2.44-SNAPSHOT`** for the Phase 01 baseline,
recorded in:

1. `server/pom.xml` → `spring-boot-maven-plugin` `build-info` additional
   property `dhis2.reference.version`.
2. `/edge-api/v1/system/health` response `dhis2Reference.version` field.
3. `docs/releases/der-0.2.0.md` as the authoritative supported matrix header.

The version guard (ADR-0003 integration point) is **fail-closed**: on startup
and before every outbound call, DER refuses to proceed unless
`/api/system/info.version` from the configured central starts with the exact
string `2.44-SNAPSHOT`. The override property
`der.dhis2.compatibility.allow-mismatch=true` is intended for development
diagnostics only and is logged at WARN on every request.

## Deviation from the DER-ENG-001 guidance

The main engineering specification states "beginning with **one specifically
pinned 2.43.x patch** after verification". This ADR explicitly deviates from
that wording because:

- The research environment contains a `2.44-SNAPSHOT` instance; a reproducible
  2.43.1 install would require either (a) obtaining an older WAR, (b) running
  a parallel Tomcat on a second port against a side database, or (c) using
  Docker, none of which are available on this machine without extra setup the
  user has declined for Phase 01.
- The DER coordination service and its public contract do not depend on
  changes between 2.43.1 and 2.44 — the Web API endpoints DER uses
  (`/api/system/info`, `/api/dataElements`, `/api/organisationUnits`,
  `/api/trackedEntityInstances`, `/api/events`, `/api/tracker`,
  `/api/metadata`) are available on both.
- 2.44-SNAPSHOT is a non-GA build, which means Phase 01 passes against a
  moving target. Phase 09 (DER 1.0.0) MUST re-pin against a released patch
  (either a 2.43.x GA when infrastructure is available, or the 2.44 GA when
  it ships) and re-run the compatibility suite.

The deviation is logged in `docs/releases/der-0.2.0.md` under "Spec deviations".
Supervisor sign-off is required before Phase 02 proceeds against this pin.

## Rejected alternatives

- **Pin 2.43.1 and defer live verification.** Rejected because Phase 01's exit
  criterion is a live run; a NOT RUN gate would leave the project stalled.
- **Install a parallel DHIS2 2.43.1 WAR on port 8081.** Rejected by the user
  as too much setup for Phase 01; may be revisited for Phase 09.
- **Allow any 2.44.x version.** Rejected because the main spec and docs
  explicitly forbid "runtime refusal or restricted mode for unvalidated
  central versions" being loosened to a range.

## Consequences

- The health endpoint, UI banner and traceability matrix carry
  `dhis2Reference.version=2.44-SNAPSHOT` from this release onward.
- The compatibility matrix (`docs/verification/compatibility/supported-matrix.csv`,
  created in Phase 01) is valid only for `2.44-SNAPSHOT` build `59b9127` or
  later with revision-stable Web API semantics.
- A fresh Phase 09 compatibility run against a GA patch is a release blocker
  for `der-1.0.0`.
- `der.dhis2.compatibility.allow-mismatch=true` is a dev-only override; it
  MUST NOT be set in packaged release config.
