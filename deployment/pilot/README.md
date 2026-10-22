# DER pilot deployment

Bare-metal Debian/Ubuntu LTS installer per ADR-0014. Authoritative
operator runbook lives at `docs/operations/pilot-runbook.md`; this
directory contains only the shippable artefacts.

## Contents

| File | Purpose |
|---|---|
| `install.sh` | Idempotent installer (user, layout, systemd, nginx, Postgres bootstrap). |
| `smoke_test.sh` | Five-step post-install verification (health, sign-in, metadata, backup round-trip, journal). |
| `upgrade.sh` | Swap jar + SPA bundles; snapshots the previous install under `/opt/der.<ts>` before Flyway runs. |
| `rollback.sh <ts>` | Restore the snapshot `upgrade.sh` left behind. See the runbook when a Flyway migration advanced the schema. |
| `env.pilot.example` | Env template; copy to `/etc/der/pilot.env` and tune per site. |
| `systemd/der-server.service` | systemd unit (Postgres dependency, hardening, log + data paths). |
| `nginx/der-edge.conf` | Reverse-proxy server block (ADR-0004 routes). |
| `postgres/bootstrap.sql` | Idempotent Postgres role + database creation. |

## Minimal install flow

```bash
# 1. On a build host with Java 21 + Node 20:
./server/mvnw -f server/pom.xml package -DskipTests
cd client    && npm ci && npm run build && cd ..
cd admin-ui  && npm ci && npm run build && cd ..

# 2. Rsync the repository checkout to the pilot host, then:
sudo bash deployment/pilot/install.sh

# 3. Edit /etc/der/pilot.env (DHIS2 URL, admin + DB passwords).
sudo systemctl start der-server

# 4. Smoke test.
sudo bash deployment/pilot/smoke_test.sh
```

Fedora/RHEL and the TLS runbook live in
`docs/operations/pilot-runbook.md`.
