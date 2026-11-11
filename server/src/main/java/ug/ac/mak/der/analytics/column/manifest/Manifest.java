package ug.ac.mak.der.analytics.column.manifest;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * A manifest names every segment that composes one consistent
 * snapshot of the columnar store (SRS FR-STO-006, FR-INC-006).
 * Manifests are generation-numbered; readers always pick the
 * highest valid generation, writers publish a new generation
 * atomically.
 *
 * @param generation       monotonic, strictly increasing
 * @param createdAt        UTC commit time
 * @param metadataRevision DER metadata snapshot id this manifest
 *                         was computed against
 * @param sourceCheckpoint per-source-type cursor at publication
 * @param engineVersion    engine semver — forward-compat hinge
 * @param segments         every segment referenced by this
 *                         generation
 */
public record Manifest(
        long generation,
        Instant createdAt,
        String metadataRevision,
        Map<String, Long> sourceCheckpoint,
        String engineVersion,
        List<SegmentRef> segments) {

    public Manifest {
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(engineVersion, "engineVersion");
        sourceCheckpoint = sourceCheckpoint == null
                ? Map.of()
                : Map.copyOf(sourceCheckpoint);
        segments = List.copyOf(
                Objects.requireNonNull(segments, "segments"));
        if (generation < 0) {
            throw new IllegalArgumentException(
                    "generation must be non-negative");
        }
    }
}
