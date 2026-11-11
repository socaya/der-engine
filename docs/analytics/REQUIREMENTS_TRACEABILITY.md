# DER Analytics — requirements traceability matrix

**Document ID:** DER-AN-TRACE-001
**Baseline:** 2026-11-11 (commit `6b04f9dc`)
**SRS:** DER-AN-SRS-001

Gate 0 artefact per SRS §14. Legend: ✅ implemented · ⚠️ partial ·
❌ missing · 🛈 reference-engine-only (will migrate to columnar in
Gate 2+). File paths are relative to the repo root.

---

## FR-ING — ingestion and lifecycle (SRS §4)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-ING-001 | ⚠️ partial | `AnalyticsIngestionService` reads existing capture tables; snapshot-to-stream handoff not explicit. |
| FR-ING-002 | ✅ | `AnalyticsSourceEvent` carries source id + version + occurredOn + orgUnit + status |
| FR-ING-003 | ✅ | `AnalyticsSourceCursor` persists after `commitBatch`; `@TransactionalEventListener(AFTER_COMMIT)` |
| FR-ING-004 | ✅ | `AnalyticsContributionRepository.upsert` keyed on (metric, source_key, period, orgUnit, dim) |
| FR-ING-005 | ⚠️ partial | create/update/delete handled via upsert + `retractSource`; cancellation reads `status`; soft-delete + restore need explicit paths |
| FR-ING-006 | ✅ | `AnalyticsMaterializer.applyContribution` + `retractSource` |
| FR-ING-007 | ⚠️ partial | Version comparison present on upsert; no explicit buffering for out-of-order gaps |
| FR-ING-008 | ⚠️ partial | Partition shape is implicit (orgUnit+period); no scheduler partitioning of ingest work |
| FR-ING-009 | ⚠️ partial | `batchSize` configurable on worker; no adaptive back-pressure |
| FR-ING-010 | ❌ | No bulk backfill with pause/resume/throttle |
| FR-ING-011 | ⚠️ partial | `analytics_live_dlq` (V116) + `AnalyticsLiveRetryWorker`; batch ingest has no DLQ yet |
| FR-ING-012 | ✅ | `AnalyticsBaselineVerifier.verify` — snapshot vs. ledger drift report |
| FR-ING-013 | ⚠️ partial | `AnalyticsLiveIngester` runs AFTER_COMMIT; no throttling under pressure |
| FR-ING-014 | ❌ | No authorised historical import |

## FR-STO — native analytical storage (SRS §5)

Every row here is 🛈 for now — the row-store satisfies correctness
but the SRS requires a native column store. Gate 2 scope.

| ID | Status | Evidence / gap |
|---|---|---|
| FR-STO-001..004 | 🛈 | Postgres `analytics_cell` + `analytics_contribution` |
| FR-STO-005 | ⚠️ partial | Postgres indexes on `(metric_id, period_key, org_unit_uid)` act as logical partitioning |
| FR-STO-006 | ❌ | No manifest / atomic generation swap |
| FR-STO-007 | ❌ | **Owner emphasis** — best-in-class compression (Zstd + LZ4 + dictionary + delta + RLE + bit-packing) is mandatory. Not implemented. |
| FR-STO-008 | ❌ | No zone maps / sparse marks |
| FR-STO-009 | 🛈 | Upsert-by-key covers the no-duplicate-count requirement |
| FR-STO-010 | ❌ | No background compaction |
| FR-STO-011 | ⚠️ partial | Definition versioning exists; projection rebuild is a separate ingest pass |
| FR-STO-012 | ❌ | No disk/spill quotas |
| FR-STO-013..014 | ❌ | No secondary projections / cold tiering |

## FR-QRY — planner and execution (SRS §6)

Gate 2+ scope. Every row row-store-only today.

| ID | Status | Evidence / gap |
|---|---|---|
| FR-QRY-001 | ⚠️ partial | `QueryBody` is typed; validation is per-field, no full AST |
| FR-QRY-002 | ✅ | `AnalyticsDefinitionService` + metadata mirror enforce PI compile + support state |
| FR-QRY-003 | ❌ | No logical plan nodes |
| FR-QRY-004 | ❌ | No plan selection — every query goes through `queryCells` JDBC |
| FR-QRY-005 | 🛈 | Row-store `queryCells` is authoritative; column batches absent |
| FR-QRY-006 | ⚠️ partial | `BigDecimal` for cell values; overflow surfaces as `ArithmeticException` not structured error |
| FR-QRY-007 | ❌ | No EXPLAIN |
| FR-QRY-008 | ❌ | No statistics service |
| FR-QRY-009..014 | ❌ | No cost model, joins, parallel partitions, spill |
| FR-QRY-015..018 | ❌ | No adaptive optimizer / plan cache / SIMD / EXPLAIN ANALYZE |

## FR-INC — incremental computation + analytical products (SRS §7)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-INC-001 | ⚠️ partial | Dependency is implicit (metric → contribution ledger → cell); no explicit graph |
| FR-INC-002 | ✅ | `AnalyticsMaterializer.applyContribution` touches prior + new cells on period / orgUnit move |
| FR-INC-003 | ⚠️ partial | Sum + count maintained; min/max not yet; deletion-aware state exists via upsert-by-key |
| FR-INC-004 | ✅ | V113 added `numerator_contribution` + `denominator_contribution`; ratio `(ΣN/ΣD)×F` at cell grain |
| FR-INC-005 | ✅ | Materializer re-aggregates only touched cells |
| FR-INC-006 | ⚠️ partial | `freshness_at` + `quality_state` on `analytics_cell`; no materialization generation or checkpoint vector |
| FR-INC-007 | ⚠️ partial | `COUNT` + `COUNT_DISTINCT` supported; identity-aware state is implicit via upsert-by-source-key |
| FR-INC-008 | ⚠️ partial | Repeat-stage counts covered via Phase 4d enrollment context; dedicated multi-stage event tally not isolated |
| FR-INC-009 | ❌ | No shadow rebuild / atomic switch on definition change |
| FR-INC-010 | ⚠️ partial | Aggregate facts + PI results shipped as `analytics_cell`; event / tracker / line-list products as named data products not shipped |
| FR-INC-011 | ⚠️ partial | Enrollment-grain evaluation exists; no first-class cohort analytics API |
| FR-INC-012 | ❌ | No relationship-derived measures |
| FR-INC-013..014 | ❌ | No auto-projection recommendations / sketches |

## FR-DIS — distributed Site / Server computation (SRS §8)

Everything here is server-side consolidation. Current DER is single-
site; this whole section is ❌ until a site-to-server contribution
protocol is introduced.

| ID | Status |
|---|---|
| FR-DIS-001 | ✅ (single-site DER runs offline) |
| FR-DIS-002..011 | ❌ |

## FR-API — APIs and consumer contracts (SRS §9)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /capabilities` | ✅ | `AnalyticsEngineController` |
| `GET /catalog` | ⚠️ partial | `/metrics` returns the catalogue; no separate `/catalog` shape |
| `GET /products` + `/products/{id}` | ❌ | Data-product concept not materialised as its own shape |
| `POST /query` | ✅ | |
| `POST /drilldown` | ✅ | V114 audit |
| `POST /explain` | ❌ | No EXPLAIN |
| `POST /jobs` + `/jobs/{id}` + `/cancel` | ❌ | Admin workers are scheduled; no job submission + cancel API |
| `GET /freshness` | ⚠️ partial | `freshness_at` in cells; no dedicated endpoint |
| `GET /status` | ⚠️ partial | `/quality` + `/admin/jobs` |
| `GET /metrics` (ops metrics) | ⚠️ partial | `/admin/observability` returns counters |

## FR-NFR — non-functional (SRS §11)

### Performance (SRS §11.1)

| ID | Status | Evidence / gap |
|---|---|---|
| NFR-PERF-01 (p95 ≤ 500 ms warm) | ❌ | Benchmark harness exists; no 500 ms gate enforced |
| NFR-PERF-02 (p95 ≤ 2 s on 10M facts) | ❌ | Fixture generator shipped; no 10M-fact soak run yet |
| NFR-PERF-03 (p95 ≤ 10 s on 100M facts) | ❌ | No 100M fixture / hardware |
| NFR-PERF-04 (ingest-to-visible p95 ≤ 5 s) | ⚠️ | `AnalyticsBenchmarkService.freshness` measures this; no documented pilot result |
| NFR-PERF-05 (retraction ≤ 10 s) | ⚠️ partial | Materializer recomputes touched cells; not benchmarked explicitly |
| NFR-PERF-06 (Capture degradation ≤ 10 %) | ❌ | No comparison harness |
| NFR-PERF-07 (replay zero duplicate) | ✅ | `AnalyticsReplayAcceptanceTest` AT-05 + AT-20 |
| NFR-PERF-08 (memory governor) | ❌ | No governor |
| NFR-PERF-09 (full-rebuild throughput) | ❌ | No rebuild tool |
| NFR-PERF-10 (plan regression ≤ 20 %) | ❌ | Needs planner |

### Reliability (SRS §11.2)

| ID | Status |
|---|---|
| NFR-REL-01 (checkpoint after durable effect) | ✅ (ingest cursor advances after upsert batch) |
| NFR-REL-02 (replay = fresh recompute) | ✅ (`AnalyticsBaselineVerifier`) |
| NFR-REL-03 (updates / deletes / metadata → retraction / scoped rebuild) | ⚠️ partial — definition-version rebuild missing |
| NFR-REL-04 (snapshot generation isolation) | ❌ |
| NFR-REL-05 (recoverable from disk-full / corruption) | ⚠️ partial — DLQ + retry cover transient; no disk-full guard |
| NFR-REL-06 (migrations backed) | ✅ (Flyway + V110..V117) |

### Security (SRS §11.3)

| ID | Status |
|---|---|
| NFR-SEC-01 | ✅ (role + org-unit scope in drilldown) |
| NFR-SEC-02 | ✅ (deny-by-default; all admin endpoints gated) |
| NFR-SEC-03 | ⚠️ partial (transport encrypted via HTTPS; no at-rest encryption on analytics tables beyond existing SecretEnvelope for secrets) |
| NFR-SEC-04 | ✅ (PHI masked in drilldown; logs avoid PHI) |
| NFR-SEC-05 | ✅ (drilldown audit; publication review audit; benchmark run history) |
| NFR-SEC-06 | ✅ (`der.analytics.min-cell-size` suppresses) |
| NFR-SEC-07 | ⚠️ partial (single-tenant assumption today; no cache-invalidation on authority changes) |
| NFR-SEC-08 | ✅ (parameterized JDBC + AST-based PI evaluation) |

### Operational (SRS §11.4)

| ID | Status |
|---|---|
| NFR-OPS-01 | ⚠️ partial (TransactionalEventListener drains on commit; no explicit worker drain-on-shutdown) |
| NFR-OPS-02 | ⚠️ partial (worker tunables exist; no CPU / I/O budget enforcement) |
| NFR-OPS-03 | ⚠️ partial (in-memory counters; no structured Micrometer export) |
| NFR-OPS-04 | ❌ (no backfill tool yet) |
| NFR-OPS-05 | ⚠️ partial (correlation across request/journal implicit; no end-to-end trace id) |
| NFR-OPS-06 | ⚠️ partial (standard DER backup covers analytics tables; no analytics-specific runbook yet) |
| NFR-OPS-07 | ✅ (JDK portable; no SIMD yet) |

---

## 6. §12 correctness fixture coverage

| Fixture | Covered by | Status |
|---|---|---|
| Changed period | `AnalyticsMaterializerTest.applyContributionTouchesPriorAndNewCells` | ✅ |
| Changed org unit | same | ✅ |
| Same-event retry (AT-05) | `AnalyticsReplayAcceptanceTest.at05DuplicateDeliveryProducesExactlyOneLedgerRow` | ✅ |
| Repeatable stage | `AnalyticsIngestionServiceTest` enrollment-grain | ⚠️ partial — needs dedicated fixture |
| Deleted data value | ❌ | ❌ |
| Age change | ❌ | ❌ |
| Out-of-order change | `AnalyticsContributionRepository.upsert` skips older source_version | ⚠️ partial — needs explicit test |
| Cross-site patient | ❌ | ❌ |
| Metadata edit → rebuild | ❌ | ❌ |
| Permission change → cache invalidation | ❌ | ❌ |
| Partial sync | ⚠️ — reconciliation taxonomy covers the labelling direction | ⚠️ |
| Rebuild race | ❌ | ❌ |
| Precision | ✅ — `BigDecimal` with `MathContext.DECIMAL64` in ratio divide | ✅ |
| Null vs blank | ⚠️ partial — evaluator null semantics mostly correct; no dedicated fixture | ⚠️ |
| Relationship edit | ❌ | ❌ |
| Expired cached query | ❌ (no plan cache) | ❌ |

---

## 7. Next-slice plan (grounded in the above)

The ordered list of implementation slices that follow from this
matrix — each slice lands with tests + evidence:

1. **Gate 1 reinforcement** (closes partials on FR-ING, FR-INC, §12
   correctness fixtures). ≈ 5-10 vertical slices.
2. **Gate 2 columnar store P0** (FR-STO-001..006). Native segment
   format on disk, manifests, atomic generation swap, dictionary +
   RLE + delta + bit-packing + Zstd/LZ4 compression (owner emphasis).
   Row-store remains the oracle.
3. **Gate 3 vectorised execution P0** (FR-QRY-005/006 + batches).
4. **Gate 4 planner + EXPLAIN** (FR-QRY-003/004/007).
5. **Gate 5 statistics + cost model** (FR-QRY-008/009 + NFR-PERF-01/02).
6. **Gate 6 distributed summaries** (FR-DIS-001..010).
7. **Gate 7 adaptive / SIMD** (FR-QRY-015..018).

Each slice has a dedicated commit / tag + benchmark evidence in
`docs/analytics/PERFORMANCE_BENCHMARKS.md`.
