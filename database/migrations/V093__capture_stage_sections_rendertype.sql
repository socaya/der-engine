-- DER Capture — program-stage sections + per-field renderType mirror.
--
-- Phase 1 + 2 of the metadata-driven custom-form support. The existing
-- metadata_program_stage_data_element table flattens stage data elements into
-- a single list, so CaptureFormService.getStageForm() renders one lumped
-- section per stage. DHIS2 admins actually configure programStageSections
-- (groupings) + per-DE renderType (DROPDOWN / RADIOBUTTONS / CHECKBOXES /
-- TOGGLE / SPINNER / SLIDER / AUTOCOMPLETE) + per-section renderType (LISTING
-- / MATRIX / SEQUENTIAL). This migration adds the mirror infrastructure so
-- the metadata sync can ingest those, the form service can emit per-section
-- groupings, and the Capture client can render the appropriate layout.
--
-- Round 1 of 3 (round 2 = CaptureFormService changes, round 3 = client parser
-- + FormEngine changes). On round-1 boot the new tables exist but are empty
-- until the next metadata sync populates them; CaptureFormService falls back
-- to its current lumped-section behavior when no section rows are found, so
-- existing programs keep rendering as they do today.
--
-- render_type columns accept the DHIS2 enum values verbatim. desktop + mobile
-- are stored separately because DHIS2 lets admins pick different render
-- strategies per form factor. Capture reads the desktop variant today; a
-- future mobile-aware switch can honor the mobile variant without a schema
-- change.

SET search_path = der, public;

-- Per-stage section groupings (DHIS2 programStageSections). sort_order is
-- what operators see; render_type_* controls layout.
CREATE TABLE IF NOT EXISTS metadata_program_stage_section (
    dhis2_uid TEXT PRIMARY KEY,
    program_stage_uid TEXT NOT NULL
        REFERENCES metadata_program_stage(dhis2_uid)
        ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    sort_order INT,
    render_type_desktop TEXT,
    render_type_mobile TEXT,
    payload JSONB NOT NULL,
    snapshot_id BIGINT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS metadata_program_stage_section_stage_idx
    ON metadata_program_stage_section (program_stage_uid, sort_order);

-- Join: which data elements belong to which section, and in what order within
-- that section. One DE lives in at most one section per stage (DHIS2
-- enforces this), but we don't add a unique constraint since the server-side
-- fetch could in theory produce duplicates on malformed metadata; we prefer
-- surfacing it as a parse issue rather than rejecting the whole stage.
CREATE TABLE IF NOT EXISTS metadata_program_stage_section_data_element (
    section_uid TEXT NOT NULL
        REFERENCES metadata_program_stage_section(dhis2_uid)
        ON DELETE CASCADE,
    data_element_uid TEXT NOT NULL,
    sort_order INT,
    PRIMARY KEY (section_uid, data_element_uid)
);

CREATE INDEX IF NOT EXISTS metadata_psse_de_section_idx
    ON metadata_program_stage_section_data_element (section_uid, sort_order);

-- Per-field render type (DROPDOWN, VERTICAL_RADIOBUTTONS, etc.). Nullable
-- because older DHIS2 metadata sometimes omits renderType; absent = DEFAULT
-- (plain input chosen by value type).
ALTER TABLE metadata_program_stage_data_element
    ADD COLUMN IF NOT EXISTS render_type_desktop TEXT;
ALTER TABLE metadata_program_stage_data_element
    ADD COLUMN IF NOT EXISTS render_type_mobile TEXT;

-- Stage-level form type (DEFAULT / SECTION / CUSTOM) + the raw custom HTML
-- blob. We store the HTML for forward-compat (Phase 3 will parse it for
-- layout hints), but round 2 only reads form_type to decide whether to
-- group by sections or fall back to the lumped layout.
ALTER TABLE metadata_program_stage
    ADD COLUMN IF NOT EXISTS form_type TEXT;
ALTER TABLE metadata_program_stage
    ADD COLUMN IF NOT EXISTS data_entry_form_html TEXT;
