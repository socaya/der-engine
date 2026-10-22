package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredOrganisationUnit(
        String dhis2Uid,
        String displayName,
        String path,
        Integer level,
        String parentUid,
        JsonNode payload
) implements MirroredEntity {

    public MirroredOrganisationUnit {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
