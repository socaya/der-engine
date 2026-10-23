package ug.ac.mak.der.workflows.tracker;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** FR-08: tracker enrollment row. */
public record Enrollment(
        String enrollmentUid,
        String teiUid,
        String programUid,
        String orgUnitUid,
        Status status,
        LocalDate enrollmentDate,
        LocalDate incidentDate,
        String storedByDhis2Uid,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        int version
) {

    public Enrollment {
        Objects.requireNonNull(enrollmentUid, "enrollmentUid");
        Objects.requireNonNull(teiUid, "teiUid");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(enrollmentDate, "enrollmentDate");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (!enrollmentUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException("enrollmentUid must be 11-char DHIS2 UID");
        }
    }

    public enum Status { ACTIVE, COMPLETED, CANCELLED }
}
