package ug.ac.mak.der.workflows.tracker;

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

/** JDBC access over {@code der.edge_enrollment} (V027, FR-08). */
@Repository
public class EnrollmentRepository {

    private final JdbcTemplate jdbc;

    public EnrollmentRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Enrollment upsert(final Enrollment e) {
        Objects.requireNonNull(e, "enrollment");
        jdbc.update(
                "INSERT INTO der.edge_enrollment "
                        + "(enrollment_uid, tei_uid, program_uid, org_unit_uid, status, "
                        + "enrollment_date, incident_date, stored_by_dhis2_uid, "
                        + "created_by, created_at, updated_at, version) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (enrollment_uid) DO UPDATE SET "
                        + "status = EXCLUDED.status, incident_date = EXCLUDED.incident_date, "
                        + "stored_by_dhis2_uid = EXCLUDED.stored_by_dhis2_uid, "
                        + "updated_at = EXCLUDED.updated_at, "
                        + "version = der.edge_enrollment.version + 1",
                e.enrollmentUid(), e.teiUid(), e.programUid(), e.orgUnitUid(),
                e.status().name(), java.sql.Date.valueOf(e.enrollmentDate()),
                e.incidentDate() == null ? null : java.sql.Date.valueOf(e.incidentDate()),
                e.storedByDhis2Uid(), e.createdBy(),
                Timestamp.from(e.createdAt()), Timestamp.from(e.updatedAt()),
                e.version());
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
                rs.getInt("version"));
    }
}
