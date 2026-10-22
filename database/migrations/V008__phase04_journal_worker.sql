-- Phase 04 (ADR-0010): durable journal worker schema extensions.

SET search_path = der, public;

ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL DEFAULT md5(random()::text);
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE operation_journal
    ADD COLUMN IF NOT EXISTS last_response JSONB;

CREATE INDEX IF NOT EXISTS ix_operation_journal_pending_next
    ON operation_journal (next_attempt_at)
    WHERE state = 'PENDING';
