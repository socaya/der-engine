package ug.ac.mak.der.workflows.tracker;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** FR-08-06: typed relationship between tracker entities. */
public record TrackerRelationship(
        String relationshipUid,
        String relationshipType,
        EntityType fromEntityType,
        String fromEntityUid,
        EntityType toEntityType,
        String toEntityUid,
        boolean bidirectional,
        UUID createdBy,
        Instant createdAt
) {

    public TrackerRelationship {
        Objects.requireNonNull(relationshipUid, "relationshipUid");
        Objects.requireNonNull(relationshipType, "relationshipType");
        Objects.requireNonNull(fromEntityType, "fromEntityType");
        Objects.requireNonNull(fromEntityUid, "fromEntityUid");
        Objects.requireNonNull(toEntityType, "toEntityType");
        Objects.requireNonNull(toEntityUid, "toEntityUid");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        if (!relationshipUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException("relationshipUid must be 11-char DHIS2 UID");
        }
        if (fromEntityType == toEntityType && fromEntityUid.equals(toEntityUid)) {
            throw new IllegalArgumentException("relationship cannot point to itself");
        }
    }

    public enum EntityType { TRACKED_ENTITY, ENROLLMENT, EVENT }
}
