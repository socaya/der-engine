package ug.ac.mak.der.workflows.referral;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;

class ReferralIngestServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private ReferralInboxEntry entry(final ReferralInboxEntry.Kind kind, final String json) {
        return new ReferralInboxEntry(UUID.randomUUID(), kind, "ref", "ou-dest",
                json, NOW, ReferralInboxEntry.Status.PENDING, null, null);
    }

    @Test
    void ingestAggregateCallsSubmit() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ReferralIngestService svc = new ReferralIngestService(agg, new ObjectMapper());
        final boolean ok = svc.ingest(entry(
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE,
                "{\"dataElement\":\"de\",\"orgUnit\":\"ou-src\",\"period\":\"2026Q1\","
                        + "\"categoryOptionCombo\":\"c\",\"attributeOptionCombo\":\"a\","
                        + "\"value\":\"7\",\"comment\":\"referred\"}"),
                UUID.randomUUID(), "1.1.1.1", "ua");
        assertThat(ok).isTrue();
        final org.mockito.ArgumentCaptor<java.util.List<AggregateDataValueService.DataValueInput>> cap =
                org.mockito.ArgumentCaptor.forClass(List.class);
        verify(agg).submit(cap.capture(), any(), any(), any());
        final AggregateDataValueService.DataValueInput in = cap.getValue().get(0);
        assertThat(in.dataElementUid()).isEqualTo("de");
        // orgUnit is overridden with the inbox entry's bound OU, not the payload's.
        assertThat(in.orgUnitUid()).isEqualTo("ou-dest");
        assertThat(in.value()).isEqualTo("7");
    }

    @Test
    void nonAggregateKindsSkip() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        for (final ReferralInboxEntry.Kind k : new ReferralInboxEntry.Kind[] {
                ReferralInboxEntry.Kind.EVENT,
                ReferralInboxEntry.Kind.ENROLLMENT,
                ReferralInboxEntry.Kind.TRACKED_ENTITY}) {
            final ReferralIngestService svc = new ReferralIngestService(agg, new ObjectMapper());
            assertThat(svc.ingest(entry(k, "{}"), UUID.randomUUID(), null, null)).isFalse();
        }
        verify(agg, never()).submit(any(), any(), any(), any());
    }

    @Test
    void malformedPayloadSkips() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ReferralIngestService svc = new ReferralIngestService(agg, new ObjectMapper());
        assertThat(svc.ingest(entry(
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "not json"),
                UUID.randomUUID(), null, null)).isFalse();
        verify(agg, never()).submit(any(), any(), any(), any());
    }

    @Test
    void nonObjectPayloadSkips() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ReferralIngestService svc = new ReferralIngestService(agg, new ObjectMapper());
        assertThat(svc.ingest(entry(
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "[]"),
                UUID.randomUUID(), null, null)).isFalse();
    }

    @Test
    void nullEntryRejected() {
        final ReferralIngestService svc = new ReferralIngestService(
                mock(AggregateDataValueService.class), new ObjectMapper());
        assertThatThrownBy(() -> svc.ingest(null, UUID.randomUUID(), null, null))
                .isInstanceOf(NullPointerException.class);
    }
}
