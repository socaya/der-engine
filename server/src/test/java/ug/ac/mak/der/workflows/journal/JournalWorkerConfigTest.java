package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class JournalWorkerConfigTest {

    @Test
    void settingsBean() {
        final JournalWorkerConfig.JournalWorkerSettings s = new JournalWorkerConfig()
                .journalWorkerSettings(true, 25, 30, 3600);
        assertThat(s.enabled().get()).isTrue();
        assertThat(s.batchSize()).isEqualTo(25);
        assertThat(s.backoffBaseSeconds()).isEqualTo(30);
        assertThat(s.backoffCapSeconds()).isEqualTo(3600);
    }
}
