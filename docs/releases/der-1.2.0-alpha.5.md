# DER 1.2.0-alpha.5 — Initiative 8 part 2: hash-chain audit + CMS-wrapped uploads

> **Scope:** Closes the Initiative 8 security-hardening gap list for
> der-1.2.0. `security_audit` is now tamper-evident via a SHA-256 hash
> chain (ADR-0021), and S3 backup uploads can be wrapped in an
> asymmetric CMS envelope so operators who hold the private key are the
> only parties who can decrypt remote archives.

**Release label:** `der-1.2.0-alpha.5`
**Git tag:** `der-1.2.0-alpha.5`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V017** — `prev_hash` + `row_hash` on
  `security_audit`; `pgcrypto` extension; a BEFORE INSERT trigger that
  computes the chain under a transaction-scoped advisory lock; a
  `security_audit_canonical_body` SQL function reused by the trigger +
  the verifier; backfill DO block for any pre-existing rows.
- `ug.ac.mak.der.security.SecurityAuditVerifier` — streams the chain
  through Postgres (recomputes via `digest(... || canonical, 'sha256')`
  in a CTE, LAG-joined) and reports the first break with reason
  (`PREV_HASH_MISMATCH` or `ROW_HASH_MISMATCH`). Capped at 500 000 rows
  per call.
- `SecurityAuditController` at `/edge-api/v1/security/audit/verify` —
  ADMIN only; returns `{ ok, totalRows, firstBreakAuditId,
  firstBreakReason }`.
- `ug.ac.mak.der.workflows.backup.RemoteArchiveEncryption` — wraps the
  pre-upload archive with
  `openssl smime -encrypt -binary -aes-256-cbc -outform DER` against a
  recipient certificate pointed at by
  `der.backup.remote.encrypt.recipient`. Independent of the Phase 10
  local-disk encryption; both can coexist. Server never holds the
  private key.
- `BackupWorker` now routes `local → remoteWrap → upload` and logs the
  new `remoteWrapped=` field.
- Admin UI `EAAuditVerify` (EA-AUD-01) at `/audit/verify` — Audit nav
  link, verify button, OK / BROKEN report + first-break id + reason.
- `edgeApi.verifyAuditChain()` helper + table row.
- 15 new server tests (verifier + controller + remote-wrap encryption)
  on top of refactored BackupWorker constructor.
- 5 new admin-ui screen tests + 1 Playwright spec + 1 edgeApi table
  row.

## Behaviour

```
INSERT INTO security_audit ...
    ↳ BEFORE INSERT trigger
         pg_advisory_xact_lock('DERA','UDIT')
         prev := (SELECT row_hash ORDER BY audit_id DESC LIMIT 1)
         NEW.prev_hash := prev
         NEW.row_hash  := digest(prev || canonical_body(NEW), 'sha256')

GET /edge-api/v1/security/audit/verify            (ADMIN only)
    ↳ CTE walk: LAG(row_hash) OVER (ORDER BY audit_id)
    ↳ expected_row_hash = digest(expected_prev || body, 'sha256')
    ↳ first row where prev_hash <> expected_prev or
      row_hash <> expected_row_hash → report
```

```
BackupWorker.runOne:
    pg_dump → archive.dump
    BackupEncryption.encrypt      (symmetric, local-disk)   -> archive.dump[.enc]
    RemoteArchiveEncryption.wrap  (asymmetric, remote-only) -> archive.dump[.enc].p7
    RemoteArchiveStore.upload
```

| local | remote | file on S3 |
|---|---|---|
| off | off | `*.dump` plaintext |
| on  | off | `*.dump.enc` symmetric |
| off | on  | `*.dump.p7` asymmetric |
| on  | on  | `*.dump.enc.p7` symmetric-then-asymmetric |

## Test state

- **1113 server tests** pass (was 1098 + 15 new). `mvn verify` green.
- Admin-ui: **208 tests** pass (was 201 + 7 new). Vitest at
  **100 / 90.94 / 97.70 / 100**. Thresholds unchanged (100/90/97/100).
- Client: unchanged — no DC-side changes.
- SpotBugs + Checkstyle clean.
- JaCoCo: `RemoteArchiveEncryption` added to the subprocess waiver list
  alongside `BackupEncryption` / `BackupWorker` (same openssl
  interrupt + timeout branches require a hanging binary; success +
  non-zero-exit + verify branches are all covered).

## Deliberate non-goals (per ADR-0021)

- Online verification per insert (we trust the trigger + lock + hash).
- Chain repair — tamper is a forensic incident, not a UI workflow.
- Rotation of hash algorithms (would require a chain migration — out
  of scope until SHA-256 is deprecated).
- Multi-recipient CMS envelopes (one recipient per cluster).
- Automated key-material rotation — manual per the runbook.
- Audit-log browse / search UI (second option explicitly deferred).

## Promotion path

`der-1.2.0-alpha.5` → stable `der-1.2.0` after a pilot run proves the
chain + remote-wrap behaviour against DHIS2 2.44.
