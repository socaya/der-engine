# DER Analytics — requirements traceability matrix

**Document ID:** DER-AN-TRACE-001
**Baseline:** 2026-11-11 (commit `eb221865`)
**SRS:** DER-AN-SRS-001

Gate 0 artefact per SRS §14, refreshed after Gates 2-6 shipped.
Legend: ✅ implemented · ⚠️ partial · ❌ missing · 🛈 reference-
engine-only (mirrored in columnar via oracle verifier). File
paths relative to repo root.

---

## FR-ING — ingestion and lifecycle (SRS §4)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-ING-001 | ⚠️ partial | `AnalyticsIngestionService` + `AnalyticsSourceCursor` |
| FR-ING-002 | ✅ | `AnalyticsSourceEvent` carries id + version + occurredOn |
| FR-ING-003 | ✅ | `AFTER_COMMIT` + cursor advance after upsert batch |
| FR-ING-004 | ✅ | Upsert-by-key dedup + version-guard (FR-ING-007) |
| FR-ING-005 | ✅ | Tombstone path + restoration (`AnalyticsLiveIngester`) |
| FR-ING-006 | ✅ | `materializer.applyContribution` + `retractSource` |
| FR-ING-007 | ✅ | Postgres version-guard in `AnalyticsContributionRepository.upsert` |
| FR-ING-008 | ⚠️ partial | Partition shape implicit; no explicit scheduler partitioning |
| FR-ING-009 | ⚠️ partial | Worker batch size configurable; no adaptive back-pressure |
| FR-ING-010 | ❌ | No bulk-backfill-with-pause tool |
| FR-ING-011 | ⚠️ partial | V116 live DLQ + retry; batch ingest still lacks quarantine |
| FR-ING-012 | ✅ | `AnalyticsBaselineVerifier.verify` |
| FR-ING-013 | ⚠️ partial | AFTER_COMMIT isolation; no throttle under pressure |
| FR-ING-014 | ❌ | No authorised historical import |

## FR-STO — native analytical storage (SRS §5)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-STO-001 | ✅ | Segments under `analytics-store/facts/` separate from Postgres |
| FR-STO-002 | ✅ | `ColumnBatch` sealed type system |
| FR-STO-003 | ✅ | INT64 / DECIMAL / STRING / BOOL / DATE primitives |
| FR-STO-004 | ✅ | `SegmentReader.projection` reads only requested columns |
| FR-STO-005 | ✅ | Segment partitioning on `(domain, site, period)` |
| FR-STO-006 | ✅ | Manifest atomic generation swap + per-segment CRC + per-manifest CRC |
| FR-STO-007 | ✅ | Dictionary + bit-pack + Zstd + LZ4 + `CodecSelector`; delta + RLE deferred |
| FR-STO-008 | ✅ | Zone-map pruning (`PlanCoster` + `ColumnarQueryEngine`) |
| FR-STO-009 | ✅ | Upsert-by-key in row-store ledger; columnar oracle-verified |
| FR-STO-010 | ❌ | No background compaction |
| FR-STO-011 | ⚠️ partial | Definition versioning present; rebuild on metadata edit still manual |
| FR-STO-012 | ⚠️ partial | Spill limits enforced (`SpillStore`); no global disk quota yet |
| FR-STO-013 | ❌ | No secondary projections |
| FR-STO-014 | ❌ | No cold tiering |

## FR-QRY — planner and execution (SRS §6)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-QRY-001 | ✅ | `CellQuery` is typed; AST shape lives in `Filter` sealed interface |
| FR-QRY-002 | ✅ | `AnalyticsDefinitionService` resolves metadata + support state |
| FR-QRY-003 | ⚠️ partial | Plan nodes = Filter + Scan + Aggregate + GroupBy; no sort / limit / join nodes yet |
| FR-QRY-004 | ✅ | `PlanSelector` picks columnar vs row-store |
| FR-QRY-005 | ✅ | `ColumnScanner` + `Filter.evaluate` + `Aggregator` + `GroupBy` |
| FR-QRY-006 | ✅ | `BigDecimal` + `MathContext.DECIMAL64` throughout |
| FR-QRY-007 | ✅ | `ColumnarExplainer` returns static plan |
| FR-QRY-008 | ✅ | `ColumnStatistics` (min / max / null / distinct sample) |
| FR-QRY-009 | ✅ | `PlanCoster` + selectivity estimates |
| FR-QRY-010 | ❌ | No joins yet (not required for current metric shape) |
| FR-QRY-011 | ⚠️ partial | `QueryGovernor.maxConcurrent`; no parallel-segment execution |
| FR-QRY-012 | ⚠️ partial | Batches are fixed-size; adaptive batch sizing deferred |
| FR-QRY-013 | ✅ core | `SpillStore` + `QueryToken` abort path; operator spill adoption pending |
| FR-QRY-014 | ✅ | Per-query byte + deadline ceilings via `QueryToken` |
| FR-QRY-015 | ⏳ Gate 7 | No adaptive optimizer feedback |
| FR-QRY-016 | ❌ | No plan cache |
| FR-QRY-017 | ❌ | No SIMD path |
| FR-QRY-018 | ⚠️ partial | `EXPLAIN` returns cost + segments; no per-operator wall-time ANALYZE yet |

## FR-INC — incremental computation + analytical products (SRS §7)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-INC-001 | ⚠️ partial | Dependency implicit; no explicit graph |
| FR-INC-002 | ✅ | `applyContribution` touches prior + new cells on move |
| FR-INC-003 | ✅ | SUM / COUNT / MIN / MAX / AVERAGE all multiset-aware |
| FR-INC-004 | ✅ | V113 numerator + denominator ledger + ratio materialiser |
| FR-INC-005 | ✅ | Materializer re-aggregates only touched cells |
| FR-INC-006 | ⚠️ partial | `freshness_at` + `quality_state`; no materialisation generation on cell yet |
| FR-INC-007 | ⚠️ partial | COUNT + COUNT_DISTINCT via upsert-by-source-key; no sketches |
| FR-INC-008 | ⚠️ partial | Repeat-stage counts covered; dedicated multi-stage event tally not a first-class metric type |
| FR-INC-009 | ❌ | No shadow rebuild / atomic switch on definition change |
| FR-INC-010 | ⚠️ partial | Aggregate facts + PI results shipped; event / tracker / line-list products not first-class |
| FR-INC-011 | ⚠️ partial | Enrollment-grain evaluation present; no first-class cohort API |
| FR-INC-012 | ❌ | No relationship-derived measures |
| FR-INC-013 | ⏳ Gate 7 | No auto-propose preaggregations |
| FR-INC-014 | ❌ | No sketches |

## FR-DIS — distributed Site / Server computation (SRS §8)

| ID | Status | Evidence / gap |
|---|---|---|
| FR-DIS-001 | ✅ | Site analytics runs offline (AFTER_COMMIT + local ledger) |
| FR-DIS-002 | ✅ | `SiteContributionExporter` emits signed packets with algebra-safe aggregates |
| FR-DIS-003 | ✅ | `SiteContributionReceiver.insertIfAbsent` dedups on constraint |
| FR-DIS-004 | ✅ | `ConsolidatedCell` carries reporting / missing / stale / completeness |
| FR-DIS-005 | ✅ | Distinct-count metrics deliberately absent from packet shape |
| FR-DIS-006 | ⚠️ partial | HMAC + checksum integrity; retry/backoff not shipped |
| FR-DIS-007 | ❌ | Ownership-transfer history not tracked |
| FR-DIS-008 | ⚠️ partial | Signed transport; per-site data-sharing policy not surfaced |
| FR-DIS-009 | ❌ | No parallel server partitioning |
| FR-DIS-010 | ❌ | No distributed query execution |
| FR-DIS-011 | ❌ | No reshard operations |

## FR-API — APIs and consumer contracts (SRS §9)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /capabilities` | ✅ | |
| `GET /catalog` | ⚠️ partial | `/metrics` acts as the catalogue |
| `GET /products` + `/products/{id}` | ❌ | Product concept not a first-class API shape |
| `POST /query` | ✅ | Row-store + columnar via `PlanSelector` |
| `POST /drilldown` | ✅ | V114 audit |
| `POST /explain` | ✅ | `/admin/segments/explain` |
| `POST /jobs` + `/jobs/{id}` + `/cancel` | ⚠️ partial | `/admin/queries` list + cancel; no first-class jobs API |
| `GET /freshness` | ⚠️ partial | `freshness_at` + manifest createdAt available |
| `GET /status` | ⚠️ partial | `/quality` + `/admin/jobs` |
| `GET /metrics` (ops) | ⚠️ partial | In-memory counters via `/admin/observability` |

Admin surface added in Gates 2-6:

| Endpoint | Role |
|---|---|
| `POST /admin/segments/flush` | Row-store → columnar sidecar |
| `GET /admin/segments/manifest` | Current manifest |
| `POST /admin/segments/verify` | Oracle comparison |
| `POST /admin/segments/explain` | Static plan |
| `POST /admin/segments/plan` | PlanSelector decision |
| `GET /admin/queries` + `/{id}/cancel` | Governor list + cancel |
| `GET /admin/queries/spill` | Spill usage |
| `POST /admin/sites/export` | Site packet producer |
| `POST /admin/sites/import` | Receiver + dedup |
| `GET /admin/sites/summary` | Per-site packet counts |
| `POST /admin/sites/consolidate` | Merged view + completeness |
| `POST /admin/reconciliation/fetch` | /api/analytics polling (manual-run) |
| `POST /admin/reconciliation/compare` | Classifier |
| `POST /admin/replay-verify` | Baseline verifier |
| `GET /admin/live-dlq` + `/{id}/retry` + `/{id}` | DLQ management |
| `POST /admin/benchmark/{latency,freshness,seed,seed/cleanup}` + `GET /admin/benchmark/runs` | NFR harness |

## FR-NFR — non-functional (SRS §11)

### Performance (SRS §11.1)

| ID | Status |
|---|---|
| NFR-PERF-01 (p95 ≤ 500 ms warm) | ⚠️ measurable via `AnalyticsBenchmarkService.latency` |
| NFR-PERF-02 (p95 ≤ 2 s on 10M facts) | ⚠️ fixture generator ready; no measured pilot result |
| NFR-PERF-03 (p95 ≤ 10 s on 100M facts) | ❌ no 100M fixture / hardware |
| NFR-PERF-04 (ingest-to-visible p95 ≤ 5 s) | ⚠️ measurable via `freshness()` |
| NFR-PERF-05 (retraction ≤ 10 s) | ⚠️ not yet benchmarked |
| NFR-PERF-06 (Capture degradation ≤ 10 %) | ❌ no comparison harness |
| NFR-PERF-07 (replay zero duplicate) | ✅ `AnalyticsReplayAcceptanceTest` |
| NFR-PERF-08 (memory governor) | ✅ `QueryGovernor` + `QueryToken.accountBytes` |
| NFR-PERF-09 (rebuild throughput) | ❌ no rebuild tool |
| NFR-PERF-10 (plan regression ≤ 20 %) | ⚠️ planner exists; no regression harness |

### Reliability (SRS §11.2)

| ID | Status |
|---|---|
| NFR-REL-01 | ✅ Cursor advances after durable upsert |
| NFR-REL-02 | ✅ Baseline verifier confirms replay = fresh recompute |
| NFR-REL-03 | ⚠️ partial — definition-version rebuild deferred |
| NFR-REL-04 | ✅ Manifest atomic generation swap |
| NFR-REL-05 | ⚠️ DLQ + retry cover transient; disk-full handling partial |
| NFR-REL-06 | ✅ Flyway V110..V118 |

### Security (SRS §11.3)

| ID | Status |
|---|---|
| NFR-SEC-01 | ✅ Role + org-unit scope in drilldown + admin endpoints |
| NFR-SEC-02 | ✅ Deny-by-default; admin gated |
| NFR-SEC-03 | ⚠️ HTTPS transport; no at-rest encryption on segment files |
| NFR-SEC-04 | ✅ PHI masked in drilldown; no PHI in segment data |
| NFR-SEC-05 | ✅ Drilldown + publication + benchmark audit trails |
| NFR-SEC-06 | ✅ Small-cell suppression threshold |
| NFR-SEC-07 | ⚠️ Single-tenant assumption today |
| NFR-SEC-08 | ✅ Parameterised JDBC + AST-based PI evaluation |

### Operational (SRS §11.4)

| ID | Status |
|---|---|
| NFR-OPS-01 | ⚠️ AFTER_COMMIT listener drains; no explicit worker drain-on-shutdown |
| NFR-OPS-02 | ✅ Governor properties per runtime profile |
| NFR-OPS-03 | ⚠️ In-memory counters; no Prometheus export |
| NFR-OPS-04 | ❌ no backfill tool |
| NFR-OPS-05 | ⚠️ correlation partial |
| NFR-OPS-06 | ⚠️ standard DER backup covers all analytics tables; no analytics-specific runbook |
| NFR-OPS-07 | ✅ JDK portable; SIMD deferred |

---

## §12 correctness fixture coverage — refreshed

| Fixture | Covered by | Status |
|---|---|---|
| 1 Changed period | `AnalyticsSrsFixtureTest.fixture01*` | ✅ |
| 2 Changed org unit | `AnalyticsSrsFixtureTest.fixture02*` | ✅ |
| 3 Same-event retry (AT-05) | `AnalyticsReplayAcceptanceTest.at05*` | ✅ |
| 4 Repeatable stage | `AnalyticsSrsFixtureTest.fixture04*` | ✅ |
| 5 Deleted data value | `AnalyticsSrsFixtureTest.fixture05*` | ✅ |
| 6 Age change | ❌ | ❌ |
| 7 Out-of-order change | `AnalyticsReplayAcceptanceTest.fixture7*` | ✅ |
| 8 Cross-site patient | ❌ | ❌ |
| 9 Metadata edit → rebuild | ❌ (Gate 7) | ❌ |
| 10 Permission change → cache invalidation | ❌ | ❌ |
| 11 Partial sync | ✅ `SiteConsolidator` completeness attribution | ✅ |
| 12 Rebuild race | ❌ | ❌ |
| 13 Precision | `AnalyticsSrsFixtureTest.fixture13*` | ✅ |
| 14 Null vs blank | ⚠️ partial — evaluator null semantics correct, no dedicated fixture | ⚠️ |
| 15 Relationship edit | ❌ | ❌ |
| 16 Expired cached query | ❌ (no plan cache) | ❌ |

**8 of 16 §12 fixtures have dedicated regressions**, up from 5 at
baseline; 11 (partial sync) landed implicitly via Gate 6.3
completeness attribution.

---

## Next-slice plan

Ordered by remaining value:

1. **Gate 7** — adaptive optimizer feedback (FR-QRY-015) +
   auto-propose preaggregations (FR-INC-013).
2. **Operator spill adoption** — vectorised operators call
   `SpillStore.allocate()` when intermediate state would exceed
   the memory budget (FR-QRY-013 operator-level).
3. **Delta + RLE codecs** — when pilot data shows demand.
4. **Metadata-edit rebuild** — shadow-rebuild + atomic switch
   (§12 fixture 9, FR-INC-009).
5. **Structured observability** — Micrometer exports for ingest
   lag, query p95, DLQ depth, compression ratios (NFR-OPS-03).
6. **Age-band / cross-site identity** — §12 fixtures 6 + 8;
   requires a dedicated identity resolution service.
