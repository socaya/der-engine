package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupWorkerTest {

    private BackupWorker worker(final BackupRepository repo, final RemoteArchiveStore remote,
                                 final Path root, final boolean enabled) {
        return new BackupWorker(repo, remote, root.toString(), "/no/such/pg_dump",
                "jdbc:postgresql://localhost:5432/der", "u", "p", enabled, 50, 60);
    }

    @Test
    void drainSkipsWhenDisabled(@TempDir final Path root) {
        final BackupRepository repo = mock(BackupRepository.class);
        final BackupWorker w = worker(repo, mock(RemoteArchiveStore.class), root, false);
        assertThat(w.drain()).isZero();
    }

    @Test
    void drainMarksFailedWhenPgDumpMissing(@TempDir final Path root) {
        final BackupRepository repo = mock(BackupRepository.class);
        final BackupRun pending = new BackupRun(5L, Instant.now(), UUID.randomUUID(),
                BackupRun.Kind.FULL, BackupRun.Status.REQUESTED, null, null, null, null,
                null, null, null);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        final BackupWorker w = worker(repo, mock(RemoteArchiveStore.class), root, true);
        assertThat(w.drain()).isOne();
        verify(repo).markStarted(eq(5L), any());
        verify(repo).markFailed(eq(5L), any());
    }

    @Test
    void localRootExposed(@TempDir final Path root) {
        assertThat(worker(mock(BackupRepository.class), mock(RemoteArchiveStore.class), root, true)
                .localRoot()).isEqualTo(root.toAbsolutePath().normalize());
    }

    @Test
    void jdbcToPgArgStripsPrefix(@TempDir final Path root) {
        final BackupWorker w = worker(mock(BackupRepository.class), mock(RemoteArchiveStore.class),
                root, true);
        assertThat(w.jdbcToPgArg()).isEqualTo("postgresql://localhost:5432/der");
    }

    @Test
    void jdbcToPgArgPassesThroughNonJdbc(@TempDir final Path root) {
        final BackupWorker w = new BackupWorker(mock(BackupRepository.class),
                mock(RemoteArchiveStore.class), root.toString(), "pg_dump", "mysql://x", "u", "p",
                true, 1, 60);
        assertThat(w.jdbcToPgArg()).isEqualTo("mysql://x");
    }

    @Test
    void prunesWhenOverLimit(@TempDir final Path root) throws IOException {
        for (int i = 0; i < 5; i++) {
            Files.writeString(root.resolve("20260101T0000" + i + "Z-full.dump"), "x");
        }
        final BackupRepository repo = mock(BackupRepository.class);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of());
        final BackupWorker w = new BackupWorker(repo, mock(RemoteArchiveStore.class),
                root.toString(), "pg_dump",
                "jdbc:postgresql://localhost/der", "u", "p", true, 2, 60);
        w.drain();
        try (var walk = Files.list(root)) {
            assertThat(walk.count()).isLessThanOrEqualTo(2);
        }
    }
}
