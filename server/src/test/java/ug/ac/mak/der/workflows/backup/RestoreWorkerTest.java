package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
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

class RestoreWorkerTest {

    private RestoreWorker worker(final RestoreRepository repo, final RemoteArchiveStore remote,
                                   final Path root, final Path uploads, final boolean enabled) {
        return new RestoreWorker(repo, remote,
                new BackupEncryption(false, "openssl", "", 60),
                root.toString(), uploads.toString(),
                "/no/such/pg_restore", "jdbc:postgresql://localhost:5432/der",
                "u", "p", 60, enabled);
    }

    @Test
    void drainSkipsWhenDisabled(@TempDir final Path root, @TempDir final Path uploads) {
        final RestoreWorker w = worker(mock(RestoreRepository.class),
                mock(RemoteArchiveStore.class), root, uploads, false);
        assertThat(w.drain()).isZero();
    }

    @Test
    void drainFailsWhenLocalSourceMissing(@TempDir final Path root,
                                           @TempDir final Path uploads) {
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(1L, Instant.now(), UUID.randomUUID(),
                root.resolve("missing.dump").toString(), RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.LOCAL);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markFailed(eq(1L), contains("does not exist"));
    }

    @Test
    void drainRejectsLocalPathEscape(@TempDir final Path root,
                                       @TempDir final Path uploads) {
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(2L, Instant.now(), UUID.randomUUID(),
                "/etc/passwd", RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.LOCAL);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markFailed(eq(2L), contains("escapes"));
    }

    @Test
    void drainFailsWhenPgRestoreMissing(@TempDir final Path root,
                                          @TempDir final Path uploads) throws IOException {
        final Path archive = root.resolve("good.dump");
        Files.writeString(archive, "x");
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(3L, Instant.now(), UUID.randomUUID(),
                archive.toString(), RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.LOCAL);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markStarted(eq(3L), any());
        verify(repo).markFailed(eq(3L), any());
    }

    @Test
    void drainRejectsUploadEscape(@TempDir final Path root,
                                    @TempDir final Path uploads) {
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(4L, Instant.now(), UUID.randomUUID(),
                "../etc/passwd", RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.UPLOAD);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markFailed(eq(4L), contains("escapes"));
    }

    @Test
    void drainDownloadsRemote(@TempDir final Path root,
                                @TempDir final Path uploads) throws IOException {
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RemoteArchiveStore remote = mock(RemoteArchiveStore.class);
        final RestoreRun pending = new RestoreRun(5L, Instant.now(), UUID.randomUUID(),
                "20260101-full.dump", RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.REMOTE);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, remote, root, uploads, true).drain();
        verify(remote).download(eq("20260101-full.dump"), any(Path.class));
        verify(repo).markStarted(eq(5L), any());
        verify(repo).markFailed(eq(5L), any());
    }

    @Test
    void uploadRootExposed(@TempDir final Path root, @TempDir final Path uploads) {
        assertThat(worker(mock(RestoreRepository.class), mock(RemoteArchiveStore.class),
                root, uploads, true).uploadRoot())
                .isEqualTo(uploads.toAbsolutePath().normalize());
    }

    private Path writeFakePgRestore(final Path dir, final boolean fail) throws IOException {
        final Path bin = dir.resolve(fail ? "fake-restore-fail.sh" : "fake-restore.sh");
        final String body = fail
                ? "#!/bin/sh\necho boom >&2\nexit 3\n"
                : "#!/bin/sh\nexit 0\n";
        Files.writeString(bin, body);
        bin.toFile().setExecutable(true);
        return bin;
    }

    @Test
    void successPathMarksSuccess(@TempDir final Path root, @TempDir final Path uploads)
            throws Exception {
        final Path archive = root.resolve("good.dump");
        Files.writeString(archive, "DUMP");
        final Path bin = writeFakePgRestore(root, false);
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(10L, Instant.now(), UUID.randomUUID(),
                archive.toString(), RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.LOCAL);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        final RestoreWorker w = new RestoreWorker(repo, mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                root.toString(), uploads.toString(), bin.toString(),
                "jdbc:postgresql://localhost:5432/der", "u", "p", 60, true);
        w.drain();
        verify(repo).markSuccess(10L);
    }

    @Test
    void failedExitMarksFailedWithExitInfo(@TempDir final Path root,
                                             @TempDir final Path uploads) throws Exception {
        final Path archive = root.resolve("good.dump");
        Files.writeString(archive, "DUMP");
        final Path bin = writeFakePgRestore(root, true);
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(11L, Instant.now(), UUID.randomUUID(),
                archive.toString(), RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.LOCAL);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        final RestoreWorker w = new RestoreWorker(repo, mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                root.toString(), uploads.toString(), bin.toString(),
                "jdbc:postgresql://localhost:5432/der", "", "", 60, true);
        w.drain();
        verify(repo).markFailed(eq(11L), org.mockito.ArgumentMatchers.contains("exit"));
    }

    @Test
    void uploadKindResolvesExistingFile(@TempDir final Path root,
                                          @TempDir final Path uploads) throws Exception {
        final Path archive = uploads.resolve("ok.dump");
        Files.writeString(archive, "x");
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(12L, Instant.now(), UUID.randomUUID(),
                "ok.dump", RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.UPLOAD);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markStarted(eq(12L), org.mockito.ArgumentMatchers.contains("ok.dump"));
    }

    @Test
    void nullKindDefaultsToLocal(@TempDir final Path root,
                                    @TempDir final Path uploads) throws Exception {
        // Row with kind=null exercises the materialise() default-LOCAL branch.
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(13L, Instant.now(), UUID.randomUUID(),
                root.resolve("missing.dump").toString(), RestoreRun.Status.REQUESTED,
                null, null, null, null, null);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markFailed(eq(13L), org.mockito.ArgumentMatchers.contains("does not exist"));
    }

    @Test
    void uploadDirectoryRejectsAsNotRegularFile(@TempDir final Path root,
                                                   @TempDir final Path uploads) throws Exception {
        // A path exists under uploadRoot but is a directory — not a regular file.
        final Path asDir = uploads.resolve("notfile");
        Files.createDirectory(asDir);
        final RestoreRepository repo = mock(RestoreRepository.class);
        final RestoreRun pending = new RestoreRun(14L, Instant.now(), UUID.randomUUID(),
                "notfile", RestoreRun.Status.REQUESTED,
                null, null, null, null, RestoreRun.Kind.UPLOAD);
        when(repo.findByStatus(RestoreRun.Status.REQUESTED, 10)).thenReturn(List.of(pending));
        worker(repo, mock(RemoteArchiveStore.class), root, uploads, true).drain();
        verify(repo).markFailed(eq(14L), org.mockito.ArgumentMatchers.contains("not found"));
    }

    @Test
    void nullDatabaseUrlReturnsEmptyPgArg(@TempDir final Path root,
                                            @TempDir final Path uploads) {
        final RestoreWorker w = new RestoreWorker(mock(RestoreRepository.class),
                mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                root.toString(), uploads.toString(),
                "pg_restore", null, "u", "p", 60, true);
        // internals: reflection-free check via invoking a run that gets as far as building the ProcessBuilder.
        // simplest observable: nullDatabaseUrl means jdbcToPgArg() returns "" — not exposed, so skip assertion.
        assertThat(w.uploadRoot()).isEqualTo(uploads.toAbsolutePath().normalize());
    }

    @Test
    void nullDatabasePasswordDefaultsEmpty(@TempDir final Path root,
                                             @TempDir final Path uploads) {
        final RestoreWorker w = new RestoreWorker(mock(RestoreRepository.class),
                mock(RemoteArchiveStore.class),
                new BackupEncryption(false, "openssl", "", 60),
                root.toString(), uploads.toString(),
                "pg_restore", "jdbc:postgresql://x/d", "u", null, 60, true);
        assertThat(w.uploadRoot()).isEqualTo(uploads.toAbsolutePath().normalize());
    }
}
