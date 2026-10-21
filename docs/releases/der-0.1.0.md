# DER 0.1.0 — Phase 00 baseline release

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Phase 00 baseline tooling only — no DHIS2 integration, authentication, journal or synchronisation is implemented. **Audience:** Student developer, supervisor, reviewers and future maintainers.

**Release label:** `der-0.1.0`
**Git tag:** `der-0.1.0` (annotated; sign with `git tag -s` where supervisor policy requires)
**Maven artifact:** `ug.ac.mak.der:der-server:0.1.0`
**Frontend package versions:** `der-admin-ui@0.1.0`, `der-client@0.1.0`
**DHIS2 reference version:** `unknown` — pinned patch is a Phase 01 decision (ADR-0002, PROPOSED)
**Scope:** Phase 00 only — repository baseline, version governance, FR/NFR/screen register validation, quality tooling, local-evidence runner.

## Deliberate non-goals (do not claim completion)

- No DHIS2 2.43.x compatibility proof. Phase 01.
- No edge identity, offline login or TLS trust configuration. Phase 02.
- No aggregate, event or Tracker workflow execution. Phase 03.
- No durable change journal or outbound sync. Phase 04.
- No inbound central refresh, metadata drift handling or conflict review. Phase 05.
- No backup/restore, metrics, observability. Phase 06.
- No implemented screens beyond test-harness stubs. Phase 07.
- No NFR measurement. Phase 08.

## What this release actually includes

| Area | Deliverable | Evidence location |
|---|---|---|
| Version governance | Root `VERSION`, `CHANGELOG.md`, `scripts/release.sh`, `scripts/check_version_consistency.py` | `docs/evaluation/evidence/phase-00/<commit>/test-results/` |
| Registers | `scripts/check_registers.py` validates the pre-existing `docs/` design baseline (176 FR, 35 NFR, 54 screen specs, traceability matrix) | `docs/evaluation/evidence/phase-00/<commit>/test-results/registers.log` |
| Server | Maven wrapper, JaCoCo + SpotBugs + Checkstyle + OWASP dependency-check, Flyway + PG driver + Testcontainers-Postgres (test scope only, no DHIS2 integration), `/edge-api/v1/system/health` returning version/commit/buildTime/dhis2Reference | `docs/evaluation/evidence/phase-00/<commit>/coverage/server/` |
| Frontends | ESLint, Prettier, Vitest V8 coverage, React Testing Library, Playwright config, axe-core, build-time version banner | `docs/evaluation/evidence/phase-00/<commit>/coverage/admin-ui/`, `.../client/` |
| Governance | `CONTRIBUTING.md`, `docs/architecture/decisions/0001-record-architecture-decisions.md`, ADR-0002 PROPOSED | `docs/architecture/decisions/` |
| Evidence | `scripts/run_all_checks.sh` emitting a dated bundle under `docs/evaluation/evidence/phase-00/<commit>/` | this directory |

## Known limitations and NOT-RUN items

- **CI:** no CI is configured in this release per deliberate choice ("local evidence only"). The spec forbids claiming "CI passed" without CI, and this release does not. `scripts/run_all_checks.sh` output is the authoritative evidence.
- **Docker:** not available on the development host, so Testcontainers-based integration tests are declared and compile but execute as `NOT RUN`. The Testcontainers dependency is wired so Phase 01+ can enable them immediately when Docker is available.
- **DHIS2 reference instance:** not provisioned in Phase 00 by design. The health endpoint reports `dhis2Reference.version=unknown` and `dhis2Integrated=false`.
- **Signed artefacts and SBOM:** not required for the Phase 00 gate. OWASP dependency-check runs offline-tolerant; the first full scan runs during the Phase 01 release-candidate work.

## Reproducing the Phase 00 release

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine
git checkout der-0.1.0
scripts/run_all_checks.sh
```

The expected output is a `gate-report.md` in `docs/evaluation/evidence/phase-00/<commit>/` whose `decision` is `PASS`.
