package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

public record MirroredProgramRuleAction(
        String dhis2Uid,
        String programRuleUid,
        String actionType,
        String dataElementUid,
        String trackedEntityAttributeUid,
        String dataExpression,
        String content,
        JsonNode payload
) implements MirroredEntity {

    public MirroredProgramRuleAction {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(programRuleUid, "programRuleUid");
        Objects.requireNonNull(actionType, "actionType");
        payload = MirroredEntity.requirePayload(payload);
    }

    @Override
    public String displayName() {
        return actionType;
    }
}
