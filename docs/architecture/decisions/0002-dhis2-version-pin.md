# ADR-0002: Pin a single DHIS2 2.43.x patch for the DER baseline

- Status: PROPOSED (decision deferred to Phase 01)
- Date: 2026-10-21
- Deciders: socaya
- Related requirements: FR-04-04, FR-04-10, FR-05-08, FR-12-04, NFR-22, NFR-35

## Context

DER-ENG-001 §1 and §3 require DER to run against **one specifically pinned
2.43.x patch** of DHIS2, verified through the Phase 01 compatibility spike. The
engineering specification forbids claims of universal "2.43+" support. Phase 00
baseline tooling therefore reports the DHIS2 reference version as `unknown`.

## Decision (pending)

- Phase 01 selects one 2.43.x patch after verifying installation prerequisites,
  the API routes DER depends on, Tracker import/export semantics, metadata
  dependency closure, authentication and version identity.
- The chosen patch is recorded in:
  1. `docs/releases/der-0.2.0.md` (Phase 01 release note).
  2. `docs/verification/compatibility/supported-matrix.csv` (to be created in
     Phase 01).
  3. The server `pom.xml` property `dhis2.reference.version` (Spring Boot
     build-info additional property), surfaced by `/edge-api/v1/system/health`.
- This ADR will be amended with the chosen patch and status set to `ACCEPTED`
  during Phase 01 gate work; the original PROPOSED text remains visible for
  audit.

## Non-decisions

- DER is not promised to support any 2.43.x patch other than the pinned one.
- A future supported patch requires its own compatibility matrix and ADR.

## Consequences

- Until Phase 01, the health endpoint, UI build banner and traceability matrix
  carry `dhis2Reference.version=unknown`.
- Attempting to run DER's sync workers against an unpinned central version is
  undefined behaviour at this release and MUST be prevented by the Phase 01
  compatibility guard before any live sync code lands.
