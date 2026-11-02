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
        int version,
        /** §2.3.89 R-C/3 — capture workflow run that produced this
         *  enrollment. Nullable at the record level; the DB enforces
         *  NOT NULL after V078 so the controller layer must thread a
         *  run id (SYS TRACKER_CAPTURE auto-wrap handles passthrough). */
        UUID workflowRunId
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

    /** Back-compat ctor — nulls {@link #workflowRunId}. */
    public Enrollment(final String enrollmentUid, final String teiUid,
                        final String programUid, final String orgUnitUid,
                        final Status status, final LocalDate enrollmentDate,
                        final LocalDate incidentDate, final String storedByDhis2Uid,
                        final UUID createdBy, final Instant createdAt,
                        final Instant updatedAt, final int version) {
        this(enrollmentUid, teiUid, programUid, orgUnitUid, status, enrollmentDate,
             incidentDate, storedByDhis2Uid, createdBy, createdAt, updatedAt,
             version, null);
    }

    public enum Status { ACTIVE, COMPLETED, CANCELLED }
}
