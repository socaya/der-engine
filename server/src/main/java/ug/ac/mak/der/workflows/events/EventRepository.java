package ug.ac.mak.der.workflows.events;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Postgres repository for {@code der.event} + {@code der.event_data_value}. */
@Repository
public class EventRepository {

    private final JdbcTemplate jdbc;

    public EventRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Transactional
    public Event upsert(final Event in) {
        final Integer version = jdbc.queryForObject(
                "INSERT INTO der.event (event_id, enrollment_id, program_uid, program_stage_uid, "
                        + "org_unit_uid, occurred_at, status, attribute_option_combo_uid, "
                        + "created_by, event_version) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) "
                        + "ON CONFLICT (event_id) DO UPDATE SET "
                        + "occurred_at = EXCLUDED.occurred_at, status = EXCLUDED.status, "
                        + "attribute_option_combo_uid = EXCLUDED.attribute_option_combo_uid, "
                        + "event_version = der.event.event_version + 1 "
                        + "RETURNING event_version",
                Integer.class,
                in.eventId(), in.enrollmentId(), in.programUid(), in.programStageUid(),
                in.orgUnitUid(), Timestamp.from(in.occurredAt()), in.status().name(),
                in.attributeOptionComboUid(), in.createdBy());
        jdbc.update("DELETE FROM der.event_data_value WHERE event_id = ?", in.eventId());
        for (final Map.Entry<String, String> dv : in.dataValues().entrySet()) {
            jdbc.update(
                    "INSERT INTO der.event_data_value (event_id, data_element_uid, value_text) "
                            + "VALUES (?, ?, ?)",
                    in.eventId(), dv.getKey(), dv.getValue());
        }
        return new Event(in.eventId(), in.enrollmentId(), in.programUid(), in.programStageUid(),
                in.orgUnitUid(), in.occurredAt(), in.status(), in.attributeOptionComboUid(),
                in.createdBy(), version == null ? 1 : version, in.dataValues());
    }

    public Optional<Event> findById(final UUID eventId) {
        final Event base;
        try {
            base = jdbc.queryForObject(
                    "SELECT event_id, enrollment_id, program_uid, program_stage_uid, org_unit_uid, "
                            + "occurred_at, status, attribute_option_combo_uid, created_by, event_version "
                            + "FROM der.event WHERE event_id = ?",
                    rowMapper(Map.of()), eventId);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
        return base == null ? Optional.empty() : Optional.of(withDataValues(base));
    }

    public List<Event> findByProgramAndOrgUnit(final String programUid, final String orgUnitUid,
                                                final int limit) {
        final List<Event> rows = jdbc.query(
                "SELECT event_id, enrollment_id, program_uid, program_stage_uid, org_unit_uid, "
                        + "occurred_at, status, attribute_option_combo_uid, created_by, event_version "
                        + "FROM der.event WHERE program_uid = ? AND org_unit_uid = ? "
                        + "ORDER BY occurred_at DESC LIMIT ?",
                rowMapper(Map.of()), programUid, orgUnitUid, Math.max(1, Math.min(500, limit)));
        final List<Event> out = new ArrayList<>(rows.size());
        for (final Event e : rows) {
            out.add(withDataValues(e));
        }
        return out;
    }

    public List<Event> findForEnrollment(final UUID enrollmentId) {
        final List<Event> rows = jdbc.query(
                "SELECT event_id, enrollment_id, program_uid, program_stage_uid, org_unit_uid, "
                        + "occurred_at, status, attribute_option_combo_uid, created_by, event_version "
                        + "FROM der.event WHERE enrollment_id = ? ORDER BY occurred_at",
                rowMapper(Map.of()), enrollmentId);
        final List<Event> out = new ArrayList<>(rows.size());
        for (final Event e : rows) {
            out.add(withDataValues(e));
        }
        return out;
    }

    public boolean existsById(final UUID eventId) {
        final Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.event WHERE event_id = ?", Integer.class, eventId);
        return count != null && count > 0;
    }

    private Event withDataValues(final Event base) {
        final Map<String, String> values = new LinkedHashMap<>();
        jdbc.query(
                "SELECT data_element_uid, value_text FROM der.event_data_value WHERE event_id = ?",
                rs -> {
                    values.put(rs.getString("data_element_uid"), rs.getString("value_text"));
                }, base.eventId());
        return new Event(base.eventId(), base.enrollmentId(), base.programUid(),
                base.programStageUid(), base.orgUnitUid(), base.occurredAt(), base.status(),
                base.attributeOptionComboUid(), base.createdBy(), base.eventVersion(), values);
    }

    private RowMapper<Event> rowMapper(final Map<String, String> values) {
        return (ResultSet rs, int row) -> new Event(
                (UUID) rs.getObject("event_id"),
                (UUID) rs.getObject("enrollment_id"),
                rs.getString("program_uid"),
                rs.getString("program_stage_uid"),
                rs.getString("org_unit_uid"),
                rs.getTimestamp("occurred_at").toInstant(),
                Event.Status.valueOf(rs.getString("status")),
                rs.getString("attribute_option_combo_uid"),
                (UUID) rs.getObject("created_by"),
                rs.getInt("event_version"),
                values);
    }
}
