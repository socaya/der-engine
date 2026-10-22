package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredTrackedEntityType(
        String dhis2Uid,
        String displayName,
        JsonNode payload
) implements MirroredEntity {

    public MirroredTrackedEntityType {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
