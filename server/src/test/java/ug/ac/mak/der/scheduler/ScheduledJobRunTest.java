package ug.ac.mak.der.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class ScheduledJobRunTest {

    @Test
    void record() {
        final ScheduledJobRun r = new ScheduledJobRun(1L, "JOB", Instant.now(), null,
                ScheduledJobRun.Outcome.STARTED, null, null, "SCHEDULED");
        assertThat(r.jobName()).isEqualTo("JOB");
        assertThat(r.outcome()).isEqualTo(ScheduledJobRun.Outcome.STARTED);
    }

    @Test
    void rejectsNulls() {
        assertThatThrownBy(() -> new ScheduledJobRun(null, null, Instant.now(), null,
                ScheduledJobRun.Outcome.STARTED, null, null, "x"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduledJobRun(null, "J", null, null,
                ScheduledJobRun.Outcome.STARTED, null, null, "x"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduledJobRun(null, "J", Instant.now(), null,
                null, null, null, "x"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ScheduledJobRun(null, "J", Instant.now(), null,
                ScheduledJobRun.Outcome.STARTED, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void outcomeValues() {
        assertThat(ScheduledJobRun.Outcome.values()).hasSize(4);
    }
}
