package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredDataElement(
        String dhis2Uid,
        String displayName,
        String valueType,
        String domainType,
        JsonNode payload
) implements MirroredEntity {

    public MirroredDataElement {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
