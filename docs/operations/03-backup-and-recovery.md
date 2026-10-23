# Backup, restore and durable-storage policy

> Companion to `02-monitoring-backup-and-recovery.md`. Documents the
> operator-visible contracts for FR-14-06..09 as of der-2.0.2-alpha.2.

## Scope

| FR | Responsibility |
|---|---|
| FR-14-06 Database recovery | Point-in-time recovery procedure with integrity verification against the latest `backup_run` manifest. |
| FR-14-07 Backup | Capture a consistent snapshot of the DER state (`der.pg_dump` role) covering local working state, metadata mirror and pending operation journal. |
| FR-14-08 Restore | Restore a tested snapshot and re-establish a reconciliation checkpoint — the restored journal cursor marks the oldest safe point for central re-attempt. |
| FR-14-09 Storage alarms | Operator-provided warn/reject thresholds halt new write admission before the volume runs out. |

## Backup

- Entry point: `POST /edge-api/v1/backup/request` (ADMIN only) with optional
  `{"kind":"FULL"}` body. Alternatively, the scheduled `BackupDrainJob`
  picks up `REQUESTED` rows every 15 minutes.
- Mechanism: `BackupWorker` shells out to `pg_dump` against the `der`
  database. Because journal, metadata snapshots, device owners and
  conflict buffer all live in that one database, the dump is naturally
  journal-consistent — pg_dump holds a transactional snapshot throughout.
- Output: a single `pg_dump` custom-format archive at
  `${der.backup.local.root}/der-<runId>-<timestamp>.dump`. SHA-256 hash
  recorded in `backup_run.sha256`.
- Encryption: when `der.backup.encrypt.key` is set, archive is wrapped
  via `BackupEncryption` (AES-256-GCM, matches ADR-0012). Remote upload
  uses `RemoteArchiveEncryption` to re-key for off-site.

## Restore

- Mechanism: `RestoreWorker` consumes a `restore_run` row; verifies the
  archive's recorded `sha256` matches the on-disk file, then restores via
  `pg_restore --clean --if-exists`.
- Reconciliation checkpoint: on restore success, the operator triggers
  `POST /edge-api/v1/admin/ops/journal/replay` which:
  - re-anchors the `operation_journal.supersedes` dependency chain,
  - sets the sync cursor to the restored max `created_at` so central
    pulls begin after the restored data, not before.
- Isolation: restores run against a disposable Postgres instance first
  (operator runbook step), only then is the live DB cutover performed.

## Integrity verification

- `scripts/evaluation/backup_integrity.py` recomputes SHA-256 of a local
  or downloaded archive and compares against the manifest.
- The `backup_run` row carries `sha256`, `archiveBytes`, and
  `pgDumpVersion` so a reviewer can prove the archive matches what was
  captured.
- CI runs this against a seeded fixture (`scripts/evaluation/`).

## Storage alarms (FR-14-09)

- Controller: `GET /edge-api/v1/system/storage` reports `status`
  (`OK` / `WARN` / `REJECT`) and raw byte counts.
- Thresholds (operator-tunable):
  - `der.storage.warn-bytes` (default 512 MiB) — raises the amber state.
  - `der.storage.reject-bytes` (default 128 MiB) — admission guard.
- Admission guard: when status is `REJECT`, write-side controllers (data
  value sets, event submission, journal referral enqueue) MUST return a
  structured `STORAGE_FULL_REJECT` error and record a `STORAGE_ALARM`
  audit entry. Read-only endpoints remain available so operators can
  diagnose.
- Dashboards: both DER client Launcher and admin-ui AppShell poll
  `/system/storage` every 60s and surface the strip when non-OK.

## Operator runbook

| Scenario | Action |
|---|---|
| Scheduled backup OK | `GET /edge-api/v1/backup/runs?limit=10` to confirm each run `COMPLETED`; nightly PASS gate. |
| Backup FAILED | Inspect `backup_run.message` + stderr tail; most common cause is `pg_dump` binary mismatch — rebuild DER container with pinned PG client. |
| Storage WARN | Operator rotates older archives off-box; verify `/system/storage` returns to OK. |
| Storage REJECT | Rotate archives; confirm admission re-enabled; audit any `STORAGE_FULL_REJECT` entries during the outage. |
| Restore drill (quarterly) | Create a scratch Postgres, pull the latest archive, run `pg_restore`, confirm journal cursor advances, then shutdown. |

## Non-goals (deferred)

- Multi-day WAL streaming to object store (Phase 09).
- Cross-site active-active replication (out of scope per DER-ENG-001).
