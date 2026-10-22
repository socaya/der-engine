package ug.ac.mak.der.workflows.journal;

/**
 * Maps a central HTTP status to the terminal state the worker should
 * transition the journal row into. ADR-0010 §Retry classification.
 */
public final class ResponseClassifier {

    private ResponseClassifier() { }

    public static JournalPublisher.TerminalState classify(final int status) {
        if (status < 0) {
            return JournalPublisher.TerminalState.RETRYABLE;
        }
        if (status / 100 == 2) {
            return JournalPublisher.TerminalState.ACCEPTED;
        }
        if (status == 409) {
            return JournalPublisher.TerminalState.CONFLICT;
        }
        if (status == 429 || status / 100 == 5) {
            return JournalPublisher.TerminalState.RETRYABLE;
        }
        return JournalPublisher.TerminalState.REJECTED;
    }
}
