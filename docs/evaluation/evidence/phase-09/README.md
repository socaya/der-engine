# Phase 09 pilot acceptance evidence

This directory holds the acceptance evidence bundles produced by
pilot operators running `scripts/evaluation/run_phase_08.sh` on real
hardware (see `docs/operations/pilot-runbook.md` §11).

Each sub-directory follows the same shape as Phase 08:

| File | Purpose |
|---|---|
| `manifest.json` | Pilot host identity, versions, timing (NFR-27, NFR-35). |
| `bench-health.json` | Latency + throughput on `/edge-api/v1/system/health` (NFR-15/16/19). |
| `bench-metadata.json` | Latency + throughput on `/api/dataSets` (NFR-15/16/19). |
| `resource-sample.json` | RSS + CPU% + data-dir time series (NFR-18). |
| `backup-integrity.json` | Round-trip backup/restore check (NFR-29). |
| `backlog-100.json` | Journal drain time for 100 queued ops (NFR-17). |
| `backlog-1000.json` | Journal drain time for 1000 queued ops (NFR-17). |

## Acceptance thresholds (per `docs/releases/der-1.0.0-rc.1.md`)

- `bench-health.json.levels[*].p95_ms` ≤ 2000 at concurrency = 20.
- `backlog-100.json.drain.timedOut` = false and `.unresolved` = 0.
- `backlog-1000.json.drain.timedOut` = false and `.unresolved` = 0.
- `backup-integrity.json.match` = true.
- `resource-sample.json.series[*].process.rssMb` max ≤ 2048.

A single bundle that clears all five thresholds plus a pilot operator
sign-off (name, date, host identity in `manifest.json.hardware`) is
the artefact that triggers the stable `der-1.0.0` tag.
