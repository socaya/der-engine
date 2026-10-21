# DER 0.2.0 — Phase 01, DHIS2 compatibility and architecture

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** DHIS2 version pin + architecture decision + live compatibility proof. **Status at this release:** architecture frozen (ADR-0003 ACCEPTED); DHIS2 pin frozen (ADR-0002 ACCEPTED with documented deviation); live Phase 01 contracts PASS against the pinned reference instance.

**Release label:** `der-0.2.0`
**Git tag:** `der-0.2.0` (annotated; sign with `git tag -s` where supervisor policy requires)
**Maven artifact:** `ug.ac.mak.der:der-server:0.2.0`
**Pinned DHIS2 reference:** `2.44-SNAPSHOT` (revision `59b9127`, build `2026-08-19T23:39:17.000`)
**Architecture:** Option A — full local DHIS2 instance ([ADR-0003](../architecture/decisions/0003-architecture-option-a.md))

## Scope committed

| Area | Deliverable |
|---|---|
| Architecture | [ADR-0003](../architecture/decisions/0003-architecture-option-a.md) ACCEPTED. Rejected B/C recorded with reasons. |
| Version pin | [ADR-0002](../architecture/decisions/0002-dhis2-version-pin.md) ACCEPTED with a documented deviation (see below). |
| Server adapter | `ug.ac.mak.der.dhis2.*` package: `Dhis2Version`, `Dhis2Properties`, `Dhis2ReferenceClient`, `Dhis2CompatibilityGuard`, Spring glue. Fail-closed version admission. |
| Diagnostic endpoint | `GET /edge-api/v1/dhis2/compatibility` returns the guard state with observed/pinned versions and HTTP 409 on mismatch. |
| Compatibility matrix | `docs/verification/compatibility/supported-matrix.csv` — 11 rows; 9 certified for Phase 01 (positives + a negative), 2 reserved for Phase 02/03. |
| Live probe | `scripts/verify_dhis2_reference.py` walks the matrix and writes `docs/evaluation/evidence/phase-01/<commit>/compatibility/<timestamp>.json`. |
| Deployment | `deployment/dhis2/README.md` + `deployment/postgresql/der-db-bootstrap.sql` codify Option A install for Postgres 17 + Tomcat 10 + DHIS2 2.44-SNAPSHOT. |
| Traceability | FR-04-04, FR-04-10, FR-12-04, NFR-22, NFR-35 flipped from `specified` to `in-progress` with implementation and evidence paths. |

## Phase 01 live-probe results

Against `http://localhost:8080/dhis` with `admin:district`:

| route_id | expected | observed |
|---|---|---|
| INFO | 200 | 200 |
| ME | 200 | 200 |
| DATA_ELEMENTS | 200 | 200 |
| ORG_UNITS | 200 | 200 |
| PROGRAMS | 200 | 200 |
| METADATA | 200 | 200 |
| TRACKER_TET | 200 | 200 |
| NOT_FOUND | 404 | 404 |
| TRACKER_EVENTS_NEEDS_PARAMS | 400 | 400 |

**Pinned-version check:** `expected prefix='2.44-SNAPSHOT'`, `observed='2.44-SNAPSHOT'` ✔

## Spec deviations

1. **DHIS2 version pin is `2.44-SNAPSHOT`, not a `2.43.x` patch.** The reference
   instance available on the engineering machine is a 2.44 extended build.
   ADR-0002 records the deviation. The pin MUST be revisited for the Phase 09
   `der-1.0.0` release against a GA DHIS2 patch; the current pin is a
   non-GA SNAPSHOT and is therefore a release blocker for 1.0 by itself.

2. **`/api/system/info` is readable without authentication on the reference
   instance.** Captured in the compatibility matrix as a Phase 02
   security-hardening item (row `UNAUTH_INFO`, `der_phase=02`). Not a Phase 01
   blocker.

## Known limitations and NOT-RUN items

- Playwright E2E suites remain NOT RUN (opt-in via
  `npm run test:e2e:install && DER_RUN_E2E=true`). Unchanged from Phase 00.
- OWASP dependency-check remains NOT RUN (opt-in via
  `DER_RUN_DEPENDENCY_CHECK=true`). Unchanged from Phase 00.
- DER coordination state is only the role + database. No migrations run
  against `der` yet; the Flyway classpath is wired but still disabled. Phase 02.
- No authentication, journal, synchronisation, or implemented UI screens
  beyond the Phase 00 shell. Phases 02–07.

## Reproducing the Phase 01 release

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine
git checkout der-0.2.0

# 1. Postgres + DHIS2 up (see deployment/dhis2/README.md)
# 2. Export the central URL and credentials.
export DER_DHIS2_CENTRAL_URL=http://localhost:8080/dhis
export DER_DHIS2_USER=admin
export DER_DHIS2_PASSWORD=district

# 3. Run every Phase 01 check.
bash scripts/run_all_checks.sh
```

Expected result: `gate-report.md` under
`docs/evaluation/evidence/phase-01/<commit>/` whose decision is `PASS`.
