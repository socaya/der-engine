package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Mirrored DHIS2 relationship type (relationships slice 1). Carries
 * the constraint shape on each side as (kind, uid) pairs flattened
 * from DHIS2's nested
 * {@code {relationshipEntity, trackedEntityType|program|programStage}}
 * JSON so CaptureFormService (and future relationship controller)
 * can query "which types apply to this TET" without JSON parsing.
 *
 * <p>Constraint kinds are the verbatim DHIS2 enum strings
 * ({@code TRACKED_ENTITY_INSTANCE} / {@code PROGRAM_INSTANCE} /
 * {@code PROGRAM_STAGE_INSTANCE}). Either side may be null if the
 * upstream metadata is malformed — the client treats a null-kind
 * side as "unusable" and skips the type.</p>
 */
public record MirroredRelationshipType(
        String dhis2Uid,
        String displayName,
        boolean bidirectional,
        String fromConstraintKind,
        String fromConstraintUid,
        String toConstraintKind,
        String toConstraintUid,
        JsonNode payload
) implements MirroredEntity {

    public MirroredRelationshipType {
        Objects.requireNonNull(dhis2Uid, "dhis2Uid");
        Objects.requireNonNull(displayName, "displayName");
        payload = MirroredEntity.requirePayload(payload);
    }
}
