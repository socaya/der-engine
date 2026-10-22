package ug.ac.mak.der.workflows.aggregate;

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
 * JDBC repository for {@code aggregate_data_value}.
 *
 * <p>Writes come exclusively through {@link AggregateDataValueService} which
 * wraps both this call and the matching {@link OperationJournalRepository}
 * insert in a single transaction (FR-09-02 atomic outbox).</p>
 */
@Repository
public class AggregateDataValueRepository {

    private final JdbcTemplate jdbc;

    public AggregateDataValueRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Insert a new row OR increment the existing version. Returns the stored
     * {@link AggregateDataValue} with its canonical valueVersion.
     *
     * <p>Uses Postgres {@code ON CONFLICT (compound_key)} so the DB enforces
     * the uniqueness invariant; concurrent commits deterministically produce
     * exactly one row.</p>
     */
    public AggregateDataValue upsert(final AggregateDataValue in) {
        final AggregateDataValue returned = jdbc.queryForObject(
                "INSERT INTO der.aggregate_data_value "
                        + "(value_id, data_element_uid, org_unit_uid, period_iso, "
                        + " category_option_combo_uid, attribute_option_combo_uid, "
                        + " value_text, comment, submitted_by, submitted_at, value_version) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) "
                        + "ON CONFLICT (data_element_uid, org_unit_uid, period_iso, "
                        + "              category_option_combo_uid, attribute_option_combo_uid) "
                        + "DO UPDATE SET value_text = EXCLUDED.value_text, "
                        + "              comment = EXCLUDED.comment, "
                        + "              submitted_by = EXCLUDED.submitted_by, "
                        + "              submitted_at = EXCLUDED.submitted_at, "
                        + "              value_version = der.aggregate_data_value.value_version + 1 "
                        + "RETURNING value_id, data_element_uid, org_unit_uid, period_iso, "
                        + "          category_option_combo_uid, attribute_option_combo_uid, "
                        + "          value_text, comment, submitted_by, submitted_at, value_version",
                rowMapper(),
                in.valueId(),
                in.dataElementUid(),
                in.orgUnitUid(),
                in.periodIso(),
                in.categoryOptionComboUid(),
                in.attributeOptionComboUid(),
                in.valueText(),
                in.comment(),
                in.submittedBy(),
                Timestamp.from(in.submittedAt())
        );
        return Objects.requireNonNull(returned, "RETURNING must yield a row");
    }

    public Optional<AggregateDataValue> findById(final UUID valueId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT value_id, data_element_uid, org_unit_uid, period_iso, "
                            + "category_option_combo_uid, attribute_option_combo_uid, "
                            + "value_text, comment, submitted_by, submitted_at, value_version "
                            + "FROM der.aggregate_data_value WHERE value_id = ?",
                    rowMapper(),
                    valueId
            ));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public boolean existsById(final UUID valueId) {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.aggregate_data_value WHERE value_id = ?",
                Integer.class,
                valueId
        );
        return n != null && n > 0;
    }

    /**
     * Filter by orgUnit and/or period. Any {@code null} parameter is a wildcard.
     * Returns results stable-ordered by submitted-time desc.
     */
    public List<AggregateDataValue> findByFilter(final String orgUnitUid, final String periodIso,
                                                  final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        final StringBuilder sql = new StringBuilder(
                "SELECT value_id, data_element_uid, org_unit_uid, period_iso, "
                        + "category_option_combo_uid, attribute_option_combo_uid, "
                        + "value_text, comment, submitted_by, submitted_at, value_version "
                        + "FROM der.aggregate_data_value WHERE 1=1");
        final List<Object> args = new java.util.ArrayList<>();
        if (orgUnitUid != null && !orgUnitUid.isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(orgUnitUid);
        }
        if (periodIso != null && !periodIso.isBlank()) {
            sql.append(" AND period_iso = ?");
            args.add(periodIso);
        }
        sql.append(" ORDER BY submitted_at DESC LIMIT ?");
        args.add(capped);
        return jdbc.query(sql.toString(), rowMapper(), args.toArray());
    }

    public List<AggregateDataValue> findRecentByUser(final UUID userId, final int limit) {
        final int capped = Math.max(1, Math.min(limit, 100));
        return jdbc.query(
                "SELECT value_id, data_element_uid, org_unit_uid, period_iso, "
                        + "category_option_combo_uid, attribute_option_combo_uid, "
                        + "value_text, comment, submitted_by, submitted_at, value_version "
                        + "FROM der.aggregate_data_value "
                        + "WHERE submitted_by = ? ORDER BY submitted_at DESC LIMIT ?",
                rowMapper(),
                userId,
                capped
        );
    }

    private static RowMapper<AggregateDataValue> rowMapper() {
        return (ResultSet rs, int rowNum) -> new AggregateDataValue(
                rs.getObject("value_id", UUID.class),
                rs.getString("data_element_uid"),
                rs.getString("org_unit_uid"),
                rs.getString("period_iso"),
                rs.getString("category_option_combo_uid"),
                rs.getString("attribute_option_combo_uid"),
                rs.getString("value_text"),
                rs.getString("comment"),
                rs.getObject("submitted_by", UUID.class),
                rs.getTimestamp("submitted_at").toInstant(),
                rs.getInt("value_version")
        );
    }
}
