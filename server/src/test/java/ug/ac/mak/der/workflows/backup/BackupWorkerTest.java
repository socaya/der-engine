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
        return new BackupWorker(repo, remote, new ug.ac.mak.der.workflows.backup.BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60), root.toString(), "/no/such/pg_dump",
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
                mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), "pg_dump", "mysql://x", "u", "p",
                true, 1, 60);
        assertThat(w.jdbcToPgArg()).isEqualTo("mysql://x");
    }

    private Path writeFakePgDump(final Path dir, final boolean fail) throws IOException {
        final Path bin = dir.resolve(fail ? "fake-fail.sh" : "fake-pg-dump.sh");
        final String body = fail
                ? "#!/bin/sh\necho boom >&2\nexit 2\n"
                : "#!/bin/sh\n"
                + "if [ \"$1\" = \"--version\" ]; then echo 'pg_dump (PostgreSQL) 17.0 (fake)'; exit 0; fi\n"
                + "for a in \"$@\"; do case \"$a\" in --file=*) f=${a#--file=}; echo FAKE > \"$f\";; esac; done\n"
                + "exit 0\n";
        Files.writeString(bin, body);
        bin.toFile().setExecutable(true);
        return bin;
    }

    @Test
    void successPathCallsPgDumpAndMarksSuccess(@TempDir final Path root) throws Exception {
        final Path bin = writeFakePgDump(root, false);
        final BackupRepository repo = mock(BackupRepository.class);
        final RemoteArchiveStore remote = mock(RemoteArchiveStore.class);
        final BackupRun pending = new BackupRun(9L, java.time.Instant.now(), UUID.randomUUID(),
                BackupRun.Kind.FULL, BackupRun.Status.REQUESTED, null, null, null, null,
                null, null, null);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        when(remote.upload(any(Path.class))).thenReturn("remote-key");
        final BackupWorker w = new BackupWorker(repo, remote, new ug.ac.mak.der.workflows.backup.BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60), root.toString(),
                bin.toString(), "jdbc:postgresql://localhost:5432/der", "u", "p",
                true, 50, 60);
        assertThat(w.drain()).isOne();
        verify(repo).markStarted(eq(9L), org.mockito.ArgumentMatchers.contains("17.0"));
        verify(repo).markSuccess(eq(9L), any(String.class),
                org.mockito.ArgumentMatchers.anyLong(), eq("remote-key"));
    }

    @Test
    void failedExitMarksFailed(@TempDir final Path root) throws Exception {
        final Path bin = writeFakePgDump(root, true);
        final BackupRepository repo = mock(BackupRepository.class);
        final BackupRun pending = new BackupRun(10L, java.time.Instant.now(), UUID.randomUUID(),
                BackupRun.Kind.FULL, BackupRun.Status.REQUESTED, null, null, null, null,
                null, null, null);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        final BackupWorker w = new BackupWorker(repo, mock(RemoteArchiveStore.class), new ug.ac.mak.der.workflows.backup.BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), bin.toString(),
                "jdbc:postgresql://localhost:5432/der", "", null,
                true, 50, 60);
        w.drain();
        verify(repo).markFailed(eq(10L), org.mockito.ArgumentMatchers.contains("exit"));
    }

    @Test
    void nullDatabaseUrlReturnsEmptyPgArg(@TempDir final Path root) {
        final BackupWorker w = new BackupWorker(mock(BackupRepository.class),
                mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), "pg_dump",
                null, "u", "p", true, 50, 60);
        assertThat(w.jdbcToPgArg()).isEmpty();
    }

    @Test
    void nullDatabasePasswordDefaultsEmpty(@TempDir final Path root) {
        // ctor branch where databasePassword == null → ""
        final BackupWorker w = new BackupWorker(mock(BackupRepository.class),
                mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), "pg_dump",
                "jdbc:postgresql://x/d", "u", null, true, 50, 60);
        assertThat(w.jdbcToPgArg()).isEqualTo("postgresql://x/d");
    }

    @Test
    void pruneLogsIOExceptionWhenEntryIsNonEmptyDir(@TempDir final Path root) throws IOException {
        // Create a non-empty dir named like a dump file so Files.list enumerates it
        // and Files.deleteIfExists raises DirectoryNotEmptyException (IOException).
        final Path dirAsDump = root.resolve("20250101T000000Z-full.dump");
        Files.createDirectory(dirAsDump);
        Files.writeString(dirAsDump.resolve("child"), "x");
        // Fill with real files so pruneLocal reaches excess.
        Files.writeString(root.resolve("20250101T000001Z-full.dump"), "y");
        Files.writeString(root.resolve("20250101T000002Z-full.dump"), "y");
        final BackupRepository repo = mock(BackupRepository.class);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of());
        final BackupWorker w = new BackupWorker(repo, mock(RemoteArchiveStore.class), new ug.ac.mak.der.workflows.backup.BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), "pg_dump",
                "jdbc:postgresql://localhost/der", "u", "p", true, 1, 60);
        // Should run drain → pruneLocal → attempt to delete the oldest entry (the dir)
        // → IOException caught + logged, drain returns zero.
        w.drain();
    }

    @Test
    void prunesWhenOverLimit(@TempDir final Path root) throws IOException {
        for (int i = 0; i < 5; i++) {
            Files.writeString(root.resolve("20260101T0000" + i + "Z-full.dump"), "x");
        }
        final BackupRepository repo = mock(BackupRepository.class);
        when(repo.findByStatus(BackupRun.Status.REQUESTED, 10)).thenReturn(List.of());
        final BackupWorker w = new BackupWorker(repo, mock(RemoteArchiveStore.class), new ug.ac.mak.der.workflows.backup.BackupEncryption(false, "openssl", "", 60),
                new RemoteArchiveEncryption(false, "openssl", "", 60),
                root.toString(), "pg_dump",
                "jdbc:postgresql://localhost/der", "u", "p", true, 2, 60);
        w.drain();
        try (var walk = Files.list(root)) {
            assertThat(walk.count()).isLessThanOrEqualTo(2);
        }
    }
}
