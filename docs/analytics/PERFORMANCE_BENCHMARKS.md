# DER Analytics — performance and compression evidence

**Document ID:** DER-AN-PERF-001

**Evidence date:** 2026-11-12

**Profile:** local DER development deployment, PostgreSQL row-store plus
verified native columnar sidecar

## Controlled dataset

The deterministic fixture generator was run with seed `424242`, program
`BENCHMARK01`, organisation unit `HL2zXaIULBe`, 100 tracked entities, 100
enrolments, and 1,000 tracker events. The fixture owns a dedicated workflow
run so it satisfies current capture foreign-key and non-null contracts and
can be removed through the benchmark cleanup endpoint.

Recomputation scanned 1,015 event rows and 120 enrolment rows and produced 13
materialized analytical cells. The extra source rows are existing local test
data, so the recorded result represents the deployed database rather than an
isolated in-memory benchmark.

## Results

| Evidence | Samples / rows | Result | Target | Outcome |
|---|---:|---:|---:|---|
| Warm query latency | 500 iterations | p50 0 ms, p95 0 ms, p99 0 ms, max 0 ms | p95 ≤ 500 ms | Pass (smoke scale) |
| Ingest-to-visible freshness | 200 samples | p50 0 ms, p95 0 ms, p99 0 ms, max 1 ms | p95 ≤ 5,000 ms | Pass (smoke scale) |
| Live parity, generation 5 | 13 cells | 13 verified, 0 drift | zero drift | Pass |
| Live generation encoding | 13 cells | 3,205 bytes, ratio 0.9988 | informational | Recorded |
| Repetitive codec fixture | 500 rows | encoded/plain ratio 0.0535 | below 0.10 | Pass |

The lifecycle also reclaimed 12,050 bytes while enforcing its retained-
generation window. The live planner correctly selected the row-store for
this tiny result set (`row-store cost 141 < columnar cost 1008`); columnar
execution and adaptive feedback are separately covered by automated engine
tests.

## Interpretation and limits

These results prove the benchmark harness, deterministic fixture, parity
gate, compression measurement, and operational lifecycle on the deployed
stack. They do **not** establish the SRS 10-million or 100-million fact
targets. Millisecond timing also rounds sub-millisecond local operations to
zero. Before production capacity sign-off, repeat the same persisted
benchmark on representative hardware at 10M and 100M facts, capture CPU,
memory, disk, and concurrency, and compare plans across releases.

## Reproduction

Use the analytics admin API in this order:

1. `POST /edge-api/v1/analytics/v1/admin/benchmark/seed`
2. Run the analytics recompute endpoint for event and enrolment sources.
3. `POST /edge-api/v1/analytics/v1/admin/segments/run`
4. `POST /edge-api/v1/analytics/v1/admin/segments/verify`
5. `POST /edge-api/v1/analytics/v1/admin/benchmark/latency`
6. `POST /edge-api/v1/analytics/v1/admin/benchmark/freshness`
7. Inspect `GET /admin/benchmark/runs` and
   `GET /admin/segments/lifecycle` under the same API prefix.
8. Remove controlled rows with `POST /admin/benchmark/seed/cleanup` when the
   evidence run is no longer needed.

Benchmark rows are persisted in `analytics_benchmark_run`; lifecycle status
reports the latest generation's row counts, bytes, compression ratio, parity,
and reclaimed bytes.
