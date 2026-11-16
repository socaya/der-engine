-- V127 — FR-02-06 offline credential-age enforcement.
--
-- Track the last time DER had positive evidence that a user still
-- exists / is still valid at central. On every sign-in while the
-- central reachability gate is REACHABLE we stamp this column so
-- the local offline window starts fresh. After
-- der.security.offline-max-age-days without a refresh, the user
-- must come back online to re-validate.
--
-- BOOTSTRAP-origin admins are deliberately excluded by the service
-- layer (they have no central anchor to validate against).

ALTER TABLE der.edge_user
    ADD COLUMN IF NOT EXISTS last_central_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN der.edge_user.last_central_sync_at IS
    'FR-02-06 — timestamp of the most recent event that proved this '
    'user is still valid at central (sign-in while REACHABLE, or an '
    'explicit user-sync pull). NULL for bootstrap users and for DHIS2 '
    'users that have never signed in online. Compared against '
    'der.security.offline-max-age-days at sign-in time.';
