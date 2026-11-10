package ug.ac.mak.der.analytics.publication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class PublicationProposalServiceTest {

    private PublicationRepository repo;
    private AnalyticsEngineRepository cellsRepo;
    private PublicationProposalService service;

    private final UUID metricId = UUID.randomUUID();
    private final UUID mappingId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(PublicationRepository.class);
        cellsRepo = mock(AnalyticsEngineRepository.class);
    }

    private PublicationMapping mapping(final PublicationMapping.Mode mode) {
        return new PublicationMapping(
                mappingId, metricId, 1,
                "DS-UID", "DE-UID", "COC-UID", "AOC-UID",
                Map.of(), mode, "REPLACE", Instant.now(), Instant.now());
    }

    private AnalyticsCell cell(final BigDecimal value) {
        return new AnalyticsCell(
                metricId, 1, "202611", "OU-A", "",
                1L, value, value, null, null, Instant.now(), "VERIFIED");
    }

    private PublicationProposal priorApproved(final BigDecimal value) {
        return new PublicationProposal(
                UUID.randomUUID(), mappingId, metricId, 1,
                "DS-UID", "DE-UID", "COC-UID", "AOC-UID",
                "202611", "OU-A",
                value, value,
                PublicationProposal.State.APPROVED,
                "ok", UUID.randomUUID(), Instant.now(),
                "{}", Instant.now(), Instant.now());
    }

    @Test
    void autoApproveExactFlipsWhenValueUnchanged() {
        service = new PublicationProposalService(repo, cellsRepo,
                new PublicationProperties(BigDecimal.ZERO, 0L, 0, true));
        final UUID proposalId = UUID.randomUUID();
        when(repo.listMappings(any()))
                .thenReturn(List.of(mapping(
                        PublicationMapping.Mode.AUTO_APPROVE_EXACT)));
        when(cellsRepo.queryCells(any()))
                .thenReturn(List.of(cell(new BigDecimal("42"))));
        when(repo.upsertProposal(any())).thenReturn(proposalId);
        when(repo.findPriorForCell(mappingId, "202611", "OU-A"))
                .thenReturn(Optional.of(priorApproved(new BigDecimal("42"))));

        service.generate(new PublicationProposalService.GenerateScope(
                metricId, "202611"));

        verify(repo).review(eq(proposalId),
                eq(PublicationProposal.State.APPROVED),
                eq(new BigDecimal("42")),
                any(String.class), any());
    }

    @Test
    void autoApproveExactSkipsWhenValueChanged() {
        service = new PublicationProposalService(repo, cellsRepo,
                new PublicationProperties(BigDecimal.ZERO, 0L, 0, true));
        when(repo.listMappings(any()))
                .thenReturn(List.of(mapping(
                        PublicationMapping.Mode.AUTO_APPROVE_EXACT)));
        when(cellsRepo.queryCells(any()))
                .thenReturn(List.of(cell(new BigDecimal("43"))));
        when(repo.upsertProposal(any())).thenReturn(UUID.randomUUID());
        when(repo.findPriorForCell(mappingId, "202611", "OU-A"))
                .thenReturn(Optional.of(priorApproved(new BigDecimal("42"))));

        service.generate(new PublicationProposalService.GenerateScope(
                metricId, "202611"));

        verify(repo, never()).review(any(), any(), any(), any(), any());
    }

    @Test
    void autoApproveUnderThresholdAcceptsSmallDelta() {
        service = new PublicationProposalService(repo, cellsRepo,
                new PublicationProperties(new BigDecimal("2"), 0L, 0, true));
        final UUID proposalId = UUID.randomUUID();
        when(repo.listMappings(any()))
                .thenReturn(List.of(mapping(
                        PublicationMapping.Mode.AUTO_APPROVE_UNDER_THRESHOLD)));
        when(cellsRepo.queryCells(any()))
                .thenReturn(List.of(cell(new BigDecimal("43"))));
        when(repo.upsertProposal(any())).thenReturn(proposalId);
        when(repo.findPriorForCell(mappingId, "202611", "OU-A"))
                .thenReturn(Optional.of(priorApproved(new BigDecimal("42"))));

        service.generate(new PublicationProposalService.GenerateScope(
                metricId, "202611"));

        verify(repo, times(1)).review(eq(proposalId),
                eq(PublicationProposal.State.APPROVED),
                eq(new BigDecimal("43")),
                any(String.class), any());
    }

    @Test
    void reviewRequiredNeverAutoApproves() {
        service = new PublicationProposalService(repo, cellsRepo,
                new PublicationProperties(new BigDecimal("1000"), 0L, 0, true));
        when(repo.listMappings(any()))
                .thenReturn(List.of(mapping(
                        PublicationMapping.Mode.REVIEW_REQUIRED)));
        when(cellsRepo.queryCells(any()))
                .thenReturn(List.of(cell(new BigDecimal("42"))));
        when(repo.upsertProposal(any())).thenReturn(UUID.randomUUID());

        service.generate(new PublicationProposalService.GenerateScope(
                metricId, "202611"));

        verify(repo, never()).review(any(), any(), any(), any(), any());
    }
}
