-- Phase 13 / der-1.4.0-alpha.1 (ADR-0027): chain-via-hub referral column.
-- Alpha.1 ships the capture surface only; outbound encoding + inbound
-- poll land in alpha.2+. No FK to org_unit_mirror — see D-RHO-3.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS next_hop_org_unit_uid TEXT;

CREATE INDEX IF NOT EXISTS ix_operation_journal_next_hop
    ON operation_journal (next_hop_org_unit_uid)
    WHERE next_hop_org_unit_uid IS NOT NULL;
