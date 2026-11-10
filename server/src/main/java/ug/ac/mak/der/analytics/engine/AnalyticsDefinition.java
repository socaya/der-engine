package ug.ac.mak.der.analytics.engine;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Projection of one {@code der.analytics_definition} row as returned
 * by the Analytics engine REST surface (spec §9 {@code /metrics} and
 * {@code /explain/{id}}).
 *
 * <p>Immutable record so controller handlers can round-trip it into
 * the JSON response via the standard Spring/Jackson converter without
 * extra serialisation logic.</p>
 */
public record AnalyticsDefinition(
        UUID id,
        String sourceUid,
        String code,
        String displayName,
        int definitionVersion,
        String metadataHash,
        String analyticsType,
        String aggregationType,
        String programUid,
        List<String> stageUids,
        String dateAnchor,
        String orgUnitAnchor,
        String supportState,
        String unsupportedReason,
        Instant effectiveFrom,
        Instant createdAt,
        Instant updatedAt) {
}
