-- V055: workflow-run submission tracking.
--
-- When a workflow run completes (all required steps have contributed
-- and dependencies are satisfied), the WorkflowRunCoordinator compiles
-- the submission via WorkflowCompiler and hands it off to
-- operation_journal. These two columns record that hand-off:
--
--   submission_journal_op_id — the operation_journal.operation_id so
--                              the run can be joined back to its
--                              outbound DHIS2 push
--   submission_error         — the error message if compile or
--                              hand-off failed; the run stays AWAITING
--                              so an operator can retry

SET search_path = der, public;

ALTER TABLE capture_workflow_run
    ADD COLUMN IF NOT EXISTS submission_journal_op_id  UUID
        REFERENCES operation_journal(operation_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submission_error          TEXT;

CREATE INDEX IF NOT EXISTS idx_capture_workflow_run_journal_op
    ON capture_workflow_run (submission_journal_op_id)
    WHERE submission_journal_op_id IS NOT NULL;
