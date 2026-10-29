-- V031 — DER Network Module (Phase N1 → N5 control plane).
--
-- Backs the admin UI Network sub-pages (Overview / Access Point /
-- Connected Devices / Interfaces / Peers / Security / Diagnostics /
-- Settings). The actual OS-level orchestration (hostapd, dnsmasq,
-- nftables, systemd-networkd) lives behind the `NetworkAgent` SPI
-- in the Java tier; this schema owns the persisted control-plane
-- state, policy, inventory and audit trail.
--
-- Phase coverage:
--   N1  — network_access_point, network_interface, network_lease,
--         network_policy_rule, network_state (snapshot)
--   N2  — network_client (device enrolment lifecycle), network_event
--   N3  — network_probe (connectivity-state detector history)
--   N4  — network_interface.priority + network_route
--   N5  — network_peer (WireGuard / Wi-Fi Direct configs)

-- ─── Phase N1 — core local network ─────────────────────────────────

CREATE TABLE IF NOT EXISTS der.network_access_point (
    id                 SMALLINT PRIMARY KEY DEFAULT 1,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    running            BOOLEAN NOT NULL DEFAULT FALSE,
    interface_name     TEXT NOT NULL DEFAULT 'wlan0',
    ssid               TEXT NOT NULL DEFAULT 'DER-EDGE',
    band               TEXT NOT NULL DEFAULT '5GHz',
    channel            INTEGER NOT NULL DEFAULT 44,
    security_mode      TEXT NOT NULL DEFAULT 'WPA3-SAE',
    network_key_hash   TEXT,
    network_key_rotated_at TIMESTAMPTZ,
    dhcp_active        BOOLEAN NOT NULL DEFAULT FALSE,
    gateway            TEXT NOT NULL DEFAULT '10.88.0.1',
    subnet             TEXT NOT NULL DEFAULT '10.88.0.0/24',
    edge_id            TEXT,
    started_at         TIMESTAMPTZ,
    stopped_at         TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_single_ap CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS der.network_interface (
    name               TEXT PRIMARY KEY,
    kind               TEXT NOT NULL,            -- wifi | ethernet | cellular | virtual | loopback
    state              TEXT NOT NULL DEFAULT 'down',   -- up | down | degraded | unknown
    purpose            TEXT NOT NULL DEFAULT 'unknown', -- local-ap | facility-lan | upstream-wifi | cellular-fallback | unknown
    address            TEXT,
    mac                TEXT,
    rx_bytes           BIGINT,
    tx_bytes           BIGINT,
    link_speed         TEXT,
    priority           INTEGER NOT NULL DEFAULT 100,  -- N4 — WAN failover ordering
    administrative_up  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS der.network_lease (
    mac                TEXT PRIMARY KEY,
    ip                 TEXT NOT NULL,
    hostname           TEXT,
    issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL,
    static_lease       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS der.network_route (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination        TEXT NOT NULL,            -- CIDR, e.g. 0.0.0.0/0
    gateway            TEXT,
    interface_name     TEXT REFERENCES der.network_interface(name) ON DELETE SET NULL,
    metric             INTEGER NOT NULL DEFAULT 100,
    source             TEXT NOT NULL DEFAULT 'STATIC',  -- STATIC | DYNAMIC | CELLULAR | MANUAL
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS der.network_policy_rule (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position           INTEGER NOT NULL,
    source_zone        TEXT NOT NULL,
    destination_zone   TEXT NOT NULL,
    action             TEXT NOT NULL,            -- allow | controlled | deny
    note               TEXT,
    updated_by         UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS der.network_settings (
    key                TEXT PRIMARY KEY,
    value              TEXT NOT NULL,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Phase N2 — managed devices + audit ────────────────────────────

CREATE TABLE IF NOT EXISTS der.network_client (
    device_id          TEXT PRIMARY KEY,
    der_device_id      UUID REFERENCES der.edge_device(device_id) ON DELETE SET NULL,
    owner              TEXT,
    hostname           TEXT,
    ip                 TEXT NOT NULL,
    mac                TEXT,
    link               TEXT NOT NULL DEFAULT 'wifi',   -- wifi | ethernet | cellular
    signal_dbm         INTEGER,
    trust              TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REVOKED | BLOCKED | UNKNOWN
    certificate_pem    TEXT,
    certificate_fingerprint TEXT,
    bytes_tx           BIGINT,
    bytes_rx           BIGINT,
    first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by        UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    approved_at        TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_network_client_trust
    ON der.network_client(trust);

CREATE TABLE IF NOT EXISTS der.network_event (
    event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type         TEXT NOT NULL,
    outcome            TEXT NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS | FAILURE | PENDING
    device_id          TEXT,
    node_id            TEXT,
    interface_name     TEXT,
    actor              TEXT,
    reason             TEXT,
    correlation_id     TEXT,
    observed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_event_observed
    ON der.network_event(observed_at DESC);

-- ─── Phase N3 — connectivity state machine ─────────────────────────

CREATE TABLE IF NOT EXISTS der.network_state (
    id                 SMALLINT PRIMARY KEY DEFAULT 1,
    state              TEXT NOT NULL DEFAULT 'OFFLINE_FIRST',
    local_ap_available BOOLEAN NOT NULL DEFAULT FALSE,
    local_lan_available BOOLEAN NOT NULL DEFAULT FALSE,
    internet_available BOOLEAN NOT NULL DEFAULT FALSE,
    dns_available      BOOLEAN NOT NULL DEFAULT FALSE,
    central_available  BOOLEAN NOT NULL DEFAULT FALSE,
    last_probe_at      TIMESTAMPTZ,
    hostname           TEXT NOT NULL DEFAULT 'der.local',
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_single_state CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS der.network_probe (
    id                 BIGSERIAL PRIMARY KEY,
    probed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind               TEXT NOT NULL,            -- LAN | INTERNET | DNS | CENTRAL
    outcome            TEXT NOT NULL,            -- SUCCESS | FAILURE
    latency_ms         INTEGER,
    message            TEXT
);

CREATE INDEX IF NOT EXISTS idx_network_probe_recent
    ON der.network_probe(probed_at DESC);

-- ─── Phase N5 — optional secure peers ──────────────────────────────

CREATE TABLE IF NOT EXISTS der.network_peer (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id            TEXT NOT NULL,
    site_id            TEXT,
    endpoint           TEXT NOT NULL,
    public_key         TEXT,
    allowed_ips        TEXT,
    state              TEXT NOT NULL DEFAULT 'DISCONNECTED', -- CONNECTED | HANDSHAKING | DISCONNECTED | ERROR
    trust              TEXT NOT NULL DEFAULT 'UNVERIFIED',   -- TRUSTED | UNVERIFIED | REVOKED
    rx_bytes           BIGINT,
    tx_bytes           BIGINT,
    last_handshake     TIMESTAMPTZ,
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by           UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL
);

-- ─── Seed defaults ─────────────────────────────────────────────────

INSERT INTO der.network_access_point (id)
    VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO der.network_state (id)
    VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Default firewall rules per spec §14 (client-isolation on):
INSERT INTO der.network_policy_rule (position, source_zone, destination_zone, action, note) VALUES
    (10, 'Client', 'DER HTTPS',      'allow',      'Clients may reach the admin + capture APIs'),
    (20, 'Client', 'DER DNS',        'allow',      'Local DNS resolution'),
    (30, 'Client', 'DER DHCP',       'allow',      'DHCP leases'),
    (40, 'Client', 'Admin API',      'controlled', 'ADMIN role only'),
    (50, 'Client', 'Client',         'deny',       'Client isolation per spec §14'),
    (60, 'Client', 'DER PostgreSQL', 'deny',       'DB is DER-internal'),
    (70, 'Client', 'DER SSH',        'deny',       'SSH is admin-plane only')
ON CONFLICT DO NOTHING;

INSERT INTO der.network_settings (key, value) VALUES
    ('mode',                  'managed'),
    ('lan.subnet',            '10.88.0.0/24'),
    ('lan.gateway',           '10.88.0.1'),
    ('ap.interface',          'wlan0'),
    ('ap.ssid',               'DER-EDGE'),
    ('ap.security',           'WPA3-SAE'),
    ('dhcp.enabled',          'true'),
    ('dhcp.range.start',      '10.88.0.50'),
    ('dhcp.range.end',        '10.88.0.200'),
    ('discovery.mdns',        'true'),
    ('discovery.hostname',    'der.local'),
    ('firewall.client-isolation', 'true'),
    ('central.probeIntervalSeconds', '30')
ON CONFLICT (key) DO NOTHING;

-- A loopback interface always exists; seed a representative pair so
-- the UI has something sensible to show before the Linux agent lands.
INSERT INTO der.network_interface (name, kind, state, purpose, address, mac, link_speed, priority) VALUES
    ('lo',    'loopback', 'up', 'unknown',       '127.0.0.1',   NULL,              NULL,       1000),
    ('wlan0', 'wifi',     'down','local-ap',     '10.88.0.1',   '02:aa:00:01:02:03','300 Mbps', 10),
    ('eth0',  'ethernet', 'up', 'facility-lan',  '192.168.1.42','02:aa:00:01:02:04','1 Gbps',    20)
ON CONFLICT (name) DO NOTHING;

INSERT INTO der.network_route (destination, gateway, interface_name, metric, source) VALUES
    ('0.0.0.0/0',      '192.168.1.1',  'eth0',  100, 'DYNAMIC'),
    ('10.88.0.0/24',    NULL,          'wlan0',  10, 'STATIC'),
    ('192.168.1.0/24',  NULL,          'eth0',   20, 'DYNAMIC')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE der.network_access_point    IS 'Phase N1 — Access Point configuration + runtime status (singleton).';
COMMENT ON TABLE der.network_interface       IS 'Phase N1 + N4 — Interface inventory with WAN-failover priority.';
COMMENT ON TABLE der.network_client          IS 'Phase N2 — Connected clients + enrolment lifecycle.';
COMMENT ON TABLE der.network_event           IS 'Phase N2 — Network audit event ring buffer.';
COMMENT ON TABLE der.network_state           IS 'Phase N3 — Connectivity state machine current snapshot.';
COMMENT ON TABLE der.network_probe           IS 'Phase N3 — Rolling history of LAN/DNS/WAN/Central probes.';
COMMENT ON TABLE der.network_peer            IS 'Phase N5 — Optional WireGuard / Wi-Fi Direct peer links.';
COMMENT ON TABLE der.network_policy_rule     IS 'Phase N1 — Default firewall policy per spec §14.';
COMMENT ON TABLE der.network_route           IS 'Phase N4 — Routing table + metric ordering.';
COMMENT ON TABLE der.network_lease           IS 'Phase N1 — DHCP leases.';
COMMENT ON TABLE der.network_settings        IS 'Phase N1 — Operator-tunable network configuration.';
