-- V033 — DER-MSG v1: device-to-device messaging within one edge
-- (Phase N5 — "devices within an edge environment share data").
--
-- Devices (tablets, phones, workstations) joined to the DER-EDGE
-- Wi-Fi exchange data pairwise or broadcast via DER as broker. DER
-- holds the authoritative log; delivery is at-least-once with
-- idempotent dedupe. When a receiving device is offline, the
-- messages queue and deliver on reconnect.
--
-- Channel kinds:
--   device:{deviceId}  — direct message to one device
--   role:{roleName}    — broadcast to all devices currently in role
--   broadcast          — every subscribed device on the edge
--
-- Message types (open-ended, operators extend via workflows):
--   REFERRAL_INTERNAL     patient referred to the lab from reception
--   STOCK_ALERT           drug/supply running low — alert the pharmacy
--   PATIENT_HANDOFF       vitals + queue slot for the next clinician
--   CHAT                  free-form operator message
--   PRESENCE              device joined / left the edge
--
-- All writes land under the existing session cookie — DER knows who
-- the sender is. Delivery is cursor-based (devices poll /messaging/recent
-- with their last-seen message_id). No long-poll / websocket in v1 —
-- fits inside the existing Spring MVC stack and survives any mobile
-- browser.

CREATE TABLE IF NOT EXISTS der.device_message (
    message_id      UUID PRIMARY KEY,
    channel         TEXT NOT NULL,
    from_device_id  TEXT NOT NULL,
    from_user_id    UUID REFERENCES der.edge_user(user_id) ON DELETE SET NULL,
    message_type    TEXT NOT NULL,
    payload         JSONB NOT NULL,
    reply_to        UUID REFERENCES der.device_message(message_id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_message_channel_time
    ON der.device_message(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_message_sender
    ON der.device_message(from_device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_message_expires
    ON der.device_message(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE  der.device_message IS
    'Phase N5 — Device-to-device message bus (DER-MSG v1) mediated by DER.';
COMMENT ON COLUMN der.device_message.channel IS
    'device:<id> | role:<role> | broadcast — DER routes based on prefix.';

-- Per-device-per-channel subscription cursors so a tablet that joins
-- late catches up from where it left off, not from the start of time.
CREATE TABLE IF NOT EXISTS der.device_subscription (
    device_id       TEXT NOT NULL,
    channel         TEXT NOT NULL,
    cursor_at       TIMESTAMPTZ,
    last_poll_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_device_subscription_channel
    ON der.device_subscription(channel);

COMMENT ON TABLE der.device_subscription IS
    'Phase N5 — Per-device channel subscriptions + replay cursors.';

-- Per-message delivery receipts (optional ack). Devices can POST
-- /messaging/ack/{messageId} to mark messages as processed; the
-- admin UI shows unacked / processed counts.
CREATE TABLE IF NOT EXISTS der.device_message_ack (
    message_id      UUID NOT NULL REFERENCES der.device_message(message_id)
                                   ON DELETE CASCADE,
    device_id       TEXT NOT NULL,
    acked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, device_id)
);
