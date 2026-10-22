# DER 0.3.0 — Phase 02, edge identity, offline sessions, authorisation

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** DER-owned user mirror, Argon2id credentials, opaque sessions, role-based admission, security audit. **Status at this release:** sign-in, session validation, role enforcement, bootstrap-admin provisioning are implemented and unit-covered; integration tests against the live Postgres opt-in.

**Release label:** `der-0.3.0`
**Git tag:** `der-0.3.0`
**Maven artifact:** `ug.ac.mak.der:der-server:0.3.0`
**Pinned DHIS2 reference:** `2.44-SNAPSHOT` (unchanged, ADR-0002)
**Architecture:** Option A — full local DHIS2 instance (ADR-0003, unchanged)
**Option (b) selected:** DER issues its own sessions and reconciles users (user decision 2026-10-21).

## Scope committed

| Area | Deliverable |
|---|---|
| Schema | `database/migrations/V001__phase02_identity.sql` with `edge_node`, `edge_configuration`, `edge_user`, `edge_role`, `edge_credential`, `edge_session`, `scope_assignment`, `security_audit`. Flyway enabled against local Postgres 17. |
| Credentials | `PasswordHasher` wrapping Spring Security `Argon2PasswordEncoder` (M=64 MiB, T=3, P=1, salt=16, hash=32). Scheme-encoded verifier in `edge_credential`; no plaintext anywhere. |
| Sessions | `SessionIssuer` mints 256-bit URL-safe base64 tokens; only their SHA-256 hash is persisted. `DER_SESSION` cookie: HttpOnly, SameSite=Strict, configurable Secure, configurable TTL. |
| Spring Security | `SecurityConfig` filter chain: `/system/health` + `/auth/sign-in` open; `/edge-api/v1/dhis2/**` and `/edge-api/v1/provisioning/**` require `ROLE_ADMIN`; everything else requires a cookie-authenticated principal. |
| Rate limiting | In-memory sliding-window `RateLimiter` per-IP and per-user, applied before password verification. Defaults 30/min IP and 10/min user. |
| Endpoints | `POST /edge-api/v1/auth/sign-in`, `POST /auth/sign-out`, `GET /auth/session`, `POST /edge-api/v1/provisioning/users`, `GET /provisioning/users`, `POST /provisioning/sync-users` (501 stub pointing to Phase 05). |
| Bootstrap | `BootstrapAdminProvisioner` runner provisions the first `ADMIN` from `DER_BOOTSTRAP_ADMIN_USERNAME/PASSWORD`; no-op if any `ADMIN` already exists. Audits every provisioning event. |
| Audit | `security_audit` append-only writer with structured JSONB detail. Writes on sign-in success, failure, rate-limit, bootstrap, provisioning, denied access. |
| TLS | `deployment/tls/README.md` runbook for self-signed PKCS#12 keystore; Phase 02 ships HTTPS wiring but does not enforce it (Phase 06 handles rotation). |
| Secrets | `.env.local.example` template; `.env.local` is gitignored. Every secret flows through environment variables. |
| Traceability | Updated for FR-01-01/03/04, FR-02-01…07, FR-03-01/05/10, FR-16-03/05/06/09 → `in-progress`. |

## Phase 02 self-test results

Server (`./mvnw verify`): **168 tests, 0 failures, 0 errors, 0 skipped.**
- JaCoCo coverage over `ug.ac.mak.der.{build,web,dhis2,security}.*`: **100% line, 100% branch** on included production classes.
- SpotBugs: clean (12 reviewed suppressions in `server/quality/spotbugs-exclude.xml`).
- Checkstyle: clean.
- Flyway: migration SQL compiled into `target/classes/db/migration/` from the authoritative `database/migrations/`.

Live DHIS2 compatibility (`verify_dhis2_reference.py`): **9/9 Phase 01 rows PASS**, pin match confirmed.

## Spec deviations (continued from Phase 01)

1. DHIS2 version pin remains `2.44-SNAPSHOT` (ADR-0002). Phase 09 re-pin required.
2. `/api/system/info` on this reference instance permits anonymous access.
   Phase 02 does not change DHIS2's config; the DER edge still enforces its own
   authentication via `SecurityConfig`.

## New dev-ops items

- Running the server now requires `DER_DB_URL`, `DER_DB_USERNAME`,
  `DER_DB_PASSWORD`, `DER_SESSION_SECRET`, `DER_BOOTSTRAP_ADMIN_USERNAME`,
  `DER_BOOTSTRAP_ADMIN_PASSWORD`. See `.env.local.example`.
- Flyway runs on every boot. The authoritative migration source is
  `database/migrations/` at the repo root; `server/pom.xml` copies it into the
  JAR classpath so the packaged artefact is self-contained.

## Known limitations and NOT-RUN items

- The DHIS2→DER user reconciliation endpoint `POST /sync-users` returns 501.
  Real reconciliation is a Phase 05 deliverable.
- Playwright E2E suites still NOT RUN (opt-in). Unchanged from Phase 00/01.
- OWASP dependency-check still NOT RUN by default (opt-in). Unchanged.
- Integration tests against the live Postgres (`*IT.java`) are declared
  but not run; the Testcontainers path requires Docker (unavailable on this
  host). Phase 06 may introduce a `*IT.java` suite that uses the live local
  Postgres via a dedicated profile.
- Scope assignment table is persisted but not yet enforced; Phase 03
  introduces org-unit / program / data-set scope checks on application APIs.

## Reproducing the Phase 02 release

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine && git checkout der-0.3.0

# One-time bootstrap of the der role + database (requires Postgres 17 on 5432).
psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql

# Fill in secrets.
cp .env.local.example .env.local
# edit .env.local — generate DER_SESSION_SECRET via `openssl rand -base64 48`,
# set DER_BOOTSTRAP_ADMIN_PASSWORD to a strong passphrase.

# Run every Phase 02 check end-to-end.
set -a; source .env.local; set +a
bash scripts/run_all_checks.sh
```

Expected: `gate-report.md` under `docs/evaluation/evidence/phase-02/<commit>/`
with decision `PASS`.
