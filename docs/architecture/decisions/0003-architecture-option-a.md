# ADR-0003: Architecture — Option A, full local DHIS2 instance

- Status: **SUPERSEDED by [ADR-0004](0004-hybrid-dhis2-edge-emulation.md) on 2026-10-22**
- Date (original): 2026-10-21
- Deciders: socaya
- Related requirements: FR-04-01, FR-04-02, FR-04-03, FR-05-01, FR-08-07, NFR-01, NFR-07, NFR-32
- Related ADRs: ADR-0002 (DHIS2 version pin). ADR-0003 was accepted without the
  A/B/C comparison the project proposal §3.3 mandates. ADR-0004 completes that
  comparison and selects the hybrid architecture instead.

**Why superseded:** The user clarified on 2026-10-22 that the project intent is
not for DHIS2 Core to be installed on the edge host; the "EDGE Runtime works
AS IF a full DHIS2 is installed." That matches the proposal's "hybrid" option,
not Option A. ADR-0004 records the comparison and the new selection.

The historical text below is preserved for audit.

---

## Context

`docs/architecture/01-system-architecture.md` lists three candidate
architectures:

- **A** — Run a full version-pinned DHIS2 instance locally on the edge host,
  with a separately deployed DER coordination service.
- **B** — Selective compatibility re-implementation: DER speaks a reduced
  DHIS2 Web API surface itself; no DHIS2 Core on the edge.
- **C** — Hybrid: reuse selected DHIS2 Core modules (e.g. embed program-rule
  engine) alongside a DER-owned API gateway.

Phase 01 must pick one, with the rejection reasons for the other two recorded.

## Decision

**Option A — Full local DHIS2 instance.** The edge host runs a complete,
version-pinned DHIS2 2.44-SNAPSHOT (ADR-0002), served over NGINX, backed by
PostgreSQL 17, with a separately deployed DER coordination service bound to a
dedicated `der` database on the same PostgreSQL instance.

Request routing:

- LAN clients → NGINX → DHIS2 Core (`/dhis/api/...`) for all supported
  aggregate / event / Tracker workflows.
- LAN clients → NGINX → DER admin + status APIs (`/edge-api/v1/...`) for
  provisioning, journal inspection, conflict review.
- DER sync workers → central DHIS2 Web API over HTTPS for outbound
  reconciliation; DER never bypasses the local DHIS2 for user-facing
  operations.
- DER never writes to the DHIS2 database schema; coordination state lives
  entirely in the separate `der` database.

## Rejected alternatives

### B — Selective compatibility re-implementation

- Rejected because the project goal (`docs/project/01-project-charter.md`
  OBJ-3) is "implement selected aggregate, event and Tracker workflows over
  LAN **in connected/disconnected modes**", which requires DHIS2's own
  validation, program-rule engine, metadata resolution and query semantics.
  Reimplementing those from scratch is out of scope for a 16-week prototype
  and would be a research project in its own right.
- Compatibility risk is maximal: any 2.44 behavioural change breaks DER.

### C — Hybrid (embed selected DHIS2 Core modules)

- Rejected because DHIS2 Core is not published as a modular library suitable
  for embedding at compile time; its Spring context assumes a full Tomcat
  deployment and PostgreSQL-schema ownership.
- Mixing DHIS2 code into the DER server also blurs the "DER-owned persistent
  entities" boundary (DER-ENG-001 §8.1) and would require schema negotiation
  that the current project does not support.
- Could be revisited if DHIS2 ever ships embeddable sub-modules; outside
  Phase 01 scope.

## Topology

```
LAN client (browser)
   │ HTTPS over LAN
   ▼
NGINX TLS gateway (edge host) ─── /dhis/  ─── DHIS2 Core (Tomcat 10)
   │                             /edge-api/ ── DER coordination (Spring Boot)
   │
   └─ localhost PostgreSQL 17
        ├─ database: dhis2 (owned by `dhis`, used by DHIS2 Core)
        └─ database: der   (owned by `der`,  used by DER coordination)

Edge host ──── HTTPS ──── Central DHIS2 2.44 (upstream)
   (only DER sync workers reach this path)
```

## Consequences

- Edge-host prerequisites expand (Java 17+ for DHIS2 2.44, Tomcat 10,
  PostgreSQL 17); `deployment/dhis2/README.md` captures the exact versions.
- Local workflows reuse DHIS2's own validation and rule engine (OBJ-3 ✔) at
  the cost of a heavier edge footprint than Option B.
- The DER server MUST NOT touch DHIS2's database schema; migrations in
  `database/migrations/` target the `der` database exclusively.
- The compatibility matrix (`docs/verification/compatibility/supported-matrix.csv`)
  describes the Web API routes DER depends on, not the DHIS2 Core features
  LAN clients may use directly against the local DHIS2 (which is DHIS2's
  own responsibility to preserve).
- NGINX routing config in `deployment/nginx/der.conf.example` is updated in
  Phase 02 to split `/dhis/*` and `/edge-api/*` paths with correct Host
  rewriting for the local DHIS2.
