package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import ug.ac.mak.der.analytics.engine.AnalyticsSourceEvent;

/** JDBC access over {@code der.edge_enrollment} (V027, FR-08). */
@Repository
public class EnrollmentRepository {

    private final JdbcTemplate jdbc;
    private ApplicationEventPublisher events;

    public EnrollmentRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Autowired(required = false)
    public void setEvents(final ApplicationEventPublisher events) {
        this.events = events;
    }

    public Enrollment upsert(final Enrollment e) {
        Objects.requireNonNull(e, "enrollment");
        jdbc.update(
                "INSERT INTO der.edge_enrollment "
                        + "(enrollment_uid, tei_uid, program_uid, org_unit_uid, status, "
                        + "enrollment_date, incident_date, stored_by_dhis2_uid, "
                        + "created_by, created_at, updated_at, version, workflow_run_id) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (enrollment_uid) DO UPDATE SET "
                        + "status = EXCLUDED.status, incident_date = EXCLUDED.incident_date, "
                        + "stored_by_dhis2_uid = EXCLUDED.stored_by_dhis2_uid, "
                        + "updated_at = EXCLUDED.updated_at, "
                        + "version = der.edge_enrollment.version + 1, "
                        + "workflow_run_id = COALESCE(EXCLUDED.workflow_run_id, "
                        + "                            der.edge_enrollment.workflow_run_id)",
                e.enrollmentUid(), e.teiUid(), e.programUid(), e.orgUnitUid(),
                e.status().name(), java.sql.Date.valueOf(e.enrollmentDate()),
                e.incidentDate() == null ? null : java.sql.Date.valueOf(e.incidentDate()),
                e.storedByDhis2Uid(), e.createdBy(),
                Timestamp.from(e.createdAt()), Timestamp.from(e.updatedAt()),
                e.version(), e.workflowRunId());
        // Analytics Phase 2b — publish for the live ingester.
        if (events != null) {
            try {
                events.publishEvent(new AnalyticsSourceEvent(
                        AnalyticsSourceEvent.SourceType.ENROLLMENT,
                        e.enrollmentUid(), e.version(), e.enrollmentDate(),
                        e.orgUnitUid(), e.status().name()));
            } catch (RuntimeException ignored) {
                // intentionally swallowed; see Analytics Phase 2b note
            }
        }
        return e;
    }

    public Optional<Enrollment> findById(final String uid) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT * FROM der.edge_enrollment WHERE enrollment_uid = ?",
                    mapper(), uid));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<Enrollment> findByTei(final String teiUid) {
        return jdbc.query(
                "SELECT * FROM der.edge_enrollment WHERE tei_uid = ? ORDER BY enrollment_date DESC",
                mapper(), teiUid);
    }

    public List<Enrollment> findByProgram(final String programUid, final int limit) {
        return jdbc.query(
                "SELECT * FROM der.edge_enrollment WHERE program_uid = ? "
                        + "ORDER BY enrollment_date DESC LIMIT ?",
                mapper(), programUid, limit);
    }

    public int delete(final String uid) {
        return jdbc.update("DELETE FROM der.edge_enrollment WHERE enrollment_uid = ?", uid);
    }

    /**
     * Phase 10.1 — enrollments whose {@code tei_uid} does not match
     * any row in {@code tracked_entity}. Produced by inbound pulls
     * that landed an enrolment before its parent TEI (central may
     * split them across two /api/tracker ticks), or by a central
     * cascade delete DER hasn't picked up yet.
     */
    public List<Enrollment> findOrphans(final int limit) {
        return jdbc.query(
                "SELECT en.* FROM der.edge_enrollment en "
                        + "LEFT JOIN der.tracked_entity te "
                        + "       ON te.tei_uid = en.tei_uid "
                        + "WHERE te.tei_uid IS NULL "
                        + "ORDER BY en.updated_at DESC LIMIT ?",
                mapper(), Math.max(1, Math.min(limit, 500)));
    }

    private static RowMapper<Enrollment> mapper() {
        return (ResultSet rs, int n) -> new Enrollment(
                rs.getString("enrollment_uid"),
                rs.getString("tei_uid"),
                rs.getString("program_uid"),
                rs.getString("org_unit_uid"),
                Enrollment.Status.valueOf(rs.getString("status")),
                rs.getDate("enrollment_date").toLocalDate(),
                rs.getDate("incident_date") == null ? null
                        : rs.getDate("incident_date").toLocalDate(),
                rs.getString("stored_by_dhis2_uid"),
                rs.getObject("created_by", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getInt("version"),
                rs.getObject("workflow_run_id", UUID.class));
    }
}
