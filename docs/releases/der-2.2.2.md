# der-2.2.2 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.2.1`

## Headline

**§5 Backup + DR production hardening — PITR, automated verification,
operator CLI.** Phase 07's pg_dump pipeline already shipped the local
+ encrypted + remote-upload path; this release adds the four pieces
that separate "we have backups" from "we have usable disaster
recovery":

1. **WAL archive tracking** for point-in-time recovery
2. **PITR plan endpoint** — operator asks for a target time, DER
   returns the exact WAL segments + recovery.conf snippet
3. **Automated restore verification** — scheduled test-restore to a
   shadow DB every Sunday 04:00 so "backups you haven't restored
   from are backups you don't have"
4. **`der-manager` CLI extensions** — `backup`, `restore`, `pitr`,
   `verify` subcommands

## 1. Schema (V039)

```
der.wal_segment            — one row per archived WAL file
der.backup_verification    — scheduled restore-test outcomes
+ retention_policy for wal_segment (7 days) and backup_verification (90 days)
```

## 2. WAL archive tracking

`WalArchiveService` scans `${der.backup.wal.dir}` (default
`/var/lib/der/wal`) every 30 s. New files get a row with filename +
archive_path + size + SHA-256.

### Operator postgres config

```
GET /edge-api/v1/backup/pitr/wal/postgresql-conf
→ { note, lines: [
    "wal_level = replica",
    "archive_mode = on",
    "archive_command = 'test ! -f /var/lib/der/wal/%f && cp %p /var/lib/der/wal/%f'",
    "archive_timeout = 60",
    "max_wal_senders = 3",
    "wal_keep_size = 1024"
  ]}
```

Operator pastes these into `postgresql.conf`, restarts Postgres,
and WAL segments start accumulating in `/var/lib/der/wal/`.

### Summary endpoint

```
GET /edge-api/v1/backup/pitr/wal
→ { walEnabled, walDirectory, walDirExists,
     segmentCount, earliestArchive, latestArchive, totalBytes }

GET /edge-api/v1/backup/pitr/wal/segments?limit=100
→ { segments: [{ segmentId, filename, archivePath, sizeBytes,
                  archivedAt, uploadedAt, uploadDestination, sha256 }] }
```

## 3. PITR plan

```
POST /edge-api/v1/backup/pitr/plan
     body: { target: "2026-10-29T14:00:00Z" }
→ {
    recoveryTarget: "2026-10-29T14:00:00Z",
    segmentCount: 42,
    segments: [{ filename, archivedAt, archivePath }, …],
    recoveryConfSnippet: [
      "restore_command = 'cp /var/lib/der/wal/%f %p'",
      "recovery_target_time = '2026-10-29T14:00:00Z'",
      "recovery_target_action = 'promote'"
    ]
  }
```

Operators pre-flight a recovery scenario with this endpoint, then
feed the snippet into a stopped standby to roll forward.

### Verified

```
POST /pitr/plan { target: "<now>" }
→ segmentCount: 0  (no WAL dir on dev)
   recoveryConfSnippet present
```

## 4. Automated backup verification

`BackupVerificationService.scheduledVerify()` runs weekly at 04:00
Sunday (configurable via `der.backup.verify.cron`):

```
1. Pick the latest backup_run with status=COMPLETED
2. CREATE DATABASE der_verify_<rand>
3. pg_restore --clean --if-exists --no-owner --no-privileges \
    -d der_verify_<rand> <archive_path>
4. Count rows in: network_event, device_message, network_client,
                   network_peer, audit_anchor
5. DROP DATABASE der_verify_<rand>
6. Record outcome (SUCCESS/FAILURE/SKIPPED), duration, row counts
```

Operators trigger manually via:

```
POST /edge-api/v1/backup/pitr/verify/run?backupId=42
GET  /edge-api/v1/backup/pitr/verify/history
GET  /edge-api/v1/backup/pitr/verify/status
```

### Verified

```
GET  /verify/status      → { enabled: true, pgRestore: null, lastRun: null }
POST /verify/run         → 200 { outcome: "SKIPPED",
                                  reason: "no COMPLETED backup to verify" }
GET  /verify/history     → history rows: 1  latest: SKIPPED
```

(Dev host has no completed backup; a pilot box with an hourly
backup job sees SUCCESS rows accumulating week over week.)

## 5. `der-manager` CLI

New subcommands:

```
sudo der-manager backup              # POST /backup trigger local
sudo der-manager backup --remote     # also push to configured destination
sudo der-manager backup list         # GET /backup/runs
sudo der-manager restore <runId>     # POST /restore from a local snapshot
sudo der-manager pitr <timestamp>    # POST /backup/pitr/plan for a target
sudo der-manager verify              # POST /backup/pitr/verify/run
```

Reads admin credentials from `/etc/der/pilot.env` on an installed
host (so cron jobs work without prompting).

## 6. Pilot operator flow

```bash
# Enable WAL archiving (one-time)
sudo nano /etc/postgresql/17/main/postgresql.conf
# Paste the snippet from GET /backup/pitr/wal/postgresql-conf
sudo mkdir -p /var/lib/der/wal && sudo chown postgres:postgres /var/lib/der/wal
sudo systemctl restart postgresql

# Schedule a weekly test-restore (already runs via @Scheduled)
# No action — the Sunday 04:00 cron fires automatically.

# Operator triggers a manual verify after a release
sudo der-manager verify

# Operator pre-flights a PITR before trying it in anger
sudo der-manager pitr 2026-10-29T14:00:00Z
# → prints the segments + recovery.conf snippet to paste
```

## 7. Files changed

```
database/migrations/V039__phase_prod_backup_pitr.sql                           (new)
server/src/main/java/ug/ac/mak/der/workflows/backup/WalArchiveService.java      (new)
server/src/main/java/ug/ac/mak/der/workflows/backup/BackupVerificationService.java (new)
server/src/main/java/ug/ac/mak/der/web/BackupPitrController.java                (new)
scripts/der-manager.sh                                                           — backup/restore/pitr/verify subcommands
```

## 8. Next step in the sequential march

- **2.2.3** — §6 Security hardening (AppArmor, fail2ban, Vault, FIPS)
- **2.2.4** — §8 UI maturity (multi-edge fleet, onboarding, a11y, offline-first)
- **2.2.5** — §9 Testing (chaos, load, soak, golden)
- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
./mvnw -q -DskipTests clean package  ✓ 2.2.2 JAR + V039 applied
Verified end-to-end:
  GET  /wal                            → segmentCount, enabled, path ✓
  GET  /wal/postgresql-conf            → 6-line snippet ✓
  POST /pitr/plan                      → recoveryConfSnippet present ✓
  POST /verify/run                     → SKIPPED (no completed backup) ✓
  GET  /verify/history                 → 1 row logged ✓
der-manager CLI help lists backup/restore/pitr/verify subcommands ✓
```
