-- DER events + tracker + extended metadata mirror — Phase 03.6b under ADR-0007.
--
-- Mirror additions (same pattern as V002): COC, program stages, program-stage
-- data elements, tracked-entity attributes, program rules, program-rule
-- actions. These feed:
--   * the aggregate COC validator (DEFAULT_COC "HllvX50cXC0" seeded
--     automatically if absent so Phase 03.5 writes continue to work on first
--     boot after this migration);
--   * the rules engine (program rules + actions);
--   * the event + tracker services (program stages, PSDE, TEA).
--
-- Edge write tables: tracked_entity_instance, tracked_entity_attribute_value,
-- enrollment, event, event_data_value. Follows the Phase 03.5 pattern with
-- compound-key uniqueness + optimistic version column.

SET search_path = der, public;

-- Mirror additions -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS metadata_category_option_combo (
    dhis2_uid TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category_combo_uid TEXT,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_program_stage (
    dhis2_uid TEXT PRIMARY KEY,
    program_uid TEXT NOT NULL REFERENCES metadata_program(dhis2_uid),
    display_name TEXT NOT NULL,
    repeatable BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_program_stage_data_element (
    program_stage_uid TEXT NOT NULL REFERENCES metadata_program_stage(dhis2_uid),
    data_element_uid TEXT NOT NULL REFERENCES metadata_data_element(dhis2_uid),
    compulsory BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT,
    PRIMARY KEY (program_stage_uid, data_element_uid)
);

CREATE TABLE IF NOT EXISTS metadata_tracked_entity_attribute (
    dhis2_uid TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    unique_attribute BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_program_rule (
    dhis2_uid TEXT PRIMARY KEY,
    program_uid TEXT NOT NULL REFERENCES metadata_program(dhis2_uid),
    display_name TEXT NOT NULL,
    priority INT,
    condition TEXT NOT NULL,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metadata_program_rule_action (
    dhis2_uid TEXT PRIMARY KEY,
    program_rule_uid TEXT NOT NULL REFERENCES metadata_program_rule(dhis2_uid),
    action_type TEXT NOT NULL,
    data_element_uid TEXT,
    tracked_entity_attribute_uid TEXT,
    data_expression TEXT,
    content TEXT,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_metadata_program_stage_program
    ON metadata_program_stage (program_uid);
CREATE INDEX IF NOT EXISTS ix_metadata_program_rule_program
    ON metadata_program_rule (program_uid);
CREATE INDEX IF NOT EXISTS ix_metadata_program_rule_action_rule
    ON metadata_program_rule_action (program_rule_uid);

-- Seed DEFAULT_COC if the mirror has never been synced ----------------------

INSERT INTO metadata_category_option_combo
    (dhis2_uid, display_name, category_combo_uid, payload, snapshot_id)
VALUES ('HllvX50cXC0', 'default', NULL,
        '{"id":"HllvX50cXC0","displayName":"default"}'::jsonb, 0)
ON CONFLICT (dhis2_uid) DO NOTHING;

-- Edge write tables ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS tracked_entity_instance (
    tei_id UUID PRIMARY KEY,
    tracked_entity_type_uid TEXT NOT NULL REFERENCES metadata_tracked_entity_type(dhis2_uid),
    org_unit_uid TEXT NOT NULL REFERENCES metadata_organisation_unit(dhis2_uid),
    created_by UUID NOT NULL REFERENCES edge_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tei_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tracked_entity_attribute_value (
    tei_id UUID NOT NULL REFERENCES tracked_entity_instance(tei_id) ON DELETE CASCADE,
    tracked_entity_attribute_uid TEXT NOT NULL REFERENCES metadata_tracked_entity_attribute(dhis2_uid),
    value_text TEXT NOT NULL,
    PRIMARY KEY (tei_id, tracked_entity_attribute_uid)
);

CREATE TABLE IF NOT EXISTS enrollment (
    enrollment_id UUID PRIMARY KEY,
    tei_id UUID NOT NULL REFERENCES tracked_entity_instance(tei_id),
    program_uid TEXT NOT NULL REFERENCES metadata_program(dhis2_uid),
    org_unit_uid TEXT NOT NULL REFERENCES metadata_organisation_unit(dhis2_uid),
    enrolled_at DATE NOT NULL,
    incident_at DATE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
    created_by UUID NOT NULL REFERENCES edge_user(user_id),
    enrollment_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_enrollment_tei ON enrollment (tei_id);
CREATE INDEX IF NOT EXISTS ix_enrollment_program ON enrollment (program_uid);

CREATE TABLE IF NOT EXISTS event (
    event_id UUID PRIMARY KEY,
    enrollment_id UUID REFERENCES enrollment(enrollment_id),
    program_uid TEXT NOT NULL REFERENCES metadata_program(dhis2_uid),
    program_stage_uid TEXT NOT NULL REFERENCES metadata_program_stage(dhis2_uid),
    org_unit_uid TEXT NOT NULL REFERENCES metadata_organisation_unit(dhis2_uid),
    occurred_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN
            ('ACTIVE','COMPLETED','VISITED','SCHEDULE','OVERDUE','SKIPPED')),
    attribute_option_combo_uid TEXT NOT NULL DEFAULT 'HllvX50cXC0',
    created_by UUID NOT NULL REFERENCES edge_user(user_id),
    event_version INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_event_program ON event (program_uid);
CREATE INDEX IF NOT EXISTS ix_event_program_stage ON event (program_stage_uid);
CREATE INDEX IF NOT EXISTS ix_event_enrollment ON event (enrollment_id);
CREATE INDEX IF NOT EXISTS ix_event_org_unit ON event (org_unit_uid);

CREATE TABLE IF NOT EXISTS event_data_value (
    event_id UUID NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    data_element_uid TEXT NOT NULL REFERENCES metadata_data_element(dhis2_uid),
    value_text TEXT NOT NULL,
    PRIMARY KEY (event_id, data_element_uid)
);
