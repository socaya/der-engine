# DER 1.3.0 — stable

> **Second stable release.** Bundles the five Phase 12 alpha cuts
> under one tag. Ships Initiative 10 slice B (device-owners,
> enforcement, program-binding, import/export, reconciler
> scaffolding, state machine, event/tracker ingest) in full. Three
> roadmap items originally slated for 1.3.0 are deferred to point
> releases — see "Open scope" below.

**Release label:** `der-1.3.0`
**Git tag:** `der-1.3.0`
**DHIS2 reference:** 2.44-SNAPSHOT
**Previous:** `der-1.3.0-alpha.5` (commit `3f38ae4`)
**No code change versus `der-1.3.0-alpha.5`.**

## What's inside

Rolled up from the alpha chain:

| Alpha | Initiative | ADR | Highlight |
|---|---|---|---|
| 1.3.0-alpha.1 | **10 slice B** kickoff | ADR-0022 | `owner_device_id` on `capture_workflow_step`. Nullable FK to `edge_device`; admin designer gets a device reference panel. Config-only in this alpha. |
| 1.3.0-alpha.2 | 10 slice B enforcement | ADR-0023 | `DeviceOwnerEnforcementInterceptor` on `/api/dataValueSets`. Writes from non-owner devices → 403 + chained `DEVICE_OWNER_MISMATCH` audit. Client auto-attaches `X-DER-Device-Id`. |
| 1.3.0-alpha.3 | 10 slice B binding + import/export | ADR-0024 | Workflows can bind to PROGRAM / PROGRAM_STAGE. Enforcement extends to `/api/events` + `/api/tracker/**`. Canonical JSON export + import with dry-run + unknown-device scrubbing. |
| 1.3.0-alpha.4 | 10 slice B reconciler scaffolding | ADR-0025 | `capture_workflow_step_contribution` buffer (`UNIQUE (run_id, step_id)` for idempotent re-POST). MVC `afterCompletion` hook buffers bodies when workflow headers are present. |
| 1.3.0-alpha.5 | 10 slice B closeout | ADR-0026 | Run-state transitions `OPEN → AWAITING → COMPLETED` driven by contribution count. `WORKFLOW_RUN_COMPLETED` audit event (hash-chained). Ingest extended to events + tracker. **No drain-time Java merger** — central DHIS2 upserts already yield the single-user-commit shape. |

Features landed in prior tags still shipping:

- 1.2.0 series: capture-workflow configuration (ADR-0018), device
  identity (ADR-0019), site-level analytics (ADR-0020), hash-chain
  audit + CMS-wrapped uploads (ADR-0021).
- 1.1.0 series: edge-to-OU binding (ADR-0015), approval workflows
  (ADR-0016), TLS enforcement + PII log masking + local backup
  encryption (ADR-0017).
- 1.0.0 series: pilot deployment runbook (ADR-0014).

## Test state

- **1181 server tests** pass. `mvn verify` green: JaCoCo gates clear,
  SpotBugs + Checkstyle clean.
- **223 admin-ui tests** pass (Vitest `100 / 90.68 / 97.82 / 100`).
- **153 client tests** pass (Vitest at the alpha.2 thresholds —
  `X-DER-Device-Id` header injection landed with full coverage).
- Playwright E2E + axe-core sweep remain mandatory in
  `run_all_checks.sh`.

## Open scope — items deferred to post-1.3.0

Three initiatives slated for 1.3.0 in the roadmap did **not** ship in
this stable. They are independent of each other and of slice B:

- **Initiative 2 part 1** — DHIS2 Edge Agent server plugin. Needs a
  new Maven module in the DHIS2 build chain; large scope. Target:
  `der-1.3.1` or `der-1.4.0`.
- **Initiative 3 option A** — chain-via-hub referral. Needs an ADR
  on the hub protocol + a workflow `DISPATCH` step kind. Target:
  `der-1.4.0`.
- **Initiative 8 part 3** — MFA (TOTP) for admin sign-in. Spring
  Security add-on + enrol UI. Target: `der-1.3.1`.

Pilot acceptance against DHIS2 2.44 under
`docs/evaluation/evidence/phase-12/` is **not** captured in this
stable — the same operator-side gate flagged in 1.2.0 remains open.
Operators who run slice B against the pilot box should bundle a
Phase 08 NFR replay via `DER_EVIDENCE_PHASE=phase-12 bash
scripts/evaluation/run_phase_08.sh`.

## Deliberate non-goals (post-1.3.0)

- Drain-time Java merger (ADR-0026 D-RST-5 — not needed; central
  upsert already produces the required shape).
- `REJECTED` run transition / rejection UI.
- Per-step payload diffing on re-POST.
- Workflow lifecycle webhooks.
- Programmatic device-id remap on import (ADR-0024 D-WIX-6 — scrub
  is the shipped behaviour).
- Android client Capacitor wrap (Initiative 6, scheduled for 2.0.0).

## Upgrade path from 1.2.0 / 1.3.0-alpha.*

1. Stop DER.
2. `pg_dump` the DER database (recommended).
3. Deploy the new artifact; Flyway runs V018–V020 on first boot.
4. Confirm `/edge-api/v1/system/health` and
   `/edge-api/v1/security/audit/verify` (admin) still answer 200.
5. If turning on device-owner enforcement, bind steps to specific
   `edge_device` rows via the designer and ensure your clients send
   `X-DER-Device-Id` (the shipped client already does).
6. If adopting workflow runs end-to-end, point your capture clients
   at `X-DER-Workflow-Run` + `X-DER-Workflow-Step` headers so the
   contribution buffer picks up each write.
