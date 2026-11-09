-- DER Capture — enrolment notes (dashboard slice D).
--
-- Mirrors DHIS2's note.text field on Enrollment. Notes are
-- enrolment-scoped (not TEI-scoped) so re-enrolments don't inherit
-- the previous enrolment's chatter. One table, text UID keys per
-- the canonical shift.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS edge_enrollment_note (
    note_uid VARCHAR(11) PRIMARY KEY,
    enrollment_uid VARCHAR(11) NOT NULL
        REFERENCES edge_enrollment(enrollment_uid) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    stored_by_dhis2_uid VARCHAR(11),
    created_by UUID NOT NULL REFERENCES edge_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    central_uid VARCHAR(11)
);

CREATE INDEX IF NOT EXISTS ix_edge_enrollment_note_enrollment
    ON edge_enrollment_note (enrollment_uid, created_at DESC);

ALTER TABLE edge_enrollment_note
    ADD CONSTRAINT edge_enrollment_note_uid_format
    CHECK (note_uid ~ '^[A-Za-z][A-Za-z0-9]{10}$');
