# ADR-0021 — Hash-chained security audit log and CMS-wrapped S3 uploads

- **Status:** Accepted (Phase 11 / der-1.2.0-alpha.5)
- **Supersedes:** —
- **Related:** ADR-0012 (backup pipeline), ADR-0017 (security hardening part 1)
- **Roadmap:** Initiative 8 part 2 ("hash-chain audit, S3 GPG wrap")

## Context

`security_audit` has been append-only since Phase 02 (ADR-0003), but
"append-only" at the application layer is not tamper-evident: anyone
with database write access can edit a historical row and the server has
no way to notice. The 1.2.0 roadmap flags this as a P1 gap and asks for
a hash-chain so each row commits to the previous one.

In parallel, the backup pipeline (ADR-0012, ADR-0017) encrypts the
local archive with symmetric AES-256-CBC, but the S3 upload is of
whatever file the local pipeline produced — operators who want
plaintext local backups but encrypted remote blobs have no supported
switch, and the server (symmetric key holder) can always decrypt its
own uploads. The roadmap asks for a remote-only envelope.

## Decisions

### D-AUD-1 — Hash-chain algorithm: SHA-256 over canonical row

Each `security_audit` row carries:

- `prev_hash BYTEA` — the `row_hash` of the preceding row, or 32 zero
  bytes for the first row.
- `row_hash BYTEA NOT NULL` — `SHA-256(prev_hash || canonical_body)`.

`canonical_body` is a UTF-8 byte sequence built from the row's
business-meaningful fields in a fixed order, joined by `0x1f` (unit
separator):

```
canonical_body =
    event_type || US ||
    coalesce(actor_user_id::text, '') || US ||
    coalesce(subject_user_id::text, '') || US ||
    coalesce(host(client_ip), '') || US ||
    coalesce(user_agent, '') || US ||
    outcome || US ||
    jsonb_canonical(detail) || US ||
    observed_at_iso_micros
```

`jsonb_canonical(detail)` is Postgres' `jsonb` text representation
(keys lexically sorted, no whitespace) — the same bytes
`SecurityAuditRepository` writes via `CAST(? AS jsonb)`.
`observed_at_iso_micros` is the UTC ISO-8601 string with microsecond
precision (`YYYY-MM-DDTHH:MM:SS.ffffffZ`).

The write-side canonicalisation lives in Java; the backfill-side lives
in SQL. A unit test asserts both produce the same bytes.

### D-AUD-2 — Serialised inserts via Postgres advisory lock

Concurrent `append()` calls could compute `prev_hash` against the same
row and both insert the next row with the same `prev_hash`, breaking
the chain. The repository takes a transaction-scoped advisory lock
(`pg_advisory_xact_lock(0x44455241, 0x55444954)`, "DERAUDIT")
before reading the tail and writing the new row. The lock is cheap
and the audit path is already off the hot capture path.

### D-AUD-3 — Backfill in V017

`V017__phase11_audit_chain.sql`:

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto`.
2. `ALTER TABLE security_audit ADD COLUMN prev_hash BYTEA`.
3. `ALTER TABLE security_audit ADD COLUMN row_hash BYTEA`.
4. A `DO` block walks the table ordered by `(observed_at, audit_id)`
   and sets `prev_hash = coalesce(previous.row_hash, repeat(E'\\000', 32))`
   and `row_hash = digest(prev_hash || canonical, 'sha256')`.
5. `ALTER TABLE security_audit ALTER COLUMN row_hash SET NOT NULL`.

A clean install hits an empty table — the DO block is a no-op.

### D-AUD-4 — Verify endpoint: ADMIN-only, first-break reporting

`GET /edge-api/v1/security/audit/verify` returns:

```json
{
  "ok": true,
  "totalRows": 1234,
  "firstBreakAuditId": null,
  "firstBreakReason": null
}
```

`firstBreakReason` is one of `PREV_HASH_MISMATCH`, `ROW_HASH_MISMATCH`,
`CANONICAL_MISMATCH`. The handler is `hasRole('ADMIN')` only. Verifier
caps the scan at 500 000 rows per call and streams via a Postgres
cursor to keep the heap bounded.

### D-AUD-5 — No repair UI

Tamper is a security incident, not a UI workflow. If the chain breaks,
operators follow the forensic runbook (snapshot, isolate, export). The
admin screen is strictly verify + report.

### D-BAK-1 — Remote-wrap crypto: openssl S/MIME CMS

`der.backup.remote.encrypt=true` enables a *second* encryption pass
applied immediately before `RemoteArchiveStore.upload()`:

```
openssl smime -encrypt -binary -aes-256-cbc -outform DER \
  -in archive.tar.gz{.enc?} \
  -out archive.tar.gz{.enc?}.p7 \
  <recipient.pem>
```

`recipient.pem` is a PEM-encoded X.509 certificate pointed at by
`der.backup.remote.encrypt.recipient`. The server **does not** have
the matching private key — this is the asymmetric contract. Operators
decrypt off-box:

```
openssl smime -decrypt -binary -inform DER \
  -in archive.*.p7 \
  -inkey operator.key \
  -out archive.tar.gz{.enc?}
```

### D-BAK-2 — Flag is orthogonal to local encryption

`der.backup.encryption.enabled` and `der.backup.remote.encrypt` are
independent toggles. Four combinations are all supported:

| local | remote | result on S3 |
|---|---|---|
| off | off | plaintext tar.gz |
| on  | off | tar.gz.enc (symmetric AES-256-CBC) |
| off | on  | tar.gz.p7 (asymmetric CMS envelope) |
| on  | on  | tar.gz.enc.p7 (symmetric then asymmetric) |

### D-BAK-3 — No new runtime binary

`openssl` is already required for the Phase 10 local encryption path.
`smime` is a built-in subcommand of the same binary. No GPG keyring, no
new systemd service, no new config directory.

## Non-goals

- Online verification per insert (we trust the lock + checksum).
- Repair of a broken chain (forensic, not programmatic).
- Rotation of hash algorithms (would require a chain migration — out of
  scope until SHA-256 is deprecated).
- A chain-of-chains / cross-table ledger — only `security_audit` is
  chained.
- Multi-recipient envelopes for the remote wrap (one recipient
  certificate per cluster; operators who need multi-recipient can wrap
  further themselves).
- Automated key-material rotation — manual per the runbook.

## Consequences

- Every `AuditLogger` call now takes a tiny lock + extra round-trip to
  read the tail. Benchmarks on the pilot box show +~0.3 ms per audit
  write, which is well under the sign-in latency budget.
- Verifying one million rows on the pilot DB takes ~4 s (local SSD).
  The 500 000-row cap keeps the endpoint responsive.
- The remote CMS wrap doubles the uploaded size's PKCS#7 overhead
  (~2 KB fixed) — negligible for multi-MB archives.
- The admin UI gains `/audit/verify`; no other EA screens change.
