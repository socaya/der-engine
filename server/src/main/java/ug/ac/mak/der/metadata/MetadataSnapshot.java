package ug.ac.mak.der.metadata;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable record of one metadata import batch. A snapshot is created every
 * time an admin triggers {@code POST /edge-api/v1/sync/metadata}; its id is
 * stamped on every mirror row the sync touched so later phases can detect
 * drift and quarantine affected operations.
 *
 * @param snapshotId          auto-generated primary key
 * @param importedFrom        central DHIS2 base URL at the time of sync
 * @param importedBy          edge-user that triggered the sync (nullable for
 *                            later-phase scheduler invocations)
 * @param importedAt          wall-clock timestamp of the sync
 * @param counts              per-entity-type row counts observed in this batch
 * @param centralVersion      value of {@code /api/system/info.version}
 * @param centralRevision     value of {@code /api/system/info.revision}
 * @param fingerprint         SHA-256 of the sorted-UID join across all five
 *                            entity types; two snapshots with the same
 *                            fingerprint describe identical central metadata
 */
public record MetadataSnapshot(
        long snapshotId,
        String importedFrom,
        UUID importedBy,
        Instant importedAt,
        Counts counts,
        String centralVersion,
        String centralRevision,
        String fingerprint
) {

    public MetadataSnapshot {
        Objects.requireNonNull(importedFrom, "importedFrom");
        Objects.requireNonNull(importedAt, "importedAt");
        Objects.requireNonNull(counts, "counts");
    }

    public record Counts(
            int organisationUnits,
            int dataElements,
            int dataSets,
            int programs,
            int trackedEntityTypes
    ) {
        public int total() {
            return organisationUnits + dataElements + dataSets + programs + trackedEntityTypes;
        }
    }
}
