-- V125 — Make signature_b64 nullable on installed_app_version.
--
-- DER-APPS-DHIS2-001 Phase 5d (stock DHIS2 iframe install). The
-- device-side verifier only exercises DER_ESM apps; DHIS2_IFRAME
-- installs are the stock DHIS2 Hub zip format where DER doesn't
-- attest to the third-party bundle. Prior to 5d every version row
-- carried a DER Ed25519 signature; now iframe rows store NULL.
--
-- A NOT NULL constraint on signature_b64 blocks the iframe install
-- at the database boundary, so drop it. The semantic is now:
--   * NULL  → unsigned (DHIS2_IFRAME host).
--   * value → Ed25519 signature over bundle_bytes, verifiable by
--             the device-side AppSigningKeyService (DER_ESM host).

SET search_path = der, public;

ALTER TABLE installed_app_version
    ALTER COLUMN signature_b64 DROP NOT NULL;

COMMENT ON COLUMN installed_app_version.signature_b64 IS
    'Ed25519 signature over bundle_bytes under DER''s signing key. '
    'Null for DHIS2_IFRAME host installs (stock DHIS2 Hub bundles); '
    'a value for DER_ESM installs. DER-APPS-DHIS2-001 Phase 5d.';
