# DER 0.4.0-alpha.0 — Phase 03b, DHIS2-emulator server + metadata mirror

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** DER server-side DHIS2 Web API emulator + metadata mirror. **Architecture:** hybrid per [ADR-0004](../architecture/decisions/0004-hybrid-dhis2-edge-emulation.md). **Pre-release:** alpha — writes + DER-platform client UI follow in subsequent releases.

**Release label:** `der-0.4.0-alpha.0`
**Git tag:** `der-0.4.0-alpha.0`
**Maven artifact:** `ug.ac.mak.der:der-server:0.4.0-SNAPSHOT`
**Pinned DHIS2 reference:** `2.44-SNAPSHOT` (ADR-0002, unchanged)
**Architecture:** hybrid (ADR-0004)

## Scope committed

| Area | Deliverable |
|---|---|
| Architecture | ADR-0004 ACCEPTED — hybrid. DER emulates DHIS2 Web API at the edge; client reuses the DHIS2 Application Platform (@dhis2/ui + @dhis2/app-runtime). Full A/B/C comparison per proposal §3.3. ADR-0003 SUPERSEDED. |
| Schema | `V002__phase03_metadata_mirror.sql` adds `metadata_organisation_unit`, `metadata_data_element`, `metadata_data_set`, `metadata_program`, `metadata_tracked_entity_type`, `metadata_snapshot`. |
| Metadata mirror | `ug.ac.mak.der.metadata.*` package: records (`Mirrored*`, `MetadataSnapshot`), `MetadataSnapshotRepository`, `MetadataMirrorRepository`. |
| Sync | `MetadataSyncService` fetches `/api/{organisationUnits,dataElements,dataSets,programs,trackedEntityTypes}?fields=:all&paging=false` from central, computes SHA-256 fingerprint, writes mirror + snapshot. |
| Sync admin endpoint | `POST /edge-api/v1/sync/metadata` (ADMIN) — triggers sync, audits SUCCESS/UNREACHABLE/BAD_RESPONSE, returns snapshot summary. |
| DHIS2 Web API emulator | `/api/system/info`, `/api/me`, `/api/organisationUnits[/{uid}]`, `/api/dataElements[/{uid}]`, `/api/dataSets[/{uid}]`, `/api/programs[/{uid}]`, `/api/trackedEntityTypes[/{uid}]`. All DHIS2 2.44 shape-compatible for the read subset. |
| Security | `SecurityConfig` protects `/api/**` with the DER session cookie; `/edge-api/v1/sync/**` requires ADMIN. |
| Deployment | `deployment/nginx/der.conf.example` rewritten for hybrid: no `/dhis/*` route; DER serves `/api/*` directly. Vite proxies updated. |

## Live-verified behaviour (not simulated)

Run against the local DHIS2 2.44-SNAPSHOT (revision `59b9127`, build `2026-08-19T23:39:17.000`) with the bootstrap admin:

- `POST /edge-api/v1/sync/metadata` → **status OK**, **874 metadata records** mirrored (484 OUs, 358 data elements, 0 data sets, 31 programs, 1 tracked entity type), fingerprint `8052ad453242c64bca995af52392f8f2dff297a826b2f2d74bda0e82905c3972`, ~3 seconds elapsed.
- `GET /api/system/info` → `version=2.44-SNAPSHOT`, `systemName="DER Edge Runtime 0.4.0-SNAPSHOT"`, `derServedAt=edge`.
- `GET /api/me` → `username=der-admin`, `authorities=[DER_ADMIN]`, `derOrigin=BOOTSTRAP`.
- `GET /api/organisationUnits?pageSize=3` → `pager.total=484`, first three OUs are "A&A Medcare Medical Centre/Clinic", "Active Health Care Mauritius Private Clinic", "Aegle Clinic Private Clinic" — real DHIS2 Mauritius sample data, served from DER's mirror with the central unreachable to the client.
- `GET /api/programs?pageSize=3` → `pager.total=31`, first three programs have `programType` in `{WITH_REGISTRATION, WITHOUT_REGISTRATION}`.

Evidence JSON archived at `docs/evaluation/evidence/phase-03/<commit>/live-sync.json`.

## Test state

- Server `./mvnw verify` — **247/247 tests PASS**, 0 failures, 0 errors, 0 skipped.
- JaCoCo coverage over `ug.ac.mak.der.{web,build,dhis2,dhis2emulator,metadata,security,workflows}.*` (excluding `DerApplication`, `ClockConfig`, `Dhis2Config`, `SecurityConfig`): **100% line, 100% branch**.
- SpotBugs: clean (14 reviewed suppressions, all documented in `server/quality/spotbugs-exclude.xml`).
- Checkstyle: clean.
- Flyway: V001 + V002 applied cleanly against the live local `der` database.

## Spec deviations (unchanged)

1. DHIS2 version pin remains `2.44-SNAPSHOT` (ADR-0002). Phase 09 re-pin to a GA still required.
2. `/api/system/info` on the central permits anonymous access on the reference instance; DER's `/api/**` enforces authentication regardless.

## What's deliberately NOT in alpha.0 (explicit non-goals)

- **DER-platform client (@dhis2/ui + @dhis2/app-runtime)** — scheduled for Phase 03c (next release `der-0.4.0-alpha.1`).
- **Write-paths** (aggregate `/api/dataValueSets`, event `/api/events`, tracker `/api/tracker`) — Phase 03.5.
- **Durable outbox / journal** — Phase 04.
- **Shared-visibility E2E** (two LAN clients see one commit) — depends on writes, follows Phase 03.5.
- **Scheduled metadata sync** — Phase 05. Current sync is admin-triggered.
- **Field filtering** (`?fields=` DHIS2 subset projection) — currently returns the stored payload as-is.
- **Playwright / OWASP dependency-check / dependency scan on CI** — unchanged from prior phases.

## Reproducing

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine && git checkout der-0.4.0-alpha.0
psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql
cp .env.local.example .env.local  # fill in secrets
set -a; source .env.local; set +a
bash scripts/run_all_checks.sh
```

Then boot DER and run live metadata sync:

```bash
java -jar server/target/der-server-0.4.0-SNAPSHOT.jar &
# wait a moment for V001+V002 to apply
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$DER_BOOTSTRAP_ADMIN_USERNAME\",\"password\":\"$DER_BOOTSTRAP_ADMIN_PASSWORD\"}"
curl -c /tmp/der.c -b /tmp/der.c -X POST http://localhost:8085/edge-api/v1/sync/metadata | jq .
curl -c /tmp/der.c -b /tmp/der.c 'http://localhost:8085/api/organisationUnits?pageSize=5' | jq .
```
