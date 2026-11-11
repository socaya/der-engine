-- V117 — DER Analytics benchmark run history (spec §13 NFR-002 /
-- NFR-003 / NFR-008). Every admin-triggered benchmark run inserts
-- one row so operators can trend latency + freshness samples
-- across pilots and spot a regression before it ships.

CREATE TABLE IF NOT EXISTS der.analytics_benchmark_run (
    run_id              UUID PRIMARY KEY,
    operation           TEXT NOT NULL CHECK (operation IN (
                            'LATENCY', 'FRESHNESS')),
    iterations          INTEGER NOT NULL,
    p50_millis          INTEGER NOT NULL,
    p95_millis          INTEGER NOT NULL,
    p99_millis          INTEGER NOT NULL,
    max_millis          INTEGER NOT NULL,
    mean_millis         INTEGER NOT NULL,
    max_heap_bytes      BIGINT,
    scope               JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_benchmark_run_recent_idx
    ON der.analytics_benchmark_run (operation, created_at DESC);

COMMENT ON TABLE der.analytics_benchmark_run IS
    'History of admin-triggered analytics benchmarks (spec §13). '
    'Each row carries the operation + iterations + percentile '
    'timings so a pilot team can see whether AN-NFR-002 '
    '(p95 < 2 s dashboard) and AN-NFR-003 (freshness < 10 s) '
    'are being met on this particular hardware over time.';
