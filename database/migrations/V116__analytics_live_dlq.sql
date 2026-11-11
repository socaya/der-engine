-- V116 — DER Analytics live-ingester dead-letter queue (spec §4.1
-- AN-FR-053 resilient queue + §13 NFR-005 durability). Every
-- failure the live ingester can't apply on the hot path lands in
-- this table before the TransactionalEventListener returns, so
-- the capture caller still sees a clean commit while the engine
-- carries on retrying in the background.
--
-- Retry policy is exponential: attempts 1..5 at 1m, 5m, 30m, 2h,
-- 12h — at attempt 6 the entry becomes "gave_up" and stays in
-- the table for operator review. Operators can explicitly retry
-- (resetting next_retry_at) or delete via the admin endpoint.

CREATE TABLE IF NOT EXISTS der.analytics_live_dlq (
    dlq_id                UUID PRIMARY KEY,
    source_type           TEXT NOT NULL CHECK (source_type IN
                                ('EVENT','ENROLLMENT')),
    source_key            VARCHAR(24) NOT NULL,
    source_version        BIGINT NOT NULL,
    occurred_on           DATE NOT NULL,
    org_unit_uid          VARCHAR(24) NOT NULL,
    status                TEXT,
    error_summary         TEXT NOT NULL,
    attempt_count         INTEGER NOT NULL DEFAULT 1,
    next_retry_at         TIMESTAMPTZ NOT NULL,
    gave_up               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT analytics_live_dlq_unique
        UNIQUE (source_type, source_key, source_version)
);

CREATE INDEX IF NOT EXISTS analytics_live_dlq_due_idx
    ON der.analytics_live_dlq (gave_up, next_retry_at);

COMMENT ON TABLE der.analytics_live_dlq IS
    'Failure queue for AnalyticsLiveIngester. A row lands here '
    'instead of silently vanishing when applyContribution raises. '
    'Exponential-backoff retry worker drains due entries; after '
    'the configured ceiling (default attempt 6) the row is marked '
    'gave_up and surfaces in the admin UI for manual action.';
