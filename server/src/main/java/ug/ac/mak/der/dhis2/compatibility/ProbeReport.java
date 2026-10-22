package ug.ac.mak.der.dhis2.compatibility;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Complete report produced by one run of {@link Dhis2CapabilityProbe}. Written
 * verbatim into the {@code dhis2_capability_snapshot.probe_report_json} column
 * so operators can see exactly what DER saw at probe time.
 */
public record ProbeReport(
        Instant startedAt,
        long totalDurationMs,
        boolean reachable,
        String versionRaw,
        List<ProbeOutcome> outcomes
) {

    public ProbeReport {
        Objects.requireNonNull(startedAt, "startedAt");
        outcomes = outcomes == null ? List.of() : Collections.unmodifiableList(outcomes);
    }
}
