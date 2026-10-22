-- Phase 10 / der-1.1.0 (ADR-0016): local approval gate on the journal.
--
-- Writes land in operation_journal with requires_approval=TRUE when the
-- der.approval.require.<domain> config is on; the journal worker filter
-- excludes those rows until a REVIEWER (or ADMIN) sets approved_at.
-- Reject records rejected_at + reason; worker filter excludes those too.
-- No automatic undo of the business write — ADR-0016 §non-goals.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES edge_user(user_id);
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES edge_user(user_id);
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- A row cannot be both approved and rejected.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'operation_journal_approve_xor_reject'
    ) THEN
        ALTER TABLE operation_journal
            ADD CONSTRAINT operation_journal_approve_xor_reject
            CHECK (approved_at IS NULL OR rejected_at IS NULL);
    END IF;
END
$$;

-- Partial index for the "awaiting approval" admin query.
CREATE INDEX IF NOT EXISTS ix_operation_journal_awaiting_approval
    ON operation_journal (created_at ASC)
    WHERE requires_approval = TRUE
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND state = 'PENDING';
