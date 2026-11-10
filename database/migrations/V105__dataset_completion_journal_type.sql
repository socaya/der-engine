-- SM-1a — allow AGGREGATE_DATASET_COMPLETION in
-- operation_journal.entity_type.
--
-- Mirrors V096 (RELATIONSHIP) and V098 (ENROLMENT_NOTE). The Java
-- enum gains AGGREGATE_DATASET_COMPLETION but the DB CHECK
-- constraint still rejects it; this migration keeps them in
-- lockstep. Without this migration DatasetCompletionController.mark()
-- throws DataIntegrityViolationException and the completion marker
-- never reaches central (silent data loss that this gap-fix is
-- specifically intended to close).

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
        'ENROLMENT_NOTE'::text,
        'AGGREGATE_DATASET_COMPLETION'::text
    ]));
