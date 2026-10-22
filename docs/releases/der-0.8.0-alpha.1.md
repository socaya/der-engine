# DER 0.8.0-alpha.1 — Phase 08: NFR evaluation harness

> **Scope:** Ship the reproducible NFR measurement harness (ADR-0013) so
> pilot operators (Phase 09) can produce the acceptance evidence bundle
> on real hardware. Nothing in the server runtime changes.

**Release label:** `der-0.8.0-alpha.1`
**Git tag:** `der-0.8.0-alpha.1`

## New

- `ADR-0013 NFR evaluation harness` — accepted.
- `scripts/evaluation/`:
  - `der_bench.py` — latency / throughput sweep at concurrency 1/5/10/20
    for NFR-15, NFR-16, NFR-19.
  - `backlog_recovery.py` — pauses the journal worker, seeds 100/1000
    aggregate writes, resumes and times the drain for NFR-17.
  - `resource_sampler.py` — RSS/CPU/disk time series + hardware
    fingerprint for NFR-18 and NFR-35.
  - `backup_integrity.py` — triggers a backup via `/edge-api/v1/backup/request`,
    polls to SUCCESS, triggers a restore, and diffs health-counters
    before/after for NFR-29.
  - `run_phase_08.sh` — orchestrator writing a timestamped evidence
    bundle under `docs/evaluation/evidence/phase-07/<run>/`.
  - `fixtures/aggregate-dataValueSet.json` — sample payload the backlog
    harness replays.
- `docs/evaluation/phase-08-methodology.md` — operator runbook with
  interpretation guidance for every measurement NFR plus a pointer-only
  table for the design NFRs (NFR-01..NFR-14, NFR-20..NFR-28, NFR-30..NFR-34).
- `docs/evaluation/evidence/phase-08/README.md` — expected directory
  shape; dev-laptop numbers deliberately not committed so pilot
  operators own the acceptance bundle.

## Why Python stdlib only

Pilot hardware is a modest Linux box with `python3` and `psql` and
nothing else. External load generators (`wrk`, `k6`, `hey`) would need
install/ARM-build steps the harness is deliberately avoiding.
`urllib` + `concurrent.futures` handle the 20-session worst case.

## Test state

- 7 Python unit tests cover `der_bench.py` (percentile math, HTTP-500
  classification, slow-endpoint scaling) and `resource_sampler.py`
  (hardware fingerprint, data-dir sampling, process pid sampling)
  with an in-process `ThreadingHTTPServer`.
- No server code changed; all 835 server tests remain green.

## Deliberate non-goals

- **No committed baseline numbers.** The release ships the harness,
  not pilot results — dev-laptop measurements are deliberately not
  evidence. Pilot operators run the harness in Phase 09.
- **No JVM profiling (JFR / async-profiler).** The harness measures
  ambient RSS/CPU only.
- **No long-soak / chaos testing.** Each pass is a few minutes so it
  fits in a pilot session.
- **No new server endpoints.** The harness drives existing REST paths
  (`/edge-api/v1/system/health`, `/journal/worker/*`, `/backup/*`,
  `/restore/*`).
