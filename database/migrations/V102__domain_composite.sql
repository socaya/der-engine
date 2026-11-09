-- DER Capture — composite DER_DOMAIN entities (spec §4).
--
-- Head + line-items pattern for clinical records that need
-- more structure than a binary DHIS2 relationship: Lab Request
-- with multiple test items, Prescription with order lines,
-- care-episode grouping, result amendments — spec §4 names
-- those as EXAMPLES. The schema must not hardcode which
-- composite kinds exist; admins register kinds in a catalogue
-- (der_domain_composite_kind) and composites reference them by
-- kind_code. New kinds are a catalogue insert — no code change,
-- no migration.
--
-- Anchored on a tracker event (anchor_event_uid). The denormalised
-- anchor_enrollment_uid + anchor_tei_uid speed up "list this
-- TEI's composites" without joining through the event table.
--
-- These composites are DER-only (spec §3.2) — the JournalPublisher
-- does NOT sync them to central. No sync_status column.

SET search_path = der, public;

-- Catalogue of composite kinds. Admin-managed; capture clients
-- read it to know which kinds to offer as "+ New X" actions and
-- which schema to apply to the head + item payloads. kind_code
-- is a stable string identifier (LAB_REQUEST, PRESCRIPTION, …)
-- that composites reference. display_name is what operators see.
CREATE TABLE IF NOT EXISTS der_domain_composite_kind (
    kind_code          TEXT PRIMARY KEY
                           CHECK (kind_code
                               ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    display_name       TEXT NOT NULL,
    description        TEXT,
    /* Optional JSON schema for the head payload + item payload.
     * Clients render form fields from these; null schema = free-
     * form JSONB (client falls back to a notes textarea). */
    head_schema        JSONB,
    item_schema        JSONB,
    /* Allowed status transitions (ordered). null = use the
     * default DRAFT → ORDERED → IN_PROGRESS → COMPLETED. */
    allowed_statuses   JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS der_domain_composite (
    composite_uid         VARCHAR(11) PRIMARY KEY
                              CHECK (composite_uid
                                ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
    /* References the catalogue; FK so composites can't name a
     * kind that doesn't exist, but ON DELETE RESTRICT so admins
     * can't accidentally remove a kind that has composites. */
    kind_code             TEXT NOT NULL
                              REFERENCES der_domain_composite_kind
                              ON DELETE RESTRICT,
    anchor_event_uid      VARCHAR(11) NOT NULL,
    anchor_enrollment_uid VARCHAR(11) NOT NULL,
    anchor_tei_uid        TEXT NOT NULL,
    org_unit_uid          VARCHAR(11) NOT NULL,
    /* status is a free text — validated per-kind in the
     * controller against allowed_statuses from the catalogue. */
    status                TEXT NOT NULL DEFAULT 'DRAFT',
    head_payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by            UUID NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ,
    composite_version     INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_domain_composite_anchor_event
    ON der_domain_composite (anchor_event_uid)
 WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_domain_composite_anchor_tei
    ON der_domain_composite (anchor_tei_uid)
 WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_domain_composite_kind_status
    ON der_domain_composite (kind_code, status)
 WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS der_domain_composite_item (
    item_uid         VARCHAR(11) PRIMARY KEY
                         CHECK (item_uid
                            ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
    composite_uid    VARCHAR(11) NOT NULL
                         REFERENCES der_domain_composite(composite_uid)
                         ON DELETE CASCADE,
    line_no          INT NOT NULL,
    item_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT der_domain_composite_item_line_check
        CHECK (line_no >= 0),
    UNIQUE (composite_uid, line_no)
);

CREATE INDEX IF NOT EXISTS ix_domain_composite_item_composite
    ON der_domain_composite_item (composite_uid, line_no);
