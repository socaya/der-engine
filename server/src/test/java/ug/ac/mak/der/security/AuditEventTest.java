package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

class AuditEventTest {

    @Test
    void detailIsImmutable() {
        final AuditEvent e = new AuditEvent("X", AuditEvent.Outcome.SUCCESS, null, null, null, null,
                Map.of("a", 1));
        assertThatThrownBy(() -> e.detail().put("b", 2))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void nullDetailBecomesEmpty() {
        final AuditEvent e = new AuditEvent("X", AuditEvent.Outcome.ERROR, null, null, null, null, null);
        assertThat(e.detail()).isEmpty();
    }

    @Test
    void rejectsNullType() {
        assertThatThrownBy(() -> new AuditEvent(null, AuditEvent.Outcome.SUCCESS, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("eventType");
    }

    @Test
    void rejectsNullOutcome() {
        assertThatThrownBy(() -> new AuditEvent("X", null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("outcome");
    }
}
