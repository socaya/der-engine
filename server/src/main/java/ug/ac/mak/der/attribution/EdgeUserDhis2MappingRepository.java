package ug.ac.mak.der.attribution;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * JDBC access over {@code der.edge_user_dhis2_mapping} (V026, ADR-0032).
 */
@Repository
public class EdgeUserDhis2MappingRepository {

    private final JdbcTemplate jdbc;

    public EdgeUserDhis2MappingRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public EdgeUserDhis2Mapping upsert(final EdgeUserDhis2Mapping mapping) {
        Objects.requireNonNull(mapping, "mapping");
        /* Three-way credential handling on upsert: null credentialCipher
         * on the incoming mapping = 'leave existing secret alone' so an
         * operator who only edits displayName doesn't clobber the
         * stored token; blank credentialCipher (= '') would clear it if
         * ever supplied, but the controller doesn't surface that shape.
         * The credential_cipher column is updated in a separate COALESCE
         * clause that preserves the existing value when the new mapping
         * has none. */
        jdbc.update(
                "INSERT INTO der.edge_user_dhis2_mapping "
                        + "(edge_user_id, dhis2_user_uid, dhis2_username, dhis2_display_name, "
                        + "mapped_at, mapped_by, last_verified_at, "
                        + "auth_type, credential_cipher, credential_set_at, credential_set_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (edge_user_id) DO UPDATE SET "
                        + "dhis2_user_uid = EXCLUDED.dhis2_user_uid, "
                        + "dhis2_username = EXCLUDED.dhis2_username, "
                        + "dhis2_display_name = EXCLUDED.dhis2_display_name, "
                        + "mapped_at = EXCLUDED.mapped_at, "
                        + "mapped_by = EXCLUDED.mapped_by, "
                        + "last_verified_at = EXCLUDED.last_verified_at, "
                        + "auth_type = COALESCE(EXCLUDED.auth_type, der.edge_user_dhis2_mapping.auth_type), "
                        + "credential_cipher = COALESCE(EXCLUDED.credential_cipher, der.edge_user_dhis2_mapping.credential_cipher), "
                        + "credential_set_at = COALESCE(EXCLUDED.credential_set_at, der.edge_user_dhis2_mapping.credential_set_at), "
                        + "credential_set_by = COALESCE(EXCLUDED.credential_set_by, der.edge_user_dhis2_mapping.credential_set_by)",
                mapping.edgeUserId(),
                mapping.dhis2UserUid(),
                mapping.dhis2Username(),
                mapping.dhis2DisplayName(),
                Timestamp.from(mapping.mappedAt()),
                mapping.mappedBy(),
                mapping.lastVerifiedAt() == null ? null : Timestamp.from(mapping.lastVerifiedAt()),
                mapping.authType() == null ? null : mapping.authType().name(),
                mapping.credentialCipher(),
                mapping.credentialSetAt() == null ? null : Timestamp.from(mapping.credentialSetAt()),
                mapping.credentialSetBy());
        return mapping;
    }

    /** Clear just the credential envelope without deleting the mapping. */
    public int clearCredential(final UUID edgeUserId) {
        return jdbc.update(
                "UPDATE der.edge_user_dhis2_mapping SET "
                        + "credential_cipher = NULL, "
                        + "credential_set_at = NULL, "
                        + "credential_set_by = NULL "
                        + "WHERE edge_user_id = ?",
                edgeUserId);
    }

    public Optional<EdgeUserDhis2Mapping> findByEdgeUser(final UUID edgeUserId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT * FROM der.edge_user_dhis2_mapping WHERE edge_user_id = ?",
                    rowMapper(), edgeUserId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<EdgeUserDhis2Mapping> findAll() {
        return jdbc.query(
                "SELECT * FROM der.edge_user_dhis2_mapping ORDER BY dhis2_username",
                rowMapper());
    }

    public int delete(final UUID edgeUserId) {
        return jdbc.update(
                "DELETE FROM der.edge_user_dhis2_mapping WHERE edge_user_id = ?",
                edgeUserId);
    }

    private static RowMapper<EdgeUserDhis2Mapping> rowMapper() {
        return (ResultSet rs, int n) -> {
            final Timestamp lastVerified = rs.getTimestamp("last_verified_at");
            final Timestamp credSetAt = rs.getTimestamp("credential_set_at");
            final String authType = rs.getString("auth_type");
            return new EdgeUserDhis2Mapping(
                    rs.getObject("edge_user_id", UUID.class),
                    rs.getString("dhis2_user_uid"),
                    rs.getString("dhis2_username"),
                    rs.getString("dhis2_display_name"),
                    rs.getTimestamp("mapped_at").toInstant(),
                    rs.getObject("mapped_by", UUID.class),
                    lastVerified == null ? null : lastVerified.toInstant(),
                    authType == null ? null : EdgeUserDhis2Mapping.AuthType.valueOf(authType),
                    rs.getString("credential_cipher"),
                    credSetAt == null ? null : credSetAt.toInstant(),
                    rs.getObject("credential_set_by", UUID.class));
        };
    }
}
