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
        String pgDumpVersion,
        String archiveSha256
) {

    public BackupRun {
        Objects.requireNonNull(requestedAt, "requestedAt");
        Objects.requireNonNull(requestedBy, "requestedBy");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(status, "status");
    }

    public BackupRun(final Long runId, final Instant requestedAt, final UUID requestedBy,
                       final Kind kind, final Status status, final String message,
                       final String archivePath, final Long archiveBytes, final String remoteKey,
                       final Instant startedAt, final Instant finishedAt,
                       final String pgDumpVersion) {
        this(runId, requestedAt, requestedBy, kind, status, message, archivePath,
             archiveBytes, remoteKey, startedAt, finishedAt, pgDumpVersion, null);
    }

    public enum Kind { AUDIT, FULL }

    public enum Status { REQUESTED, QUEUED, SUCCESS, FAILED }
}
