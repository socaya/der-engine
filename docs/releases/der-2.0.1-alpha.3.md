# DER 2.0.1-alpha.3 — close NFR gaps + strict code-sweep DONE promotions

> **Scope:** NFR evaluation harness + operator metrics endpoint + a11y
> coverage confirmation (7 NFRs DONE). Plus a strict code-sweep over
> the remaining 178 `in-progress` rows → 125 promoted to DONE after
> per-item verification, 53 held with specific gap notes.

**Release label:** `der-2.0.1-alpha.3`
**Git tag:** `der-2.0.1-alpha.3`

## New

### NFR cluster (7 DONE)

- `OperatorMetricsController` at `/edge-api/v1/admin/metrics` —
  process (uptime, heap, threads, cpus) + journal state counts +
  queue depth. Authenticated any-user. **NFR-20.**
- `scripts/evaluation/nfr_sweep.sh` — one-shot runner that captures
  `bench-health-{1,5,10,20}.json` + `resource-sample.json` +
  `operator-metrics.json` + `backup-integrity.json` + `manifest.json`
  under `docs/evaluation/evidence/phase-15/<run-id>/`.
  **NFR-15 / NFR-16 / NFR-18 / NFR-19 / NFR-29.**
- `docs/evaluation/evidence/phase-15/sample-template/` — sample
  bundle shape (manifest + README) so operators know the output
  format before running.
- **NFR-26** confirmed via existing `admin-ui/e2e/axe.spec.ts` sweep
  (WCAG 2 A/AA, zero violations across 19 EA screens).

### Code-sweep (125 DONE)

Promoted after per-FR verification against the FR statement and the
shipped code artifact. Covers:

- Provisioning + auth clusters (FR-01-01..06, FR-02-01..06, FR-02-08).
- Authorisation + audit (FR-03-01..10, NFR-21).
- DHIS2 emulation / metadata (FR-04-01, 03..05, 07, 08, 10;
  FR-05-01..09).
- Aggregate + event capture (FR-06-01..05, 07, 08; FR-07-01, 03..07).
- Tracker partial (FR-08-03, 04, 05, 11).
- Persistence + journal (FR-09-01..09; FR-11-01..08).
- Outbound sync + inbound pull (FR-12-04..12; FR-13-01, 10).
- Resilience + admin (FR-14-01..05, 11, 12; FR-15-01..05).
- Security (FR-16-01..06, 08..12).
- NFR durability + safety (NFR-01, 05, 06, 07, 14, 17, 27, 30..32,
  34).

### Doc

- `docs/implementation_status.md` rewritten with 158/211 DONE and a
  per-item gap table for the remaining 53 PARTIAL rows.

## CSV status

| Status | Count |
|---|---:|
| `done` | 158 (↑ 132) |
| `in-progress` | 53 (gap-documented) |
| `pending` | 0 |

## Non-goals (post-2.0.1)

The 53 remaining PARTIAL rows are listed with specific per-item gaps
in `docs/implementation_status.md`. None is scoped to a *new* feature
— each is either (a) evidence capture on pilot hardware, or (b) a
narrow extension to existing shipped code (specific detection
taxonomy, retention knob, enforcement test, oracle fixture corpus).

## Test state

- **1282 server tests** pass; `mvn verify` green.
- Admin-ui + client unchanged.
