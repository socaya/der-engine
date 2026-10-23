package ug.ac.mak.der.workflows.referral;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;

class ReferralInboxScannerTest {

    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private ReferralInboxScanner newScanner(final ReferralInboxRepository inbox,
                                              final OrgUnitBindingService binding,
                                              final CentralReferralSearchClient central) {
        return new ReferralInboxScanner(inbox, binding, central,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private EdgeOrgUnitBinding bound(final String ou) {
        return new EdgeOrgUnitBinding(ou, "name", "/root/" + ou, NOW, UUID.randomUUID());
    }

    @Test
    void notBoundSkips() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(new EdgeOrgUnitBinding(null, null, null, null, null));
        final ReferralInboxRepository inbox = mock(ReferralInboxRepository.class);
        assertThat(newScanner(inbox, binding, new NoOpCentralReferralSearchClient()).scanOnce())
                .isEqualTo(ReferralInboxScanner.ScanResult.NOT_BOUND);
        verify(inbox, never()).insertIfAbsent(any());
    }

    @Test
    void failsOpenOnRuntimeException() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(bound("ou"));
        final CentralReferralSearchClient central = mock(CentralReferralSearchClient.class);
        when(central.findReferrals(anyString(), any())).thenThrow(new RuntimeException("down"));
        final ReferralInboxRepository inbox = mock(ReferralInboxRepository.class);
        assertThat(newScanner(inbox, binding, central).scanOnce())
                .isEqualTo(ReferralInboxScanner.ScanResult.UNAVAILABLE);
        verify(inbox, never()).insertIfAbsent(any());
    }

    @Test
    void insertsEachCandidate() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(bound("ou"));
        final CentralReferralSearchClient central = mock(CentralReferralSearchClient.class);
        when(central.findReferrals(anyString(), any())).thenReturn(List.of(
                new CentralReferralSearchClient.Candidate(
                        ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "ref-1", "{}"),
                new CentralReferralSearchClient.Candidate(
                        ReferralInboxEntry.Kind.EVENT, "ref-2", "{}")));
        final ReferralInboxRepository inbox = mock(ReferralInboxRepository.class);
        when(inbox.insertIfAbsent(any())).thenReturn(1);
        final var result = newScanner(inbox, binding, central).scanOnce();
        assertThat(result.candidates()).isEqualTo(2);
        assertThat(result.inserted()).isEqualTo(2);
        verify(inbox, org.mockito.Mockito.times(2)).insertIfAbsent(any());
    }

    @Test
    void swallowsInsertFailureAndContinues() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(bound("ou"));
        final CentralReferralSearchClient central = mock(CentralReferralSearchClient.class);
        when(central.findReferrals(anyString(), any())).thenReturn(List.of(
                new CentralReferralSearchClient.Candidate(
                        ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, "ref-1", "{}"),
                new CentralReferralSearchClient.Candidate(
                        ReferralInboxEntry.Kind.EVENT, "ref-2", "{}")));
        final ReferralInboxRepository inbox = mock(ReferralInboxRepository.class);
        when(inbox.insertIfAbsent(any())).thenThrow(new RuntimeException("db down"))
                .thenReturn(1);
        final var result = newScanner(inbox, binding, central).scanOnce();
        // Both insert attempts happen; only one succeeds.
        assertThat(result.candidates()).isEqualTo(2);
        assertThat(result.inserted()).isEqualTo(1);
    }

    @Test
    void customLookbackPassedToClient() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(bound("ou"));
        final CentralReferralSearchClient central = mock(CentralReferralSearchClient.class);
        when(central.findReferrals(anyString(), any())).thenReturn(List.of());
        newScanner(mock(ReferralInboxRepository.class), binding, central)
                .scanOnce(java.time.Duration.ofMinutes(5));
        final org.mockito.ArgumentCaptor<Instant> cap =
                org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(central).findReferrals(anyString(), cap.capture());
        assertThat(cap.getValue()).isEqualTo(NOW.minus(java.time.Duration.ofMinutes(5)));
    }

    @Test
    void nullLookbackFallsBackToDefault() {
        final OrgUnitBindingService binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(bound("ou"));
        final CentralReferralSearchClient central = mock(CentralReferralSearchClient.class);
        when(central.findReferrals(anyString(), any())).thenReturn(List.of());
        newScanner(mock(ReferralInboxRepository.class), binding, central).scanOnce(null);
        final org.mockito.ArgumentCaptor<Instant> cap =
                org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(central).findReferrals(anyString(), cap.capture());
        assertThat(cap.getValue()).isEqualTo(NOW.minus(java.time.Duration.ofHours(24)));
    }

    @Test
    void noOpClientReturnsEmpty() {
        assertThat(new NoOpCentralReferralSearchClient().findReferrals("ou", NOW)).isEmpty();
    }
}
