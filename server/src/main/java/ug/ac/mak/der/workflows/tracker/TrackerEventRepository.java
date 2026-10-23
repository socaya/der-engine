package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC access over {@code der.edge_tracker_event} (V027, FR-08). */
@Repository
public class TrackerEventRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public TrackerEventRepository(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public TrackerEvent upsert(final TrackerEvent e) {
        Objects.requireNonNull(e, "event");
        final String dvJson = writeJson(e.dataValues());
        jdbc.update(
                "INSERT INTO der.edge_tracker_event "
                        + "(event_uid, enrollment_uid, program_uid, program_stage_uid, "
                        + "org_unit_uid, status, occurred_date, data_values, "
                        + "stored_by_dhis2_uid, created_by, created_at, updated_at, version) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (event_uid) DO UPDATE SET "
                        + "status = EXCLUDED.status, "
                        + "data_values = EXCLUDED.data_values, "
                        + "stored_by_dhis2_uid = EXCLUDED.stored_by_dhis2_uid, "
                        + "updated_at = EXCLUDED.updated_at, "
                        + "version = der.edge_tracker_event.version + 1",
                e.eventUid(), e.enrollmentUid(), e.programUid(), e.programStageUid(),
                e.orgUnitUid(), e.status().name(),
                java.sql.Date.valueOf(e.occurredDate()), dvJson,
                e.storedByDhis2Uid(), e.createdBy(),
                Timestamp.from(e.createdAt()), Timestamp.from(e.updatedAt()),
                e.version());
        return e;
    }

    public Optional<TrackerEvent> findById(final String uid) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT event_uid, enrollment_uid, program_uid, program_stage_uid, "
                            + "org_unit_uid, status, occurred_date, "
                            + "data_values::text AS data_values, "
                            + "stored_by_dhis2_uid, created_by, created_at, updated_at, version "
                            + "FROM der.edge_tracker_event WHERE event_uid = ?",
                    rowMapper(), uid));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<TrackerEvent> findByEnrollment(final String enrollmentUid) {
        return jdbc.query(
                "SELECT event_uid, enrollment_uid, program_uid, program_stage_uid, "
                        + "org_unit_uid, status, occurred_date, "
                        + "data_values::text AS data_values, "
                        + "stored_by_dhis2_uid, created_by, created_at, updated_at, version "
                        + "FROM der.edge_tracker_event WHERE enrollment_uid = ? "
                        + "ORDER BY occurred_date DESC",
                rowMapper(), enrollmentUid);
    }

    public int delete(final String uid) {
        return jdbc.update("DELETE FROM der.edge_tracker_event WHERE event_uid = ?", uid);
    }

    private String writeJson(final Map<String, Object> dv) {
        try {
            return mapper.writeValueAsString(dv == null ? Map.of() : dv);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("data_values serialization failed", ex);
        }
    }

    private RowMapper<TrackerEvent> rowMapper() {
        return (ResultSet rs, int n) -> {
            Map<String, Object> dv;
            try {
                dv = mapper.readValue(rs.getString("data_values"), Map.class);
            } catch (Exception ex) {
                dv = Map.of();
            }
            return new TrackerEvent(
                    rs.getString("event_uid"),
                    rs.getString("enrollment_uid"),
                    rs.getString("program_uid"),
                    rs.getString("program_stage_uid"),
                    rs.getString("org_unit_uid"),
                    TrackerEvent.Status.valueOf(rs.getString("status")),
                    rs.getDate("occurred_date").toLocalDate(),
                    dv,
                    rs.getString("stored_by_dhis2_uid"),
                    rs.getObject("created_by", UUID.class),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("updated_at").toInstant(),
                    rs.getInt("version"));
        };
    }
}
