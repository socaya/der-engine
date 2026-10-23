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
        int version
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

    public enum Status { ACTIVE, COMPLETED, VISITED, SCHEDULED, OVERDUE, SKIPPED }
}
