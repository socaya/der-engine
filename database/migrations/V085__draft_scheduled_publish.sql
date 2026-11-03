-- E6 — Draft publish scheduling.
--
-- A draft can carry a {@code scheduled_publish_at} timestamp. The
-- ScheduledDraftPublishJob tick scans for rows past-due and runs the
-- same publish logic the operator would invoke manually. On success
-- the schedule is cleared implicitly (the draft row is deleted by
-- the publish handler); on validation failure the draft is retained
-- but the schedule is cleared so the next tick doesn't retry forever
-- against a payload the operator must fix.
--
-- Nullable because almost every draft is manually published; the
-- scheduling flow is opt-in.

SET search_path = der, public;

ALTER TABLE draft
    ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ NULL;

-- Partial index: only the handful of drafts that are actually
-- scheduled participate in the tick's lookup.
CREATE INDEX IF NOT EXISTS ix_draft_scheduled_due
    ON draft (scheduled_publish_at)
    WHERE scheduled_publish_at IS NOT NULL;
