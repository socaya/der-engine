-- V027 — tracker lifecycle beyond entity capture, der-2.0.3-alpha.1.
--
-- Adds edge-side enrollment + event + relationship tables with full
-- referential integrity against the existing tracked_entity (V025).
-- Covers FR-08-06 (relationships), FR-08-10 (dependency ordering),
-- FR-08-12 (audit) and lays the surface for FR-08-07/08/09.
--
-- Named with the der_ / edge_ prefix pattern so these don't collide
-- with the V005 mirror tables (enrollment/event — read-only reflection
-- of central's tracker data via metadata sync). These new tables are
-- DER's own capture state, writable at the edge.

CREATE TABLE IF NOT EXISTS der.edge_enrollment (
    enrollment_uid        VARCHAR(11) PRIMARY KEY,
    tei_uid               TEXT NOT NULL REFERENCES der.tracked_entity(tei_uid) ON DELETE CASCADE,
    program_uid           VARCHAR(11) NOT NULL,
    org_unit_uid          VARCHAR(11) NOT NULL,
    status                VARCHAR(16) NOT NULL
                            CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
    enrollment_date       DATE NOT NULL,
    incident_date         DATE,
    stored_by_dhis2_uid   VARCHAR(11),
    created_by            UUID NOT NULL REFERENCES der.edge_user(user_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    version               INT NOT NULL DEFAULT 1,
    CONSTRAINT edge_enrollment_uid_format
        CHECK (enrollment_uid ~ '^[A-Za-z][A-Za-z0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_edge_enrollment_tei ON der.edge_enrollment(tei_uid);
CREATE INDEX IF NOT EXISTS idx_edge_enrollment_program ON der.edge_enrollment(program_uid);
CREATE INDEX IF NOT EXISTS idx_edge_enrollment_status ON der.edge_enrollment(status);

CREATE TABLE IF NOT EXISTS der.edge_tracker_event (
    event_uid             VARCHAR(11) PRIMARY KEY,
    enrollment_uid        VARCHAR(11) REFERENCES der.edge_enrollment(enrollment_uid) ON DELETE CASCADE,
    program_uid           VARCHAR(11) NOT NULL,
    program_stage_uid     VARCHAR(11) NOT NULL,
    org_unit_uid          VARCHAR(11) NOT NULL,
    status                VARCHAR(16) NOT NULL
                            CHECK (status IN ('ACTIVE','COMPLETED','VISITED','SCHEDULED','OVERDUE','SKIPPED')),
    occurred_date         DATE NOT NULL,
    data_values           JSONB NOT NULL DEFAULT '{}'::jsonb,
    stored_by_dhis2_uid   VARCHAR(11),
    created_by            UUID NOT NULL REFERENCES der.edge_user(user_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    version               INT NOT NULL DEFAULT 1,
    CONSTRAINT edge_event_uid_format
        CHECK (event_uid ~ '^[A-Za-z][A-Za-z0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS idx_edge_tracker_event_enrollment
    ON der.edge_tracker_event(enrollment_uid);
CREATE INDEX IF NOT EXISTS idx_edge_tracker_event_program_stage
    ON der.edge_tracker_event(program_stage_uid);
CREATE INDEX IF NOT EXISTS idx_edge_tracker_event_occurred
    ON der.edge_tracker_event(occurred_date);

CREATE TABLE IF NOT EXISTS der.edge_tracker_relationship (
    relationship_uid      VARCHAR(11) PRIMARY KEY,
    relationship_type     VARCHAR(11) NOT NULL,
    from_entity_type      VARCHAR(16) NOT NULL
                            CHECK (from_entity_type IN ('TRACKED_ENTITY','ENROLLMENT','EVENT')),
    from_entity_uid       TEXT NOT NULL,
    to_entity_type        VARCHAR(16) NOT NULL
                            CHECK (to_entity_type IN ('TRACKED_ENTITY','ENROLLMENT','EVENT')),
    to_entity_uid         TEXT NOT NULL,
    bidirectional         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by            UUID NOT NULL REFERENCES der.edge_user(user_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edge_relationship_uid_format
        CHECK (relationship_uid ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
    CONSTRAINT edge_relationship_type_format
        CHECK (relationship_type ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
    CONSTRAINT edge_relationship_not_self CHECK (
        NOT (from_entity_type = to_entity_type AND from_entity_uid = to_entity_uid))
);

CREATE INDEX IF NOT EXISTS idx_edge_relationship_from
    ON der.edge_tracker_relationship(from_entity_type, from_entity_uid);
CREATE INDEX IF NOT EXISTS idx_edge_relationship_to
    ON der.edge_tracker_relationship(to_entity_type, to_entity_uid);

COMMENT ON TABLE der.edge_enrollment IS
    'FR-08: edge-side tracker program enrollments. FK to tracked_entity (V025); distinct from V005 mirror.';
COMMENT ON TABLE der.edge_tracker_event IS
    'FR-08: edge-side tracker-stage events. FK to edge_enrollment for lifecycle integrity.';
COMMENT ON TABLE der.edge_tracker_relationship IS
    'FR-08-06: typed relationships between TEIs/enrollments/events; existence validated at controller layer.';
