# Phase 11.3 — NFR sweep evidence

## Status

- **Harness:** ✅ shipped. `scripts/evaluation/nfr_sweep.sh` runs the
  live sweep end-to-end: resource sampler, bench at c=1/5/10/20,
  operator-metrics probe, backup-integrity dry-run, resource-budget
  comparator, bench-budget comparator, experiment export.
- **Synthetic smoke:** ✅ `scripts/evaluation/test_nfr_sweep_e2e.py`
  exercises every comparator against fabricated artefacts that both
  pass + regress the pinned budgets. Catches any budget-pin tightening
  that would make the pins unreachable even on healthy hardware. Runs
  every gate.
- **Live pilot evidence:** 🧰 pending the reference-hardware run.
  Attach the sweep output (see §Layout below) to this folder after
  running against the pilot host.

The pilot operator produces this evidence by running on a reference
Ubuntu 24.04 host (see §NFR-24 in
`docs/operations/component-and-portability.md`):

```bash
export DER_BASE_URL="http://localhost:8080"
export DER_ADMIN_COOKIE="JSESSIONID=…"
export DER_BENCH_DURATION=60
bash scripts/evaluation/nfr_sweep.sh
```

## Pinned budgets (source of truth)

| File | Covers | Shipped |
|---|---|---|
| `scripts/evaluation/budgets/resource_budgets.json` | NFR-18 | ✅ |
| `scripts/evaluation/budgets/bench_budgets.json` | NFR-15, NFR-16 | ✅ |

Changing a pin requires an ADR + a dated evidence run under this
folder showing the new limit is tight enough.

## Pass criteria — what the comparators assert

| NFR | Assertion | Checker |
|---|---|---|
| NFR-15 | p50/p95/p99 latency ≤ pinned per-concurrency ceilings | `check_bench_budget.py` |
| NFR-16 | throughput_rps ≥ pinned per-concurrency floor; error rate ≤ 1% | `check_bench_budget.py` |
| NFR-17 | journal drains to zero inside the sweep window (surfaced through the saturation + error breakdown) | `analyze_saturation()` + `collect_failures()` |
| NFR-18 | p50/p95/p99 CPU + RSS + latency ≤ pinned ceilings; diskGrowthBytesPerHour ≤ pin | `check_resource_budget.py` |
| NFR-19 | per-level saturation + error breakdown surfaced; auto-rollback on throughput collapse | `analyze_saturation()` |
| NFR-20 | operator metrics contract (health.status, lastSuccessfulSyncAt, queueDepth, rejections, conflicts) present | `operator-metrics.json` snapshot |
| NFR-29 | backup round-trip preserves per-state journal counts | `check_backup_integrity.py` (via `backup_integrity.py`) |

## Layout (after a live run)

```
11.3-nfr-sweep/
├── README.md                         (this file)
├── <run-id>/                          (populated by nfr_sweep.sh)
│   ├── resource-sample.json           (FR-17-08 / NFR-18 time series + summary)
│   ├── resource-budget-result.json    (NFR-18 assertion result)
│   ├── resource-budget-report.md      (reviewer-facing)
│   ├── bench-health.json              (NFR-15/16/19 per-level + saturation)
│   ├── bench-budget-result.json       (NFR-15/16 assertion result)
│   ├── bench-budget-report.md         (reviewer-facing)
│   ├── operator-metrics.json          (NFR-20 snapshot)
│   ├── backup-integrity.json          (NFR-29 round-trip)
│   ├── nfr-sweep.log                  (full run log)
│   ├── manifest.json                  (per-file SHA-256)
│   └── experiment/                    (FR-17-09 reviewer bundle)
│       └── experiment-<ts>-<commit>/
│           ├── config.json
│           ├── failures.json          (anyFailure == false → pass)
│           ├── inputs/                (budget pins verbatim)
│           ├── outputs/                (raw artefacts)
│           └── manifest.json
```

## Gate-time guarantee

Every build re-runs `test_nfr_sweep_e2e.py` which:

1. Loads the shipped `resource_budgets.json` + `bench_budgets.json`
   from the repo.
2. Feeds `check_resource_budget.py` + `check_bench_budget.py` a
   synthetic sweep report whose numbers sit comfortably inside the
   pins (margin: CPU p95 at 55/70, latency p95 at 700/1000 ms @ c=20,
   disk at ~24/50 MiB/hr).
3. Also feeds a deliberately regressed report to each comparator and
   asserts the regression is caught.

So any pin tightening that makes the pins unreachable even on healthy
hardware fails the gate — the pilot operator never gets a sweep that
can't pass.
