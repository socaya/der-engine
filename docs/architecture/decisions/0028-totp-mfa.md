# ADR-0028 — TOTP MFA for admin sign-in

- **Status:** Accepted (Phase 13 / der-1.4.0-alpha.8)
- **Related:** ADR-0017 (security hardening part 1), ADR-0021
  (hash-chain audit)
- **Roadmap:** Initiative 8 part 3

## Decisions

- **D-MFA-1:** TOTP (RFC 6238), SHA-1 HMAC, 6-digit code, 30-second
  step. Rejects WebAuthn as pilot hardware is unreliable.
- **D-MFA-2:** Admin-only in slice A. OPERATORS can opt-in via the
  same enrol endpoint, but not required. All-users enforcement
  deferred to a future ADR.
- **D-MFA-3:** `edge_user.totp_secret` stores the base32 secret
  encrypted at rest via the Phase 10 backup key (reuses the
  openssl AES-256 path from BackupEncryption — same key material,
  separate record). Alpha.8 ships it plaintext in the column; the
  encryption-at-rest sweep is scheduled with pilot cut.
- **D-MFA-4:** Enrol flow:
    1. `POST /edge-api/v1/auth/mfa/enrol` → generates secret, returns
       the base32 string + an `otpauth://` URI the admin UI renders
       as a QR.
    2. Admin scans with Google Authenticator / Aegis / etc, enters
       the 6-digit code.
    3. `POST /edge-api/v1/auth/mfa/verify` with the code →
       `totp_enrolled_at = now()`.
    4. `POST /edge-api/v1/auth/mfa/disable` → clears secret +
       enrolled_at.
- **D-MFA-5:** Sign-in path checks `totp_enrolled_at`. If non-null,
  the first `POST /auth/sign-in` returns `202 { "mfaRequired": true,
  "challenge": "<opaque>" }`; a second call with the challenge +
  code completes the session. Backup codes are not shipped — admins
  with a lost device call ops out-of-band to clear
  `totp_enrolled_at`.
- **D-MFA-6:** `MFA_ENROLLED`, `MFA_VERIFY_SUCCESS`,
  `MFA_VERIFY_FAILED`, `MFA_DISABLED` audit events, chained via
  ADR-0021.

## Non-goals

- WebAuthn / hardware keys.
- Backup codes.
- MFA for the DC-side (device-user).
- Enforcement rules by role tier (admins vs. operators).
- Rate limiting on MFA attempts (ADR-0017's rate limiter covers
  sign-in generally).
- Secret rotation beyond "disable + re-enrol".
