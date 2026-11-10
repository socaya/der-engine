package ug.ac.mak.der.analytics.publication;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.DimensionKey;

/**
 * Turns analytics cells + operator-declared mappings into proposed
 * {@code dataValueSets} rows awaiting human review (spec §4.5,
 * §8). Nothing in this service writes to DHIS2 directly — that
 * step is a separate drain job on APPROVED proposals.
 *
 * <p>Generation algorithm per mapping:</p>
 * <ol>
 *   <li>Query analytics_cell for the mapping's (metric,
 *       definition_version) and optional dimension filter.</li>
 *   <li>For each cell, upsert a PROPOSED row with the current
 *       value as the proposed value.</li>
 *   <li>Keep review state intact when a prior proposal exists —
 *       only the proposedValue + provenance get updated so a
 *       re-generation after the cell changes doesn't silently
 *       unapprove a prior sign-off.</li>
 * </ol>
 */
@Service
public class PublicationProposalService {

    private final PublicationRepository repo;
    private final AnalyticsEngineRepository cells;

    public PublicationProposalService(final PublicationRepository repo,
                                        final AnalyticsEngineRepository cells) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.cells = Objects.requireNonNull(cells, "cells");
    }

    public record GenerateScope(
            UUID metricId,
            String periodKey) {
    }

    public record GenerateResult(
            int mappingsConsidered,
            int cellsScanned,
            int proposalsUpserted,
            List<UUID> proposalIds) {
    }

    @Transactional
    public GenerateResult generate(final GenerateScope scope) {
        final List<PublicationMapping> mappings = repo.listMappings(
                scope == null ? null : scope.metricId());
        int cellsScanned = 0;
        int upserts = 0;
        final List<UUID> ids = new java.util.ArrayList<>();
        for (final PublicationMapping m : mappings) {
            final AnalyticsEngineRepository.CellQuery q =
                    new AnalyticsEngineRepository.CellQuery(
                            List.of(m.metricId()),
                            scope == null || scope.periodKey() == null
                                    ? List.of()
                                    : List.of(scope.periodKey()),
                            List.of(),
                            m.dimensionFilter(),
                            2000, 0);
            final List<AnalyticsCell> rows = cells.queryCells(q);
            for (final AnalyticsCell c : rows) {
                cellsScanned++;
                final BigDecimal value = c.value() != null
                        ? c.value()
                        : c.sumValue() != null
                                ? c.sumValue()
                                : (c.countValue() == null ? null
                                        : BigDecimal.valueOf(c.countValue()));
                if (value == null) {
                    continue;
                }
                final PublicationProposal p = new PublicationProposal(
                        UUID.randomUUID(),
                        m.mappingId(), m.metricId(),
                        m.definitionVersion(),
                        m.datasetUid(), m.dataElementUid(),
                        m.categoryOptionComboUid(),
                        m.attributeOptionComboUid(),
                        c.periodKey(), c.orgUnitUid(),
                        value, null,
                        PublicationProposal.State.PROPOSED,
                        null, null, null,
                        buildProvenance(c, m),
                        Instant.now(), Instant.now());
                ids.add(repo.upsertProposal(p));
                upserts++;
            }
        }
        return new GenerateResult(mappings.size(), cellsScanned,
                upserts, ids);
    }

    private static String buildProvenance(
            final AnalyticsCell c, final PublicationMapping m) {
        final Map<String, Object> prov = new java.util.LinkedHashMap<>();
        prov.put("metricId", c.metricId().toString());
        prov.put("definitionVersion", c.definitionVersion());
        prov.put("cellFreshnessAt",
                c.freshnessAt() == null ? null
                        : c.freshnessAt().toString());
        prov.put("cellQualityState", c.qualityState());
        prov.put("dimensionKey", c.dimensionKey());
        prov.put("dimensions", DimensionKey.decode(c.dimensionKey()));
        prov.put("mappingDimensionFilter", m.dimensionFilter());
        prov.put("publicationMode", m.publicationMode().name());
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(prov);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            return "{}";
        }
    }

    /* ─────── review operations ─────── */

    @Transactional
    public Optional<PublicationProposal> approve(final UUID proposalId,
                                                    final BigDecimal reviewedValue,
                                                    final String reason,
                                                    final UUID reviewer) {
        final Optional<PublicationProposal> existing =
                repo.findProposal(proposalId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        final BigDecimal value = reviewedValue != null
                ? reviewedValue : existing.get().proposedValue();
        repo.review(proposalId, PublicationProposal.State.APPROVED,
                value, reason, reviewer);
        return repo.findProposal(proposalId);
    }

    @Transactional
    public Optional<PublicationProposal> reject(final UUID proposalId,
                                                   final String reason,
                                                   final UUID reviewer) {
        final Optional<PublicationProposal> existing =
                repo.findProposal(proposalId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        repo.review(proposalId, PublicationProposal.State.REJECTED,
                null, reason, reviewer);
        return repo.findProposal(proposalId);
    }
}
