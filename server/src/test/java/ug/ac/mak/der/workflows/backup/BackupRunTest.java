package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class BackupRunTest {

    @Test
    void rejectsMissingRequired() {
        final UUID u = UUID.randomUUID();
        assertThatThrownBy(() -> new BackupRun(1L, null, u, BackupRun.Kind.FULL,
                BackupRun.Status.REQUESTED, null, null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new BackupRun(1L, Instant.now(), null, BackupRun.Kind.FULL,
                BackupRun.Status.REQUESTED, null, null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new BackupRun(1L, Instant.now(), u, null,
                BackupRun.Status.REQUESTED, null, null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new BackupRun(1L, Instant.now(), u, BackupRun.Kind.FULL,
                null, null, null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void enumsSurface() {
        assertThat(BackupRun.Kind.values()).containsExactly(BackupRun.Kind.AUDIT, BackupRun.Kind.FULL);
        assertThat(BackupRun.Status.values()).containsExactly(
                BackupRun.Status.REQUESTED, BackupRun.Status.QUEUED,
                BackupRun.Status.SUCCESS, BackupRun.Status.FAILED);
    }
}
