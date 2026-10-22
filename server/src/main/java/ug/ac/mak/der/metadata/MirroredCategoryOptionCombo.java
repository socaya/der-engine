package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredCategoryOptionCombo(
        String dhis2Uid,
        String displayName,
        String categoryComboUid,
        JsonNode payload
) implements MirroredEntity {

    public MirroredCategoryOptionCombo {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
