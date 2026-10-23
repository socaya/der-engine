package ug.ac.mak.der.orgunit;

import java.sql.Timestamp;
import java.util.Objects;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC repository over the {@code der.edge_node} singleton for the
 * orgUnit binding columns added in V012. ADR-0015.
 */
@Repository
public class EdgeOrgUnitBindingRepository {

    private final JdbcTemplate jdbc;

    public EdgeOrgUnitBindingRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public EdgeOrgUnitBinding read() {
        try {
            return Objects.requireNonNull(jdbc.queryForObject(
                    "SELECT org_unit_id, org_unit_display_name, org_unit_path, "
                            + "org_unit_bound_at, org_unit_bound_by "
                            + "FROM der.edge_node LIMIT 1",
                    (rs, row) -> {
                        final Timestamp boundAt = rs.getTimestamp("org_unit_bound_at");
                        final UUID boundBy = (UUID) rs.getObject("org_unit_bound_by");
                        return new EdgeOrgUnitBinding(
                                rs.getString("org_unit_id"),
                                rs.getString("org_unit_display_name"),
                                rs.getString("org_unit_path"),
                                boundAt == null ? null : boundAt.toInstant(),
                                boundBy);
                    }));
        } catch (EmptyResultDataAccessException ex) {
            // der.edge_node singleton has not been provisioned yet.
            return EdgeOrgUnitBinding.empty();
        }
    }

    public int write(final EdgeOrgUnitBinding binding) {
        return jdbc.update(
                "UPDATE der.edge_node SET org_unit_id = ?, org_unit_display_name = ?, "
                        + "org_unit_path = ?, org_unit_bound_at = ?, org_unit_bound_by = ?",
                binding.orgUnitId(),
                binding.orgUnitDisplayName(),
                binding.orgUnitPath(),
                binding.boundAt() == null ? null : Timestamp.from(binding.boundAt()),
                binding.boundBy());
    }

    /** Returns true if the orgUnit (by id) sits under the bound sub-tree. */
    public boolean isUnderBoundSubtree(final EdgeOrgUnitBinding binding, final String candidateOrgUnitPath) {
        if (binding == null || !binding.isBound()) {
            return false;
        }
        if (candidateOrgUnitPath == null) {
            return false;
        }
        final String bound = binding.orgUnitPath();
        if (candidateOrgUnitPath.equals(bound)) {
            return true;
        }
        return candidateOrgUnitPath.startsWith(bound + "/");
    }

    /** Resolves the DHIS2-shaped path for an orgUnit id by reading the mirror. */
    public String resolveOrgUnitPath(final String orgUnitId) {
        if (orgUnitId == null) {
            return null;
        }
        try {
            return jdbc.queryForObject(
                    "SELECT COALESCE(path, '/' || dhis2_uid) "
                            + "FROM der.metadata_organisation_unit "
                            + "WHERE dhis2_uid = ? LIMIT 1",
                    String.class, orgUnitId);
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    /** Resolves the display name for an orgUnit id by reading the mirror. */
    public String resolveOrgUnitDisplayName(final String orgUnitId) {
        if (orgUnitId == null) {
            return null;
        }
        try {
            return jdbc.queryForObject(
                    "SELECT display_name FROM der.metadata_organisation_unit "
                            + "WHERE dhis2_uid = ? LIMIT 1",
                    String.class, orgUnitId);
        } catch (EmptyResultDataAccessException ex) {
            return orgUnitId;
        }
    }
}
