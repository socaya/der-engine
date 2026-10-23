# Sample NFR evidence bundle (shape only)

This directory shows the output shape of `scripts/evaluation/nfr_sweep.sh`
without the actual measurements. Real pilot runs produce bundles under
`docs/evaluation/evidence/phase-15/<utc-timestamp>-<commit>/`.

## Files emitted

- `manifest.json` — run id, commit, baseURL, duration, NFR coverage.
- `bench-health-{1,5,10,20}.json` — per-concurrency latency + throughput
  via `der_bench.py` against `/edge-api/v1/system/health`.
- `resource-sample.json` — CPU/RSS/disk time-series via `resource_sampler.py`.
- `operator-metrics.json` — snapshot of `/edge-api/v1/admin/metrics`.
- `backup-integrity.json` — round-trip verification via `backup_integrity.py`.

## How to run

```bash
export DER_BASE_URL=http://localhost:8080
export DER_ADMIN_COOKIE="DERSESSION=…"
bash scripts/evaluation/nfr_sweep.sh
```

Bundle lands under `docs/evaluation/evidence/phase-15/<run-id>/`.
