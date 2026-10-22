package ug.ac.mak.der.workflows.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EventTest {

    private Event newEvent(final String aoc) {
        return new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, aoc, UUID.randomUUID(), 1,
                Map.of("de1", "1"));
    }

    @Test
    void defaultsAttributeOptionCombo() {
        assertThat(newEvent(null).attributeOptionComboUid()).isEqualTo("HllvX50cXC0");
        assertThat(newEvent("other").attributeOptionComboUid()).isEqualTo("other");
    }

    @Test
    void dataValuesCopyOf() {
        final Event e = new Event(UUID.randomUUID(), null, "p", "ps", "ou", Instant.now(),
                Event.Status.ACTIVE, null, UUID.randomUUID(), 1, null);
        assertThat(e.dataValues()).isEmpty();
    }

    @Test
    void rejectsNulls() {
        assertThatThrownBy(() -> new Event(null, null, "p", "ps", "ou", Instant.now(),
                Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, null, "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, "p", null, "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, "p", "ps", null,
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                null, Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.now(), null, null, UUID.randomUUID(), 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, null, 1, Map.of()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void statusEnumValues() {
        assertThat(Event.Status.values()).contains(Event.Status.ACTIVE,
                Event.Status.COMPLETED, Event.Status.VISITED, Event.Status.SCHEDULE,
                Event.Status.OVERDUE, Event.Status.SKIPPED);
    }
}
