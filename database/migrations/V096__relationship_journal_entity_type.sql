-- Relationships slice 2 follow-up — the Java enum gained
-- RELATIONSHIP in 100b6c0 but the DB CHECK constraint on
-- operation_journal.entity_type still only permitted the five
-- pre-RELATIONSHIP values. Any attempt to enqueue a relationship
-- journal entry (from TrackerRelationshipController.enqueueJournal)
-- was throwing DataIntegrityViolationException → 500 to the
-- client.
--
-- Drop + recreate the constraint with RELATIONSHIP included.
-- Idempotent — the IF EXISTS guard skips the DROP on fresh
-- schemas; the ADD then installs the full list regardless.

SET search_path = der, public;

ALTER TABLE operation_journal
    DROP CONSTRAINT IF EXISTS operation_journal_entity_type_check;
ALTER TABLE operation_journal
    ADD CONSTRAINT operation_journal_entity_type_check
    CHECK (entity_type = ANY (ARRAY[
        'AGGREGATE_DATA_VALUE'::text,
        'EVENT'::text,
        'TRACKED_ENTITY'::text,
        'ENROLLMENT'::text,
        'PROGRAM_STAGE_EVENT'::text,
        'RELATIONSHIP'::text
    ]));
