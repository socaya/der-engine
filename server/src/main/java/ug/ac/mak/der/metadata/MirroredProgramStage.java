package ug.ac.mak.der.metadata;

import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredProgramStage(
        String dhis2Uid,
        String programUid,
        String displayName,
        boolean repeatable,
        List<ProgramStageDataElement> dataElements,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgramStage {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(displayName, "displayName");
        dataElements = dataElements == null ? List.of() : List.copyOf(dataElements);
        payload = MirroredEntity.requirePayload(payload);
    }

    public record ProgramStageDataElement(
            String dataElementUid,
            boolean compulsory,
            Integer sortOrder
    ) {

        public ProgramStageDataElement {
            Objects.requireNonNull(dataElementUid, "dataElementUid");
        }
    }
}
