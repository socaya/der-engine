-- V081 — expose the referral-ingest workflow run id on the inbox
-- row so the admin UI can drill from a referral into the workflow
-- run that produced the local record(s).
--
-- Rationale §2.3.110 R-AE: `ReferralDetail` showed a referral under
-- review as plain text ("Event · abc123") with no way to open the
-- record it produced on acceptance. The ingest already creates a
-- system workflow run (`SystemWorkflowService.ensureReferralIngestRun`)
-- keyed by inbox id — we just didn't carry the run id back onto the
-- referral row. One UUID column + a FK closes the loop so the UI
-- can offer "Workflows › View ingest run ↗".
--
-- Nullable because historical referrals accepted before this
-- migration don't have a captured run id. Non-NULL on all new
-- ACCEPTED rows.

SET search_path = der, public;

ALTER TABLE referral_inbox
    ADD COLUMN IF NOT EXISTS ingest_run_id UUID
        REFERENCES capture_workflow_run(run_id)
        ON DELETE SET NULL;

COMMENT ON COLUMN referral_inbox.ingest_run_id IS
'When a referral is accepted the ingest service creates/reuses a '
'system workflow run; its id lands here so operators can drill '
'from the referral detail into the resulting workflow run. NULL '
'for PENDING / DISMISSED rows and for pre-V081 historical rows.';
