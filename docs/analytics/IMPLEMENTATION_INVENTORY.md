# DER Analytics — implementation inventory

**Document ID:** DER-AN-INV-001
**Baseline:** 2026-11-11 (commit `6b04f9dc`)
**SRS:** DER-AN-SRS-001 (`DER_Native_Analytics_Engine_SRS_Claude.md`)

Gate 0 artefact mandated by SRS §14. Cross-reference every existing
module against SRS §2.2 ARCH-01..15 so the gap is explicit before a
single columnar-store line is written.

---

## 1. Shipped modules — DER row-store-backed engine

All code lives under `server/src/main/java/ug/ac/mak/der/analytics/`
except the client bundle which is under `apps/analytics/src/`.

### 1.1 Expression engine (`engine/expression/*.java` + `engine/*ExpressionContext.java`)

| File | Role |
|---|---|
| `Lexer.java`, `Parser.java`, `Expression.java` | PI expression parser → sealed AST |
| `Evaluator.java` | Interpreter over AST with EventExpressionContext / EnrollmentExpressionContext |
| `ExpressionCompiler.java` | Compile + support-state classification (READY / UNSUPPORTED / PARSE_ERROR) |
| `Token.java` | Lex tokens |

### 1.2 Definitions + catalogue (`engine/*.java`)

| File | Role |
|---|---|
| `AnalyticsDefinition.java` | Persistent record of a metric definition |
| `AnalyticsDefinitionService.java` | CRUD + compile + reserved-code guard |
| `AnalyticsDimension.java` + `DimensionKey.java` | Dimension schema + sorted encoded key |
| `AnalyticsEngineRepository.java` | JDBC for `analytics_definition` + `analytics_cell` + source cursors |
| `AnalyticsSeed.java` | Built-in metrics (DER_EVENT_COUNT, DER_ENROLLMENT_COUNT) |
| `AnalyticsCapabilities.java` | Capability manifest returned by `/capabilities` |
| `AnalyticsPeriodEnumerator.java` | Period window generator (daily/weekly/monthly/yearly) |
| `AnalyticsObservability.java` | In-memory counters for `/quality` + `/admin/jobs` |
| `OptionSetLookup.java` | OptionSet code → label resolver |
| `ProgramIndicatorSyncService.java` | DHIS2 PI auto-import into `analytics_definition` |

### 1.3 Ingestion + materialization (`engine/*.java`)

| File | Role |
|---|---|
| `AnalyticsIngestionService.java` | Operator-triggered batch ingest + ratio contribution emit |
| `AnalyticsLiveIngester.java` | `@TransactionalEventListener` hot-path consumer; now writes to DLQ on failure |
| `AnalyticsMaterializer.java` | Aggregate committed contributions → upsert `analytics_cell`; applyContribution for live |
| `AnalyticsContribution.java` + `AnalyticsContributionRepository.java` | Contribution ledger (upsert by metric + source_key + period + orgUnit + dim) |
| `AnalyticsCell.java` | Materialised cell |
| `AnalyticsSourceEvent.java` | Event the Capture side publishes after commit |

### 1.4 Publication (`publication/*.java`)

| File | Role |
|---|---|
| `PublicationMapping.java` + `PublicationProposal.java` | Mapping DER metric → DHIS2 (dataset, DE, CoC, AoC); proposal state machine |
| `PublicationRepository.java` | JDBC CRUD |
| `PublicationProposalService.java` | Generate from cells; AUTO_APPROVE_EXACT / UNDER_THRESHOLD |
| `PublicationDrainWorker.java` | `@Scheduled` drain of APPROVED proposals → `/api/dataValueSets` |
| `PublicationProperties.java` | `der.analytics.publication.*` tunables |

### 1.5 Drilldown + privacy (`drilldown/*.java`)

| File | Role |
|---|---|
| `AnalyticsDrilldownService.java` | Lineage query; role gate; small-cell suppression; PHI masking |
| `AnalyticsDrilldownAuditRepository.java` | V114 append-only audit log |

### 1.6 Reconciliation (`reconciliation/*.java`)

| File | Role |
|---|---|
| `ReconciliationClassifier.java` | Pure classifier per SRS taxonomy |
| `AnalyticsReconciliation.java` + `AnalyticsReconciliationRepository.java` | V115 persistence |
| `AnalyticsReconciliationService.java` | `compare(List<CentralSample>)` dispatcher |
| `AnalyticsReconciliationFetcher.java` | Polls DHIS2 `/api/analytics` for every PUBLISHED proposal and every PI-backed metric |
| `ReconciliationFetchProperties.java` | Cadence + batch size |

### 1.7 Replay baseline verifier (`replay/*.java`)

| File | Role |
|---|---|
| `AnalyticsBaselineVerifier.java` | Re-aggregate every cell from the ledger, compare to stored, report drift |

### 1.8 Live DLQ (`dlq/*.java`)

| File | Role |
|---|---|
| `AnalyticsLiveDlqEntry.java` + `AnalyticsLiveDlqRepository.java` | V116 persistent failure queue |
| `AnalyticsLiveRetryWorker.java` | Exponential-backoff retry with ceiling + gave-up flag |

### 1.9 Benchmark harness (`benchmark/*.java`)

| File | Role |
|---|---|
| `AnalyticsBenchmarkService.java` | p50/p95/p99/max/mean for `queryCells` (latency) + `ingester.handle` (freshness) |
| `AnalyticsBenchmarkRun.java` + `AnalyticsBenchmarkRepository.java` | V117 run history |
| `AnalyticsBenchmarkFixtureGenerator.java` | Synthetic workload seeder (deterministic, tagged, cleanupable) |

### 1.10 Controller + UI

| File | Role |
|---|---|
| `web/AnalyticsEngineController.java` | REST surface at `/edge-api/v1/analytics/v1/*` |
| `apps/analytics/src/index.tsx` | Nine-section DER-dispatched app (Overview, Explore, Metrics, Tally, Reports, Drilldowns, Saved, Quality, Admin) |

### 1.11 Persistent schema (`database/migrations/V110..V117`)

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

Row-store: everything materialised sits in PostgreSQL tables.

---

## 2. SRS §2.2 module map — what exists vs. what SRS calls for

| ID | Module | Status | Notes |
|---|---|---|---|
| ARCH-01 | Source adapters | ✅ implemented | `AnalyticsSourceEvent` + `@TransactionalEventListener` from Capture |
| ARCH-02 | Metadata/semantics registry | ✅ implemented | Uses existing DER metadata mirror + `AnalyticsDefinition` |
| ARCH-03 | Canonical fact builder | ⚠️ partial | `AnalyticsContribution` IS the canonical fact; no separate normalized fact schema with tombstones |
| ARCH-04 | Ingestion controller | ⚠️ partial | `AnalyticsIngestionService` + `AnalyticsSourceCursor`; DLQ + retry exists; no explicit back-pressure |
| ARCH-05 | Native columnar segment store | ❌ missing | Postgres row-store only. SRS requires on-disk columnar segments. **Primary Gate 2 target.** |
| ARCH-06 | Mutable-key overlay | ⚠️ partial | Upsert-by-key semantics in the contribution ledger covers correctness; no separate overlay |
| ARCH-07 | Statistics service | ❌ missing | No cardinalities / histograms / distinct-count summaries |
| ARCH-08 | Logical/physical planner | ❌ missing | Queries are hand-written JDBC; no AST, cost model or plan selection |
| ARCH-09 | Vectorized execution | ❌ missing | Row-at-a-time via `RowMapper` |
| ARCH-10 | Incremental maintenance | ✅ implemented | Contribution ledger + materializer + applyContribution + retract |
| ARCH-11 | Scheduler/resource governor | ❌ missing | No per-query memory ceilings, no spill, no cancellation |
| ARCH-12 | Distributed summaries | ❌ missing | No site-to-server summary protocol; reconciliation only compares |
| ARCH-13 | Analytics serving | ✅ implemented | `AnalyticsEngineController` + nine-section UI |
| ARCH-14 | Security/audit | ✅ implemented | `EdgeUserPrincipal`, drilldown audit (V114), PHI masking |
| ARCH-15 | Observability | ⚠️ partial | `AnalyticsObservability` has counters; no structured telemetry per SRS NFR-OPS-03 |

Legend: ✅ implemented · ⚠️ partial · ❌ missing

---

## 3. Deployment profile (SRS §2.3)

Current wiring matches **Client lightweight** (single-process, no disk
analytics store, scheduler shares the Capture JVM). The SRS profile
set — Client lightweight, Client enhanced, Server standard,
Server scale-out — is not yet an explicit configuration dimension.
Config knobs exist for individual workers (drain interval, DLQ retry
cadence, benchmark ceiling) but not a profile-level switch.

---

### 2.1 Compression — not yet implemented

The current row-store does no analytics-specific compression beyond
PostgreSQL's default TOAST and generic WAL compression. **Owner
emphasis (2026-11-11):** the engine MUST use the best lossless
compression algorithms per column type so stored and transmitted
data stay professionally small. Candidates for the columnar store
(SRS FR-STO-007):

- **Zstd** at tuned levels for binary payloads + spilled state
  (Apache 2.0, SIMD-friendly, strong ratio).
- **LZ4** for latency-critical scan paths where decompress speed
  dominates ratio.
- Per-column: dictionary + bit-packing for low-cardinality strings,
  delta + varint for monotonic integer ids, RLE for long runs,
  FastPFOR / BtrBlocks techniques where measurably faster.
- Page-level integrity via xxHash + framing so a corrupt block
  surfaces as a hard failure instead of a silently-wrong decode.

Compression decisions are measured per-column in Gate 5 (SRS §14) —
a column swaps codec when the benchmark harness shows a reproducible
win on the reference fixture. No hardcoded codec per metric.

---

## 4. Immediate gaps blocking SRS §17 release criteria

1. **No native columnar segment store** — row-store is authoritative;
   SRS §5 (FR-STO-001..014) requires separate column-oriented
   persisted segments with manifests + atomic generation swap.
2. **No planner / EXPLAIN** — all queries are hand-SQL. SRS §6
   (FR-QRY-001..018) requires a typed plan, cost model and
   `EXPLAIN`/`EXPLAIN ANALYZE`.
3. **No vectorized execution** — SRS §6 (FR-QRY-005) requires column
   batches; our executor is JdbcTemplate row-at-a-time.
4. **No separate materialization manifest** — SRS §7.1 mandates
   `productId` + `generation` + checkpoint vector + checksums +
   lineage. Today, `analytics_cell` carries only `freshnessAt` +
   `quality_state`.
5. **No distributed site-contribution protocol** — SRS §8 (FR-DIS-001..010).
6. **Performance gates (SRS §11.1)** stricter than the previous spec:
   warm materialised p95 ≤ 500 ms (vs. our 2 s target), 100M-fact
   query p95 ≤ 10 s (we have no 100M-fact fixture).

---

## 5. Already-aligned items that just need to be labelled against SRS

- Contribution ledger idempotency (SRS NFR-REL-02 + NFR-PERF-07).
- Drilldown privacy contract (SRS NFR-SEC-01, NFR-SEC-04, NFR-SEC-06).
- Reconciliation classification (SRS NFR-REL-04 + §12 fixture #11).
- Live-DLQ exponential retry (SRS NFR-OPS-01 + NFR-REL-05).
- Replay baseline verifier (SRS NFR-REL-02 + §12 fixture #3).
- Benchmark run history (SRS §11.1 benchmark gates).

These stay as-is in the Gate 1 reference engine. The columnar Gate 2
engine will be built beside them — row-store remains the oracle.
