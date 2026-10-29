-- V043: device profile — operator-editable display name + form factor.
--
-- Pre-V043 devices get display_name=NULL (admin UI falls back to the UUID
-- prefix) and form_factor='UNKNOWN'. Operators edit via PATCH
-- /edge-api/v1/devices/{id}/profile. The mesh topology uses these for the
-- device cards.

ALTER TABLE der.edge_device
    ADD COLUMN display_name TEXT,
    ADD COLUMN form_factor  TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK (form_factor IN ('WORKSTATION','LAPTOP','TABLET','MOBILE','UNKNOWN'));

CREATE INDEX idx_edge_device_form_factor ON der.edge_device (form_factor);
