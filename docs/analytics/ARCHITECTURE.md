# DER Analytics — target architecture

**Document ID:** DER-AN-ARCH-001
**Baseline:** 2026-11-11
**SRS:** DER-AN-SRS-001

Gate 0 architectural record. Captures *why* DER Analytics evolves
into a dual-engine shape: the Postgres row-store stays as the
correctness oracle, and a new in-process native columnar engine
(ClickHouse / Doris principles, no external OLAP server) owns the
hot read path.

---

## 1. Two engines, one source of truth

```
Capture (TransactionalEventListener AFTER_COMMIT)
   │
   ▼
 AnalyticsLiveIngester ─────────────────┐
   │                                     │ (durable fact
   │ (row-store contribution ledger)     │  canonicalisation)
   ▼                                     ▼
 analytics_contribution (Postgres)   fact-builder  ──► canonical facts
   │   ← FR-QRY-005 oracle                              │
   ▼                                                    ▼
 analytics_cell (Postgres)                     Native columnar segments
   │                                                    │
   ▼                                                    ▼
 queryCells (JdbcTemplate)                    Vectorised executor
   │                                                    │
   └────────── results   ◄──── planner ────────────────┘
                              (chooses row vs. column)
```

**Correctness contract.** For every query, the columnar executor
must produce the same result as the row-store oracle for the same
(metadata-revision, source-checkpoint) tuple. The baseline verifier
(`AnalyticsBaselineVerifier`) generalises: when a columnar plan
disagrees with the oracle, the plan is rejected and the operator
sees a classified drift (SRS NFR-REL-02, FR-QRY-006).

**Why keep the row-store.** Three reasons:

1. **It is already correct.** All §12 fixtures that we cover pass
   against it; discarding it is pure regression risk.
2. **It is the oracle.** Property-based tests (SRS §13.1) compare
   columnar vs row-store on every batch size + reorder permutation.
3. **It stays authoritative for low-cardinality writes.** The
   contribution ledger owns idempotency (upsert-by-source-key); the
   columnar store materialises from it, it never receives writes
   directly.

---

## 2. Module split per SRS §2.2

| SRS ID | Module | Current wiring | Target |
|---|---|---|---|
| ARCH-01 | Source adapters | `AnalyticsSourceEvent` listener | unchanged — the fact builder sits downstream |
| ARCH-02 | Metadata registry | DER metadata mirror + `AnalyticsDefinition` | unchanged |
| ARCH-03 | Canonical fact builder | implicit inside `AnalyticsLiveIngester` | **extract** into `analytics/fact/*` with typed record shapes + tombstones (new) |
| ARCH-04 | Ingestion controller | per-worker tunables | add back-pressure + poison-record quarantine (FR-ING-011) |
| ARCH-05 | **Native columnar segment store** | ❌ | new `analytics/column/*` — see §3 |
| ARCH-06 | Mutable-key overlay | upsert-by-key in ledger | columnar overlay for current-state (§4) |
| ARCH-07 | Statistics service | ❌ | new `analytics/stats/*` — Gate 5 |
| ARCH-08 | Logical/physical planner | ❌ | new `analytics/plan/*` — Gate 4 |
| ARCH-09 | Vectorised execution | ❌ | new `analytics/exec/*` — Gate 3 |
| ARCH-10 | Incremental maintenance | `AnalyticsMaterializer` | unchanged; emits columnar deltas as well as row-store cells |
| ARCH-11 | Scheduler / governor | per-worker `@Scheduled` | per-query governor — Gate 5 |
| ARCH-12 | Distributed summaries | ❌ | Gate 6 |
| ARCH-13 | Analytics serving | `AnalyticsEngineController` | unchanged — planner chooses which engine answers |
| ARCH-14 | Security / audit | V114 drilldown audit | columnar paths honour the same filters (NFR-SEC-01) |
| ARCH-15 | Observability | counters | structured Micrometer export + `EXPLAIN ANALYZE` — Gate 5 |

---

## 3. Columnar segment store (SRS §5)

### 3.1 File layout

```
<analytics-root>/
  catalog/metadata-revisions/{revision}.json
  manifests/{generation}.json              ← atomic generation swap
  facts/{domain}/{site}/{period-bucket}/segment-{N}.col
  indexes/{segment}/zone-maps.bin
  indexes/{segment}/sparse-marks.bin
  materializations/{productId}/{revision}/state-{N}.bin
  checkpoints/{source}/{partition}.json
  spill/{query-id}/...
```

Segment files are append-only once published. A publication is an
fsync-and-rename into `manifests/{generation}.json` with a checksum;
readers only observe segments that appear in a published manifest
(FR-STO-006).

### 3.2 Per-column encoding

Column type → codec is a decision made at segment write time by a
measurement step: the writer emits a small sample page under each
candidate and picks the codec with the best compressed-size × scan-
speed score for the observed values. The chosen codec is recorded in
the segment header. No codec is hardcoded per column.

Codec families implemented:

- **Dictionary + bit-packing** for low-cardinality strings (OU UIDs,
  option codes, status).
- **Delta + varint** for monotonic integers (source versions,
  period keys when sorted).
- **RLE** for long runs (status after sorting by period, boolean
  eligibility flags).
- **Zstd** at tuned levels for high-entropy numeric / text blocks.
- **LZ4** on latency-critical scan paths where decompress speed
  dominates ratio.
- **xxHash** page-level integrity framing so a corrupt page is a
  hard failure, never a silently-wrong decode.

**Owner emphasis (2026-11-11):** compression is a first-class
concern, not a Gate 5 nice-to-have. Every column lands with a
chosen codec and a compressed-size assertion in the test harness.
Uncompressed baseline + compressed size are both recorded in
`PERFORMANCE_BENCHMARKS.md`.

### 3.3 Statistics per segment

- Row count, byte count, min + max per column.
- Null bitmap + null frequency.
- Distinct-count sketch (bounded cardinality) per dimension column.
- Zone maps per sorted/clustered column.
- Sparse marks every N rows for fast seek.

### 3.4 Partitioning

Partition key is `(domain, site, period-bucket)`. Period buckets are
coarse enough that a typical scan touches ≤ 12 segments on a single-
site deployment. Partitioning never shards within a single logical
metric unless the segment exceeds a configured size threshold.

---

## 4. Mutable-key overlay (SRS FR-STO-009)

Once a segment is published it is immutable. Mutations are first applied to
the authoritative contribution ledger and materialized row-store cells. The
scheduled columnar lifecycle then writes a complete shadow generation,
verifies every row in both directions, and atomically publishes the manifest
only when drift is zero. A retention compactor preserves the configured
rollback window and deletes manifests, segments, and statistics sidecars no
longer referenced by a retained generation (FR-STO-010).

This full-snapshot strategy deliberately favours correctness and recovery
simplicity at the current scale. Delta-segment overlays remain a future
throughput optimization, not a prerequisite for correct mutation handling.

---

## 5. Query path

### 5.1 Logical plan

Parser produces a typed AST (filter, projection, scan, aggregate,
join, sort, limit, drilldown). Semantic resolution binds metric UIDs,
periods, org units, dimensions, user scope. Metadata-revision becomes
part of the plan key; a plan prepared under revision R is invalid
against revision R+1.

### 5.2 Plan selection

The planner evaluates each valid plan against the current statistics
+ materialisations + security scope:

1. If a materialised product covers the request at a compatible
   freshness → return cached product.
2. Else if a columnar segment pruning exists → vectorised scan.
3. Else fall back to the row-store oracle (FR-QRY-005).

Fallback is recorded in `EXPLAIN` so an operator sees when the
columnar path was unable to serve.

### 5.3 Vectorised execution

- Column batches of fixed row count (configurable; initial 1024).
- Scalar implementations of every operator — no SIMD requirement.
- SIMD-accelerated paths added later behind a verified scalar
  fallback (FR-QRY-017).
- Bounded workers (`FR-QRY-011`), spill-to-disk under memory pressure
  (`FR-QRY-013`), cancellation cleanup (`FR-QRY-013`).

### 5.4 EXPLAIN

`POST /admin/analytics/explain` returns:

- Chosen plan tree with estimated rows / cost per node.
- Materialisation / cache coverage.
- Source checkpoint + metadata revision.
- Pruned segment count.
- `EXPLAIN ANALYZE` adds wall time, CPU time, bytes scanned, spills
  and cache hits per operator (Gate 5).

---

## 6. Non-negotiable invariants

1. The columnar engine is **in-process**. No external OLAP server,
   no network hop (SRS §0).
2. Postgres row-store remains authoritative for operational records.
3. A columnar result that disagrees with the row-store oracle is a
   hard failure the test harness catches; such a plan is disabled
   until a fix lands.
4. Every segment landing on disk carries a checksum + codec id in
   its header. Corruption is detected on first read, not after the
   fact (FR-STO-006).
5. **Compression is observable** — every segment publishes its
   compressed + uncompressed size; the admin UI exposes a ratio
   report so operators can see the compression working.
6. Privacy contracts (small-cell suppression + PHI masking) apply
   identically to both engines.

---

## 7. Deployment profiles → config dimensions

The SRS §2.3 profile set is captured as runtime properties under
`der.analytics.profile`:

| Profile | `.batch.rows` | `.store.diskQuotaBytes` | `.exec.parallelism` | `.scheduler.priority` |
|---|---|---|---|---|
| Client lightweight | 512 | 2 GB | 1 | background |
| Client enhanced | 1024 | 10 GB | 2 | normal |
| Server standard | 4096 | 50 GB | half CPU | normal |
| Server scale-out | 8192 | configurable | all CPU | normal |

The columnar engine reads these; the row-store oracle is unaffected.

---

## 8. Open architectural questions

- **Arrow compatibility.** We intend typed column-batch interfaces
  that are Arrow-compatible so a future Visualiser path can consume
  batches directly. Full Arrow Java dependency is deferred until it
  shows a benefit the scalar path can't match.
- **On-disk encryption.** Transport is HTTPS; at-rest encryption of
  segments depends on the pilot's filesystem policy. Default: rely
  on existing DER disk-level encryption; segment-level encryption is
  a Gate 5 opt-in.
- **Multi-tenant site isolation.** Single-tenant today. When a
  multi-site deployment lands, segments namespace on `site` already;
  caches will need site-scoped keys (SRS NFR-SEC-07).
