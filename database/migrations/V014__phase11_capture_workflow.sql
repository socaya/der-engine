-- Phase 11 / der-1.2.0 (ADR-0018 slice A): DER capture-workflow configuration.
--
-- Five tables that let an admin model multi-step capture flows DHIS2
-- doesn't natively express. Slice A ships the data model + authoring
-- surface; slice B (der-1.3.0) wires the drain-time reconciler.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS capture_workflow (
    workflow_id          UUID PRIMARY KEY,
    display_name         TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    bound_metadata_kind  TEXT NOT NULL CHECK (bound_metadata_kind IN ('DATA_SET')),
    bound_metadata_id    TEXT NOT NULL,
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    version              INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by           UUID REFERENCES edge_user(user_id)
);
CREATE INDEX IF NOT EXISTS ix_capture_workflow_binding
    ON capture_workflow (bound_metadata_kind, bound_metadata_id)
    WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS capture_workflow_step (
    step_id      UUID PRIMARY KEY,
    workflow_id  UUID NOT NULL REFERENCES capture_workflow(workflow_id) ON DELETE CASCADE,
    ordinal      INT NOT NULL CHECK (ordinal >= 0),
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    owner_role   TEXT NOT NULL CHECK (owner_role IN ('ADMIN','OPERATOR','REVIEWER')),
    step_kind    TEXT NOT NULL CHECK (step_kind IN ('CAPTURE','REVIEW','APPROVE','DISPATCH')),
    UNIQUE (workflow_id, ordinal)
);
CREATE INDEX IF NOT EXISTS ix_capture_workflow_step_workflow
    ON capture_workflow_step (workflow_id);

CREATE TABLE IF NOT EXISTS capture_workflow_field (
    step_id      UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    field_ref    TEXT NOT NULL,
    requirement  TEXT NOT NULL CHECK (requirement IN ('REQUIRED','OPTIONAL','READONLY','HIDDEN')),
    PRIMARY KEY (step_id, field_ref)
);

CREATE TABLE IF NOT EXISTS capture_workflow_dependency (
    step_id             UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    depends_on_step_id  UUID NOT NULL REFERENCES capture_workflow_step(step_id) ON DELETE CASCADE,
    dependency_kind     TEXT NOT NULL CHECK (dependency_kind IN ('COMPLETES_BEFORE')),
    PRIMARY KEY (step_id, depends_on_step_id),
    CHECK (step_id <> depends_on_step_id)
);

CREATE TABLE IF NOT EXISTS capture_workflow_run (
    run_id            UUID PRIMARY KEY,
    workflow_id       UUID NOT NULL REFERENCES capture_workflow(workflow_id),
    workflow_version  INT NOT NULL,
    business_key      TEXT NOT NULL,
    current_step_id   UUID REFERENCES capture_workflow_step(step_id),
    state             TEXT NOT NULL CHECK (state IN ('OPEN','AWAITING','COMPLETED','REJECTED'))
                                   DEFAULT 'OPEN',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES edge_user(user_id),
    UNIQUE (workflow_id, workflow_version, business_key)
);
CREATE INDEX IF NOT EXISTS ix_capture_workflow_run_state
    ON capture_workflow_run (state);
