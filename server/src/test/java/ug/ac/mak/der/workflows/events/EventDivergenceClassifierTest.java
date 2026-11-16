package ug.ac.mak.der.workflows.events;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EventDivergenceClassifierTest {

    private static final Instant T = Instant.parse("2026-11-01T00:00:00Z");
    private static final UUID ACTOR = UUID.fromString(
            "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0");
    private static final UUID EID = UUID.fromString(
            "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1");

    private static Event evt(final int version, final Event.Status status,
                              final Map<String, String> values) {
        return new Event(EID, null, "PROG", "STAGE", "OU", T,
                status, "AOC", ACTOR, version, values);
    }

    @Test
    void nullLocalMeansInsertNotDivergence() {
        final var c = EventDivergenceClassifier.classify(null,
                evt(1, Event.Status.ACTIVE, Map.of("de-1", "7")));
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.IN_SYNC);
    }

    @Test
    void nullCentralMeansCentralDeleted() {
        final var local = evt(3, Event.Status.ACTIVE, Map.of("de-1", "7"));
        final var c = EventDivergenceClassifier.classify(local, null);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.CENTRAL_DELETED);
        assertThat(c.detail()).containsEntry("absentOn", "central");
        assertThat(c.detail()).containsEntry("localEventVersion", "3");
    }

    @Test
    void identicalLocalAndCentralIsInSync() {
        final var local = evt(1, Event.Status.ACTIVE, Map.of("de-1", "7"));
        final var central = evt(1, Event.Status.ACTIVE, Map.of("de-1", "7"));
        final var c = EventDivergenceClassifier.classify(local, central);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.IN_SYNC);
        assertThat(c.detail()).isEmpty();
    }

    @Test
    void differentStatusFlagsCentralDiverged() {
        final var local = evt(1, Event.Status.ACTIVE, Map.of("de-1", "7"));
        final var central = evt(2, Event.Status.COMPLETED, Map.of("de-1", "7"));
        final var c = EventDivergenceClassifier.classify(local, central);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.CENTRAL_DIVERGED);
        assertThat(c.detail()).containsKey("status");
    }

    @Test
    @SuppressWarnings("unchecked")
    void dataValueDiffAppearsInDetail() {
        final var local = evt(1, Event.Status.ACTIVE, Map.of("de-1", "7", "de-2", "x"));
        final var central = evt(1, Event.Status.ACTIVE, Map.of("de-1", "8", "de-3", "y"));
        final var c = EventDivergenceClassifier.classify(local, central);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.CENTRAL_DIVERGED);
        final var rows = (java.util.List<Map<String, Object>>) c.detail().get("dataValues");
        assertThat(rows).hasSize(3);
        // de-1 diff, de-2 local-only, de-3 central-only — all three rows present.
        assertThat(rows.stream().map(r -> r.get("dataElement")))
                .containsExactlyInAnyOrder("de-1", "de-2", "de-3");
    }

    @Test
    void duplicateLocalDetectsCollidingUid() {
        final var a = evt(1, Event.Status.ACTIVE, Map.of());
        final var b = evt(2, Event.Status.COMPLETED, Map.of());
        final var c = EventDivergenceClassifier.classifyDuplicate(a, b);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.DUPLICATE_LOCAL);
        assertThat(c.detail()).containsEntry("eventId", EID.toString());
        assertThat(c.detail()).containsEntry("localVersions", "1,2");
    }

    @Test
    void duplicateLocalIsInSyncWhenUidsDiffer() {
        final var a = evt(1, Event.Status.ACTIVE, Map.of());
        final var different = new Event(UUID.randomUUID(), null, "PROG", "STAGE", "OU",
                T, Event.Status.ACTIVE, "AOC", ACTOR, 1, Map.of());
        final var c = EventDivergenceClassifier.classifyDuplicate(a, different);
        assertThat(c.klass()).isEqualTo(EventDivergenceClass.IN_SYNC);
    }
}
