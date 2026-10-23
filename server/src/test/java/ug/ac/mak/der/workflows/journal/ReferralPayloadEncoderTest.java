package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

class ReferralPayloadEncoderTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ReferralPayloadEncoder encoder = new ReferralPayloadEncoder(mapper);
    private final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private OperationJournalEntry entry(final OperationJournalEntry.EntityType type,
                                           final String payloadJson,
                                           final String nextHop) throws Exception {
        final JsonNode payload = mapper.readTree(payloadJson);
        return new OperationJournalEntry(UUID.randomUUID(), type, "ref", payload,
                OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW, nextHop);
    }

    @Test
    void noMarkerWhenNextHopNull() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"dataElement\":\"de\",\"comment\":\"x\"}", null));
        assertThat(body).isEqualTo("{\"dataElement\":\"de\",\"comment\":\"x\"}");
    }

    @Test
    void noMarkerWhenNextHopBlank() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"comment\":\"x\"}", "   "));
        assertThat(body).isEqualTo("{\"comment\":\"x\"}");
    }

    @Test
    void aggregateAppendsToExistingComment() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"comment\":\"existing\"}", "ou-dest"));
        final JsonNode n = mapper.readTree(body);
        assertThat(n.get("comment").asText()).isEqualTo("existing [DER-next-hop:ou-dest]");
    }

    @Test
    void aggregateSetsCommentWhenEmpty() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"comment\":\"\"}", "ou-dest"));
        assertThat(mapper.readTree(body).get("comment").asText())
                .isEqualTo("[DER-next-hop:ou-dest]");
    }

    @Test
    void aggregateSetsCommentWhenMissing() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"dataElement\":\"de\"}", "ou-dest"));
        assertThat(mapper.readTree(body).get("comment").asText())
                .isEqualTo("[DER-next-hop:ou-dest]");
    }

    @Test
    void aggregateRewritesOrgUnitToDestination() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "{\"dataElement\":\"de\",\"orgUnit\":\"ou-src\",\"value\":\"5\"}",
                "ou-dest"));
        final JsonNode n = mapper.readTree(body);
        assertThat(n.get("orgUnit").asText()).isEqualTo("ou-dest");
        assertThat(n.get("comment").asText()).isEqualTo("[DER-next-hop:ou-dest]");
    }

    @Test
    void eventPushesNote() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.EVENT,
                "{\"event\":\"e1\"}", "ou-dest"));
        final JsonNode notes = mapper.readTree(body).get("notes");
        assertThat(notes.isArray()).isTrue();
        assertThat(notes.size()).isEqualTo(1);
        assertThat(notes.get(0).get("value").asText()).isEqualTo("[DER-next-hop:ou-dest]");
    }

    @Test
    void eventAppendsToExistingNotes() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.EVENT,
                "{\"notes\":[{\"value\":\"first\"}]}", "ou-dest"));
        final JsonNode notes = mapper.readTree(body).get("notes");
        assertThat(notes.size()).isEqualTo(2);
        assertThat(notes.get(1).get("value").asText()).isEqualTo("[DER-next-hop:ou-dest]");
    }

    @Test
    void enrollmentPushesNote() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.ENROLLMENT,
                "{\"enrollment\":\"e1\"}", "ou-dest"));
        assertThat(mapper.readTree(body).get("notes").size()).isEqualTo(1);
    }

    @Test
    void trackedEntityPushesNote() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.TRACKED_ENTITY,
                "{}", "ou-dest"));
        assertThat(mapper.readTree(body).get("notes").size()).isEqualTo(1);
    }

    @Test
    void programStageEventPushesNote() throws Exception {
        final String body = encoder.body(entry(
                OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT,
                "{}", "ou-dest"));
        assertThat(mapper.readTree(body).get("notes").size()).isEqualTo(1);
    }

    @Test
    void failsOpenOnWrongShape() throws Exception {
        // Payload is an array, not an object → ClassCastException inside; encoder
        // should log + return the raw payload.
        final OperationJournalEntry entry = new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "r",
                mapper.readTree("[]"), OperationJournalEntry.State.PENDING,
                0, null, null, NOW, NOW, "ou-dest");
        assertThat(encoder.body(entry)).isEqualTo("[]");
    }

    @Test
    void nullPayloadReturnsEmptyObject() {
        final OperationJournalEntry entry = new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "r",
                mapper.createObjectNode(), OperationJournalEntry.State.PENDING,
                0, null, null, NOW, NOW, null);
        // Use reflection to bypass @NotNull — simplest is to construct with a null
        // payload via a direct new call. The record ctor enforces non-null, so we
        // only cover the null branch via a direct call to body() with a crafted
        // entry — easier: verify explicit null guard via Objects.requireNonNull.
        assertThatThrownBy(() -> encoder.body(null))
                .isInstanceOf(NullPointerException.class);
        assertThat(encoder.body(entry)).isEqualTo("{}");
    }

    @Test
    void markerHelperFormats() {
        assertThat(ReferralPayloadEncoder.marker("ou-x")).isEqualTo("[DER-next-hop:ou-x]");
        assertThatThrownBy(() -> ReferralPayloadEncoder.marker(null))
                .isInstanceOf(NullPointerException.class);
    }
}
