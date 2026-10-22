# DER pilot operator runbook

Authoritative install / day-2 / troubleshoot / upgrade / rollback
runbook for the `der-1.0.0-rc.1` pilot. Topology is ADR-0014
(systemd-on-Debian/Ubuntu, bare metal, no containers).

## 1. Prerequisites

- Hardware: 2–4 vCPU, 4–8 GB RAM, 50+ GB free on the data partition.
- OS: Debian 12 or Ubuntu 24.04 LTS (fresh install).
- Java 21: `sudo apt install openjdk-21-jre-headless`.
- PostgreSQL 17: `sudo apt install postgresql-17`.
- nginx: `sudo apt install nginx`.
- `pg_dump` / `pg_restore`: shipped with the `postgresql-client-17`
  package.
- Reachable DHIS2 central over HTTPS (outbound only).

Verify the DHIS2 central URL:

```bash
curl -sS -I "${DER_DHIS2_CENTRAL_URL}/api/system/info" | head -n1
```

## 2. Install

```bash
# On the build host (dev laptop) — not on the pilot:
./server/mvnw -f server/pom.xml package -DskipTests
cd client    && npm ci && npm run build && cd ..
cd admin-ui  && npm ci && npm run build && cd ..

# Transfer the repo checkout to the pilot host:
rsync -azP ./ pilot-host:/tmp/der-source/

# On the pilot host:
cd /tmp/der-source
sudo bash deployment/pilot/install.sh
```

The installer is idempotent — re-running updates layout + units
without duplicating the system user.

### RPM-family manual adaptation

Fedora/RHEL operators replace `apt install` with
`sudo dnf install java-21-openjdk-headless postgresql17-server
postgresql17-contrib nginx` and run `postgresql-setup --initdb` before
starting Postgres. The installer itself only shells `psql` + `systemd`
and works unchanged.

## 3. Configure

Edit `/etc/der/pilot.env` and set at minimum:

- `SPRING_DATASOURCE_PASSWORD` — matches the role seeded by
  `deployment/pilot/postgres/bootstrap.sql`.
- `DER_DHIS2_CENTRAL_URL` and `DER_DHIS2_CENTRAL_TOKEN`.
- `DER_BOOTSTRAP_ADMIN_PASSWORD` — single-use; rotate from the admin
  UI immediately after first sign-in.

Permissions must be `0640 root:der`:

```bash
sudo chown root:der /etc/der/pilot.env
sudo chmod 0640 /etc/der/pilot.env
```

## 4. Start

```bash
sudo systemctl start der-server
sudo systemctl status der-server
sudo journalctl -u der-server -f
```

First boot runs Flyway V001..V011 and the `BootstrapAdminProvisioner`
seeds the admin user from env.

## 5. Smoke test

```bash
sudo bash deployment/pilot/smoke_test.sh
```

A `PASS` line proves:

1. `/edge-api/v1/system/health` responds.
2. The bootstrap admin can sign in (session cookie issued).
3. An authenticated metadata read via `/api/dataSets` works.
4. A FULL backup completes (NFR-29 round-trip).
5. The journal worker is live.

## 6. TLS

The shipped nginx block listens on `:8080` HTTP for LAN topology.
Terminating TLS at nginx:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d edge.pilot.example.org
```

Certbot rewrites the server block to listen on 443. Nothing in DER
changes.

### 6.0 TLS enforcement at the server (ADR-0017)

`der-1.1.0-alpha.3` added `der.security.require-tls`. When
enabled, DER rejects plain HTTP with HTTP 426 UPGRADE_REQUIRED;
loopback is exempt so the smoke test still works. Pilot operators
set this in `/etc/der/pilot.env`:

```
DER_SECURITY_REQUIRE_TLS=true
```

### 6.1 Backup-archive at-rest encryption (ADR-0017)

Encryption is **opt-in** and uses a 0400 keyfile on disk. DER never
generates or rotates this key — operators own it. **Lose the key
and encrypted archives are irrecoverable.**

Generate the key once per site:

```bash
sudo openssl rand -base64 32 | sudo tee /etc/der/backup.key >/dev/null
sudo chown root:der /etc/der/backup.key
sudo chmod 0400 /etc/der/backup.key
```

Enable in `/etc/der/pilot.env`:

```
DER_BACKUP_ENCRYPTION_ENABLED=true
DER_BACKUP_ENCRYPTION_KEY_FILE=/etc/der/backup.key
```

Verify `openssl` is on PATH (it is on Debian/Ubuntu LTS by default).
After `systemctl restart der-server`, new backup archives land with
a `.enc` suffix; restores detect the suffix and decrypt first.

**Key rotation.** Not supported in `der-1.1.0`. Rotation strategy
needs KMS integration (`der-1.3.0+`). Operators who want to rotate
early must restore every encrypted archive, generate a new key, and
re-run backup. Document this in the site runbook.

## 7. Day-2 operations

### 7.1 Backups

Admin triggers backups via EA-23 or:

```bash
curl -sS -b "cookies.txt" -H 'Content-Type: application/json' \
  -d '{"kind":"FULL"}' http://127.0.0.1:8080/edge-api/v1/backup/request
```

Archives land under `/var/lib/der/backups/<timestamp>-full.dump`.
Retention: `DER_BACKUP_LOCAL_MAX_ARCHIVES` (default 50). Point
`DER_BACKUP_REMOTE_URL` at an S3-compatible endpoint for offsite
copies.

Cron-triggered automation lives on the pilot host, not inside DER:

```crontab
# /etc/cron.d/der-nightly-backup
30 2 * * * der  curl -sS -b /var/lib/der/cookies.txt \
  -d '{"kind":"FULL"}' -H 'Content-Type: application/json' \
  http://127.0.0.1:8080/edge-api/v1/backup/request >/dev/null
```

### 7.2 Journal worker

Pause / resume via EA-14 or:

```bash
curl -X POST -b cookies.txt http://127.0.0.1:8080/edge-api/v1/journal/worker/pause
curl -X POST -b cookies.txt http://127.0.0.1:8080/edge-api/v1/journal/worker/resume
```

Health:

```bash
curl -sS -b cookies.txt http://127.0.0.1:8080/edge-api/v1/journal/worker | jq
```

### 7.3 Log rotation

systemd routes stdout/err to `/var/log/der/{server,server.err}`.
Install logrotate:

```bash
sudo tee /etc/logrotate.d/der >/dev/null <<'EOF'
/var/log/der/*.log /var/log/der/*.err {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}
EOF
```

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `systemctl start der-server` immediately fails | Flyway refuses — schema drift | `sudo journalctl -u der-server --since '-5 min'`; roll back jar if a migration ran unexpectedly |
| `/edge-api/v1/system/health` reports DHIS2 unreachable | WAN partition | expected offline mode; local workflows keep working. Confirm with `curl -I ${DER_DHIS2_CENTRAL_URL}/api/system/info` |
| Journal backlog growing | DHIS2 rejecting writes | EA-14 shows last error; EA-17 lists conflicts awaiting review |
| Backup stuck at REQUESTED | pg_dump path wrong | `which pg_dump`; set `DER_BACKUP_PG_DUMP` in `/etc/der/pilot.env` and restart |
| `smoke_test.sh` step 4 FAILED | pg_dump cannot connect | `sudo -u der PGPASSWORD=xxx /usr/bin/pg_dump -U der -h 127.0.0.1 der >/dev/null` |
| `413 Request Entity Too Large` on uploads | nginx body limit | increase `client_max_body_size` in the server block |
| High CPU under 20 concurrent sessions | G1GC pressure | widen `-Xmx` in `JAVA_TOOL_OPTIONS` or lower `JavaFX concurrent client count |

## 9. Upgrade

```bash
# Build the new release on the build host, rsync to pilot:
sudo bash deployment/pilot/upgrade.sh
```

`upgrade.sh` snapshots the previous `/opt/der` to
`/opt/der.<timestamp>` before swapping. Flyway migrations run on
restart; a migration failure stops the service and the operator must
rollback.

## 10. Rollback

```bash
sudo bash deployment/pilot/rollback.sh 20261022T183015Z
```

If a Flyway migration ran during the failed upgrade, the old jar will
not start against the advanced schema. Order of operations:

1. Trigger a RESTORE from the archive taken by the pre-upgrade cron
   backup (step 7.1). `POST /edge-api/v1/restore/request` with
   `kind=LOCAL` and the archive path.
2. Wait for `/edge-api/v1/restore/runs/<id>` to report SUCCESS.
3. Then run `rollback.sh <timestamp>`.

## 11. Pilot acceptance evidence

Phase 09 acceptance = producing an NFR evaluation bundle on this
pilot host using the Phase 08 harness:

```bash
export DER_BASE_URL=http://127.0.0.1:8080
export DER_ADMIN_COOKIE="$(cat /var/lib/der/cookies.txt | grep SESSION | awk '{print $NF}')"
export DER_DATA_DIR=/var/lib/postgresql/17/main
export DER_PID="$(systemctl show -p MainPID --value der-server)"
bash scripts/evaluation/run_phase_08.sh
```

The resulting bundle under
`docs/evaluation/evidence/phase-09/<run>/` is the artefact Phase 09
ships with the stable `der-1.0.0` release.
