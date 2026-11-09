-- DER Capture — allow ENROLMENT_NOTE in operation_journal.entity_type.
--
-- Mirrors V096 (which added RELATIONSHIP). The Java enum gains
-- ENROLMENT_NOTE but the DB CHECK constraint still rejects it; this
-- migration keeps them in lockstep.

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
        'RELATIONSHIP'::text,
        'ENROLMENT_NOTE'::text
    ]));
