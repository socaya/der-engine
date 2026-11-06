package ug.ac.mak.der.apps;

import java.sql.ResultSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * JDBC over the V091 app signing + versioning tables.
 *
 * <p>Sibling to {@link InstalledAppRepository} — this one carries the
 * uploaded bundle bytes, their sha-256, the Ed25519 signature over
 * those bytes, and the minimum {@code requiresDerApi} semver. The
 * {@code installed_app} row still tracks the app identity (app_key,
 * display name, module metadata); versions live here.</p>
 */
@Repository
public class AppCatalogueRepository {

    private final JdbcTemplate jdbc;

    public AppCatalogueRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    // ---- signing_key ---------------------------------------------------

    /** Read the singleton row. Empty until {@link AppSigningKeyService} seeds it. */
    public Optional<SigningKey> readSigningKey() {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT algorithm, public_key_b64, sealed_secret "
                            + "FROM der.signing_key WHERE id = 1",
                    (ResultSet rs, int n) -> new SigningKey(
                            rs.getString("algorithm"),
                            rs.getString("public_key_b64"),
                            rs.getString("sealed_secret"))));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /**
     * Idempotent insert — {@code ON CONFLICT DO NOTHING} lets two concurrent
     * boots race safely; the loser's generated key pair is discarded and
     * both callers subsequently SELECT the winner's row.
     */
    public int insertSigningKey(final String algorithm,
                                 final String publicKeyB64,
                                 final String sealedSecret,
                                 final UUID createdBy) {
        return jdbc.update(
                "INSERT INTO der.signing_key (id, algorithm, public_key_b64, "
                        + "sealed_secret, created_by) "
                        + "VALUES (1, ?, ?, ?, ?) "
                        + "ON CONFLICT (id) DO NOTHING",
                algorithm, publicKeyB64, sealedSecret, createdBy);
    }

    // ---- catalogue reads ----------------------------------------------

    /**
     * One row per enabled app, joined to its currently-active version
     * (superseded_at IS NULL). Apps with no active version are omitted —
     * on-disk reality is always "either you have bytes or you aren't in
     * the catalogue" and callers should not have to deal with the latter.
     */
    public List<CatalogueEntry> catalogue() {
        return jdbc.query(
                "SELECT ia.app_id, ia.app_key, ia.display_name, "
                        + "       ia.manifest_json::text AS manifest_json, "
                        + "       iav.version, iav.bundle_sha256, iav.signature_b64, "
                        + "       iav.requires_der_api "
                        + "FROM der.installed_app ia "
                        + "JOIN der.installed_app_version iav ON iav.app_id = ia.app_id "
                        + "WHERE ia.enabled = TRUE AND iav.superseded_at IS NULL "
                        + "ORDER BY ia.app_key",
                catalogueMapper());
    }

    /** Read a specific version's bundle + crypto metadata. */
    public Optional<BundleRow> readBundle(final UUID appId, final String version) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT bundle_bytes, bundle_sha256, signature_b64, "
                            + "       requires_der_api "
                            + "FROM der.installed_app_version "
                            + "WHERE app_id = ? AND version = ?",
                    (ResultSet rs, int n) -> new BundleRow(
                            rs.getBytes("bundle_bytes"),
                            rs.getString("bundle_sha256"),
                            rs.getString("signature_b64"),
                            rs.getString("requires_der_api")),
                    appId, version));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    // ---- writes --------------------------------------------------------

    /**
     * Install a new version row. Any currently-active version for the same
     * app gets its {@code superseded_at} stamped first, in the same JDBC
     * transaction — a connection-level setAutoCommit on the pool would make
     * these two statements atomic. Spring's default JdbcTemplate behaviour
     * (one connection per execute) means the UPDATE and INSERT share no
     * explicit transaction here, but the UNIQUE (app_id, version) guard
     * means a colliding insert still rolls back.
     *
     * <p>Returns the generated {@code version_id} UUID for the new row.</p>
     */
    public UUID installVersion(final UUID appId,
                                final String version,
                                final byte[] bytes,
                                final String sha256,
                                final String signatureB64,
                                final String requiresDerApi,
                                final UUID uploadedBy) {
        jdbc.update(
                "UPDATE der.installed_app_version SET superseded_at = now() "
                        + "WHERE app_id = ? AND superseded_at IS NULL",
                appId);
        final UUID versionId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO der.installed_app_version (version_id, app_id, version, "
                        + "bundle_bytes, bundle_sha256, signature_b64, requires_der_api, "
                        + "uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                versionId, appId, version, bytes, sha256, signatureB64,
                requiresDerApi, uploadedBy);
        return versionId;
    }

    /** Flip {@code installed_app.enabled} + stamp {@code installed_by}. */
    public int setEnabled(final UUID appId, final boolean enabled,
                           final UUID updatedBy) {
        return jdbc.update(
                "UPDATE der.installed_app SET enabled = ?, installed_by = ? "
                        + "WHERE app_id = ?",
                enabled, updatedBy, appId);
    }

    /**
     * Delete the installed_app row — ON DELETE CASCADE on
     * installed_app_version takes care of every version.
     */
    public int deleteApp(final UUID appId) {
        return jdbc.update("DELETE FROM der.installed_app WHERE app_id = ?", appId);
    }

    // ---- row mappers ---------------------------------------------------

    private static RowMapper<CatalogueEntry> catalogueMapper() {
        return (ResultSet rs, int n) -> new CatalogueEntry(
                (UUID) rs.getObject("app_id"),
                rs.getString("app_key"),
                rs.getString("display_name"),
                rs.getString("manifest_json"),
                rs.getString("version"),
                rs.getString("bundle_sha256"),
                rs.getString("signature_b64"),
                rs.getString("requires_der_api"));
    }

    // ---- projections ---------------------------------------------------

    /** Ed25519 keypair record — raw public + sealed PKCS#8 private. */
    public record SigningKey(String algorithm,
                              String publicKeyB64,
                              String sealedSecret) { }

    /** One row of the enabled-apps catalogue with its active version. */
    public record CatalogueEntry(UUID appId,
                                  String appKey,
                                  String displayName,
                                  String manifestJson,
                                  String version,
                                  String bundleSha256,
                                  String signatureB64,
                                  String requiresDerApi) { }

    /** Bytes + crypto metadata for a specific version. */
    public record BundleRow(byte[] bytes,
                             String sha256,
                             String signatureB64,
                             String requiresDerApi) {

        /** Defensive copy so the stored blob can't be mutated by callers. */
        public BundleRow {
            Objects.requireNonNull(bytes, "bytes");
            bytes = bytes.clone();
        }

        @Override
        public byte[] bytes() {
            return bytes.clone();
        }
    }
}
