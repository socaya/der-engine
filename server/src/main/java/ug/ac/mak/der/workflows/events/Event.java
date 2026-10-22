package ug.ac.mak.der.workflows.events;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Edge-stored event, mirroring the DHIS2 2.44 tracker event shape.
 *
 * <p>{@code enrollmentId} is {@code null} for events in single-event programs
 * ({@code programType=WITHOUT_REGISTRATION}); a tracker-program event
 * ({@code WITH_REGISTRATION}) must reference an enrollment.</p>
 */
public record Event(
        UUID eventId,
        UUID enrollmentId,
        String programUid,
        String programStageUid,
        String orgUnitUid,
        Instant occurredAt,
        Status status,
        String attributeOptionComboUid,
        UUID createdBy,
        int eventVersion,
        Map<String, String> dataValues
) {

    public Event {
        Objects.requireNonNull(eventId, "eventId");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(programStageUid, "programStageUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdBy, "createdBy");
        attributeOptionComboUid = attributeOptionComboUid == null
                ? "HllvX50cXC0" : attributeOptionComboUid;
        dataValues = dataValues == null ? Map.of()
                : Map.copyOf(new LinkedHashMap<>(dataValues));
    }

    public enum Status { ACTIVE, COMPLETED, VISITED, SCHEDULE, OVERDUE, SKIPPED }
}
