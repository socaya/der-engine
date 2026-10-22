# ADR-0017: Security hardening part 1 — TLS enforcement, PII log masking, backup encryption

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0002 (DHIS2 version pin), ADR-0012 (backup/restore engine),
  ADR-0014 (pilot deployment), post-1.0 roadmap Initiative 8 part 1

## Context

`der-1.0.0-rc.2` ships with HTTPS as a deployment concern — nginx handles
it in `deployment/pilot/`. Nothing in the server enforces it. Backup
archives land on disk unencrypted (ADR-0012 §non-goals). PII (usernames,
emails, display names) is logged at WARN+ in a few places. The post-1.0
roadmap scopes these as Initiative 8 part 1 for `der-1.1.0-alpha.3`.

## Decisions

### D4 — TLS enforcement: hard-fail in prod profile

A new `TlsEnforcementFilter` rejects any request whose
`X-Forwarded-Proto` header is not `https` (or whose scheme is not
`https` when there is no proxy) with **HTTP 426 UPGRADE_REQUIRED**
when the config flag is on.

- `der.security.require-tls` — defaults to `false`.
- `deployment/pilot/env.pilot.example` sets it to `true`, so pilot
  installations enforce TLS from the first boot.
- `test` profile keeps it `false` so `@WebMvcTest` slices do not
  need to add TLS plumbing.

The filter runs before the Spring Security chain so unauthenticated
plaintext health probes also get the 426 response. Loopback requests
from `127.0.0.1` / `localhost` are **exempt** so the pilot smoke-test
script and health-probe cron continue to work.

### D12 — Encryption key management: 0400 keyfile on disk

Encryption-at-rest for backup archives uses `openssl enc
-aes-256-cbc -pbkdf2 -pass file:<path>`. The key material is read
from a file at `${der.backup.encryption.key-file}`.

- The server **does not** generate or rotate the key — operators
  seed it with `openssl rand -base64 32 > /etc/der/backup.key && chmod
  0400 /etc/der/backup.key && chown der:der /etc/der/backup.key`
  as part of the pilot install runbook (new §6.1).
- Server refuses to run backups if `der.backup.encryption.enabled`
  is true but the key file is missing / unreadable / larger than
  4 KB (defensive). The admin UI surfaces this precondition in
  EA-23 before the operator can trigger a backup.
- KMS integration (Vault / AWS KMS / cloud-provider KMS) is **out
  of scope** for `der-1.1.0`. ADR notes the keyfile approach is a
  deliberate near-term choice; `der-1.3.0` revisits.

Archive naming: `<timestamp>-<kind>.dump` when unencrypted,
`<timestamp>-<kind>.dump.enc` when encrypted. The DB column tracks
the actual on-disk filename unchanged.

### PII log masking

Introduce `ug.ac.mak.der.security.PiiMasking` — a tiny stateless
helper with:

- `maskUsername(String)` — first + last letter visible, everything
  else `*` (`alice` → `a***e`).
- `maskEmail(String)` — local part masked, domain preserved
  (`alice@example.org` → `a***e@example.org`).
- `maskDisplayName(String)` — first letter of each token, rest `*`.

Applied at the known hot spots that currently log full PII:

- `AuthenticationService.signIn` (success + failure logs).
- `BootstrapAdminProvisioner`.
- `SecurityAuditRepository.append` payload serialization.

A **full codebase sweep** for PII in logs is deferred; this ADR
lands the helper + applies it to the user-identifiable auth paths.
Phase 11 widens the net.

### Not in scope (deferred to later alphas)

- MFA on admin sign-in (D11 — `der-1.3.0`).
- Hash-chained `security_audit` for tamper evidence (`der-1.2.0`).
- GPG wrapping of archives on the S3-compatible remote
  (`der-1.2.0` with the hash-chain audit work).
- Automatic key rotation / KMS integration (`der-1.3.0`+).

## REST + config surface

| Property | Default | Purpose |
|---|---|---|
| `der.security.require-tls` | `false` | Enforce HTTPS on every request (except loopback). |
| `der.security.tls.loopback-exempt` | `true` | Allow `127.0.0.1`/`localhost` requests to bypass the TLS check. |
| `der.backup.encryption.enabled` | `false` | Pipe `pg_dump` output through `openssl enc -aes-256-cbc`. |
| `der.backup.encryption.key-file` | *(unset)* | Path to the 0400 keyfile. |
| `der.backup.encryption.openssl` | `openssl` | Binary path override. |

HTTP response on TLS rejection:

```json
HTTP 426 Upgrade Required
{ "code": "TLS_REQUIRED",
  "message": "DER requires HTTPS. Terminate TLS at nginx or the loadbalancer." }
```

## Consequences

- Pilot operators who deploy without TLS (lab networks, kiosk
  mode) must explicitly set `der.security.require-tls=false`. The
  pilot runbook calls that out.
- Encrypted archives can only be restored on a host with the
  matching keyfile. Operators who rotate or lose the key cannot
  restore — the runbook spells this out.
- `openssl` is now a mandatory binary dependency for encrypted
  backups (and for restore of encrypted archives). The pilot
  installer verifies `which openssl` when
  `der.backup.encryption.enabled=true`.
- PII masking in logs is lossy on purpose — ops teams tracing an
  issue can correlate via the user_id UUID (unmasked), not via the
  username.
