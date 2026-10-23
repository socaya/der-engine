package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class TrackerRelationshipTest {

    @Test
    void acceptsValidRelationship() {
        final TrackerRelationship r = new TrackerRelationship("aBcDeFgHiJk",
                "aBcDeFgHiJ2", TrackerRelationship.EntityType.TRACKED_ENTITY,
                "aBcDeFgHiJ3", TrackerRelationship.EntityType.ENROLLMENT,
                "aBcDeFgHiJ4", false, UUID.randomUUID(), Instant.now());
        assertThat(r.bidirectional()).isFalse();
    }

    @Test
    void rejectsSelfRelationship() {
        assertThatThrownBy(() -> new TrackerRelationship("aBcDeFgHiJk",
                "aBcDeFgHiJ2", TrackerRelationship.EntityType.TRACKED_ENTITY,
                "aBcDeFgHiJ3", TrackerRelationship.EntityType.TRACKED_ENTITY,
                "aBcDeFgHiJ3", false, UUID.randomUUID(), Instant.now()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("itself");
    }

    @Test
    void rejectsBadUid() {
        assertThatThrownBy(() -> new TrackerRelationship("bad",
                "aBcDeFgHiJ2", TrackerRelationship.EntityType.TRACKED_ENTITY,
                "aBcDeFgHiJ3", TrackerRelationship.EntityType.ENROLLMENT,
                "aBcDeFgHiJ4", false, UUID.randomUUID(), Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
