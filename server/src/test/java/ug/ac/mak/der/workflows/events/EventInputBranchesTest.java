package ug.ac.mak.der.workflows.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EventInputBranchesTest {

    @Test
    void defaultsAocWhenNull() {
        final var input = new EventService.EventInput(UUID.randomUUID(), null,
                "p", "ps", "ou", Instant.now(), Event.Status.ACTIVE, null, null);
        assertThat(input.attributeOptionComboUid()).isEqualTo("HllvX50cXC0");
        assertThat(input.dataValues()).isEmpty();
    }

    @Test
    void preservesExplicitAocAndEventIdAndValues() {
        final UUID id = UUID.randomUUID();
        final var input = new EventService.EventInput(id, null, "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, "custom", Map.of("de", "1"));
        assertThat(input.eventId()).isEqualTo(id);
        assertThat(input.attributeOptionComboUid()).isEqualTo("custom");
        assertThat(input.dataValues()).containsEntry("de", "1");
    }

    @Test
    void rejectsNullsOnRequiredFields() {
        final Instant t = Instant.now();
        assertThatThrownBy(() -> new EventService.EventInput(null, null, null, "ps", "ou", t,
                Event.Status.ACTIVE, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EventService.EventInput(null, null, "p", null, "ou", t,
                Event.Status.ACTIVE, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EventService.EventInput(null, null, "p", "ps", null, t,
                Event.Status.ACTIVE, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EventService.EventInput(null, null, "p", "ps", "ou", null,
                Event.Status.ACTIVE, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EventService.EventInput(null, null, "p", "ps", "ou", t,
                null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void importResultImmutable() {
        final var r = new EventService.EventImportResult(
                new java.util.ArrayList<>(), new java.util.ArrayList<>());
        assertThatThrownBy(() -> r.imported().add(null))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> r.conflicts().add(null))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void conflictAccessors() {
        final var c = new EventService.Conflict("ref", "reason");
        assertThat(c.reference()).isEqualTo("ref");
        assertThat(c.reason()).isEqualTo("reason");
    }
}
