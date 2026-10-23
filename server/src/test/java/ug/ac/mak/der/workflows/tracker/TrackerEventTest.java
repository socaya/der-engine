package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class TrackerEventTest {

    @Test
    void acceptsValidEvent() {
        final TrackerEvent e = new TrackerEvent("aBcDeFgHiJk", "aBcDeFgHiJ2",
                "aBcDeFgHiJ3", "aBcDeFgHiJ4", "aBcDeFgHiJ5",
                TrackerEvent.Status.ACTIVE, LocalDate.of(2026, 10, 23),
                Map.of("de1", "v1"), null, UUID.randomUUID(),
                Instant.now(), Instant.now(), 1);
        assertThat(e.dataValues()).containsEntry("de1", "v1");
    }

    @Test
    void rejectsBadUid() {
        assertThatThrownBy(() -> new TrackerEvent("bad", null,
                "aBcDeFgHiJ3", "aBcDeFgHiJ4", "aBcDeFgHiJ5",
                TrackerEvent.Status.ACTIVE, LocalDate.now(),
                Map.of(), null, UUID.randomUUID(),
                Instant.now(), Instant.now(), 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
