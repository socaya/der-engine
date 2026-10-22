package ug.ac.mak.der.workflows.drafts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class DraftTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void rejectsEveryMissingField() {
        final UUID did = UUID.randomUUID();
        final UUID oid = UUID.randomUUID();
        final Instant now = Instant.now();
        assertThatThrownBy(() -> new Draft(null, oid, "k", "t", mapper.createObjectNode(), now, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, null, "k", "t", mapper.createObjectNode(), now, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, oid, null, "t", mapper.createObjectNode(), now, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, oid, "k", null, mapper.createObjectNode(), now, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, oid, "k", "t", null, now, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, oid, "k", "t", mapper.createObjectNode(), null, now))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new Draft(did, oid, "k", "t", mapper.createObjectNode(), now, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void acceptsAllFields() {
        final UUID did = UUID.randomUUID();
        final UUID oid = UUID.randomUUID();
        final Instant now = Instant.now();
        final Draft d = new Draft(did, oid, "AGGREGATE", "Weekly", mapper.createObjectNode(), now, now);
        assertThat(d.draftId()).isEqualTo(did);
        assertThat(d.ownerId()).isEqualTo(oid);
        assertThat(d.kind()).isEqualTo("AGGREGATE");
        assertThat(d.title()).isEqualTo("Weekly");
    }
}
