package ug.ac.mak.der.workflows.backup;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.restore_run}. ADR-0012. */
public record RestoreRun(
        Long runId,
        Instant requestedAt,
        UUID requestedBy,
        String source,
        Status status,
        String message,
        Instant startedAt,
        Instant finishedAt,
        String archivePath,
        Kind kind
) {

    public RestoreRun {
        Objects.requireNonNull(requestedAt, "requestedAt");
        Objects.requireNonNull(requestedBy, "requestedBy");
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(status, "status");
    }

    public enum Status { REQUESTED, QUEUED, SUCCESS, FAILED }

    public enum Kind { LOCAL, REMOTE, UPLOAD }
}
