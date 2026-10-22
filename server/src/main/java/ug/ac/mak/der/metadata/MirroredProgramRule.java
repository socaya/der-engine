package ug.ac.mak.der.metadata;

import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredProgramRule(
        String dhis2Uid,
        String programUid,
        String displayName,
        Integer priority,
        String condition,
        List<MirroredProgramRuleAction> actions,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgramRule {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(condition, "condition");
        actions = actions == null ? List.of() : List.copyOf(actions);
        payload = MirroredEntity.requirePayload(payload);
    }
}
