-- DER aggregate writes + operation journal — Phase 03.5 under ADR-0004.
--
-- aggregate_data_value: local store for POST /api/dataValueSets submissions.
-- The DHIS2 compound key (dataElement, orgUnit, period, categoryOptionCombo,
-- attributeOptionCombo) is enforced as unique so FR-06-05 "detect stale or
-- competing writes to identical aggregate-value keys" is honoured at the DB
-- level — a second commit for the same key is a conflict, not a silent
-- overwrite. value_version increments on every update so Phase 04 can detect
-- stale writes at outbound-sync time.
--
-- operation_journal: minimal state machine for FR-11-02. Phase 03.5 only
-- writes PENDING; Phase 04 adds the worker that transitions through
-- IN_FLIGHT / CENTRAL_ACCEPTED / RETRYABLE / etc.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS aggregate_data_value (
    value_id                   UUID PRIMARY KEY,
    data_element_uid           TEXT NOT NULL REFERENCES metadata_data_element(dhis2_uid),
    org_unit_uid               TEXT NOT NULL REFERENCES metadata_organisation_unit(dhis2_uid),
    period_iso                 TEXT NOT NULL,
    category_option_combo_uid  TEXT NOT NULL DEFAULT 'HllvX50cXC0',  -- DHIS2 'default'
    attribute_option_combo_uid TEXT NOT NULL DEFAULT 'HllvX50cXC0',
    value_text                 TEXT NOT NULL,
    comment                    TEXT,
    submitted_by               UUID NOT NULL REFERENCES edge_user(user_id),
    submitted_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    value_version              INT NOT NULL DEFAULT 1,
    CONSTRAINT aggregate_data_value_value_nonempty CHECK (length(trim(value_text)) > 0),
    CONSTRAINT aggregate_data_value_period_nonempty CHECK (length(trim(period_iso)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_aggregate_data_value_compound
    ON aggregate_data_value (
        data_element_uid, org_unit_uid, period_iso,
        category_option_combo_uid, attribute_option_combo_uid
    );
CREATE INDEX IF NOT EXISTS ix_aggregate_data_value_submitted_by
    ON aggregate_data_value (submitted_by, submitted_at DESC);


CREATE TABLE IF NOT EXISTS operation_journal (
    operation_id      UUID PRIMARY KEY,
    entity_type       TEXT NOT NULL CHECK (entity_type IN (
        'AGGREGATE_DATA_VALUE',
        'EVENT',
        'TRACKED_ENTITY',
        'ENROLLMENT',
        'PROGRAM_STAGE_EVENT'
    )),
    entity_ref        TEXT NOT NULL,         -- DHIS2-style identifier or compound key
    payload_json      JSONB NOT NULL,
    state             TEXT NOT NULL CHECK (state IN (
        'PENDING',
        'IN_FLIGHT',
        'CENTRAL_ACCEPTED',
        'CENTRAL_REJECTED',
        'RETRYABLE',
        'UNKNOWN_OUTCOME',
        'CONFLICT_REVIEW'
    )),
    attempt_count     INT NOT NULL DEFAULT 0,
    last_error        TEXT,
    submitted_by      UUID REFERENCES edge_user(user_id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_operation_journal_state
    ON operation_journal (state, created_at)
    WHERE state IN ('PENDING', 'RETRYABLE', 'UNKNOWN_OUTCOME');
CREATE INDEX IF NOT EXISTS ix_operation_journal_entity
    ON operation_journal (entity_type, entity_ref, created_at DESC);
