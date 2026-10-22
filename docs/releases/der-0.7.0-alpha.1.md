# DER 0.7.0-alpha.1 — Phase 07: backup / restore engine

> **Scope:** Ship the pg_dump / pg_restore orchestration promised by
> ADR-0012. The Phase 06 stub tables (`backup_run`, `restore_run`) now
> back a real worker + REST surface. Local disk is the mandatory target;
> an S3-compatible endpoint is optional. Restore accepts three source
> kinds: local path, remote key, and multipart upload.

**Release label:** `der-0.7.0-alpha.1`
**Git tag:** `der-0.7.0-alpha.1`

## New

- `ADR-0012 Backup and restore engine` — accepted.
- `V011__phase07_backup_restore.sql` — extends `backup_run` + `restore_run`
  with archive path, bytes, remote key, timing, pg_dump version, restore
  kind.
- `ug.ac.mak.der.workflows.backup` package:
  - `BackupWorker` — shells `pg_dump --format=custom --no-owner
    --no-privileges`, writes to `${der.backup.local.root}` (default
    `~/.der/backups`), prunes to `${der.backup.local.max-archives}`
    (default 50), per-run timeout `${der.backup.timeout-seconds}`
    (default 900s).
  - `RestoreWorker` — shells `pg_restore --clean --if-exists --no-owner
    --no-privileges`; materialises LOCAL/REMOTE/UPLOAD source kinds
    with path-traversal guards against the configured roots.
  - `RemoteArchiveStore` — plain `HttpClient` PUT/GET against an
    S3-compatible endpoint. Keeps DER free of the AWS SDK; operators
    needing SigV4 override the bean in a profile.
- `BackupDrainJob` — new Quartz job drains both worklists; triggered
  every 2 min (`der.backup.drain.cron`).
- `BackupController` (`/edge-api/v1/backup/**`) — `POST /request`,
  `GET /runs`, `GET /runs/{id}`, `GET /runs/{id}/archive` (streams the
  file, path validated against local root).
- `RestoreController` (`/edge-api/v1/restore/**`) — `POST /request`
  (kind + source), `POST /upload` (multipart staging into
  `${der.backup.upload.root}`), `GET /runs`, `GET /runs/{id}`.
- `SecurityConfig` — both surfaces require role `ADMIN`.

## Configuration

| Property | Default | Purpose |
|---|---|---|
| `der.backup.enabled` | `true` | Master kill-switch for both workers. |
| `der.backup.local.root` | `${user.home}/.der/backups` | pg_dump output. |
| `der.backup.local.max-archives` | `50` | Retention; older files pruned. |
| `der.backup.upload.root` | `${user.home}/.der/uploads` | Multipart staging. |
| `der.backup.pg-dump` | `pg_dump` | Binary path override. |
| `der.backup.pg-restore` | `pg_restore` | Binary path override. |
| `der.backup.timeout-seconds` | `900` | Per-run subprocess timeout. |
| `der.backup.drain.cron` | `0 */2 * * * ?` | Quartz schedule. |
| `der.backup.remote.url` | *(blank)* | S3-compatible base URL (optional). |
| `der.backup.remote.bearer` | *(blank)* | Bearer token for the remote. |
| `der.backup.remote.timeout-seconds` | `300` | HTTP timeout. |

## Deliberate non-goals

- Point-in-time recovery (PITR) — only full-cluster dumps.
- Incremental backups — each run is a full custom-format dump.
- Encryption-at-rest for archives — operator responsibility
  (filesystem / S3 bucket policy).
- Scheduled auto-backup cron — admin triggers a backup via EA-23.
  (Phase 09 ships a nightly cron hook if pilots request it.)
- AWS SDK dependency — operators that need SigV4 override
  `RemoteArchiveStore` in a Spring profile.

## Test state

- Server unit tests cover `BackupRun`, `RestoreRun`, both repositories,
  the two workers (subprocess + remote mocked), both controllers, and
  the Quartz job.
- Coverage threshold carried through from `0.6.0-alpha.3`.
- Playwright E2E against the backup/restore flow ships with
  `der-0.7.0-alpha.2` once pilot hardware is wired to a test MinIO.
