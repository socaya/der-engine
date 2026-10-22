package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredProgram(
        String dhis2Uid,
        String displayName,
        String programType,
        String trackedEntityTypeUid,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgram {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
