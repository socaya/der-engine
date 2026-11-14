package ug.ac.mak.der.analytics.column.preagg;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class PreaggregationProposalServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    private PreaggregationProposal advisory(final String shape,
                                               final long observations,
                                               final double avgMs,
                                               final long bytes) {
        return new PreaggregationProposal(
                shape, observations, avgMs,
                observations * avgMs, bytes,
                NOW.minusSeconds(3600), NOW,
                "test");
    }

    private PreaggregationProposalRecord persisted(
            final UUID id, final String shape,
            final PreaggregationProposalRecord.State state) {
        return new PreaggregationProposalRecord(
                id, shape, 5L, 10.0, 50.0, 100L,
                NOW.minusSeconds(3600), NOW, "r",
                state, null, null, null, NOW, NOW);
    }

    @Test
    void generateInsertsFreshRecordsForNewShapes() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        when(proposer.propose()).thenReturn(List.of(
                advisory("s1", 20L, 50.0, 1024L),
                advisory("s2", 10L, 100.0, 2048L)));
        when(repo.findOpenByShape(anyString())).thenReturn(Optional.empty());
        when(repo.findById(any(UUID.class)))
                .thenAnswer(inv -> Optional.empty());

        final List<PreaggregationProposalRecord> out =
                new PreaggregationProposalService(proposer, repo).generate();

        assertThat(out).hasSize(2);
        assertThat(out).extracting(PreaggregationProposalRecord::shapeKey)
                .containsExactly("s1", "s2");
        assertThat(out).allMatch(r -> r.state()
                == PreaggregationProposalRecord.State.PROPOSED);
        verify(repo, never()).refreshMeasurements(any(UUID.class),
                anyLong(), anyDouble(), anyDouble(), anyLong(),
                any(Instant.class), anyString());
    }

    @Test
    void generateRefreshesExistingProposedRecords() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        final UUID openId = UUID.randomUUID();
        when(proposer.propose()).thenReturn(List.of(
                advisory("s1", 50L, 80.0, 2048L)));
        final PreaggregationProposalRecord existing = persisted(
                openId, "s1",
                PreaggregationProposalRecord.State.PROPOSED);
        when(repo.findOpenByShape("s1")).thenReturn(Optional.of(existing));
        when(repo.findById(openId)).thenReturn(Optional.of(existing));

        new PreaggregationProposalService(proposer, repo).generate();

        verify(repo).refreshMeasurements(eq(openId), eq(50L),
                eq(80.0), eq(4000.0), eq(2048L),
                eq(NOW), eq("test"));
    }

    @Test
    void generateDoesNotRefreshApprovedRecords() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        final UUID openId = UUID.randomUUID();
        when(proposer.propose()).thenReturn(List.of(
                advisory("s1", 50L, 80.0, 2048L)));
        final PreaggregationProposalRecord approved = persisted(
                openId, "s1",
                PreaggregationProposalRecord.State.APPROVED);
        when(repo.findOpenByShape("s1")).thenReturn(Optional.of(approved));
        when(repo.findById(openId)).thenReturn(Optional.of(approved));

        new PreaggregationProposalService(proposer, repo).generate();

        verify(repo, never()).refreshMeasurements(any(UUID.class),
                anyLong(), anyDouble(), anyDouble(), anyLong(),
                any(Instant.class), anyString());
    }

    @Test
    void approveReturnsEmptyWhenTransitionAffectsNoRows() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.transition(eq(id), any(), any(), any())).thenReturn(0);

        final Optional<PreaggregationProposalRecord> out =
                new PreaggregationProposalService(proposer, repo)
                        .approve(id, UUID.randomUUID(), "ok");

        assertThat(out).isEmpty();
    }

    @Test
    void approveReturnsRecordWhenTransitionSucceeds() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        final UUID id = UUID.randomUUID();
        final UUID adminId = UUID.randomUUID();
        when(repo.transition(eq(id),
                eq(PreaggregationProposalRecord.State.APPROVED),
                eq(adminId), eq("ok"))).thenReturn(1);
        when(repo.findById(id)).thenReturn(Optional.of(persisted(
                id, "s1",
                PreaggregationProposalRecord.State.APPROVED)));

        final Optional<PreaggregationProposalRecord> out =
                new PreaggregationProposalService(proposer, repo)
                        .approve(id, adminId, "ok");

        assertThat(out).isPresent();
        assertThat(out.get().state())
                .isEqualTo(PreaggregationProposalRecord.State.APPROVED);
    }

    @Test
    void rejectTransitionsToRejected() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        final UUID id = UUID.randomUUID();
        final UUID adminId = UUID.randomUUID();
        when(repo.transition(eq(id),
                eq(PreaggregationProposalRecord.State.REJECTED),
                eq(adminId), eq("no thanks"))).thenReturn(1);
        when(repo.findById(id)).thenReturn(Optional.of(persisted(
                id, "s1",
                PreaggregationProposalRecord.State.REJECTED)));

        new PreaggregationProposalService(proposer, repo)
                .reject(id, adminId, "no thanks");

        verify(repo).transition(eq(id),
                eq(PreaggregationProposalRecord.State.REJECTED),
                eq(adminId), eq("no thanks"));
    }

    @Test
    void listNormalisesZeroLimitToOneHundred() {
        final PreaggregationProposer proposer = mock(PreaggregationProposer.class);
        final PreaggregationProposalRepository repo =
                mock(PreaggregationProposalRepository.class);
        when(repo.listByState(any(), anyInt())).thenReturn(List.of());

        new PreaggregationProposalService(proposer, repo).list(null, 0);
        new PreaggregationProposalService(proposer, repo).list(null, -5);

        verify(repo, org.mockito.Mockito.times(2))
                .listByState(eq(null), eq(100));
    }
}
