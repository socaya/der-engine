package ug.ac.mak.der.workflows.aggregate;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** FR-06-06: dataset completeness state. */
@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class DatasetCompletionRepository {

    public static final String DEFAULT_AOC = "HllvX50cXC0";

    private final JdbcTemplate jdbc;

    public DatasetCompletionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Record upsert(final String dataSet, final String orgUnit,
                           final String period, final String aoc,
                           final boolean completed, final UUID completedBy,
                           final Instant completedAt) {
        final String effectiveAoc = aoc == null || aoc.isBlank() ? DEFAULT_AOC : aoc;
        jdbc.update(
                "INSERT INTO der.dataset_completion "
                        + "(data_set_uid, org_unit_uid, period_iso, attribute_option_combo, "
                        + " completed, completed_by, completed_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (data_set_uid, org_unit_uid, period_iso, attribute_option_combo) "
                        + "DO UPDATE SET completed = EXCLUDED.completed, "
                        + "               completed_by = EXCLUDED.completed_by, "
                        + "               completed_at = EXCLUDED.completed_at",
                dataSet, orgUnit, period, effectiveAoc, completed, completedBy,
                Timestamp.from(completedAt));
        return new Record(dataSet, orgUnit, period, effectiveAoc, completed,
                completedBy, completedAt);
    }

    public Optional<Record> find(final String dataSet, final String orgUnit,
                                   final String period, final String aoc) {
        final String effectiveAoc = aoc == null || aoc.isBlank() ? DEFAULT_AOC : aoc;
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT data_set_uid, org_unit_uid, period_iso, attribute_option_combo, "
                            + "completed, completed_by, completed_at "
                            + "FROM der.dataset_completion "
                            + "WHERE data_set_uid = ? AND org_unit_uid = ? "
                            + "  AND period_iso = ? AND attribute_option_combo = ?",
                    mapper(), dataSet, orgUnit, period, effectiveAoc));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<Record> listByOrgUnit(final String orgUnit) {
        if (orgUnit == null) {
            return List.of();
        }
        return jdbc.query(
                "SELECT data_set_uid, org_unit_uid, period_iso, attribute_option_combo, "
                        + "completed, completed_by, completed_at "
                        + "FROM der.dataset_completion WHERE org_unit_uid = ? "
                        + "ORDER BY completed_at DESC",
                mapper(), orgUnit);
    }

    private RowMapper<Record> mapper() {
        return (ResultSet rs, int row) -> new Record(
                rs.getString("data_set_uid"),
                rs.getString("org_unit_uid"),
                rs.getString("period_iso"),
                rs.getString("attribute_option_combo"),
                rs.getBoolean("completed"),
                (UUID) rs.getObject("completed_by"),
                rs.getTimestamp("completed_at").toInstant());
    }

    public record Record(String dataSet, String orgUnit, String period, String aoc,
                           boolean completed, UUID completedBy, Instant completedAt) { }
}
