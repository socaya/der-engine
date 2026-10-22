# DER 1.2.0 — stable

> **First stable release.** DER 1.2.0 bundles the five Phase 11 alpha
> cuts (Initiatives 10 slice A, 1, 7, 8 part 2) into a single tag. Prior
> majors `1.0.0` and `1.1.0` shipped only as rc / alpha chains; this is
> the first `vMAJOR.MINOR.PATCH` with no suffix on `main`.

**Release label:** `der-1.2.0`
**Git tag:** `der-1.2.0`
**DHIS2 reference:** 2.44-SNAPSHOT
**Previous:** `der-1.2.0-alpha.5` (commit `2b38a69`)

## What's inside

Rolled up from the alpha chain:

| Alpha | Initiative | ADR | Highlight |
|---|---|---|---|
| 1.2.0-alpha.1 | **10 slice A** | ADR-0018 | Capture-workflow configuration — compose DHIS2 metadata (datasets / program stages / sections) into edge-only workflows with step ordering, aggregate reconciler, workflow runs. |
| 1.2.0-alpha.2 | **1 server** | ADR-0019 | Edge device-client management — `edge_device` + `edge_device_dependency` schema, DeviceService with Argon2id token hash, approve/suspend/revoke/heartbeat state machine, admin fleet UI. |
| 1.2.0-alpha.3 | **1 client** | ADR-0019 | Device-client enrollment hook — install-UUID storage, enrol-on-mount hook, heartbeat on configurable cadence, non-blocking status banner. |
| 1.2.0-alpha.4 | **7 slice A** | ADR-0020 | Site-level analytics — `analytics_facility_summary` matview, 5-min Quartz refresh, `/edge-api/v1/analytics/**`, EA-ANA-01 admin screen. |
| 1.2.0-alpha.5 | **8 part 2** | ADR-0021 | Hash-chain audit (SHA-256, BEFORE INSERT trigger, verifier endpoint) + CMS-wrapped S3 uploads (`openssl smime` with recipient cert — server never holds the private key). |

Features landed in prior tags still shipping:

- Phase 09 pilot deployment runbook (ADR-0014).
- Phase 10: TLS enforcement, PII log masking, local-disk backup
  encryption (ADR-0017); edge-to-OU binding (ADR-0015); approval
  workflows (ADR-0016); Playwright + axe sweep.

## Test state

- **1113 server tests** pass. `mvn verify` green: JaCoCo gates clear,
  SpotBugs + Checkstyle clean.
- **208 admin-ui tests** pass (Vitest `100 / 90.94 / 97.70 / 100`).
- **Client tests** at the alpha.3 state (`98.74 / 94.54 / 94.84 /
  98.74`); no DC-side changes in alpha.4/5.
- Playwright E2E + axe-core sweep remain mandatory in `run_all_checks.sh`.

## Open gates

- **Pilot acceptance against DHIS2 2.44 is not yet captured in
  `docs/evaluation/evidence/phase-11/`.** ADR-0021 lists a pilot run
  for the hash-chain + remote-wrap behaviour as its promotion path.
  Operator run is punted to the first point release (`der-1.2.1` or a
  Phase 09 evidence bundle), per the user decision at tag time.
- NFR evaluation on real pilot hardware remains Phase 08's job
  (Initiative 9 trailing work).
- No stable `der-1.0.0` or `der-1.1.0` tags were cut — all intermediate
  milestones shipped as `rc.*` or `alpha.*` only. CalVer-style tag
  history treats those as semantic equivalents for consumers that pin
  by minor.

## Deliberate non-goals (deferred to post-1.2.0)

- Initiative 10 slice B — device-owners, event/tracker reconciler,
  workflow import/export (`der-1.3.0`).
- Initiative 2 part 1 — DHIS2 Edge Agent server plugin (`1.3.0`).
- Initiative 3 — chain-via-hub referral option A (`1.3.0`).
- Initiative 8 part 3 — MFA (`1.3.0`).
- Initiative 6 — Android client Capacitor wrap (`2.0.0`).

## Upgrade path from 1.1.0-alpha.* / 1.2.0-alpha.*

1. Stop DER.
2. `pg_dump` the DER database (optional but recommended).
3. Deploy the new artifact; Flyway runs V014–V017 on first boot.
4. Confirm `/edge-api/v1/system/health` and
   `/edge-api/v1/security/audit/verify` (admin) both answer 200.
5. If moving to the asymmetric remote-wrap, set
   `der.backup.remote.encrypt=true` and point
   `der.backup.remote.encrypt.recipient` at the operator's PEM cert.
   Prior `.enc` / plaintext archives already on S3 are not retroactively
   rewrapped — they decrypt as before.
