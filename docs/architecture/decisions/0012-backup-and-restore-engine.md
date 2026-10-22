# ADR-0012: Backup / restore engine

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0001 (Postgres-only), ADR-0010 (journal worker), ADR-0011
  (admin-ui / backup scope boundary)

## Decision

DER owns an operator-triggered backup/restore engine that shells out to
`pg_dump` / `pg_restore` and persists archives under
`~/.der/backups/` with optional S3-compatible offsite upload.

### Pipeline

```
operator → POST /edge-api/v1/backup/request → backup_run (REQUESTED)
      ↓
Quartz BackupWorker (every minute)
      ↓
backup_run (QUEUED → SUCCESS / FAILED)
      ↓
~/.der/backups/<timestamp>-<kind>.dump
      ↓ (optional)
S3-compatible upload if der.backup.remote.url set
```

Restore:

```
operator →
  POST /edge-api/v1/restore/request { source: local|remote|upload }
      ↓
  restore_run (REQUESTED)
      ↓
Quartz RestoreWorker:
  * local  → ~/.der/backups/<path>
  * remote → downloads der.backup.remote.url/<key>
  * upload → multipart file reads via POST /restore/upload
      ↓
  pg_restore --clean --if-exists
      ↓
  restore_run (SUCCESS / FAILED)
```

### Rationale

- `pg_dump` is the operationally understood tool at every pilot deployment;
  no new JSON-replay layer to maintain.
- Local disk default keeps the pilot runnable without a cloud dependency.
- S3-compatible optional upload (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `der.backup.remote.url`) covers MinIO, AWS, Backblaze, Wasabi, etc. via
  the AWS SDK v2.
- Supporting restore from local path **and** remote URL **and** uploaded
  file covers cross-edge disaster recovery (upload laptop copy to new
  edge) and admin convenience (direct re-run from the UI).

### Non-goals

- Point-in-time recovery (PITR). Would need Postgres `archive_mode` tuning
  outside DER's control — Phase 09+.
- Incremental backups. `pg_dump` is full-schema per run.
- Encryption at rest beyond the host filesystem's own protections. S3 upload
  uses server-side encryption when the bucket enforces it.
- Scheduled automatic backups beyond the admin-triggered path. A cron-based
  schedule arrives in Phase 09 against the same `backup_run` table.

## Schema (V011)

Extend `backup_run` and `restore_run` from Phase 06 Release 3 (V010) with
columns the worker needs:

```sql
ALTER TABLE backup_run ADD COLUMN archive_path TEXT;
ALTER TABLE backup_run ADD COLUMN archive_bytes BIGINT;
ALTER TABLE backup_run ADD COLUMN remote_key TEXT;
ALTER TABLE backup_run ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE backup_run ADD COLUMN finished_at TIMESTAMPTZ;

ALTER TABLE restore_run ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE restore_run ADD COLUMN finished_at TIMESTAMPTZ;
```

## REST surface

- `POST /edge-api/v1/backup/request` — body `{kind: AUDIT|FULL}`.
- `GET /edge-api/v1/backup/runs` — audit list.
- `GET /edge-api/v1/backup/runs/{id}/archive` — stream archive bytes.
- `POST /edge-api/v1/restore/request` — body `{source: LOCAL|REMOTE|UPLOAD, path?, url?, uploadId?}`.
- `POST /edge-api/v1/restore/upload` — multipart `.dump` upload.
- `GET /edge-api/v1/restore/runs` — audit list.

All backup/restore routes require ADMIN role. Audit entries written per
start / finish / fail.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `pg_dump` version skew vs Postgres server | Record `pg_dump --version` string in `backup_run.message`. |
| Archive disk fills up | `der.backup.local.max-archives` prunes oldest beyond N. |
| Restore blows away live data | Admin-only; `--clean --if-exists`; audit trail; Phase 09 adds a dry-run flag. |
| S3 creds leak | Standard AWS SDK v2 credential chain; `env` vars only, never persisted. |
| Upload DoS | Multipart hard limit 500 MiB; configurable via `der.backup.max-upload-bytes`. |
