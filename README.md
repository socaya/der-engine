# DER — DHIS2 Edge Runtime

A software engineering project for **local execution of supported DHIS2 workflows** over a functioning LAN, with background reconciliation to a central DHIS2 installation.

## Repository status

**Starter repository — not a completed DHIS2 synchronisation implementation.** The Java health API, React app shells, scripts, and configuration samples are real starter code. Authentication integration, DHIS2 API compatibility, durable change capture, conflict policies, and synchronisation require implementation and verification against a pinned DHIS2 release.

## Components

- `server/`: Java Spring Boot service for DER-owned coordination endpoints.
- `admin-ui/`: React/TypeScript edge administration shell.
- `client/`: React/TypeScript client shell; replace or integrate with supported DHIS2 applications rather than recreating them blindly.
- `database/`: DER-owned migration and schema samples; do not edit DHIS2 Core tables.
- `deployment/`: NGINX, systemd, PostgreSQL and local deployment samples.
- `tests/`: compatibility and fault-injection scenario specifications.
- `docs/`: architecture, requirements mapping, API, operations and evaluation notes.

## Run locally

**Server:** Java 21, Maven 3.9+. `cd server && mvn spring-boot:run`. Health: `http://localhost:8085/edge-api/v1/system/health`.

**Admin:** Node 20+. `cd admin-ui && npm install && npm run dev`.

**Client:** `cd client && npm install && npm run dev` (different development port).

The UI shells show architecture/navigation status, not real DHIS2 records. Do not deploy this starter as a production DHIS2 system.

## Implementation order

1. Pin DHIS2 release and select full-instance, hybrid, or compatibility architecture with documented proof.
2. Make supported workflows execute against the LAN-local DHIS2 installation during total WAN disconnection.
3. Implement durable change capture consistent with actual DHIS2 transaction semantics.
4. Implement asynchronous, version-specific central APIs; track central acceptance separately from local commits.
5. Add conflict review, permission/metadata drift management, recovery and repeatable end-to-end testing.

See `docs/architecture/README.md` and `docs/requirements/README.md`.

## Academic integrity

Maintain meaningful commits, tests, engineering decisions and accurate documentation of the development process in accordance with institutional requirements.
