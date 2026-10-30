-- V044: device-to-device peer adjacency.
--
-- Facility devices can report direct P2P links to one another
-- (Bluetooth, Wi-Fi Direct, LoRa, BLE mesh, custom radio). The
-- topology view renders these as dashed edges per spec §20.
--
-- Pair ordering is canonical: device_a < device_b (UUIDs sorted) so
-- the row is unique regardless of which side reported it.

CREATE TABLE der.edge_device_adjacency (
    device_a_id   UUID NOT NULL REFERENCES der.edge_device(device_id) ON DELETE CASCADE,
    device_b_id   UUID NOT NULL REFERENCES der.edge_device(device_id) ON DELETE CASCADE,
    link_type     TEXT NOT NULL CHECK (link_type IN
                     ('p2p','bluetooth','wifi-direct','lora','ble-mesh')),
    state         TEXT NOT NULL DEFAULT 'active'
                     CHECK (state IN ('active','degraded','offline')),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reported_by   UUID,
    PRIMARY KEY (device_a_id, device_b_id),
    CHECK (device_a_id < device_b_id)
);

CREATE INDEX idx_edge_device_adjacency_a ON der.edge_device_adjacency (device_a_id);
CREATE INDEX idx_edge_device_adjacency_b ON der.edge_device_adjacency (device_b_id);
CREATE INDEX idx_edge_device_adjacency_last_seen
    ON der.edge_device_adjacency (last_seen_at DESC);
