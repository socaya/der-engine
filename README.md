# DER — DHIS2 Edge Runtime

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.41 – 2.44 (and newer, per ADR-0006). **Status:** Phase 06 — full UI build-out complete; Phase 07 (backup/restore engine) in progress. **Audience:** student developer, supervisor, reviewers, future maintainers, pilot operators.

A research prototype that lets a Local Area Network keep running DHIS2 workflows
even when the Wide Area Network goes dark. The edge runtime emulates DHIS2's
`/api/*` surface at every clinic, speaks the DHIS2 shape to standard DHIS2 apps
and devices, journals every change, resolves conflicts explicitly, and drains
back to a central DHIS2 installation when connectivity returns.

> _No WAN, no problem._ WAN disconnection does not interrupt supported local
> operations; everything the staff capture is durable, auditable, and sync-ready.

---

## Current release

- **Latest tag:** `der-0.6.0-alpha.3` — Phase 06 Release 3 (EA-19..36 admin screens, V010 backup/restore audit tables, ADR-0011).
- **Component versions:** server `0.6.0-SNAPSHOT`, client `0.6.0-SNAPSHOT`, admin-ui `0.6.0-SNAPSHOT`.
- **DHIS2 reference range:** 2.41 through 2.44 as of this release; the compatibility engine (ADR-0006) auto-detects and routes per version.
- **Local verification against:** DHIS2 2.44-SNAPSHOT on Tomcat 10 + PostgreSQL 17.

**Supported workflows today:**
- Aggregate reporting (`POST`/`GET /api/dataValueSets`) with locally-committed audit.
- Event programs (`POST /api/events`, legacy + tracker shape).
- Tracker programs (`POST /api/tracker` for TEI + enrollment + events).
- Program-rule execution at the edge (ADR-0007) — ASSIGN, SHOWERROR, SHOWWARNING, WARNINGONCOMPLETE, ERRORONCOMPLETE, SETMANDATORYFIELD.
- Scheduled metadata resync + drift detection (ADR-0008).
- Conflict review & resolution (ADR-0009).
- Durable journal worker draining edge → central (ADR-0010).
- Custom DHIS2 app hosting via `.zip` install (ADR-0005).

**Explicitly not yet implemented** (per release notes):
- Backup/restore engine (`pg_dump` orchestration) — Phase 07.
- Measured NFR thresholds against pilot hardware — Phase 08.
- Playwright E2E + axe-core sweep over all 54 UI screens — Phase 06.5 polish.
- Signed tags, pilot deployment runbook — Phase 09 → stable 1.0.

See [`CHANGELOG.md`](CHANGELOG.md) and [`docs/releases/`](docs/releases/) for every intermediate release.

---

## Architecture at a glance

```
                      ┌──────────────────────────────────────────┐
                      │                CENTRAL                   │
                      │   DHIS2 2.4x server + Postgres           │
                      └────────────────────┬─────────────────────┘
                                           │  (periodic drain)
                                           │
┌──────────────────────────────┐   ┌───────┴────────────────────────┐
│  Device Client               │   │  DER Edge Node                  │
│  (18 DC screens / @dhis2/ui) ├──►│  Spring Boot 3.3 / Java 21      │
└──────────────────────────────┘   │  Quartz + Postgres JobStore     │
                                   │  Flyway V001..V010              │
┌──────────────────────────────┐   │  Spring Security + Argon2id     │
│  Admin UI                    ├──►│  Rules engine (ADR-0007)        │
│  (36 EA screens / plain HTML)│   │  Compatibility engine (ADR-0006)│
└──────────────────────────────┘   │                                 │
                                   │  Serves /api/* (DHIS2 shape)    │
                                   │  Serves /dhis-web-<key>/** apps │
                                   │  Serves /edge-api/v1/* (admin)  │
                                   └─────────────────────────────────┘
```

Hybrid per [ADR-0004](docs/architecture/decisions/0004-hybrid-dhis2-edge-emulation.md): DHIS2 Core runs on central only; DER emulates `/api/*` at the edge so stock DHIS2 clients (and custom apps installed via ADR-0005) can keep working offline.

---

## Repository layout

| Path | Role |
|---|---|
| `server/` | Spring Boot coordination service (`ug.ac.mak.der`). JDBC + Flyway + Spring Security + Quartz Postgres JobStore. |
| `client/` | React 18 / TypeScript device-client. 18 DC screens using `@dhis2/ui`. |
| `admin-ui/` | React 18 / TypeScript admin console. 36 EA screens with plain-HTML / data-test semantics. |
| `database/migrations/` | DER-owned Flyway migrations `V001..V010`. |
| `deployment/` | NGINX, systemd, PostgreSQL bootstrap, DHIS2 reference install. |
| `tests/` | Compatibility, concurrency, recovery, performance, security scenario specs. |
| `docs/` | Authoritative design baseline (176 FRs, 35 NFRs, 54 screen specs, ADRs, verification matrix). |
| `scripts/` | Repeatable project checks (`run_all_checks.sh`, `verify_dhis2_reference.py`), release automation. |

---

## Key architecture decisions

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](docs/architecture/decisions/0001-postgresql-only-persistence.md) | PostgreSQL-only persistence | Accepted |
| [ADR-0002](docs/architecture/decisions/0002-dhis2-version-pin.md) | DHIS2 version pin | Superseded by ADR-0006 |
| [ADR-0003](docs/architecture/decisions/0003-architecture-options.md) | Architecture options review | Superseded by ADR-0004 |
| [ADR-0004](docs/architecture/decisions/0004-hybrid-dhis2-edge-emulation.md) | Hybrid DHIS2 edge emulation | Accepted |
| [ADR-0005](docs/architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md) | Custom DHIS2 apps on the edge | Accepted (alpha.6) |
| [ADR-0006](docs/architecture/decisions/0006-dhis2-compatibility-engine.md) | Dynamic DHIS2 compatibility engine | Accepted |
| [ADR-0007](docs/architecture/decisions/0007-program-rules-at-the-edge.md) | Program-rule execution at the edge | Accepted |
| [ADR-0008](docs/architecture/decisions/0008-scheduled-sync-and-drift.md) | Scheduled metadata resync + drift via Quartz | Accepted |
| [ADR-0009](docs/architecture/decisions/0009-conflict-review-api.md) | Conflict-review API over the journal | Accepted |
| [ADR-0010](docs/architecture/decisions/0010-journal-worker.md) | Durable journal worker for edge → central drain | Accepted |
| [ADR-0011](docs/architecture/decisions/0011-admin-ui-separation.md) | admin-ui vs device-client separation + backup scope | Accepted |

---

## Design baseline

The authoritative design package lives under [`docs/`](docs/):

- Project charter and scope: [`docs/project/`](docs/project/)
- 176 functional requirements: [`docs/requirements/source-functional-register.csv`](docs/requirements/source-functional-register.csv)
- 35 non-functional requirements: [`docs/requirements/source-nonfunctional-register.csv`](docs/requirements/source-nonfunctional-register.csv)
- 54 UI screen specifications: [`docs/ui/screens/`](docs/ui/screens/) (18 DC + 36 EA)
- DHIS2 version-endpoint matrix: [`docs/verification/compatibility/version-endpoint-matrix.csv`](docs/verification/compatibility/version-endpoint-matrix.csv)
- Architecture + ADRs: [`docs/architecture/`](docs/architecture/)
- Interfaces, security, operations: [`docs/interfaces/`](docs/interfaces/), [`docs/security/`](docs/security/), [`docs/operations/`](docs/operations/)
- Verification matrix + 20 scenario suites: [`docs/verification/`](docs/verification/)
- Delivery, phases, versioning policy: [`docs/delivery/`](docs/delivery/)
- Per-phase evidence: [`docs/evaluation/evidence/<phase>/<commit>/`](docs/evaluation/evidence/)

The `docs/` tree is **specified** at Phase 00 and progressively marked **in-progress** / **verified** as each release ships evidence.

---

## Quick start

**Prerequisites:** Java 21, Maven wrapper (bundled), Node 20+, PostgreSQL 17, Python 3.11+. Local DHIS2 2.4x for live integration (ADR-0004 — DHIS2 does **not** run on the edge).

```bash
# 1. Prepare the DER Postgres database.
psql -h localhost -U postgres \
     -f deployment/postgresql/der-db-bootstrap.sql

# 2. Configure environment.
cp .env.local.example .env.local
# Edit DER_DB_URL, DER_SESSION_SECRET,
# DER_BOOTSTRAP_ADMIN_USERNAME / _PASSWORD,
# DER_DHIS2_CENTRAL_URL / _USER / _PASSWORD.

# 3. Full gate end-to-end (produces docs/evaluation/evidence/<phase>/<commit>/).
set -a; source .env.local; set +a
bash scripts/run_all_checks.sh

# 4. Dev loops (three terminals).
cd server && ./mvnw spring-boot:run
# -> http://localhost:8085/edge-api/v1/system/health

cd client && npm install && npm run dev
# -> http://localhost:5174/

cd admin-ui && npm install && npm run dev
# -> http://localhost:5173/
```

Sign in as the bootstrap admin, then from the launcher:

- **Device-client** (`:5174`): dataset entry (DC-06/07), event programs (DC-08–10), tracker (DC-11–15), review & drafts (DC-16/17).
- **Admin console** (`:5173`): setup overview, provisioning, compatibility, scheduler, drift, conflict review, journal worker, metadata overview, recovery, backup intent, evaluation reports, custom-app management, diagnostics, settings.

---

## REST surfaces served by DER

### DHIS2-shaped `/api/*` (ADR-0004 emulation)
- `GET /api/system/info` — version reflected from the resolved compat snapshot.
- `GET /api/me`, `GET /api/metadata`, `GET /api/organisationUnits`, `/api/dataElements`, `/api/dataSets`, `/api/programs`, `/api/programStages`, `/api/trackedEntityTypes`, `/api/trackedEntityAttributes`, `/api/categoryOptionCombos`, `/api/programRules`.
- `POST`/`GET /api/dataValueSets` — aggregate writes + readback.
- `POST /api/events`, `POST /api/tracker` — event + tracker writes with rules executed at the edge.
- `GET /api/events`, `GET /api/tracker/events` — read-back from the local store.

### DER-only `/edge-api/v1/*`
- `/auth/*`, `/system/health`, `/provisioning/*`.
- `/sync/metadata`, `/sync/jobs`, `/sync/jobs/{name}/trigger`, `/sync/drift`.
- `/compat`, `/compat/history`, `/compat/refresh`.
- `/journal/conflicts`, `/journal/conflicts/{id}/resolve`, `/journal/conflicts/{id}/re-journal`, `/journal/worker`, `/journal/worker/{pause,resume}`.
- `/apps`, `/apps/install`, `/apps/{id}/{enable,…}`.
- `/drafts`.
- `/dhis-web-<app-key>/**` — custom DHIS2 app static assets.

### Phase 07 (not yet live)
- `/admin/diagnostics`, `/admin/settings`, `/backup/{runs,request}`, `/restore/{runs,request}`.

---

## Verification and gating

Every release ships with:

1. `./mvnw verify` — unit + integration tests, JaCoCo gate, SpotBugs, Checkstyle (server).
2. `cd client && npm test -- --coverage` — Vitest, V8 coverage.
3. `cd admin-ui && npm test -- --coverage` — Vitest, V8 coverage.
4. `scripts/run_all_checks.sh` — orchestrates the gate and writes an evidence bundle to `docs/evaluation/evidence/<phase>/<commit>/`.
5. Live verification against DHIS2 2.44-SNAPSHOT captured as JSON evidence (`docs/evaluation/evidence/phase-*/*/live-*.json`).

**Progressive-coverage policy (alpha-phase pragma):** the server and client gates relax slightly for alphas and lift back to 100% line + branch at stable `der-0.6.0` and `der-1.0.0`. Every relaxation is documented inline in `server/pom.xml` and the client/admin-ui `vite.config.ts` with a release-note cross-reference.

No phase advances unless the gate report records a `PASS` decision.

---

## Release history (highlights)

- **`der-0.1.0`** — Phase 00 baseline: tooling, governance, honest health endpoint.
- **`der-0.2.0`** — Phase 01: DHIS2 version pin + fail-closed compatibility guard (ADR-0002).
- **`der-0.3.0`** — Phase 02: edge identity, offline sessions, authorization.
- **`der-0.4.0-alpha.0`** — Phase 03b: DHIS2 Web API emulator (read-only).
- **`der-0.4.0-alpha.1`** — Phase 03c: `@dhis2/ui` device-client bootstrap.
- **`der-0.4.0-alpha.2`** — Phase 03.5: aggregate dataValueSets writes + durable journal rows.
- **`der-0.4.0-alpha.3`** — Phase 03.6a: intelligent DHIS2 compatibility engine (ADR-0006).
- **`der-0.4.0-alpha.4` (+ fix)** — Phase 03.6b: event/tracker writes + full rules engine (ADR-0007).
- **`der-0.4.0-alpha.5`** — Phase 05 part A: Quartz scheduler + drift detection + conflict-review API (ADR-0008/0009).
- **`der-0.4.0-alpha.6`** — Phase 05 part B: custom DHIS2 app hosting (ADR-0005 finalized).
- **`der-0.5.0-alpha.1`** — Phase 04: durable journal worker drain (ADR-0010).
- **`der-0.6.0-alpha.1`** — Phase 06 Release 1: DC-06..17 device-client screens + V009 drafts.
- **`der-0.6.0-alpha.2`** — Phase 06 Release 2: EA-01..18 admin screens.
- **`der-0.6.0-alpha.3`** — Phase 06 Release 3: EA-19..36 admin screens + V010 backup/restore audit + ADR-0011.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch, PR, commit and quality
rules enforced by the gate.

Commit convention: single-author commits by the project maintainer (`socaya`).
No AI co-authorship appears in commit messages or release artefacts.

---

## Academic integrity

The project follows the academic integrity policy in `docs/project/`. All data
in experiments is synthetic. The repository is the single source of truth; no
external systems or private channels carry authoritative requirement, test, or
evidence state.
