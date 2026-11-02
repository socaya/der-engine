-- V072 — link every data-plane row to its originating workflow run.
--
-- Policy decision §2.3.85: workflows capture facility data; every
-- domain row and every outbox entry should know which workflow run
-- produced it so admins can trace a value back to a run, filter the
-- Sync queue by run, and prove end-to-end "run → row → push" chain.
--
-- The column is nullable because not every write originates in a
-- workflow — the DHIS2 Data Entry web app, referral ingestion, and
-- the dataValueSets endpoint can all write ad-hoc values. When a
-- write does come from a workflow run, the service layer threads
-- the UUID through. Pre-feature rows stay null.
--
-- FK: ON DELETE SET NULL — if a workflow run is purged, data stays
-- but loses its lineage trail (not deleted — DHIS2 data retention
-- is independent of workflow housekeeping).

SET search_path = der, public;

-- 1. Aggregate values
ALTER TABLE aggregate_data_value
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_aggregate_data_value_wf_run
    ON aggregate_data_value (workflow_run_id, submitted_at DESC);

-- 2. Events + event data values
ALTER TABLE event
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_event_wf_run
    ON event (workflow_run_id);

-- 3. Enrolments
ALTER TABLE enrollment
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_enrollment_wf_run
    ON enrollment (workflow_run_id);

-- 4. Tracked entity instances
ALTER TABLE tracked_entity_instance
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_tracked_entity_instance_wf_run
    ON tracked_entity_instance (workflow_run_id);

-- 5. Operation journal (makes the Sync chip filter real)
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_operation_journal_wf_run
    ON operation_journal (workflow_run_id, created_at DESC);

-- 6. Drafts (makes the /data/drafts chip filter real)
ALTER TABLE draft
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_draft_wf_run
    ON draft (workflow_run_id);
