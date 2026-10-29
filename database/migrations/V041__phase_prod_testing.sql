-- V041: §9 Testing (chaos / load / soak / golden deployment)
--
-- Records every operator-triggered or script-driven testing run so the
-- site can prove continuous validation of chaos tolerance, load limits,
-- and soak endurance.

CREATE TABLE der.testing_run (
    run_id            UUID PRIMARY KEY,
    kind              TEXT NOT NULL CHECK (kind IN ('CHAOS','LOAD','SOAK','GOLDEN')),
    scenario          TEXT NOT NULL,
    started_at        TIMESTAMPTZ NOT NULL,
    finished_at       TIMESTAMPTZ,
    outcome           TEXT NOT NULL DEFAULT 'RUNNING'
                      CHECK (outcome IN ('RUNNING','PASS','FAIL','ABORTED')),
    duration_ms       BIGINT,
    requests_total    BIGINT,
    requests_failed   BIGINT,
    latency_p50_ms    BIGINT,
    latency_p95_ms    BIGINT,
    latency_p99_ms    BIGINT,
    throughput_rps    DOUBLE PRECISION,
    details           JSONB,
    triggered_by      TEXT
);

CREATE INDEX idx_testing_run_kind_started
    ON der.testing_run (kind, started_at DESC);
CREATE INDEX idx_testing_run_outcome
    ON der.testing_run (outcome);
