-- V120 — one device table to rule them all.
--
-- Before V120, DER had two overlapping device tables:
--   * der.edge_device   — browser installation enrolments (UUID device_id,
--                         user-agent, form-factor, session-based identity)
--   * der.network_client — local-AP observations (TEXT device_id, IP, MAC,
--                         hostname, cert fingerprint, trust state)
--
-- Operators saw the same conceptual thing in two different shapes, and
-- the admin UI had to reconcile them in every screen (unified view,
-- topology, devices panel). V120 collapses them into one table that
-- carries both axes — session identity and LAN presence — with
-- source=FLEET/LAN/BOTH describing where a device was observed.
--
-- All 11 FKs that previously pointed at der.edge_device keep their
-- UUID device_id reference, so no FK rewiring is required. The LAN
-- device_id (TEXT in the old schema) becomes a synthesised UUID on
-- first observation; the external hostname/mac/ip are what operators
-- look at, not the key.
--
-- This migration assumes both tables are empty (the preceding nuclear
-- cleanup wiped stale fixtures). It will refuse to run if either
-- table still has rows.

-- Guard only fires on first application — once the `source` column
-- exists the migration has already been applied and the guard is
-- irrelevant (idempotent re-runs are safe thanks to IF NOT EXISTS /
-- IF EXISTS clauses below).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='der' AND table_name='edge_device'
                      AND column_name='source') THEN
        IF (SELECT COUNT(*) FROM der.edge_device) > 0 THEN
            RAISE EXCEPTION 'V120: edge_device still has rows; run cleanup first';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='der' AND table_name='network_client')
            AND (SELECT COUNT(*) FROM der.network_client) > 0 THEN
            RAISE EXCEPTION 'V120: network_client still has rows; run cleanup first';
        END IF;
    END IF;
END $$;

ALTER TABLE der.edge_device
    ADD COLUMN IF NOT EXISTS source                   TEXT NOT NULL DEFAULT 'FLEET'
        CHECK (source IN ('FLEET', 'LAN', 'BOTH')),
    ADD COLUMN IF NOT EXISTS hostname                 TEXT,
    ADD COLUMN IF NOT EXISTS owner                    TEXT,
    ADD COLUMN IF NOT EXISTS ip                       TEXT,
    ADD COLUMN IF NOT EXISTS mac                      TEXT,
    ADD COLUMN IF NOT EXISTS link                     TEXT
        CHECK (link IS NULL OR link IN ('wifi', 'ethernet', 'cellular')),
    ADD COLUMN IF NOT EXISTS signal_dbm               INTEGER,
    ADD COLUMN IF NOT EXISTS certificate_fingerprint  TEXT,
    ADD COLUMN IF NOT EXISTS bytes_tx                 BIGINT,
    ADD COLUMN IF NOT EXISTS bytes_rx                 BIGINT,
    ADD COLUMN IF NOT EXISTS first_seen_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS revoked_at               TIMESTAMPTZ;

-- Expand the status domain to cover the states network_client's trust
-- column used — the unified lifecycle needs both SUSPENDED (admin held)
-- and BLOCKED (system/security held).
ALTER TABLE der.edge_device DROP CONSTRAINT IF EXISTS edge_device_status_check;
ALTER TABLE der.edge_device
    ADD CONSTRAINT edge_device_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED',
                          'REVOKED', 'BLOCKED', 'UNKNOWN'));

CREATE INDEX IF NOT EXISTS idx_edge_device_source ON der.edge_device (source);
CREATE INDEX IF NOT EXISTS idx_edge_device_ip ON der.edge_device (ip)
    WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_device_mac ON der.edge_device (mac)
    WHERE mac IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edge_device_cert_fingerprint
    ON der.edge_device (certificate_fingerprint)
    WHERE certificate_fingerprint IS NOT NULL;

DROP TABLE IF EXISTS der.network_client CASCADE;

COMMENT ON COLUMN der.edge_device.source IS
    'Observation axis: FLEET = browser enrolment with session; '
    'LAN = seen on the local access point; BOTH = both axes meet on '
    'this device.';
COMMENT ON COLUMN der.edge_device.hostname IS
    'Reported hostname (LAN axis, nullable for pure FLEET rows).';
COMMENT ON COLUMN der.edge_device.ip IS
    'Last-observed IPv4/IPv6 address (LAN axis).';
COMMENT ON TABLE der.edge_device IS
    'Unified device table (V120). Carries both browser-session '
    'identity (user_agent / form_factor) and LAN observation '
    '(ip / mac / hostname / trust) for the same physical device.';
