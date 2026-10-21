# Local DHIS2 — Option A deployment notes

> **Architecture:** full local DHIS2 (ADR-0003). **Pinned version:** `2.44-SNAPSHOT` for the Phase 01 baseline (ADR-0002). **Status:** reference install notes for the engineering machine; not a production runbook.

## Target stack

| Component | Version | Port |
|---|---|---|
| PostgreSQL | **17.x** (EnterpriseDB installer or Homebrew) | `5432` |
| Tomcat | **10.1.x** (Homebrew `tomcat@10`) | `8080` |
| DHIS2 Core WAR | **2.44-SNAPSHOT** (build `59b9127`, `2026-08-19T23:39:17.000`) | served at `/dhis` on Tomcat |
| JDK | **21** (Homebrew `openjdk@21`) | n/a |

The DER server runs separately on port `8085` and connects to a dedicated `der`
database in the same PostgreSQL instance (`deployment/postgresql/der-db-bootstrap.sql`).

## PostgreSQL

Prerequisite: PostgreSQL 17 running on `localhost:5432` with a superuser named
`postgres` (default EnterpriseDB layout).

1. Create the `dhis` role + `dhis2` database used by DHIS2 Core. If the user
   already has these, skip this step.

   ```sql
   CREATE ROLE dhis LOGIN PASSWORD '<dhis-password>';
   CREATE DATABASE dhis2 OWNER dhis;
   ```

2. Create the `der` role + `der` database used by DER coordination:

   ```bash
   psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql
   ```

3. Verify both are reachable:

   ```bash
   psql -h localhost -U dhis -d dhis2 -c 'select 1'
   psql -h localhost -U der  -d der   -c 'select 1'
   ```

## DHIS2 Core

1. Place the pinned DHIS2 WAR at
   `/opt/homebrew/opt/tomcat@10/libexec/webapps/dhis.war`. The reference build
   is `dhis-service-core-2.44-SNAPSHOT.jar`, revision `59b9127`, built
   `2026-08-19T23:39:17.000`. Do **not** use a different build without
   amending ADR-0002.
2. Create `~/.dhis2/dhis.conf` with at least:

   ```properties
   connection.dialect   = org.hibernate.dialect.PostgreSQLDialect
   connection.driver_class = org.postgresql.Driver
   connection.url       = jdbc:postgresql://localhost:5432/dhis2
   connection.username  = dhis
   connection.password  = <dhis-password>
   connection.schema    = update
   server.base.url      = http://localhost:8080/dhis
   filestore.provider   = filesystem
   filestore.container  = files
   filestore.location   = /Users/<you>/.dhis2/files
   encryption.password  = <at least 24 characters>
   ```

3. Start Tomcat with Java 21:

   ```bash
   export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
   /opt/homebrew/opt/tomcat@10/bin/catalina start
   ```

4. Verify DHIS2 serves `/api/system/info` and reports the pinned version:

   ```bash
   curl -u admin:district http://localhost:8080/dhis/api/system/info | jq .version
   ```

   Expected output: `"2.44-SNAPSHOT"`.

## Running the DER→DHIS2 compatibility probe

```bash
export DER_DHIS2_CENTRAL_URL=http://localhost:8080/dhis
export DER_DHIS2_USER=admin
export DER_DHIS2_PASSWORD=district
python3 scripts/verify_dhis2_reference.py
```

Evidence is written under
`docs/evaluation/evidence/phase-01/<commit>/compatibility/`. The Phase 01 gate
requires every row with `der_phase=01` to PASS and the live `version` field
to start with the pinned prefix.

## Known deviations from the main engineering spec

- Pin is `2.44-SNAPSHOT` instead of a `2.43.x` patch. See
  [ADR-0002](../../docs/architecture/decisions/0002-dhis2-version-pin.md).
- The reference instance currently allows anonymous access to
  `/api/system/info`. This is captured in the compatibility matrix as a
  Phase 02 security-hardening follow-up, not a Phase 01 blocker.
