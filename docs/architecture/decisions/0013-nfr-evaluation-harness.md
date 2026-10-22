# ADR-0013: NFR evaluation harness

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0004 (hybrid edge architecture), ADR-0010 (journal worker),
  ADR-0012 (backup/restore engine)

## Context

Phases 02–07 shipped the functional surface. The non-functional register
(`docs/requirements/source-nonfunctional-register.csv`, NFR-01..NFR-35)
splits into two groups:

1. **Design NFRs** (NFR-02 durability, NFR-03 atomicity, NFR-05 authZ,
   NFR-06 confidentiality, …) — verified by the existing JUnit /
   Testcontainers / MockMvc suites. No new work required; the Phase 08
   report links to the existing tests.
2. **Measurement NFRs** (NFR-15 latency, NFR-16 throughput, NFR-17
   backlog recovery, NFR-18 resource budget, NFR-19 scalability,
   NFR-27 reproducibility, NFR-29 backup integrity, NFR-35 deployment
   transparency) — require live measurement against a running DER and
   can only be fully evaluated on **pilot hardware** (NFR-18/35).

Phase 08's job is to build a reproducible, hardware-portable harness
that produces the measurement NFR evidence. The same scripts run on the
dev laptop (producing baseline numbers that go into the Phase 08
release note) and on pilot hardware in Phase 09 (producing the signed
acceptance evidence bundle).

## Decision

Ship a Python-stdlib-only measurement harness under
`scripts/evaluation/` with four scripts and one orchestrator:

| Script | NFRs | Produces |
|---|---|---|
| `der_bench.py` | NFR-15, NFR-16, NFR-19 | latency p50/p95/p99 + sustained r/s at 1/5/10/20 concurrent sessions |
| `backlog_recovery.py` | NFR-17 | drain-to-zero time for 100/1000 queued operations |
| `resource_sampler.py` | NFR-18, NFR-35 | RSS, CPU%, data-dir growth sampled every N seconds + hardware fingerprint |
| `backup_integrity.py` | NFR-29 | full backup → restore round-trip, row-count diff |
| `run_phase_08.sh` | NFR-27, all above | glue; writes `docs/evaluation/evidence/phase-08/<run>/manifest.json` |

### Why Python stdlib only

Pilot hardware is likely a low-powered Linux box with no toolchain
beyond `python3` and `psql`. External load generators (`wrk`, `k6`,
`hey`) require installation + ARM/x86 variants + sudo. `urllib` +
`concurrent.futures` are good enough for a 20-session worst case.
Measurements remain explicitly honest about their load-gen co-location
cost — the harness also captures the measuring process's own CPU
share, so skew can be subtracted when reporting.

### Reproducibility (NFR-27)

Each run writes a `manifest.json` to its evidence directory with:

- `runId` — UTC timestamp + commit SHA.
- `seed` — RNG seed for all randomness (default fixed; override via env).
- `hardware` — `uname -a`, `lscpu`, `/proc/meminfo`, `df -h $DER_DATA_DIR`.
- `dhis2Version` — pulled from `/api/system/info` of the paired central.
- `derVersion` — `cat VERSION`.
- `startedAt`, `finishedAt`, `durationSeconds`.

### Not in scope

- NFR-26 accessibility is covered by the Playwright + axe-core step
  that already lands with each UI release; the Phase 08 report cites
  that evidence rather than re-running it.
- JVM profiling (JFR, async-profiler) — the harness captures ambient
  RSS/CPU only. Deep profiling is a Phase 09 troubleshooting step.
- Chaos / long-soak (24 h+) testing — the harness runs minutes-scale
  workloads so each full pass fits in an evening on a pilot laptop.

## Consequences

- Phase 08's release bundles baseline numbers measured on the dev
  laptop so pilot operators have a reference. Phase 09 overlays the
  same manifest with the pilot-hardware numbers, and the comparison
  itself becomes the final acceptance evidence.
- The harness is self-contained Python; adding a dependency would
  reopen the install-footprint discussion. Prefer forking the harness
  before adding `requests` or `pytest-benchmark`.
