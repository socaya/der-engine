package ug.ac.mak.der.sync.drift;

import java.time.Instant;
import java.util.Objects;

/** Persisted drift-detection row. ADR-0008 §Drift detection. */
public record DriftSnapshot(
        Long driftId,
        Instant capturedAt,
        long snapshotFrom,
        long snapshotTo,
        String fingerprintFrom,
        String fingerprintTo,
        String deltasJson,
        String triggeredBy
) {

    public DriftSnapshot {
        Objects.requireNonNull(capturedAt, "capturedAt");
        Objects.requireNonNull(deltasJson, "deltasJson");
        Objects.requireNonNull(triggeredBy, "triggeredBy");
    }
}
