-- V040 — §8 UI maturity: multi-edge fleet entries + user preferences
-- for onboarding tour state.

-- 1. Fleet entries — this edge's view of every edge in the fleet
-- (itself + every peer). Rows are populated from peer_adjacency +
-- peer_health_sample so the fleet view works without a central
-- inventory. A pilot can later add a central aggregator that
-- cross-references these rows.
CREATE TABLE IF NOT EXISTS der.edge_fleet_entry (
    edge_id         TEXT PRIMARY KEY,
    display_name    TEXT,
    site_id         TEXT,
    role            TEXT NOT NULL DEFAULT 'peer',   -- self | peer
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    announced_version TEXT,
    tags            JSONB
);

CREATE INDEX IF NOT EXISTS idx_edge_fleet_entry_role
    ON der.edge_fleet_entry(role);

COMMENT ON TABLE der.edge_fleet_entry IS
    '§8 — Fleet-level view of every edge this edge knows about. '
    'Populated from peer_adjacency + peer_health_sample.';

-- 2. User preferences — small KV so the admin UI can remember
-- state per operator (onboarding tour dismissed, preferred page
-- size, dark/light theme toggle, etc).
CREATE TABLE IF NOT EXISTS der.user_preference (
    user_id     UUID NOT NULL REFERENCES der.edge_user(user_id) ON DELETE CASCADE,
    pref_key    TEXT NOT NULL,
    pref_value  TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, pref_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preference_user
    ON der.user_preference(user_id);

COMMENT ON TABLE der.user_preference IS
    '§8 — Per-operator preferences (onboarding tour dismissed, '
    'theme choice, page-size defaults).';
