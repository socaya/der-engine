package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ResponseClassifierTest {

    @Test
    void accepted2xx() {
        assertThat(ResponseClassifier.classify(200)).isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
        assertThat(ResponseClassifier.classify(201)).isEqualTo(JournalPublisher.TerminalState.ACCEPTED);
    }

    @Test
    void conflict() {
        assertThat(ResponseClassifier.classify(409)).isEqualTo(JournalPublisher.TerminalState.CONFLICT);
    }

    @Test
    void retryable5xxAnd429() {
        assertThat(ResponseClassifier.classify(500)).isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
        assertThat(ResponseClassifier.classify(503)).isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
        assertThat(ResponseClassifier.classify(429)).isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
    }

    @Test
    void rejectedOther4xx() {
        assertThat(ResponseClassifier.classify(400)).isEqualTo(JournalPublisher.TerminalState.REJECTED);
        assertThat(ResponseClassifier.classify(404)).isEqualTo(JournalPublisher.TerminalState.REJECTED);
    }

    @Test
    void negativeStatusIsRetryable() {
        assertThat(ResponseClassifier.classify(-1)).isEqualTo(JournalPublisher.TerminalState.RETRYABLE);
    }
}
