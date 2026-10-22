package ug.ac.mak.der.workflows.backup;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.backup_run}. ADR-0012. */
public record BackupRun(
        Long runId,
        Instant requestedAt,
        UUID requestedBy,
        Kind kind,
        Status status,
        String message,
        String archivePath,
        Long archiveBytes,
        String remoteKey,
        Instant startedAt,
        Instant finishedAt,
        String pgDumpVersion
) {

    public BackupRun {
        Objects.requireNonNull(requestedAt, "requestedAt");
        Objects.requireNonNull(requestedBy, "requestedBy");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(status, "status");
    }

    public enum Kind { AUDIT, FULL }

    public enum Status { REQUESTED, QUEUED, SUCCESS, FAILED }
}
