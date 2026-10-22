package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class RestoreRunTest {

    @Test
    void rejectsMissingRequired() {
        final UUID u = UUID.randomUUID();
        assertThatThrownBy(() -> new RestoreRun(1L, null, u, "src",
                RestoreRun.Status.REQUESTED, null, null, null, null, RestoreRun.Kind.LOCAL))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RestoreRun(1L, Instant.now(), null, "src",
                RestoreRun.Status.REQUESTED, null, null, null, null, RestoreRun.Kind.LOCAL))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RestoreRun(1L, Instant.now(), u, null,
                RestoreRun.Status.REQUESTED, null, null, null, null, RestoreRun.Kind.LOCAL))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RestoreRun(1L, Instant.now(), u, "src",
                null, null, null, null, null, RestoreRun.Kind.LOCAL))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void enumsSurface() {
        assertThat(RestoreRun.Status.values()).containsExactly(
                RestoreRun.Status.REQUESTED, RestoreRun.Status.QUEUED,
                RestoreRun.Status.SUCCESS, RestoreRun.Status.FAILED);
        assertThat(RestoreRun.Kind.values()).containsExactly(
                RestoreRun.Kind.LOCAL, RestoreRun.Kind.REMOTE, RestoreRun.Kind.UPLOAD);
    }
}
