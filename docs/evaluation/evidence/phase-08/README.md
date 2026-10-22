# Phase 08 evidence

Each sub-directory is one run of `scripts/evaluation/run_phase_08.sh`.
The directory name is `<utc-timestamp>-<commit>`. Every run writes:

| File | Purpose |
|---|---|
| `manifest.json` | run id, versions, hardware, timing (NFR-27, NFR-35) |
| `bench-health.json` | latency + throughput on `/edge-api/v1/system/health` (NFR-15/16/19) |
| `bench-metadata.json` | latency + throughput on `/api/dataSets` (NFR-15/16/19) |
| `resource-sample.json` | RSS + CPU% + data-dir time series (NFR-18) |
| `backup-integrity.json` | round-trip backup/restore check (NFR-29) |
| `backlog-100.json` | journal drain time for 100 queued ops (NFR-17) |
| `backlog-1000.json` | journal drain time for 1000 queued ops (NFR-17) |
| `run.log` | combined stdout/stderr |

The dev-laptop baseline for release `der-0.8.0-alpha.1` is intentionally
**not committed** — the harness ships without a sample bundle so pilot
operators are not tempted to treat dev-laptop numbers as acceptance
evidence. Run the harness locally to generate your own bundle before
Phase 09 acceptance.
