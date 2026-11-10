package ug.ac.mak.der.analytics.publication;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Operator-declared mapping that associates one analytics metric
 * (+ optional dimension filter) to a DHIS2 aggregate target cell.
 *
 * <p>Spec §4.5 / §8 — the publication path is a reviewed bridge
 * from analytics output to a {@code dataValueSets} submission. The
 * mapping is a governed object: a review step turns a proposal
 * into an approved value, and only approved proposals ever reach
 * {@code POST /api/dataValueSets}.</p>
 */
public record PublicationMapping(
        UUID mappingId,
        UUID metricId,
        int definitionVersion,
        String datasetUid,
        String dataElementUid,
        String categoryOptionComboUid,
        String attributeOptionComboUid,
        Map<String, String> dimensionFilter,
        Mode publicationMode,
        String overlapPolicy,
        Instant createdAt,
        Instant updatedAt) {

    public PublicationMapping {
        Objects.requireNonNull(mappingId, "mappingId");
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(datasetUid, "datasetUid");
        Objects.requireNonNull(dataElementUid, "dataElementUid");
        Objects.requireNonNull(categoryOptionComboUid, "categoryOptionComboUid");
        Objects.requireNonNull(attributeOptionComboUid, "attributeOptionComboUid");
        dimensionFilter = dimensionFilter == null ? Map.of()
                : Map.copyOf(dimensionFilter);
        Objects.requireNonNull(publicationMode, "publicationMode");
    }

    public enum Mode {
        /** Human review required for every proposed cell value. */
        REVIEW_REQUIRED,
        /** Auto-approve when the proposed value exactly matches the
         *  prior approved value (metadata-stable re-publication). */
        AUTO_APPROVE_EXACT,
        /** Auto-approve when |proposed - reviewed| ≤ configured
         *  threshold (small deltas don't require re-review). */
        AUTO_APPROVE_UNDER_THRESHOLD
    }
}
