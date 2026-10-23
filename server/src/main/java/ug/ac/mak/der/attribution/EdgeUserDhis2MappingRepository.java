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
        jdbc.update(
                "INSERT INTO der.edge_user_dhis2_mapping "
                        + "(edge_user_id, dhis2_user_uid, dhis2_username, dhis2_display_name, "
                        + "mapped_at, mapped_by, last_verified_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (edge_user_id) DO UPDATE SET "
                        + "dhis2_user_uid = EXCLUDED.dhis2_user_uid, "
                        + "dhis2_username = EXCLUDED.dhis2_username, "
                        + "dhis2_display_name = EXCLUDED.dhis2_display_name, "
                        + "mapped_at = EXCLUDED.mapped_at, "
                        + "mapped_by = EXCLUDED.mapped_by, "
                        + "last_verified_at = EXCLUDED.last_verified_at",
                mapping.edgeUserId(),
                mapping.dhis2UserUid(),
                mapping.dhis2Username(),
                mapping.dhis2DisplayName(),
                Timestamp.from(mapping.mappedAt()),
                mapping.mappedBy(),
                mapping.lastVerifiedAt() == null ? null : Timestamp.from(mapping.lastVerifiedAt()));
        return mapping;
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
            return new EdgeUserDhis2Mapping(
                    rs.getObject("edge_user_id", UUID.class),
                    rs.getString("dhis2_user_uid"),
                    rs.getString("dhis2_username"),
                    rs.getString("dhis2_display_name"),
                    rs.getTimestamp("mapped_at").toInstant(),
                    rs.getObject("mapped_by", UUID.class),
                    lastVerified == null ? null : lastVerified.toInstant());
        };
    }
}
