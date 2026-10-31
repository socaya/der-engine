-- V062: Service-account auth for inter-edge peer push.
--
-- Each peer may carry a username + password for a service account on
-- the remote edge. Pilots create a dedicated `der-peer` ADMIN user per
-- facility; the sender signs in with these credentials, extracts the
-- cookie, and replays it on /workflows/import.
--
-- Stored plaintext for pilot. A follow-up release will encrypt at
-- rest once a key-management story lands.

SET search_path = der, public;

ALTER TABLE workflow_peer
    ADD COLUMN auth_username TEXT,
    ADD COLUMN auth_password TEXT;
