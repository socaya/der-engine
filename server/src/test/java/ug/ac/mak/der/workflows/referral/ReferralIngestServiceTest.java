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
        final ReferralIngestService svc = new ReferralIngestService(agg, noEvents(), new ObjectMapper());
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
            final ReferralIngestService svc = new ReferralIngestService(agg, noEvents(), new ObjectMapper());
            assertThat(svc.ingest(entry(k, "{}"), UUID.randomUUID(), null, null)).isFalse();
        }
        verify(agg, never()).submit(any(), any(), any(), any());
    }

    @Test
    void malformedPayloadSkips() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ReferralIngestService svc = new ReferralIngestService(agg, noEvents(), new ObjectMapper());
        assertThat(svc.ingest(entry(
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "not json"),
                UUID.randomUUID(), null, null)).isFalse();
        verify(agg, never()).submit(any(), any(), any(), any());
    }

    @Test
    void nonObjectPayloadSkips() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ReferralIngestService svc = new ReferralIngestService(agg, noEvents(), new ObjectMapper());
        assertThat(svc.ingest(entry(
                ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "[]"),
                UUID.randomUUID(), null, null)).isFalse();
    }

    @Test
    void nullEntryRejected() {
        final ReferralIngestService svc = new ReferralIngestService(
                mock(AggregateDataValueService.class), noEvents(), new ObjectMapper());
        assertThatThrownBy(() -> svc.ingest(null, UUID.randomUUID(), null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void eventIngestWritesViaEventService() {
        final AggregateDataValueService agg = mock(AggregateDataValueService.class);
        final ug.ac.mak.der.workflows.events.EventService ev =
                mock(ug.ac.mak.der.workflows.events.EventService.class);
        final org.springframework.beans.factory.ObjectProvider<
                ug.ac.mak.der.workflows.events.EventService> provider =
                        org.mockito.Mockito.mock(
                                org.springframework.beans.factory.ObjectProvider.class);
        org.mockito.Mockito.when(provider.getIfAvailable()).thenReturn(ev);
        final ReferralIngestService svc = new ReferralIngestService(agg, provider, new ObjectMapper());
        final boolean ok = svc.ingest(new ReferralInboxEntry(UUID.randomUUID(),
                ReferralInboxEntry.Kind.EVENT, "ref", "ou-dest",
                "{\"event\":\"" + UUID.randomUUID() + "\","
                + "\"program\":\"p\",\"programStage\":\"ps\","
                + "\"orgUnit\":\"ou-src\",\"occurredAt\":\"2026-10-23T00:00:00Z\","
                + "\"status\":\"ACTIVE\","
                + "\"dataValues\":[{\"dataElement\":\"de\",\"value\":\"1\"},"
                + "{\"dataElement\":\"de2\"}]}", NOW,
                ReferralInboxEntry.Status.PENDING, null, null),
                UUID.randomUUID(), null, null);
        assertThat(ok).isTrue();
        org.mockito.Mockito.verify(ev).submit(any(), any(), any(), any());
    }

    @Test
    void eventIngestMissingServiceReturnsFalse() {
        final org.springframework.beans.factory.ObjectProvider<
                ug.ac.mak.der.workflows.events.EventService> provider =
                        org.mockito.Mockito.mock(
                                org.springframework.beans.factory.ObjectProvider.class);
        org.mockito.Mockito.when(provider.getIfAvailable()).thenReturn(null);
        final ReferralIngestService svc = new ReferralIngestService(
                mock(AggregateDataValueService.class), provider, new ObjectMapper());
        assertThat(svc.ingest(new ReferralInboxEntry(UUID.randomUUID(),
                ReferralInboxEntry.Kind.EVENT, "r", "ou", "{\"program\":\"p\",\"programStage\":\"ps\"}",
                NOW, ReferralInboxEntry.Status.PENDING, null, null),
                UUID.randomUUID(), null, null)).isFalse();
    }

    @Test
    void eventIngestMissingProgramReturnsFalse() {
        final ug.ac.mak.der.workflows.events.EventService ev =
                mock(ug.ac.mak.der.workflows.events.EventService.class);
        final org.springframework.beans.factory.ObjectProvider<
                ug.ac.mak.der.workflows.events.EventService> provider =
                        org.mockito.Mockito.mock(
                                org.springframework.beans.factory.ObjectProvider.class);
        org.mockito.Mockito.when(provider.getIfAvailable()).thenReturn(ev);
        final ReferralIngestService svc = new ReferralIngestService(
                mock(AggregateDataValueService.class), provider, new ObjectMapper());
        assertThat(svc.ingest(new ReferralInboxEntry(UUID.randomUUID(),
                ReferralInboxEntry.Kind.EVENT, "r", "ou", "{\"programStage\":\"ps\"}",
                NOW, ReferralInboxEntry.Status.PENDING, null, null),
                UUID.randomUUID(), null, null)).isFalse();
        org.mockito.Mockito.verify(ev, org.mockito.Mockito.never())
                .submit(any(), any(), any(), any());
    }

    @SuppressWarnings("unchecked")
    private org.springframework.beans.factory.ObjectProvider<
            ug.ac.mak.der.workflows.events.EventService> noEvents() {
        final org.springframework.beans.factory.ObjectProvider<
                ug.ac.mak.der.workflows.events.EventService> p =
                org.mockito.Mockito.mock(
                        org.springframework.beans.factory.ObjectProvider.class);
        org.mockito.Mockito.when(p.getIfAvailable()).thenReturn(null);
        return p;
    }
}
