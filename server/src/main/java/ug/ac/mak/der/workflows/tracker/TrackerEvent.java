package ug.ac.mak.der.workflows.tracker;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** FR-08: tracker-stage event row. */
public record TrackerEvent(
        String eventUid,
        String enrollmentUid,
        String programUid,
        String programStageUid,
        String orgUnitUid,
        Status status,
        LocalDate occurredDate,
        Map<String, Object> dataValues,
        String storedByDhis2Uid,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        int version,
        /** §2.3.89 R-C/3 — capture workflow run that produced this
         *  tracker event. See {@link ug.ac.mak.der.workflows.tracker.Enrollment#workflowRunId()}. */
        UUID workflowRunId
) {

    public TrackerEvent {
        Objects.requireNonNull(eventUid, "eventUid");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(programStageUid, "programStageUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredDate, "occurredDate");
        Objects.requireNonNull(dataValues, "dataValues");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (!eventUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException("eventUid must be 11-char DHIS2 UID");
        }
    }

    /** Back-compat ctor — nulls {@link #workflowRunId}. */
    public TrackerEvent(final String eventUid, final String enrollmentUid,
                          final String programUid, final String programStageUid,
                          final String orgUnitUid, final Status status,
                          final LocalDate occurredDate,
                          final Map<String, Object> dataValues,
                          final String storedByDhis2Uid, final UUID createdBy,
                          final Instant createdAt, final Instant updatedAt,
                          final int version) {
        this(eventUid, enrollmentUid, programUid, programStageUid, orgUnitUid,
             status, occurredDate, dataValues, storedByDhis2Uid, createdBy,
             createdAt, updatedAt, version, null);
    }

    public enum Status { ACTIVE, COMPLETED, VISITED, SCHEDULED, OVERDUE, SKIPPED }
}
