-- V038 — §4 Hardware integration: watchdog state, UPS/thermal
-- rolling samples, status-LED current state, and TPM-sealed
-- secret references.

-- 1. Rolling sensor history. Thermal + UPS + fan RPM + anything a
-- Linux edge box can read from /sys. Trimmed to 7 days by the
-- compliance retention sweep (policy added below).
CREATE TABLE IF NOT EXISTS der.hardware_sensor_sample (
    sample_id       BIGSERIAL PRIMARY KEY,
    sensor_kind     TEXT NOT NULL,      -- thermal | ups_battery | ups_runtime | fan_rpm
    sensor_zone     TEXT NOT NULL,      -- thermal_zone0, apc, cpu-fan, …
    value_double    DOUBLE PRECISION NOT NULL,
    unit            TEXT NOT NULL,       -- degC | percent | seconds | rpm
    sampled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    note            TEXT
);

CREATE INDEX IF NOT EXISTS idx_hardware_sensor_recent
    ON der.hardware_sensor_sample(sensor_kind, sampled_at DESC);

COMMENT ON TABLE der.hardware_sensor_sample IS
    '§4 — Rolling sensor history (thermal, UPS, fan) for the hardware admin page.';

-- Add retention policy row so the daily sweep trims this table.
INSERT INTO der.retention_policy (category, keep_days, description) VALUES
    ('hardware_sensor_sample', 7, 'Hardware sensor rolling history')
ON CONFLICT (category) DO NOTHING;

-- 2. Watchdog heartbeat state so the admin UI shows "last pinged
-- systemd Xs ago" without needing to shell out to journalctl.
CREATE TABLE IF NOT EXISTS der.watchdog_state (
    id                SMALLINT PRIMARY KEY DEFAULT 1,
    last_ping_at      TIMESTAMPTZ,
    ping_count        BIGINT NOT NULL DEFAULT 0,
    last_failure_at   TIMESTAMPTZ,
    last_failure_msg  TEXT,
    systemd_notify_path TEXT,
    expected_interval_us BIGINT,
    CONSTRAINT chk_single_watchdog CHECK (id = 1)
);

INSERT INTO der.watchdog_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Status LED current state — admin UI edits colour/pattern per
-- zone; a tiny Pi-side daemon polls GET /system/status-leds and
-- drives the strip.
CREATE TABLE IF NOT EXISTS der.status_led_zone (
    zone            TEXT PRIMARY KEY,   -- primary | secondary | attention | network | sync
    color           TEXT NOT NULL,       -- hex or named colour
    pattern         TEXT NOT NULL,       -- solid | pulse | blink | off
    period_ms       INTEGER,
    label           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO der.status_led_zone (zone, color, pattern, label) VALUES
    ('primary',   'green', 'solid', 'DER running'),
    ('secondary', 'blue',  'off',   'sync idle'),
    ('attention', 'off',   'off',   'no alerts')
ON CONFLICT (zone) DO NOTHING;

-- 4. TPM-sealed secrets registry. The actual sealed blob lives on
-- disk under /etc/der/sealed/{secret_id} (owner der, mode 600);
-- this table just tracks what's sealed where.
CREATE TABLE IF NOT EXISTS der.tpm_sealed_secret (
    secret_id        TEXT PRIMARY KEY,
    description      TEXT,
    sealed_path      TEXT NOT NULL,
    algorithm        TEXT NOT NULL DEFAULT 'tpm2-sealed-aes256-gcm',
    sealed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_unseal_at   TIMESTAMPTZ,
    unseal_count     BIGINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE der.tpm_sealed_secret IS
    '§4.5 — Registry of TPM-sealed secrets. Blobs under /etc/der/sealed.';
