package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Edge-local store for enrolment notes (dashboard slice D). Notes
 * are append-only — operators can add, never edit/delete — matching
 * DHIS2's Note model where each note is immutable once stored. One
 * row per note, one enrolment per batch.
 */
@Repository
public class EnrolmentNoteRepository {

    private final JdbcTemplate jdbc;

    public EnrolmentNoteRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public EnrolmentNote insert(final EnrolmentNote n) {
        Objects.requireNonNull(n, "note");
        jdbc.update(
                "INSERT INTO der.edge_enrollment_note "
                        + "(note_uid, enrollment_uid, note_text, "
                        + " stored_by_dhis2_uid, created_by, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                n.noteUid(), n.enrollmentUid(), n.noteText(),
                n.storedByDhis2Uid(), n.createdBy(),
                Timestamp.from(n.createdAt()));
        return n;
    }

    /** Called by the drain on a successful central POST. Stamps
     *  the server-assigned (or replayed-client) UID so the dirty-
     *  subset lookup can exclude it on the next drain tick. */
    public int markSynced(final String noteUid, final String centralUid) {
        return jdbc.update(
                "UPDATE der.edge_enrollment_note "
                        + "SET central_uid = ? "
                        + "WHERE note_uid = ?",
                centralUid, noteUid);
    }

    public List<EnrolmentNote> findByEnrollment(final String enrollmentUid) {
        return jdbc.query(
                "SELECT note_uid, enrollment_uid, note_text, "
                        + " stored_by_dhis2_uid, created_by, created_at, "
                        + " central_uid "
                        + "FROM der.edge_enrollment_note "
                        + "WHERE enrollment_uid = ? "
                        + "ORDER BY created_at DESC",
                rowMapper(), enrollmentUid);
    }

    private RowMapper<EnrolmentNote> rowMapper() {
        return (ResultSet rs, int n) -> new EnrolmentNote(
                rs.getString("note_uid"),
                rs.getString("enrollment_uid"),
                rs.getString("note_text"),
                rs.getString("stored_by_dhis2_uid"),
                rs.getObject("created_by", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("central_uid"));
    }

    public record EnrolmentNote(
            String noteUid,
            String enrollmentUid,
            String noteText,
            String storedByDhis2Uid,
            UUID createdBy,
            Instant createdAt,
            String centralUid
    ) {

        public EnrolmentNote {
            Objects.requireNonNull(noteUid, "noteUid");
            Objects.requireNonNull(enrollmentUid, "enrollmentUid");
            Objects.requireNonNull(noteText, "noteText");
            Objects.requireNonNull(createdBy, "createdBy");
            Objects.requireNonNull(createdAt, "createdAt");
            if (!noteUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
                throw new IllegalArgumentException(
                        "noteUid must be an 11-char DHIS2 UID");
            }
            if (noteText.isBlank()) {
                throw new IllegalArgumentException(
                        "noteText must not be blank");
            }
        }
    }
}
