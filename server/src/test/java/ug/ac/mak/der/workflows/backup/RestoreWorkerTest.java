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
        return new RestoreWorker(repo, remote, root.toString(), uploads.toString(),
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
}
