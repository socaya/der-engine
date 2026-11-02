-- V077 — add workflow_run_id to the tracker edge_* tables.
--
-- §2.3.89 R-C/3 — tracker captures (TEIs, enrollments, tracker
-- events) now carry workflow lineage like aggregate + events did
-- in R-C/1 and R-C/2.
--
-- The active write path uses the edge_* tables (not the `enrollment`
-- + `event` tables V072 touched); add the column there. Nullable
-- for now so backfill lands in V078 before we flip NOT NULL.

SET search_path = der, public;

ALTER TABLE edge_enrollment
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_edge_enrollment_wf_run
    ON edge_enrollment (workflow_run_id);

ALTER TABLE edge_tracker_event
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_edge_tracker_event_wf_run
    ON edge_tracker_event (workflow_run_id);

ALTER TABLE tracked_entity
    ADD COLUMN IF NOT EXISTS workflow_run_id UUID
        REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_tracked_entity_wf_run
    ON tracked_entity (workflow_run_id);
