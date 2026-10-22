# DER 1.1.0-alpha.4 — Initiative 9 cleanup + pilot runbook §6

> **Scope:** Fourth and final slice of `der-1.1.0`. Adds axe-core
> accessibility sweeps to the per-screen Playwright suite, introduces
> a `mandatory` tier in `scripts/run_all_checks.sh` so pilot cuts
> fail when browsers aren't installed, and extends the pilot runbook
> with the backup-encryption key provisioning procedure from
> `der-1.1.0-alpha.3`. No server runtime changes.

**Release label:** `der-1.1.0-alpha.4`
**Git tag:** `der-1.1.0-alpha.4`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- **`client/e2e/axe.spec.ts` + `admin-ui/e2e/axe.spec.ts`** — 7 and
  9 axe-core assertions respectively, covering every unique UI
  state the current spec suite exercises. Scanned with the WCAG 2
  A/AA tags.
- `_fixtures.ts` on both sides exports a shared `assertNoAxeViolations(page)`
  helper so each spec file can scan with one line.
- **`scripts/run_all_checks.sh`** — `DER_RUN_E2E` grew a third
  value:
    - `true` — run Playwright; **NOT RUN** gracefully if browsers
      are missing (dev-time).
    - `mandatory` — run Playwright; **FAIL** if the Playwright CLI
      is unavailable (pilot-cut mode).
    - anything else — skip + NOT RUN with a `set DER_RUN_E2E=…` hint.
  The gate report now distinguishes "dev skipped" from "pilot
  required-but-missing" without pre-release surprises.
- **`docs/operations/pilot-runbook.md` §6.0 + §6.1** —
    - §6.0 adds the TLS-enforcement toggle (`der.security.require-tls`).
    - §6.1 adds the backup-encryption key provisioning procedure
      (0400 keyfile, `openssl rand -base64 32 | tee`), the pilot.env
      flags, and the explicit "lose the key = irrecoverable" warning.
      Flags key rotation as `der-1.3.0+`.

## Test state

- 991 server tests unchanged.
- 124 client + 157 admin-ui Vitest tests unchanged.
- 16 new Playwright axe assertions (7 client + 9 admin-ui) — all
  typecheck green via `npx tsc --noEmit`. They do not run as part
  of `mvn verify` or `npm test`; they fire when `DER_RUN_E2E` is set.

## Deliberate non-goals

- Playwright does **not** become mandatory by default — the dev
  gate stays opt-in, which keeps the local-run surface the same.
  The `mandatory` tier is for the pilot-cut CI step documented in
  the pilot runbook.
- No per-screen axe coverage for the 17 EA screens bundled into
  siblings during Phase 06 R2/R3; the shipped components take the
  hit, consistent with the per-screen spec coverage in rc.2.
- No automatic axe-core sweep inside the Vitest suite — that is a
  real-browser-only concern.

## Promotion path

`der-1.1.0-alpha.4` → stable **`der-1.1.0`** after the pilot cut
runs `DER_RUN_E2E=mandatory bash scripts/run_all_checks.sh` on
real hardware and all gates PASS.
