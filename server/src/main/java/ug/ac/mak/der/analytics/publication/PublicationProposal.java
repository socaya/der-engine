package ug.ac.mak.der.analytics.publication;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * One proposed {@code dataValueSets} cell derived from a
 * {@link PublicationMapping} + the current state of an analytics
 * cell. Spec §4.5 / §7.3 analytics_publication table.
 */
public record PublicationProposal(
        UUID proposalId,
        UUID mappingId,
        UUID metricId,
        int definitionVersion,
        String datasetUid,
        String dataElementUid,
        String categoryOptionComboUid,
        String attributeOptionComboUid,
        String periodKey,
        String orgUnitUid,
        BigDecimal proposedValue,
        BigDecimal reviewedValue,
        State state,
        String reviewReason,
        UUID reviewedBy,
        Instant reviewedAt,
        String provenanceJson,
        Instant createdAt,
        Instant updatedAt) {

    public PublicationProposal {
        Objects.requireNonNull(proposalId, "proposalId");
        Objects.requireNonNull(mappingId, "mappingId");
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(datasetUid, "datasetUid");
        Objects.requireNonNull(dataElementUid, "dataElementUid");
        Objects.requireNonNull(categoryOptionComboUid, "categoryOptionComboUid");
        Objects.requireNonNull(attributeOptionComboUid, "attributeOptionComboUid");
        Objects.requireNonNull(periodKey, "periodKey");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(state, "state");
    }

    public enum State {
        PROPOSED, APPROVED, REJECTED,
        PUBLISHED, RECONCILED, DIVERGED
    }
}
