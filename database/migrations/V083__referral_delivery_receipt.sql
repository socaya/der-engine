-- V083 — ADR-0027 D-RHO-4 + Phase 10.3 extension.
--
-- Referral delivery receipt: when the destination edge finishes
-- processing a referred record it POSTs /edge-api/v1/referrals/ack
-- with the origin's operationId. The origin stamps these two
-- columns so the operator-facing /journal/operations/{id} view can
-- show "DELIVERED to ou-XYZ at 14:03" instead of just "ACCEPTED".
--
-- Partial index limits upkeep cost — referral rows are a small
-- fraction of operation_journal; the index only tracks rows where
-- a next-hop is actually set.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS referral_delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referral_receipt_id TEXT;

CREATE INDEX IF NOT EXISTS ix_operation_journal_referral_outstanding
    ON operation_journal (updated_at)
    WHERE next_hop_org_unit_uid IS NOT NULL
      AND referral_delivered_at IS NULL;

COMMENT ON COLUMN operation_journal.referral_delivered_at IS
    'ADR-0027 D-RHO-4 — when the destination edge acknowledged ingest.';
COMMENT ON COLUMN operation_journal.referral_receipt_id IS
    'Destination-side identifier so operators can trace which edge sent the ack.';
