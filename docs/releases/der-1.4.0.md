# DER 1.4.0 — stable

> **Third stable release.** Bundles alphas 1-9. Closes Initiative 3
> (chain-via-hub referral option A). Scaffolds Initiative 2 (Edge
> Agent + /sync/notify). Ships Initiative 8 part 3 TOTP MFA enrol
> surface. No code change versus `der-1.4.0-alpha.9`.

**Release label:** `der-1.4.0`
**Git tag:** `der-1.4.0`
**DHIS2 reference:** 2.44-SNAPSHOT
**Previous:** `der-1.4.0-alpha.9` (commit `c137f1a`)

## Rolled up from the alpha chain

| Alpha | Initiative | ADR | Highlight |
|---|---|---|---|
| alpha.1 | 3 | 0027 | `next_hop_org_unit_uid` journal column + admin tag endpoint |
| alpha.2 | 3 | 0027 | Write-time `X-DER-Referral-Next-Hop` header capture |
| alpha.3 | 3 | 0027 | Outbound `[DER-next-hop:…]` marker on comment / notes |
| alpha.4 | 3 | 0027 | `referral_inbox` schema + no-op scanner |
| alpha.5 | 3 | 0027 | HTTP central scan + resolve endpoints |
| alpha.6 | 3 | 0027 | Outbound orgUnit rewrite + aggregate accept-ingest |
| alpha.7 | 3 | 0027 | Events + tracker scan + ingest — Initiative 3 complete |
| alpha.8 | 8 part 3 | 0028 | TOTP MFA enrol / verify / disable |
| alpha.9 | 2 | 0029 | Edge Agent scaffold + edge-side `/sync/notify` |

## Open scope — items deferred to post-1.4.0

- **Initiative 2 continuations:** DHIS2 polling + webhook dispatch
  logic inside `agents/dhis2-edge-agent/`. Webhook signing / mTLS
  pairing. Edge registration UI.
- **Initiative 8 part 3 continuations:** sign-in challenge-response
  flow (today's MFA is enrol-only); encryption-at-rest for
  `totp_secret`; WebAuthn / backup codes.
- **Initiative 3 continuations:** multi-hop referral chaining;
  ENROLLMENT / TRACKED_ENTITY accept-ingest; signed referrals.
- **Pilot acceptance** against DHIS2 2.44 under
  `docs/evaluation/evidence/phase-13/`.

## Test state

- **1277 server tests** pass. `mvn verify` green.
- Admin-ui: 237 tests pass.
- Client: 153 tests pass.
- SpotBugs + Checkstyle clean.

## Promotion path

`der-1.4.0` → `der-2.0.0` roadmap:
- Initiative 6 (Android Capacitor wrap).
- Initiative 3 option B / C design spike.
- Agent polling + webhook dispatch to continue Initiative 2.
