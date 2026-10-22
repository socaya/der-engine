# ADR-0004: Hybrid architecture — DER emulates DHIS2 at the edge; client reuses the DHIS2 Application Platform

- Status: **ACCEPTED**
- Date: 2026-10-22
- Deciders: socaya
- Supersedes: [ADR-0003](0003-architecture-option-a.md)
- Related requirements: FR-04-01, FR-04-02, FR-04-03, FR-04-04, FR-04-06, FR-05-01, FR-05-04, FR-05-08, FR-13-01, FR-13-02, NFR-01, NFR-07, NFR-08, NFR-22, NFR-32
- Related ADRs: [ADR-0001](0001-record-architecture-decisions.md), [ADR-0002](0002-dhis2-version-pin.md) (unchanged)
- Primary source: project proposal §2.4, §3.3, §3.3.1

## Context

The project proposal is explicit that **architecture selection is a project output, not an input**:

> *"Before implementation, three alternatives will be compared: a complete version-matched local DHIS2 instance, a selective compatibility service implementing only required operations, and a hybrid arrangement reusing supported DHIS2 components with additional coordination services. Selection criteria will include behavioural parity, application compatibility, deployment complexity, resource use, upgrade burden, API support and testability. Rationale and rejected alternatives will be captured in an architecture decision record."*
> — proposal §3.3

ADR-0003 selected **Option A (full local DHIS2 instance on the edge host)**. That decision was made before the proposal's required comparison matrix was produced, and before the user's clarifying statement:

> *"DHIS2 only runs on the central server, and the EDGE Runtime works AS IF it is a full running DHIS2 instance installed on the EDGE SERVER."*
> — user, 2026-10-22

ADR-0004 completes the required comparison and reselects.

## Options compared

| Criterion | A — Full local DHIS2 Core on edge | B — Selective compatibility service (DER reimplements the entire subset) | C — Hybrid: DER emulates `/api/*`; client reuses the DHIS2 Application Platform |
|---|---|---|---|
| Behavioural parity with central DHIS2 | Highest (same code) | Lowest (every nuance reimplemented) | High at the API boundary; client UX inherited directly from DHIS2 App Platform |
| Application compatibility (program rules, option sets, validations) | Full | Must be re-implemented endpoint by endpoint | Validation/rules remain DER's responsibility, but the client contract is DHIS2-native so forms, data-engine queries and rendering come from `@dhis2/ui` + `@dhis2/app-runtime` |
| Deployment complexity on edge host | High (JVM, Tomcat, DHIS2 WAR, DHIS2 Postgres schema, filestore, encryption keys) | Low (DER server + Postgres only) | Low (DER server + Postgres only; no DHIS2 Core on edge) |
| Resource footprint on edge | 2–4 GiB JVM for DHIS2 Core + Tomcat + its own DB | ~400 MiB DER server + its DB | ~400 MiB DER server + its DB |
| Upgrade burden | DER team must track every DHIS2 patch for Tomcat/JVM/schema | DER tracks only the subset of `/api/*` it reimplements | DER tracks the subset of `/api/*` + whatever `@dhis2/app-runtime` the client bundles |
| API support | 100% of DHIS2 Web API available (whether or not DER needs it) | Only what DER implements | Only what DER implements (same bound as B); client reuses existing DHIS2 App Platform code |
| Testability (per proposal §2.4) | Hardest — DER's effect is intermingled with DHIS2 Core behaviour | Clean (DER owns both sides of the boundary) | Clean (DER owns server-side; client-side reuse is a dependency, not DER logic) |
| User-visible UX parity | Pixel identical (users use real DHIS2 apps) | Depends entirely on DER-written UI | Pixel identical for the chosen workflows (uses the same `@dhis2/ui` components) |
| Alignment with "edge runtime" naming | Weak — the edge *hosts* DHIS2 rather than *runs* it | Strong | Strong |
| Alignment with proposal §3.3.1 ("existing DHIS2 backend or application functionality **will be reused**") | Yes — reuses DHIS2 Core | No — reimplements everything | Yes — reuses the DHIS2 Application Platform frontend components |
| 16-week prototype feasibility | Moderate (operational complexity) | Low (reimplementing Tracker rules + validation blindly is weeks per workflow) | Moderate (bounded by chosen subset) |

## Decision

**Pick Option C (hybrid).** The DER edge runtime:

1. **Server-side** — exposes a stable subset of the DHIS2 2.44 Web API at `/api/*`
   on the DER coordination service (port 8085 behind NGINX). Response shapes
   are byte-for-byte compatible with DHIS2 2.44 for the implemented endpoints.
   Phase 03 implements read-only metadata (`system/info`, `me`,
   `organisationUnits`, `dataSets`, `dataElements`, `programs`,
   `trackedEntityTypes`); Phase 03.5 adds the aggregate / event / Tracker
   write paths; Phase 04 wires them through the durable journal.
2. **Client-side** — the DER device-client is itself a DHIS2
   App-Platform-style React application. It depends on `@dhis2/ui` for
   components and `@dhis2/app-runtime` for the Data Engine; the Data
   Engine's `baseUrl` is configured to point at DER's `/api/*`. The client
   cannot tell whether it is talking to DER or to a real DHIS2 Core.
3. **No DHIS2 Core on the edge host.** The 2.44-SNAPSHOT instance on
   `localhost:8080/dhis` is henceforth treated exclusively as the
   **central** reference (ADR-0002 pin). Phase 05 adds metadata sync from
   there into the DER mirror; Phase 04 pushes journalled edge changes to
   it.

## Rejected: Option A (ADR-0003 superseded)

- Operational complexity on the edge is incompatible with the "runtime"
  framing in the project title and the proposal §2.4 observation that
  "hosting a workload locally does not automatically make its dependencies
  local" — hosting DHIS2 Core still requires its own Postgres, filestore,
  encryption keys, upgrade path. The edge is not a convenient place for
  that complexity.
- The option conflates the *reference* central instance with the *edge*
  runtime. In production the central is a managed hosted service; placing
  a second full DHIS2 on each edge site multiplies the operational
  surface by the number of sites.
- ADR-0003 was recorded without the A/B/C comparison the proposal §3.3
  mandates. ADR-0004 includes the comparison and therefore supersedes.

## Rejected: Option B (pure selective service, no DHIS2 Application Platform reuse)

- Reimplementing `@dhis2/ui` form rendering, program-rule execution, option
  sets, validations and app chrome from scratch is weeks of work per
  workflow and recreates mechanical complexity that already exists in
  battle-tested form in the DHIS2 Application Platform.
- Proposal §3.3.1: *"Existing DHIS2 backend or application functionality
  will be reused when this preserves version compatibility and reduces
  duplicated business logic."* — Option B deliberately does not reuse.
- Main spec DER-ENG-001 §8 warns: *"do not duplicate complex Tracker rules
  blindly."*

## Consequences

- **Server surface:** DER server grows a `/api/*` namespace alongside
  `/edge-api/v1/*`. SecurityConfig extends to protect `/api/**` with the
  same cookie session. OpenAPI will be generated per phase that adds
  endpoints.
- **Mirror schema:** V002 adds `metadata_organisation_unit`,
  `metadata_data_element`, `metadata_data_set`, `metadata_program`,
  `metadata_tracked_entity_type`, `metadata_snapshot`.
- **Client toolchain:** the device-client gains `@dhis2/ui` and
  `@dhis2/app-runtime` as runtime dependencies. `styled-jsx@^4` is
  required by `@dhis2/ui@10` as a peer and is pinned at that major.
- **Compatibility matrix pivot:** `docs/verification/compatibility/supported-matrix.csv`
  now has TWO perspectives: (a) rows that probe the **central** (unchanged
  from Phase 01), and (b) a new sibling file documenting the **DER-emulated**
  `/api/*` DER itself serves. The former proves DER can talk to central;
  the latter proves DER can be talked to as if it were DHIS2.
- **Deployment:** `deployment/nginx/der.conf.example` no longer proxies
  `/dhis/*` to a local Tomcat; it serves DER's `/api/*` directly through
  the coordination service and the DHIS2-Application-Platform client as
  the SPA root.
- **Phase 06 scope change:** no longer needs a lifecycle supervisor for
  DHIS2 Core — Phase 06 focuses only on DER's own observability, backup
  and TLS rotation.
- **Deliberate limitation:** this hybrid cannot execute DHIS2 Web API
  features DER has not implemented. Each phase extends the list; the
  canonical subset is `docs/verification/compatibility/der-emulated-matrix.csv`
  (introduced here, filled in incrementally). Attempting an unimplemented
  endpoint returns a 501 with a stable error shape so the client can show
  "unsupported at this edge" rather than conflate it with a transient
  error (FR-04-06).

## Non-decisions / Phase gates for later ADRs

- ADR to come: how writes (aggregate `dataValueSets`, event `events`,
  tracker `tracker`) are mediated through the journal (Phase 04).
- ADR to come: whether a given DHIS2 program rule is executed on the
  client (via @dhis2/app-runtime's existing engine), on the DER server
  (reimplemented), or deferred to central at import (Phase 03.5+).
