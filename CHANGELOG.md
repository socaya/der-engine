# Changelog

All notable changes to the DHIS2 Edge Runtime (DER) are recorded in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
Release labels are of the form `der-X.Y.Z` with a matching annotated git tag.

The DHIS2 upstream release is **not** the DER version. The pinned reference DHIS2 patch
is recorded separately per release in `docs/releases/`.

## [Unreleased]

### Added

- Phase 00 work in progress (see `docs/releases/der-0.1.0.md`).

## [0.1.0] — unreleased

Phase 00 baseline: repository governance, FR/NFR/screen registers, version tooling,
quality gates and local-evidence runner. **No DHIS2 integration, authentication,
journal or synchronisation is implemented at this release.**

- Added: root `VERSION` file as single source of truth for the DER release.
- Added: `CHANGELOG.md` and `docs/releases/` directory.
- Added: `scripts/check_version_consistency.py` and `scripts/release.sh`.
- Added: `scripts/check_registers.py` validating the pre-existing authoritative
  design baseline in `docs/`: 176 FRs in `docs/requirements/source-functional-register.csv`,
  35 NFRs in `docs/requirements/source-nonfunctional-register.csv`, 54 screen specs
  in `docs/ui/screens/` and the full traceability matrix in
  `docs/verification/traceability-matrix.csv`.
- Added: Maven wrapper, JaCoCo, SpotBugs, Checkstyle, OWASP dependency-check,
  Flyway, Postgres driver and Testcontainers-Postgres (test scope) on the server.
- Added: ESLint, Prettier, Vitest V8 coverage, React Testing Library, Playwright and
  axe-core on both frontends.
- Added: `scripts/run_all_checks.sh` producing an evidence bundle under
  `docs/evaluation/evidence/phase-00/<commit>/`.
- Changed: `GET /edge-api/v1/system/health` now returns `version`, `commit`,
  `buildTime`, `dhis2Reference.version` (pinned patch, `unknown` until Phase 01)
  and `dhis2Integrated=false`.
- Changed: honest root `README.md` and ADR template introduced.

[Unreleased]: https://github.com/socaya/der-engine/compare/der-0.1.0...HEAD
[0.1.0]: https://github.com/socaya/der-engine/releases/tag/der-0.1.0
