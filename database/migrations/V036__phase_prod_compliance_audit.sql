-- V036 — Production hardening: audit tamper detection + retention +
-- right-to-erasure + data-residency (§6 + §7 of the roadmap).

-- 1. Hash-chain the audit log so tampering is detectable.
ALTER TABLE der.network_event
    ADD COLUMN IF NOT EXISTS prev_hash TEXT,
    ADD COLUMN IF NOT EXISTS row_hash  TEXT;

CREATE TABLE IF NOT EXISTS der.audit_anchor (
    anchor_at    TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
    row_count    BIGINT NOT NULL,
    chain_head   TEXT   NOT NULL,
    uploaded_at  TIMESTAMPTZ,
    upload_url   TEXT
);

COMMENT ON TABLE der.audit_anchor IS
    'Daily root-hash anchor of the network_event chain. Optionally '
    'uploaded to central for non-repudiation.';

-- 2. Retention policy — operator-configurable data lifetime per
-- category. Reaper runs daily and purges rows older than the limit.
CREATE TABLE IF NOT EXISTS der.retention_policy (
    category         TEXT PRIMARY KEY,
    keep_days        INTEGER NOT NULL,
    description      TEXT,
    last_purge_at    TIMESTAMPTZ,
    last_purge_rows  BIGINT,
    updated_by       UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO der.retention_policy (category, keep_days, description) VALUES
    ('network_event',   365, 'Network audit events'),
    ('device_message',   90, 'Device-to-device messages'),
    ('peer_health_sample', 30, 'Peer health probe history'),
    ('network_probe',    30, 'Connectivity probe history')
ON CONFLICT DO NOTHING;

-- 3. Right-to-erasure request + signed receipt.
CREATE TABLE IF NOT EXISTS der.erasure_request (
    request_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_type     TEXT NOT NULL,  -- patient | device | user
    subject_id       TEXT NOT NULL,
    reason           TEXT,
    requested_by     UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    status           TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | COMPLETED | REJECTED
    completed_at     TIMESTAMPTZ,
    receipt_hash     TEXT,
    rows_affected    JSONB
);

CREATE INDEX IF NOT EXISTS idx_erasure_request_subject
    ON der.erasure_request(subject_type, subject_id);

COMMENT ON TABLE der.erasure_request IS
    '§7.2 — Right-to-erasure requests with signed receipts.';

-- 4. Data residency allow-list — upstream URLs that outbound
-- backups / telemetry may hit. Enforced at runtime.
CREATE TABLE IF NOT EXISTS der.data_residency_rule (
    rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_pattern  TEXT NOT NULL,          -- e.g. '*.ug.gov.*'
    allow         BOOLEAN NOT NULL,
    note          TEXT,
    updated_by    UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO der.data_residency_rule (host_pattern, allow, note) VALUES
    ('*.local',        TRUE, 'LAN hosts always allowed'),
    ('127.0.0.1',      TRUE, 'Loopback'),
    ('10.*',           TRUE, 'Private RFC-1918'),
    ('192.168.*',      TRUE, 'Private RFC-1918')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE der.data_residency_rule IS
    '§7.4 — Allow-list for outbound backup / telemetry destinations.';
