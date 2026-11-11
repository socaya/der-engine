package ug.ac.mak.der.analytics.reconciliation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * Orchestrates spec §12 reconciliation. Given a batch of
 * {@link CentralSample} rows (one per authoritative central value
 * for the same (metric, period, orgUnit, dimensionKey)), the service
 * joins each sample to the latest materialised local cell, runs
 * {@link ReconciliationClassifier}, and upserts the classified
 * verdict into {@code der.analytics_reconciliation}.
 *
 * <p>The central-fetch step (DHIS2 {@code /api/analytics}) lives in
 * a later slice; the service accepts pre-fetched samples now so it's
 * fully testable with no HTTP mock and the classifier is used in
 * production exactly as unit tests exercise it.</p>
 */
@Service
public class AnalyticsReconciliationService {

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsReconciliationRepository reconRepo;

    public AnalyticsReconciliationService(
            final AnalyticsEngineRepository engineRepo,
            final AnalyticsReconciliationRepository reconRepo) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.reconRepo = Objects.requireNonNull(reconRepo, "reconRepo");
    }

    /** One authoritative central value, with the metadata the
     *  classifier needs to pick a specific reason over a generic
     *  REAL_MISMATCH. */
    public record CentralSample(
            UUID metricId,
            String periodKey,
            String orgUnitUid,
            String dimensionKey,
            BigDecimal centralValue,
            Integer centralDefinitionVersion,
            Instant centralRefreshAt,
            boolean metricFormulaCompatibleWithCentral,
            boolean sameOrgUnitAnchor,
            boolean sameDateAnchor,
            boolean sameDedupPolicy,
            boolean hasRejectedTrackerUpdate,
            boolean localHasUnpublishedSources,
            boolean lateDataAfterRefresh,
            Instant lastLocalPublishAt) {
    }

    public record CompareResult(
            int samplesConsidered,
            int rowsUpserted,
            Map<String, Integer> byClassification) {
    }

    @Transactional
    public CompareResult compare(final List<CentralSample> samples) {
        if (samples == null || samples.isEmpty()) {
            return new CompareResult(0, 0,
                    emptyClassificationHistogram());
        }
        final Map<String, Integer> counts = emptyClassificationHistogram();
        int upserts = 0;
        for (final CentralSample s : samples) {
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinition(s.metricId());
            if (defOpt.isEmpty()) {
                continue;
            }
            final AnalyticsDefinition def = defOpt.get();
            final String dim = s.dimensionKey() == null ? ""
                    : s.dimensionKey();
            final Optional<AnalyticsCell> cellOpt = engineRepo.findCell(
                    def.id(), def.definitionVersion(),
                    s.periodKey(), s.orgUnitUid(), dim);
            final BigDecimal localValue = cellOpt
                    .map(AnalyticsCell::value)
                    .orElse(null);

            final ReconciliationClassifier.Input in =
                    new ReconciliationClassifier.Input(
                            localValue, s.centralValue(),
                            def.definitionVersion(),
                            s.centralDefinitionVersion(),
                            s.centralRefreshAt(),
                            s.lastLocalPublishAt(),
                            s.metricFormulaCompatibleWithCentral(),
                            s.sameOrgUnitAnchor(),
                            s.sameDateAnchor(),
                            s.sameDedupPolicy(),
                            s.hasRejectedTrackerUpdate(),
                            s.localHasUnpublishedSources(),
                            s.lateDataAfterRefresh());
            final ReconciliationClassifier.Verdict v =
                    ReconciliationClassifier.classify(in);

            final AnalyticsReconciliation row =
                    new AnalyticsReconciliation(
                            UUID.randomUUID(), def.id(),
                            def.definitionVersion(),
                            s.periodKey(), s.orgUnitUid(), dim,
                            localValue, s.centralValue(),
                            v.classification(), v.explanation(),
                            s.centralRefreshAt(), null,
                            Instant.now(), Instant.now());
            reconRepo.upsert(row);
            upserts++;
            counts.merge(v.classification().name(), 1, Integer::sum);
        }
        return new CompareResult(samples.size(), upserts, counts);
    }

    /** Summary snapshot — total rows + classification histogram. */
    public Map<String, Object> summary() {
        final Map<String, Object> out = new LinkedHashMap<>();
        final Map<String, Integer> counts = reconRepo.classificationCounts();
        int total = 0;
        for (final int n : counts.values()) {
            total += n;
        }
        out.put("totalRows", total);
        out.put("byClassification", counts);
        return out;
    }

    /** Stable zero-valued histogram, so downstream renderers can
     *  display the full taxonomy even when a classification has no
     *  rows yet. */
    public static Map<String, Integer> emptyClassificationHistogram() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final ReconciliationClassifier.Classification c
                : ReconciliationClassifier.Classification.values()) {
            out.put(c.name(), 0);
        }
        return out;
    }

    /** JSON projection for the controller. Kept beside the service
     *  so the shape stays consistent with the summary endpoint. */
    public static List<Map<String, Object>> asJson(
            final List<AnalyticsReconciliation> rows) {
        final List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (final AnalyticsReconciliation r : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("reconciliationId", r.reconciliationId().toString());
            m.put("metricId", r.metricId().toString());
            m.put("definitionVersion", r.definitionVersion());
            m.put("periodKey", r.periodKey());
            m.put("orgUnitUid", r.orgUnitUid());
            m.put("dimensionKey", r.dimensionKey());
            m.put("localValue", r.localValue() == null ? null
                    : r.localValue().toPlainString());
            m.put("centralValue", r.centralValue() == null ? null
                    : r.centralValue().toPlainString());
            m.put("classification", r.classification().name());
            m.put("explanation", r.explanation());
            m.put("centralRefreshAt", r.centralRefreshAt() == null ? null
                    : r.centralRefreshAt().toString());
            m.put("updatedAt", r.updatedAt() == null ? null
                    : r.updatedAt().toString());
            out.add(m);
        }
        return out;
    }
}
