# DER 1.1.0-alpha.3 — Initiative 8 part 1: security hardening

> **Scope:** Third slice of the post-1.0 roadmap. Ships ADR-0017
> (TLS enforcement, PII log masking, backup-archive at-rest
> encryption). Everything is **opt-in** — default behaviour matches
> rc.2. Enabling the switches in `pilot.env` is a per-site operator
> decision.

**Release label:** `der-1.1.0-alpha.3`
**Git tag:** `der-1.1.0-alpha.3`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- **ADR-0017 Security hardening part 1** — accepted. TLS enforcement
  hard-fails in prod (default-off), PII log-mask helper + known
  hot-spot application, backup archives encrypted via `openssl
  enc -aes-256-cbc -pbkdf2` with a 0400 keyfile.
- `TlsEnforcementFilter` — Spring `OncePerRequestFilter` that
  rejects HTTP with **426 UPGRADE_REQUIRED** when
  `der.security.require-tls=true`. Honours `X-Forwarded-Proto` for
  nginx-terminated TLS. Loopback (`127.0.0.1`, `::1`, `localhost`)
  exempt by default so the pilot smoke-test keeps working.
- `PiiMasking` — static helper (`maskUsername`, `maskEmail`,
  `maskDisplayName`). Applied at `BootstrapAdminProvisioner` first;
  Phase 11 widens the sweep.
- `BackupEncryption` — wraps `pg_dump` output through `openssl enc`
  on the way out; `pg_restore` input is decrypted first. Archive
  naming gains a `.enc` suffix when encryption is on.
- `BackupWorker` + `RestoreWorker` take `BackupEncryption` as a
  dependency; existing behaviour unchanged when encryption is off.

## Configuration

| Property | Default | Purpose |
|---|---|---|
| `der.security.require-tls` | `false` | Enforce HTTPS on every request (except loopback). |
| `der.security.tls.loopback-exempt` | `true` | Allow `127.0.0.1`/`localhost` to bypass TLS. |
| `der.backup.encryption.enabled` | `false` | Pipe archive through `openssl enc -aes-256-cbc`. |
| `der.backup.encryption.key-file` | *(unset)* | Path to the 0400 keyfile. |
| `der.backup.encryption.openssl` | `openssl` | Binary path override. |
| `der.backup.encryption.timeout-seconds` | `300` | Per-invocation subprocess timeout. |

## Operator checklist (pilot host)

```bash
# Generate the backup key (one-off).
sudo openssl rand -base64 32 | sudo tee /etc/der/backup.key >/dev/null
sudo chown root:der /etc/der/backup.key
sudo chmod 0400 /etc/der/backup.key

# Edit /etc/der/pilot.env:
#   DER_SECURITY_REQUIRE_TLS=true
#   DER_BACKUP_ENCRYPTION_ENABLED=true
#   DER_BACKUP_ENCRYPTION_KEY_FILE=/etc/der/backup.key
# Then restart the service.
sudo systemctl restart der-server
```

Operators who **lose the keyfile cannot restore encrypted archives**.
The pilot runbook §6.1 (to be added in `der-1.1.0-alpha.4`) spells
this out.

## Error shapes

```json
HTTP 426 Upgrade Required:
{ "code": "TLS_REQUIRED",
  "message": "DER requires HTTPS. Terminate TLS at nginx or the loadbalancer." }

HTTP 500 (backup) when key file missing with encryption enabled:
"backup encryption key file is missing or unreadable: /etc/der/backup.key"
```

## Test state

- **991 server tests** pass (was 935, +23 new security-hardening
  cases + 33 misc).
- Admin-ui unchanged: **157 tests, 100/91.31/99.24/100**.
- `mvn verify` green; SpotBugs + Checkstyle clean.
- `BackupEncryption` is excluded from the per-class JaCoCo gate for
  the same reason as `BackupWorker` — subprocess-timeout + Interrupt
  branches need a hanging binary; lift at der-1.1.0 stable with
  Testcontainers fixtures.

## Deliberate non-goals

- MFA on admin sign-in (D11 — `der-1.3.0`).
- Hash-chained `security_audit` for tamper evidence (`der-1.2.0`).
- Automatic key rotation / KMS integration (`der-1.3.0`+).
- GPG-wrapping archives on the S3-compatible remote (`der-1.2.0`).
- Full codebase PII-log sweep — ADR-0017 lands the helper + wires
  the auth path; the wider audit is Phase 11 work.

## Promotion path

`der-1.1.0-alpha.3` → `der-1.1.0-alpha.4` (pilot runbook §6.1
updates + Initiative 9 cleanup) → stable `der-1.1.0`.
