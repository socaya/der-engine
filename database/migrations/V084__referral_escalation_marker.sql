-- V084 — Phase 10.3.2 referral escalation marker.
--
-- The referral ack endpoint (V083) lets destination edges stamp
-- delivery. This migration adds the complementary origin-side
-- bookkeeping: when a referral has been outstanding past the
-- configured threshold without an ack, a scheduled job emits one
-- REFERRAL_UNDELIVERED audit event and stamps referral_escalated_at
-- so the operator is alerted exactly once per row (not every tick).
--
-- The existing partial index ix_operation_journal_referral_outstanding
-- already covers (next_hop set, delivered_at null). Replace it with
-- a narrower one that also excludes already-escalated rows, so the
-- escalation job's scan only reads work it hasn't done yet.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS referral_escalated_at TIMESTAMPTZ;

DROP INDEX IF EXISTS der.ix_operation_journal_referral_outstanding;
CREATE INDEX IF NOT EXISTS ix_operation_journal_referral_outstanding
    ON operation_journal (updated_at)
    WHERE next_hop_org_unit_uid IS NOT NULL
      AND referral_delivered_at IS NULL
      AND referral_escalated_at IS NULL;

COMMENT ON COLUMN operation_journal.referral_escalated_at IS
    'Phase 10.3.2 — timestamp of the first REFERRAL_UNDELIVERED audit event.';
