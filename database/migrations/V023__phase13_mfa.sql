-- Phase 13 / der-1.4.0-alpha.8 (ADR-0028): TOTP MFA.

SET search_path = der, public;

ALTER TABLE edge_user
    ADD COLUMN IF NOT EXISTS totp_secret TEXT,
    ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;
