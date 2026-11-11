# DER Analytics — implementation inventory

**Document ID:** DER-AN-INV-001
**Baseline:** 2026-11-11 (commit `eb221865`)
**SRS:** DER-AN-SRS-001 (`DER_Native_Analytics_Engine_SRS_Claude.md`)

Gate 0 artefact mandated by SRS §14, refreshed after Gates 2-6
shipped. Row-store reference engine stays as the correctness
oracle; the native columnar OLAP pipeline is now in place end-to-
end alongside it.

---

## 1. Shipped modules — row-store reference engine (Gate 1)

All code under `server/src/main/java/ug/ac/mak/der/analytics/` except the
client bundle under `apps/analytics/src/`.

| Package | Files | Role |
|---|---|---|
| `engine/expression/*` | `Lexer`, `Parser`, `Expression`, `Evaluator`, `ExpressionCompiler`, `Token` | PI parser → AST, interpreter, compile + support-state |
| `engine/*ExpressionContext.java` | `EventExpressionContext`, `EnrollmentExpressionContext` | Multi-event enrollment-grain + option-set resolution |
| `engine/*.java` | `AnalyticsDefinition`, `AnalyticsDefinitionService`, `AnalyticsDimension`, `DimensionKey`, `AnalyticsEngineRepository`, `AnalyticsSeed`, `AnalyticsCapabilities`, `AnalyticsPeriodEnumerator`, `AnalyticsObservability`, `OptionSetLookup`, `ProgramIndicatorSyncService` | Definitions, catalog, cells, period / dimension / option-set surface |
| `engine/*.java` (ingest) | `AnalyticsIngestionService`, `AnalyticsLiveIngester`, `AnalyticsMaterializer`, `AnalyticsContribution`, `AnalyticsContributionRepository`, `AnalyticsCell`, `AnalyticsSourceEvent` | Batch + live ingest → contribution ledger → materialised cells |
| `publication/*` | `PublicationMapping`, `PublicationProposal`, `PublicationRepository`, `PublicationProposalService`, `PublicationDrainWorker`, `PublicationProperties` | Mapping + proposal state machine + /dataValueSets drain + AUTO_APPROVE |
| `drilldown/*` | `AnalyticsDrilldownService`, `AnalyticsDrilldownAuditRepository` | Lineage query + role gate + PHI masking + V114 audit |
| `reconciliation/*` | `ReconciliationClassifier`, `AnalyticsReconciliation`, `AnalyticsReconciliationRepository`, `AnalyticsReconciliationService`, `AnalyticsReconciliationFetcher`, `ReconciliationFetchProperties` | Classifier taxonomy + /api/analytics fetch worker |
| `replay/*` | `AnalyticsBaselineVerifier` | Re-aggregate from ledger, report drift |
| `dlq/*` | `AnalyticsLiveDlqEntry`, `AnalyticsLiveDlqRepository`, `AnalyticsLiveRetryWorker` | V116 persistent failure queue + exponential retry |
| `benchmark/*` | `AnalyticsBenchmarkService`, `AnalyticsBenchmarkRun`, `AnalyticsBenchmarkRepository`, `AnalyticsBenchmarkFixtureGenerator` | p50/p95/p99 latency + freshness + synthetic seeder |

### 1.1 Persistent schema — row-store (V110..V118)

| Migration | Tables |
|---|---|
| V110 | `analytics_definition`, `analytics_cell`, `analytics_source_cursor` |
| V111 | `analytics_contribution` |
| V112 | `analytics_publication_mapping`, `analytics_publication` |
| V113 | `analytics_contribution.numerator_contribution` + `denominator_contribution` |
| V114 | `analytics_drilldown_audit` |
| V115 | `analytics_reconciliation` |
| V116 | `analytics_live_dlq` |
| V117 | `analytics_benchmark_run` |
| V118 | `analytics_site_contribution` (Gate 6.2 — server consolidator ledger) |

---

## 2. Shipped modules — native columnar pipeline (Gates 2-6)

Everything under `server/src/main/java/ug/ac/mak/der/analytics/column/` and
`server/src/main/java/ug/ac/mak/der/analytics/distributed/`. No new Flyway
migrations after V118 — columnar state lives on disk under
`analytics-store/`.

### 2.1 Column primitives (Gate 2.1-2.5)

| File | Role |
|---|---|
| `column/ColumnType.java` | INT64 / DECIMAL / STRING / BOOL / DATE primitive set |
| `column/ColumnBatch.java` | Sealed per-type batch (primitive-array backing) |
| `column/NullBitmap.java` | Bit-packed null tracker |
| `column/Codec.java` | Encode / decode interface; stable codecId |
| `column/BuiltinCodecs.java` | id → Codec registry for every base codec |
| `column/CodecResolver.java` | Reverse of `CompressedCodec.codecId` — resolves wrapped ids |
| `column/CodecSelector.java` | Measurement-based codec selection (SRS FR-STO-007) |
| `column/PlainCodec.java` + `PlainCodecHeader.java` | Reference uncompressed oracle |
| `column/BitPacker.java` + `BitPackedInt64Codec.java` | Frame-of-reference + bit-pack |
| `column/DictionaryStringCodec.java` | Low-cardinality string dictionary |
| `column/Compressor.java` + `ZstdCompressor.java` + `Lz4Compressor.java` | Page-level compressors |
| `column/CompressedCodec.java` | Zstd/LZ4 wrapper with xxHash64 integrity |

### 2.2 Segment format (Gate 2.6)

| File | Role |
|---|---|
| `column/segment/Segment.java` + `SegmentColumn.java` | In-memory segment + per-column entry |
| `column/segment/SegmentFormat.java` | Magic / version / trailer constants |
| `column/segment/SegmentWriter.java` | Atomic temp+fsync+rename writer; CRC32 trailer |
| `column/segment/SegmentReader.java` | parseAll + projection (SRS FR-STO-004) |

### 2.3 Manifest (Gate 2.7)

| File | Role |
|---|---|
| `column/manifest/Manifest.java` + `SegmentRef.java` | Generation + segment refs + checkpoints |
| `column/manifest/ManifestFormat.java` | JSON body + 12-byte trailer (`CRCMNF\0\0` + CRC32) |
| `column/manifest/ManifestWriter.java` | Atomic + deterministic serialisation |
| `column/manifest/ManifestReader.java` | Parse + verify trailer + CRC32 |
| `column/manifest/ManifestStore.java` | Highest-valid-generation picker |

### 2.4 Sink + verifier (Gate 2.8 + 2.9)

| File | Role |
|---|---|
| `column/sink/AnalyticsColumnarProperties.java` | `der.analytics.columnar.*` config |
| `column/sink/AnalyticsColumnarSink.java` | Row-store cells → columnar segments + manifest publish |
| `column/sink/AnalyticsColumnarVerifier.java` | Oracle-matched row-by-row comparison |

### 2.5 Statistics + planner (Gate 4)

| File | Role |
|---|---|
| `column/stats/ColumnStatistics.java` | Per-column min / max / null-count / distinct estimate + sample |
| `column/stats/SegmentStatistics.java` | Roll-up of per-column stats for a segment |
| `column/stats/SegmentStatisticsBuilder.java` | Compute at write time (walks sealed batches) |
| `column/stats/SegmentStatisticsStore.java` | Sidecar `.stats.json` writer / reader |
| `column/stats/PlanCoster.java` | CostEstimate from stats (SRS FR-QRY-008/009) |

### 2.6 Vectorised executor (Gate 3)

| File | Role |
|---|---|
| `column/exec/SelectionBitmap.java` | Bit-packed row mask + and/or/not |
| `column/exec/Filter.java` | Sealed Equals/In/Between/IsNotNull/And/Or/Not |
| `column/exec/ColumnScanner.java` | Projection-load segment → batches |
| `column/exec/Aggregator.java` | Count / Sum / Min / Max / Average over bitmap |
| `column/exec/GroupBy.java` | Multi-column group-by |
| `column/exec/ColumnarQueryEngine.java` | End-to-end CellQuery → List<AnalyticsCell>; honours QueryToken |
| `column/exec/ColumnarExplainer.java` | Static-plan EXPLAIN surface |
| `column/exec/PlanSelector.java` | Columnar vs row-store cost-based routing |

### 2.7 Governor + spill (Gate 5)

| File | Role |
|---|---|
| `column/governor/GovernorProperties.java` | `der.analytics.governor.*` — maxConcurrent / maxDuration / maxBytes |
| `column/governor/QueryToken.java` | Per-query cancellation + byte accounting |
| `column/governor/QueryAbortedException.java` | Clean-abort signal operators propagate |
| `column/governor/QueryGovernor.java` | begin / cancel / list / inFlightCount |
| `column/governor/SpillProperties.java` | `der.analytics.governor.spill.*` — rootPath / limits |
| `column/governor/SpillHandle.java` | One file per allocation; write / append / read / release |
| `column/governor/SpillStore.java` | Per-query temp dir + cleanup lifecycle |

### 2.8 Distributed consolidation (Gate 6)

| File | Role |
|---|---|
| `distributed/SiteContributionPacket.java` | Algebra-safe aggregates + cursor + checksum + signature |
| `distributed/SiteContributionExporter.java` | Walk cells → signed packets (SRS FR-DIS-002) |
| `distributed/SiteContributionRepository.java` | V118 ledger CRUD + findForQuery |
| `distributed/SiteContributionReceiver.java` | Checksum verify + signature verify + upsert dedup |
| `distributed/ConsolidatedCell.java` | Merge result + per-site completeness |
| `distributed/ConsolidatorProperties.java` | Expected sites + staleness threshold |
| `distributed/SiteConsolidator.java` | Group packets → consolidated view (SRS FR-DIS-004) |
| `distributed/SiteTrustProperties.java` + `SiteSigner.java` + `SiteSignatureVerifier.java` | HMAC-SHA256 signed transport (SRS FR-DIS-002) |

### 2.9 Controller + UI

| File | Role |
|---|---|
| `web/AnalyticsEngineController.java` | REST surface under `/edge-api/v1/analytics/v1/*` (query / drilldown / reconciliation / replay / DLQ / benchmark / segments / queries / sites) |
| `apps/analytics/src/index.tsx` | Nine-section DER-dispatched app |

---

## 3. SRS §2.2 module map — refreshed

| ID | Module | Status | Notes |
|---|---|---|---|
| ARCH-01 | Source adapters | ✅ | `AnalyticsSourceEvent` + `@TransactionalEventListener` |
| ARCH-02 | Metadata/semantics registry | ✅ | DER metadata mirror + `AnalyticsDefinition` |
| ARCH-03 | Canonical fact builder | ⚠️ partial | `AnalyticsContribution` IS the canonical fact; still implicit, not a dedicated builder |
| ARCH-04 | Ingestion controller | ⚠️ partial | V116 DLQ + exponential retry; no adaptive back-pressure yet |
| ARCH-05 | **Native columnar segment store** | ✅ | Gates 2.1 / 2.5 / 2.6 / 2.8 shipped — on-disk format with dict + bit-pack + Zstd + LZ4 |
| ARCH-06 | Mutable-key overlay | ✅ | Upsert-by-key in ledger + oracle verifier confirms matching column-store state |
| ARCH-07 | Statistics service | ✅ | Gate 4.1 — per-segment sidecar stats |
| ARCH-08 | Logical/physical planner | ✅ | Gate 4.2 — `PlanCoster` + `PlanSelector` |
| ARCH-09 | Vectorized execution | ✅ | Gate 3 — scan + filter + aggregate + group-by |
| ARCH-10 | Incremental maintenance | ✅ | Contribution ledger + materializer + applyContribution + retract |
| ARCH-11 | Scheduler/resource governor | ✅ core | Gate 5.1/5.2/5.3 — governor + spill store; operator-level spill adoption deferred |
| ARCH-12 | Distributed summaries | ✅ | Gate 6.1-6.4 — export, receive, dedup, consolidate, signed |
| ARCH-13 | Analytics serving | ✅ | Full REST surface + nine-section UI |
| ARCH-14 | Security/audit | ✅ | Drilldown audit + PHI masking + HMAC transport trust |
| ARCH-15 | Observability | ⚠️ partial | In-memory counters + EXPLAIN; structured Micrometer export still pending |

Legend: ✅ implemented · ⚠️ partial · ❌ missing

---

## 4. Deployment profile (SRS §2.3)

The existing wiring already supports all four profiles via config:

| Profile | `columnar.rowsPerSegmentCap` | `governor.maxConcurrent` | `governor.maxBytesPerQuery` | `spill.globalByteLimit` |
|---|---|---|---|---|
| Client lightweight | 512 | 1 | 64 MiB | 1 GiB |
| Client enhanced | 1024 | 2 | 256 MiB | 2 GiB |
| Server standard | 4096 | half-CPU | 1 GiB | 10 GiB |
| Server scale-out | 8192 | all-CPU | 4 GiB | configurable |

Row-store reference engine is profile-agnostic.

---

## 5. Remaining work

| Area | SRS ID | Status | Notes |
|---|---|---|---|
| Delta + varint codec | FR-STO-007 | ⏳ deferred | Low marginal value until pilot data shows demand |
| RLE codec | FR-STO-007 | ⏳ deferred | Same |
| Operator spill adoption | FR-QRY-013 | ⏳ | Governor + store done; operators don't spill yet |
| SIMD acceleration | FR-QRY-017 | ⏳ | Scalar path everywhere today |
| Adaptive optimizer feedback | FR-QRY-015 | ⏳ (Gate 7) | Cost model collects stats but doesn't yet learn |
| Auto-propose preaggregations | FR-INC-013 | ⏳ (Gate 7) | Materialisation budget concept not surfaced |
| Dedicated canonical fact builder | ARCH-03 | ⏳ | Fact shape is implicit today |
| Structured Micrometer observability | NFR-OPS-03 | ⏳ | Counters exist in-memory; no Prometheus export |
| Bulk backfill with pause/resume | FR-ING-010 | ⏳ | Not shipped |
| Historical snapshot verification | FR-ING-012 | ✅ `AnalyticsBaselineVerifier` | |
| Reporting-rate / completeness metrics | FR-INC-008 part | ⏳ | Covered inside consolidator per-site; dedicated metric type deferred |

---

## 6. Already-aligned items worth re-labelling

- Contribution ledger idempotency — ✅ **AT-05 + AT-20 regression suite**
  (`AnalyticsReplayAcceptanceTest`).
- Drilldown privacy contract — ✅ V114 audit + masking + min-cell-size
  suppression; verified in `AnalyticsSrsFixtureTest` + `AnalyticsDrilldown
  ServiceTest`.
- Reconciliation classifier — ✅ full §12 taxonomy covered in
  `ReconciliationClassifierTest`.
- Live-DLQ exponential retry — ✅ AN-FR-053 queue closed.
- Replay baseline verifier — ✅ §12 fixture #3.
- Benchmark run history — ✅ §11.1 gates measurable.
- Oracle verification harness — ✅ `AnalyticsColumnarVerifier` compares
  every cell row-by-row.
- Compression evidence — ✅ Zstd + LZ4 + dict + bit-pack with selector
  measurement; 5000-row repeated-label fixture lands below 10% of plain.

All seven stay intact behind Gates 2-6 — the columnar pipeline mirrors
the row-store's semantics and the oracle verifier is the live proof.
