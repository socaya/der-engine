# DER — DHIS2 Edge Runtime

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Phase 00 baseline. **Audience:** Student developer, supervisor, reviewers and future maintainers.

A research prototype that provides **local execution of supported DHIS2
workflows** over a functioning LAN with background reconciliation to a central
DHIS2 installation. The system is designed so that WAN disconnection does not
interrupt supported local operations.

## Current release

- **Release:** `der-0.1.0` (Phase 00 baseline — repository governance, quality
  tooling, and local-evidence runner only).
- **DHIS2 reference version:** `unknown`. The pinned 2.43.x patch is a Phase 01
  decision (see [ADR-0002](docs/architecture/decisions/0002-dhis2-version-pin.md)).
- **Explicitly not implemented at this release:** authentication, aggregate /
  event / Tracker workflows, durable change journal, central synchronisation,
  conflict review, backup/restore, measured NFR thresholds, implemented screens
  beyond test-harness scaffolds.

See [`docs/releases/der-0.1.0.md`](docs/releases/der-0.1.0.md) for the full Phase
00 release note and [`CHANGELOG.md`](CHANGELOG.md) for the running changelog.

## Design baseline

The authoritative design package lives under [`docs/`](docs/):

- Project charter and scope: [`docs/project/`](docs/project/)
- 176 functional requirements: [`docs/requirements/source-functional-register.csv`](docs/requirements/source-functional-register.csv)
- 35 non-functional requirements: [`docs/requirements/source-nonfunctional-register.csv`](docs/requirements/source-nonfunctional-register.csv)
- 54 UI screen specifications: [`docs/ui/screens/`](docs/ui/screens/)
- Architecture: [`docs/architecture/`](docs/architecture/)
- Interfaces: [`docs/interfaces/`](docs/interfaces/)
- Security: [`docs/security/`](docs/security/)
- Operations: [`docs/operations/`](docs/operations/)
- Verification and 20 test suites: [`docs/verification/`](docs/verification/)
- Delivery, phases, and versioning policy: [`docs/delivery/`](docs/delivery/)

The `docs/` tree is **specified**, not **verified**. Implementation progresses
phase-by-phase per the engineering specification; evidence per phase is
collected in `docs/evaluation/evidence/<phase>/<commit>/`.

## Components

| Path | Role |
|---|---|
| `server/` | Spring Boot coordination service (`ug.ac.mak.der`) |
| `admin-ui/` | React/TypeScript administrator console |
| `client/` | React/TypeScript device-client application shell |
| `database/migrations/` | DER-owned schema migrations only |
| `deployment/` | NGINX, systemd and PostgreSQL deployment samples |
| `tests/` | Compatibility, concurrency, recovery, performance and security scenario specifications |
| `docs/` | Authoritative design baseline (see above) |
| `scripts/` | Repeatable project checks and release automation |

## Quick start

Prerequisites: Java 21, Maven 3.9+, Node 20+, Python 3.11+.

```bash
# Run every Phase 00 check end-to-end and produce an evidence bundle.
scripts/run_all_checks.sh

# Run the server locally (dev loop).
cd server && ./mvnw spring-boot:run
# Health: http://localhost:8085/edge-api/v1/system/health

# Run the admin UI (dev loop).
cd admin-ui && npm install && npm run dev    # http://localhost:5173

# Run the client UI (dev loop).
cd client && npm install && npm run dev      # http://localhost:5174
```

The UI shells render the Phase 00 navigation and build banner only. **Do not
deploy this release as a DHIS2 system.** It performs no DHIS2 integration.

## Phase order and gating

See [`docs/delivery/01-implementation-phases.md`](docs/delivery/01-implementation-phases.md).
No phase advances unless every scoped test passes and the per-phase gate report
in `docs/evaluation/evidence/<phase>/<commit>/gate-report.md` records a `PASS`
decision.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch, PR, commit and quality
rules enforced by the gate.

## Academic integrity

The project follows the academic integrity policy in `docs/project/`. All data
in experiments is synthetic. No AI co-authorship appears in commit messages or
release artefacts.
