# DER 1.4.0-alpha.8 — Initiative 8 part 3: TOTP MFA (post-sign-in enrol)

> **Scope:** Ships TOTP (RFC 6238) enrolment surface. Admins (and
> any authenticated user who opts in) can generate a secret, verify
> it with a 6-digit code, and disable. The sign-in challenge-response
> flow slides to a point release — alpha.8 is the self-enrol slice.

**Release label:** `der-1.4.0-alpha.8`
**Git tag:** `der-1.4.0-alpha.8`

## New

- V023 adds `totp_secret` + `totp_enrolled_at` to `edge_user`.
- `TotpService` — pure Java RFC 6238 (SHA-1 HMAC, 30s step, 6-digit,
  ±1 step drift). No external dependency.
- `EdgeUserRepository.setTotpSecret` / `findTotpSecret` /
  `findTotpEnrolledAt`.
- `MfaController` at `/edge-api/v1/auth/mfa/{enrol,verify,disable}`
  — any authenticated user; emits `MFA_ENROLLED` /
  `MFA_VERIFY_SUCCESS|FAILED` / `MFA_DISABLED` audit events chained
  via ADR-0021.
- ADR-0028 (TOTP, admin-first, no WebAuthn / backup codes).

## Deliberate non-goals (deferred)

- Sign-in challenge-response — alpha.8 only ships the enrol surface.
  The sign-in flow will add a two-step "has secret → 202 with
  challenge → POST code" exchange in a later alpha.
- Encryption-at-rest for `totp_secret` (currently plaintext in the
  column; roadmap §Initiative 8 part 3 flags this as "secret
  rotation Phase 15+").
- WebAuthn / hardware keys.
- Backup codes.
- Admin UI MFA screens (post-1.4.0 release).

## Test state

- **1274 server tests** pass (was 1259 + 9 TOTP + 6 controller).
  `mvn verify` green.
