package ug.ac.mak.der.metadata;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Base shape for every DHIS2 metadata entity DER mirrors. Carries the three
 * fields DER-logic always needs (uid, display name, raw payload) so the
 * emulator can project any additional DHIS2-shaped field directly out of
 * {@link #payload} without a schema change here.
 */
public sealed interface MirroredEntity permits
        MirroredOrganisationUnit,
        MirroredDataElement,
        MirroredDataSet,
        MirroredProgram,
        MirroredTrackedEntityType {

    String dhis2Uid();

    String displayName();

    JsonNode payload();

    /** Null-safe accessor for the stored JSON payload. */
    static JsonNode requirePayload(final JsonNode payload) {
        return Objects.requireNonNull(payload, "payload");
    }
}
