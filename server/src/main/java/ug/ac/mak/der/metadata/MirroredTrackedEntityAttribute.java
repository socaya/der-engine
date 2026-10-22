package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredTrackedEntityAttribute(
        String dhis2Uid,
        String displayName,
        String valueType,
        boolean uniqueAttribute,
        JsonNode payload
) implements MirroredEntity {

    public MirroredTrackedEntityAttribute {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(valueType, "valueType");
        payload = MirroredEntity.requirePayload(payload);
    }
}
