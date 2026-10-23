# DER 2.0.0 — stable (post-1.0 roadmap closeout)

> **Fourth stable release.** Closes out the post-1.0 roadmap:
> every initiative is either shipped, scaffolded, or has a formal
> design decision locked in. Bundles 2.0.0-alpha.1 (Android
> Capacitor wrap scaffold) and 2.0.0-alpha.2 (Initiative 3
> option B/C design spike). No code change versus
> `der-2.0.0-alpha.2`.

**Release label:** `der-2.0.0`
**Git tag:** `der-2.0.0`
**DHIS2 reference:** 2.44-SNAPSHOT
**Previous:** `der-2.0.0-alpha.2` (commit `2308628`)

## Roadmap closeout

The post-1.0 roadmap is in `docs/project/post-1.0-roadmap.md`. Final
status by initiative:

| # | Initiative | Status | Reference |
|---|---|---|---|
| 1 | Edge device-client management | ✅ Shipped | der-1.2.0 (ADR-0019) |
| 2 | DHIS2 Edge Agent broadcast | 🧱 Scaffolded + edge receiver live | der-1.4.0-alpha.9 (ADR-0029) |
| 3 | Peer-to-peer workflow chains | ✅ Option A shipped · 🔭 B picked, C shelved | der-1.4.0 (ADR-0027) + der-2.0.0-alpha.2 (ADR-0031) |
| 4 | Data approval + sync workflows | ✅ Shipped | der-1.1.0 (ADR-0016) |
| 5 | Edge-to-OU binding | ✅ Shipped | der-1.1.0 (ADR-0015) |
| 6 | Android client | 🧱 Capacitor scaffold | der-2.0.0-alpha.1 (ADR-0030) |
| 7 | Site-level analytics | ✅ Shipped | der-1.2.0 (ADR-0020) |
| 8 | Edge data security hardening | ✅ Parts 1-3 shipped | 1.1.0 (ADR-0017) + 1.2.0 (ADR-0021) + 1.4.0 (ADR-0028) |
| 9 | Cleanup / Playwright | ✅ Shipped | der-1.1.0 |
| 10 | Capture-workflow config | ✅ Slice A + B shipped | der-1.2.0 + der-1.3.0 (ADR-0018 / 0022-26) |

## Open scope — flagged for 2.1.0+

- **Agent polling + webhook dispatch** inside `agents/dhis2-edge-agent/`.
  Alpha.9 shipped the shell; the DHIS2 polling + fan-out logic
  remains.
- **Option B implementation** (direct TLS mesh, peer_edge table,
  pairing ceremony, DISPATCH_PEER step kind). Scheduled as a
  dedicated 2.1.0 train per ADR-0031.
- **MFA sign-in challenge** (TOTP enrol shipped in 1.4.0; the
  two-step sign-in exchange is still enrol-only).
- **MFA secret encryption-at-rest** (plaintext `totp_secret` column
  today; roadmap pins this to Phase 15+ with KMS integration).
- **Android native plugins** (biometric unlock, native file picker,
  APK auto-update, CI-driven APK builds).
- **Multi-hop referral chaining** on Initiative 3.
- **ENROLLMENT / TRACKED_ENTITY accept-ingest** on referrals.
- **Pilot acceptance** against DHIS2 2.44 under
  `docs/evaluation/evidence/phase-14/` — same policy as previous
  stables (operator-driven).

## Test state

- **1277 server tests** pass. `mvn verify` green.
- Admin-ui: 237 tests pass.
- Client: 153 tests pass.
- SpotBugs + Checkstyle clean.

## Upgrade path from 1.4.0

1. Stop DER.
2. `pg_dump` the DER database (recommended).
3. Deploy the new artifact; Flyway finds no new migrations in 2.0.0.
4. Operators building the Android client run
   `cd client && npm run build && cd ../android && npx cap add android`
   (first-time only).

The Android project is scaffold-only in 2.0.0 — do not expect a
production APK yet. Agent polling likewise ships later.
