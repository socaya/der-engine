package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

class BackupIntegrityServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T05:00:00Z");

    private static BackupRun successRun(final String path, final long bytes,
                                           final String sha256) {
        return new BackupRun(7L, NOW.minusSeconds(3600),
                UUID.randomUUID(), BackupRun.Kind.FULL, BackupRun.Status.SUCCESS,
                null, path, bytes, "k", NOW.minusSeconds(3600), NOW.minusSeconds(3500),
                "v16", sha256);
    }

    private static BackupIntegrityService svc(final JdbcTemplate jdbc,
                                                 final BackupRepository repo,
                                                 final SecurityAuditRepository audit) {
        return new BackupIntegrityService(jdbc, repo, audit,
                new ObjectMapper(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static Path writeArchive(final Path dir, final byte[] content) throws Exception {
        final Path f = dir.resolve("archive.dump");
        try (OutputStream out = Files.newOutputStream(f)) {
            out.write(content);
        }
        return f;
    }

    @Test
    void matchingHashAndSizeEmitsIntegritySuccess(@TempDir final Path dir) throws Exception {
        final byte[] bytes = "backup-payload".getBytes();
        final Path f = writeArchive(dir, bytes);
        final String sha = BackupWorker.sha256Hex(f);
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(repo.findRecent(anyInt())).thenReturn(List.of(
                successRun(f.toString(), (long) bytes.length, sha)));
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "BACKUP_INTEGRITY_CHECK".equals(e.eventType())
                        && e.outcome() == AuditEvent.Outcome.SUCCESS
                        && "INTEGRITY_SUCCESS".equals(e.detail().get("outcome"))
                        && "OPERATOR".equals(e.detail().get("source"))),
                any());
    }

    @Test
    void sha256DriftEmitsIntegrityMismatch(@TempDir final Path dir) throws Exception {
        final byte[] bytes = "tampered".getBytes();
        final Path f = writeArchive(dir, bytes);
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        // Anchor is wrong — file was tampered after the backup finished.
        when(repo.findRecent(anyInt())).thenReturn(List.of(
                successRun(f.toString(), (long) bytes.length, "wrong_sha")));
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "BACKUP_INTEGRITY_CHECK".equals(e.eventType())
                        && e.outcome() == AuditEvent.Outcome.ERROR
                        && "INTEGRITY_MISMATCH".equals(e.detail().get("outcome"))),
                any());
    }

    @Test
    void sizeDriftShortCircuitsAsMismatch(@TempDir final Path dir) throws Exception {
        final Path f = writeArchive(dir, "12345".getBytes());
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        // Recorded size 999 but file only has 5 bytes.
        when(repo.findRecent(anyInt())).thenReturn(List.of(
                successRun(f.toString(), 999L, "ignored")));
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "INTEGRITY_MISMATCH".equals(e.detail().get("outcome"))),
                any());
    }

    @Test
    void missingArchiveFileEmitsIntegrityMissing(@TempDir final Path dir) {
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(repo.findRecent(anyInt())).thenReturn(List.of(
                successRun(dir.resolve("gone.dump").toString(), 42L, "deadbeef")));
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "INTEGRITY_MISSING".equals(e.detail().get("outcome"))
                        && e.outcome() == AuditEvent.Outcome.ERROR),
                any());
    }

    @Test
    void preMigrationBackupWithoutAnchorIsSuccessOnReadable(@TempDir final Path dir)
            throws Exception {
        final Path f = writeArchive(dir, "payload".getBytes());
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        // archive_sha256 null — a backup from before V126 shipped.
        when(repo.findRecent(anyInt())).thenReturn(List.of(
                successRun(f.toString(), 7L, null)));
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "INTEGRITY_SUCCESS".equals(e.detail().get("outcome"))),
                any());
    }

    @Test
    void emptyBackupHistoryEmitsSkipped() {
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(repo.findRecent(anyInt())).thenReturn(List.of());
        svc(jdbc, repo, audit).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "INTEGRITY_SKIPPED".equals(e.detail().get("outcome"))),
                any());
    }

    @Test
    void disabledSchedulerDoesNotRun() {
        final var jdbc = mock(JdbcTemplate.class);
        final var repo = mock(BackupRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final BackupIntegrityService s = svc(jdbc, repo, audit);
        // Reflectively flip the flag false — the service is normally
        // Spring-bound so the test needs to prove the gate.
        org.springframework.test.util.ReflectionTestUtils.setField(s,
                "enabled", false);
        s.dailyCheck();
        verify(repo, never()).findRecent(anyInt());
        verify(audit, never()).append(any(), any());
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }
}
