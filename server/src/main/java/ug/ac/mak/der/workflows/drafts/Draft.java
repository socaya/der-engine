package ug.ac.mak.der.workflows.drafts;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/** Row in {@code der.draft} — DC-17 work-in-progress payload. */
public record Draft(
        UUID draftId,
        UUID ownerId,
        String kind,
        String title,
        JsonNode payload,
        Instant createdAt,
        Instant updatedAt
) {

    public Draft {
        Objects.requireNonNull(draftId, "draftId");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(title, "title");
        Objects.requireNonNull(payload, "payload");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }
}
