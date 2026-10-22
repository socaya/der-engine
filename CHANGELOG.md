# Changelog

All notable changes to the DHIS2 Edge Runtime (DER) are recorded in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
Release labels are of the form `der-X.Y.Z` with a matching annotated git tag.

The DHIS2 upstream release is **not** the DER version. The pinned reference DHIS2 patch
is recorded separately per release in `docs/releases/`.

## [Unreleased]

### Added

- Phase 03c (DER-platform client with @dhis2/ui) and Phase 03.5 (write paths) not yet started.

## [0.4.0-alpha.0] — unreleased

Phase 03b — DHIS2 Web API emulator (read-only) + metadata mirror
(see `docs/releases/der-0.4.0-alpha.0.md`).

- Added: ADR-0004 — hybrid architecture; supersedes ADR-0003.
- Added: V002 migration — metadata_snapshot + five mirror tables.
- Added: `ug.ac.mak.der.metadata` package — records + repositories + `MetadataSyncService`.
- Added: `ug.ac.mak.der.dhis2emulator` package — `SystemInfoController`,
  `MeController`, `MetadataListController` serving DHIS2-shape read endpoints.
- Added: `POST /edge-api/v1/sync/metadata` admin endpoint.
- Added: `Dhis2ReferenceClient.fetchJson(path)` generic authenticated GET helper.
- Removed: Option-A artefacts (`deployment/dhis2/`, `WorkflowAppsController`, `Dhis2AppCatalogue`).
- Verified live: 874 metadata records pulled from DHIS2 2.44-SNAPSHOT and
  served from DER's `/api/*` to the DER session cookie.
- Server tests: **247/247 pass**; JaCoCo **100% line + branch**.

[0.4.0-alpha.0]: https://github.com/socaya/der-engine/releases/tag/der-0.4.0-alpha.0

## [0.3.0] — unreleased

Phase 02 — edge identity, offline sessions, authorisation (see `docs/releases/der-0.3.0.md`).

- Added: `database/migrations/V001__phase02_identity.sql` with `edge_node`,
  `edge_configuration`, `edge_user`, `edge_role`, `edge_credential`,
  `edge_session`, `scope_assignment`, `security_audit`. Flyway now runs on boot.
- Added: `ug.ac.mak.der.security` package — `EdgeUser`, `EdgeSession`,
  `EdgeRole`, `PasswordHasher` (Argon2id), `SessionIssuer`, `RateLimiter`,
  `AuthenticationService`, `SessionValidationService`, `BootstrapAdminProvisioner`,
  `SessionCookieAuthenticationFilter`, `SecurityConfig`.
- Added: `AuthController` and `ProvisioningController` endpoints at
  `/edge-api/v1/auth/*` and `/edge-api/v1/provisioning/*`.
- Added: `security_audit` append-only logger; writes on every sign-in, provisioning
  and bootstrap event.
- Added: `deployment/tls/README.md` self-signed-cert runbook (not enforced at Phase 02).
- Added: `.env.local.example` template; `.env.local` gitignored.
- Changed: `VERSION`, `pom.xml`, both `package.json` → `0.3.0-SNAPSHOT`.
- Changed: `application.yml` reads datasource + Flyway + security config from
  the environment; test profile excludes DB autoconfig.

[0.3.0]: https://github.com/socaya/der-engine/releases/tag/der-0.3.0

## [0.2.0] — unreleased

Phase 01 — DHIS2 compatibility and architecture (see `docs/releases/der-0.2.0.md`).

- Added: ADR-0003 (Option A — full local DHIS2 instance), ACCEPTED. ADR-0002
  (DHIS2 version pin) moved from PROPOSED to ACCEPTED with a documented
  deviation to `2.44-SNAPSHOT`.
- Added: `ug.ac.mak.der.dhis2` package — `Dhis2Version`, `Dhis2Properties`,
  `Dhis2ReferenceClient`, `Dhis2CompatibilityGuard` and Spring glue, with a
  fail-closed version admission policy.
- Added: `GET /edge-api/v1/dhis2/compatibility` diagnostic endpoint.
- Added: `docs/verification/compatibility/supported-matrix.csv` listing the
  DHIS2 Web API routes DER depends on, with Phase mapping and expected
  status contracts.
- Added: `scripts/verify_dhis2_reference.py` — live probe that walks the
  matrix and writes `docs/evaluation/evidence/phase-01/<commit>/compatibility/*.json`.
- Added: `deployment/dhis2/README.md` and `deployment/postgresql/der-db-bootstrap.sql`
  for the Option A install path (Postgres 17 + Tomcat 10 + DHIS2 2.44-SNAPSHOT).
- Changed: `VERSION`, `pom.xml`, both `package.json` → `0.2.0-SNAPSHOT`;
  Maven `dhis2.reference.version` property set to `2.44-SNAPSHOT`.
- Changed: traceability-matrix status flipped to `in-progress` for FR-04-04,
  FR-04-10, FR-12-04, NFR-22, NFR-35.

[0.2.0]: https://github.com/socaya/der-engine/releases/tag/der-0.2.0

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
