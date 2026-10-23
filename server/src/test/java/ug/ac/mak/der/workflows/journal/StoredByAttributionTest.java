package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * ADR-0032: verifies the {@link ReferralPayloadEncoder} stamps the
 * DHIS2 {@code storedBy} field with the mapped captor username.
 */
class StoredByAttributionTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private ReferralPayloadEncoder encoderWithMapping(final UUID edgeUser,
                                                        final String storedBy) {
        final CapturedByResolver resolver = mock(CapturedByResolver.class);
        when(resolver.storedByFor(edgeUser)).thenReturn(Optional.ofNullable(storedBy));
        @SuppressWarnings("unchecked")
        final ObjectProvider<CapturedByResolver> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(resolver);
        return new ReferralPayloadEncoder(mapper, provider);
    }

    private OperationJournalEntry entry(final OperationJournalEntry.EntityType type,
                                           final JsonNode payload,
                                           final UUID submittedBy) {
        return new OperationJournalEntry(UUID.randomUUID(), type, "ref", payload,
                OperationJournalEntry.State.PENDING, 0, null,
                submittedBy, NOW, NOW, null);
    }

    @Test
    void aggregateStampsStoredByOnEnvelopeAndDataValues() throws Exception {
        final UUID edgeUser = UUID.randomUUID();
        final ReferralPayloadEncoder enc = encoderWithMapping(edgeUser, "nurse.alice");
        final JsonNode payload = mapper.readTree(
                "{\"dataSet\":\"ds\",\"dataValues\":["
                        + "{\"dataElement\":\"de1\",\"value\":\"1\"},"
                        + "{\"dataElement\":\"de2\",\"value\":\"2\"}]}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, payload, edgeUser));
        final JsonNode out = mapper.readTree(body);
        assertThat(out.get("storedBy").asText()).isEqualTo("nurse.alice");
        assertThat(out.get("dataValues").get(0).get("storedBy").asText())
                .isEqualTo("nurse.alice");
        assertThat(out.get("dataValues").get(1).get("storedBy").asText())
                .isEqualTo("nurse.alice");
    }

    @Test
    void eventStampsStoredBy() throws Exception {
        final UUID edgeUser = UUID.randomUUID();
        final ReferralPayloadEncoder enc = encoderWithMapping(edgeUser, "nurse.alice");
        final JsonNode payload = mapper.readTree("{\"event\":\"abc\",\"program\":\"p1\"}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.EVENT, payload, edgeUser));
        assertThat(mapper.readTree(body).get("storedBy").asText()).isEqualTo("nurse.alice");
    }

    @Test
    void enrollmentStampsStoredBy() throws Exception {
        final UUID edgeUser = UUID.randomUUID();
        final ReferralPayloadEncoder enc = encoderWithMapping(edgeUser, "nurse.alice");
        final JsonNode payload = mapper.readTree("{\"enrollment\":\"e1\",\"program\":\"p1\"}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.ENROLLMENT, payload, edgeUser));
        assertThat(mapper.readTree(body).get("storedBy").asText()).isEqualTo("nurse.alice");
    }

    @Test
    void trackedEntityStampsNestedEnrollmentsAndEvents() throws Exception {
        final UUID edgeUser = UUID.randomUUID();
        final ReferralPayloadEncoder enc = encoderWithMapping(edgeUser, "nurse.alice");
        final JsonNode payload = mapper.readTree(
                "{\"trackedEntity\":\"tei1\",\"enrollments\":["
                        + "{\"enrollment\":\"e1\",\"events\":["
                        + "{\"event\":\"ev1\"}]}]}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.TRACKED_ENTITY, payload, edgeUser));
        final JsonNode out = mapper.readTree(body);
        assertThat(out.has("storedBy")).isFalse();
        assertThat(out.get("enrollments").get(0).get("storedBy").asText())
                .isEqualTo("nurse.alice");
        assertThat(out.get("enrollments").get(0).get("events").get(0)
                .get("storedBy").asText()).isEqualTo("nurse.alice");
    }

    @Test
    void noStampWhenMappingAbsent() throws Exception {
        final UUID edgeUser = UUID.randomUUID();
        final ReferralPayloadEncoder enc = encoderWithMapping(edgeUser, null);
        final JsonNode payload = mapper.readTree("{\"dataSet\":\"ds\"}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, payload, edgeUser));
        assertThat(mapper.readTree(body).has("storedBy")).isFalse();
    }

    @Test
    void noStampWhenResolverUnavailable() throws Exception {
        final ReferralPayloadEncoder enc = new ReferralPayloadEncoder(mapper);
        final JsonNode payload = mapper.readTree("{\"dataSet\":\"ds\"}");
        final String body = enc.body(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                payload, UUID.randomUUID()));
        assertThat(mapper.readTree(body).has("storedBy")).isFalse();
    }
}
