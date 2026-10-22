package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredDataSet(
        String dhis2Uid,
        String displayName,
        String periodType,
        JsonNode payload
) implements MirroredEntity {

    public MirroredDataSet {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
