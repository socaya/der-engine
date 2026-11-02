-- V082 — ADR-0034 inbound data pull cursor.
--
-- Each (entity_type, org_unit_uid) pair tracks the lastUpdated
-- watermark DER has consumed from central. The DataPullJob reads
-- the cursor, issues a bounded /api/dataValueSets?lastUpdated= style
-- query, merges the response, then advances the cursor to the max
-- lastUpdated returned. First-time cursor is NULL — the puller
-- fetches everything for that OU subtree ("initial reconciliation").
--
-- consecutive_failures + last_error let the UI surface stuck
-- cursors to the operator (e.g. "Aggregate pull for ou=HL2zXaIULBe
-- hasn't advanced in 3h — central responded 502") without needing a
-- separate monitoring plane.
--
-- The three entity_type values ('AGGREGATE', 'EVENT', 'TRACKER') are
-- namespaced apart from operation_journal.entity_type on purpose:
-- the pull cursor rolls up TEI + enrolment + stage event into a
-- single tracker cursor so one central tracker tick advances the
-- whole family consistently.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS data_pull_cursor (
    entity_type           TEXT NOT NULL
        CHECK (entity_type IN ('AGGREGATE', 'EVENT', 'TRACKER')),
    org_unit_uid          TEXT NOT NULL,
    last_pulled_at        TIMESTAMPTZ,
    last_cursor           TEXT,
    consecutive_failures  INT NOT NULL DEFAULT 0,
    last_error            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_type, org_unit_uid)
);

-- Audit event marker: emitted every time the puller overwrites a
-- terminal local row with central's authoritative value. Operators
-- grepping the audit log for DATA_PULL_OVERWRITE see every state
-- change the puller caused — matches ADR-0034 "audit log every pull
-- overwrite" mitigation.
COMMENT ON TABLE data_pull_cursor IS
    'ADR-0034 inbound data pull watermark; one row per (entity_type, org_unit_uid)';
