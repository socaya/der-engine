package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Batch ingestion for the two built-in event-/enrollment-count
 * metrics seeded by {@link AnalyticsSeed}.
 *
 * <p>Spec §15 Phase 2 scope: "event count, enrollment count, stable-
 * tally states". Phase 2 ships this as a batch job (operator /
 * admin-triggered) rather than a streaming journal consumer so the
 * materialization path can be exercised end-to-end before the
 * journal plumbing lands. Phase 2b will wire this to the operation
 * journal's change stream.</p>
 *
 * <p>Ingestion strategy:</p>
 * <ol>
 *   <li>For each source row (event / enrollment), resolve its
 *       canonical monthly period via {@link
 *       AnalyticsPeriodEnumerator#windowContaining}.</li>
 *   <li>Upsert a count=1 contribution keyed by the source UID +
 *       version — replays are a no-op.</li>
 *   <li>Collect the distinct affected cells and materialise each one
 *       by re-aggregating over the contribution ledger.</li>
 * </ol>
 *
 * <p>Out of scope for Phase 2: soft-deleted source handling requires
 * the source tables to carry a {@code deleted_at} column that the
 * capture surface doesn't yet publish uniformly. The ingestion job
 * filters by status on both event + enrollment so cancelled /
 * skipped records aren't silently counted.</p>
 */
@Service
public class AnalyticsIngestionService {

    private final JdbcTemplate jdbc;
    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsContributionRepository contributions;
    private final AnalyticsMaterializer materializer;
    private final AnalyticsPeriodEnumerator periods;
    private final AnalyticsSeed seed;

    public AnalyticsIngestionService(final JdbcTemplate jdbc,
                                       final AnalyticsEngineRepository engineRepo,
                                       final AnalyticsContributionRepository contributions,
                                       final AnalyticsMaterializer materializer,
                                       final AnalyticsPeriodEnumerator periods,
                                       final AnalyticsSeed seed) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.materializer = Objects.requireNonNull(materializer, "materializer");
        this.periods = Objects.requireNonNull(periods, "periods");
        this.seed = Objects.requireNonNull(seed, "seed");
    }

    public record IngestResult(
            String metricCode,
            long rowsScanned,
            long contributionsWritten,
            long cellsMaterialised) {
    }

    /** Scope for the batch ingestion job. {@code null} values widen
     *  the scan to "every row" in that dimension. */
    public record IngestScope(
            String orgUnitUid,
            String programUid,
            LocalDate fromDate,
            LocalDate toDate) {
    }

    /** Run both built-in metrics against the current source tables.
     *  Returns a per-metric summary suitable for the admin endpoint
     *  response. */
    @Transactional
    public List<IngestResult> ingestBuiltIns(final IngestScope scope) {
        Objects.requireNonNull(scope, "scope");
        final List<IngestResult> out = new ArrayList<>(2);
        seed.definition(AnalyticsSeed.EVENT_COUNT_CODE)
                .ifPresent(d -> out.add(ingestEventCount(d, scope)));
        seed.definition(AnalyticsSeed.ENROLLMENT_COUNT_CODE)
                .ifPresent(d -> out.add(ingestEnrollmentCount(d, scope)));
        return out;
    }

    private IngestResult ingestEventCount(final AnalyticsDefinition def,
                                            final IngestScope scope) {
        final StringBuilder sql = new StringBuilder(
                "SELECT event_uid, org_unit_uid, occurred_date, "
              + "       version, status "
              + "  FROM der.edge_tracker_event WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            sql.append(" AND program_uid = ?");
            args.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            sql.append(" AND occurred_date >= ?");
            args.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            sql.append(" AND occurred_date <= ?");
            args.add(java.sql.Date.valueOf(scope.toDate()));
        }

        final List<AnalyticsContribution> batch = new ArrayList<>();
        final Set<AnalyticsContributionRepository.CellRef> touched = new HashSet<>();
        final long[] scanned = { 0L };
        jdbc.query(sql.toString(), (rs, i) -> {
            scanned[0]++;
            final String status = rs.getString("status");
            final LocalDate occurred = rs.getDate("occurred_date")
                    .toLocalDate();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY, occurred).id();
            final String orgUnit = rs.getString("org_unit_uid");
            final boolean eligible = !"SKIPPED".equals(status);
            batch.add(new AnalyticsContribution(def.id(),
                    def.definitionVersion(),
                    rs.getString("event_uid"),
                    String.valueOf(rs.getInt("version")),
                    periodKey,
                    orgUnit,
                    "",
                    BigDecimal.ONE,
                    eligible,
                    "COMMITTED",
                    null, null));
            touched.add(new AnalyticsContributionRepository.CellRef(
                    periodKey, orgUnit, ""));
            return null;
        }, args.toArray());

        return commitBatch(def, batch, touched, scanned[0]);
    }

    private IngestResult ingestEnrollmentCount(final AnalyticsDefinition def,
                                                 final IngestScope scope) {
        final StringBuilder sql = new StringBuilder(
                "SELECT enrollment_uid, org_unit_uid, enrollment_date, "
              + "       version, status "
              + "  FROM der.edge_enrollment WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            sql.append(" AND program_uid = ?");
            args.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            sql.append(" AND enrollment_date >= ?");
            args.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            sql.append(" AND enrollment_date <= ?");
            args.add(java.sql.Date.valueOf(scope.toDate()));
        }

        final List<AnalyticsContribution> batch = new ArrayList<>();
        final Set<AnalyticsContributionRepository.CellRef> touched = new HashSet<>();
        final long[] scanned = { 0L };
        jdbc.query(sql.toString(), (rs, i) -> {
            scanned[0]++;
            final String status = rs.getString("status");
            final LocalDate enrolledOn = rs.getDate("enrollment_date")
                    .toLocalDate();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY, enrolledOn).id();
            final String orgUnit = rs.getString("org_unit_uid");
            // CANCELLED enrolments still land as ineligible so the ledger
            // reflects attempted enrolment without inflating counts.
            final boolean eligible = !"CANCELLED".equals(status);
            batch.add(new AnalyticsContribution(def.id(),
                    def.definitionVersion(),
                    rs.getString("enrollment_uid"),
                    String.valueOf(rs.getInt("version")),
                    periodKey, orgUnit, "",
                    BigDecimal.ONE, eligible, "COMMITTED",
                    null, null));
            touched.add(new AnalyticsContributionRepository.CellRef(
                    periodKey, orgUnit, ""));
            return null;
        }, args.toArray());

        return commitBatch(def, batch, touched, scanned[0]);
    }

    private IngestResult commitBatch(final AnalyticsDefinition def,
                                       final List<AnalyticsContribution> batch,
                                       final Set<AnalyticsContributionRepository.CellRef> touched,
                                       final long scanned) {
        int[] updates = new int[0];
        if (!batch.isEmpty()) {
            updates = contributions.upsertBatch(batch);
        }
        long cells = 0;
        for (final AnalyticsContributionRepository.CellRef ref : touched) {
            materializer.materializeCell(def, ref.periodKey(),
                    ref.orgUnitUid(), ref.dimensionKey());
            cells++;
        }
        return new IngestResult(def.code(), scanned, updates.length, cells);
    }

    /** Clear the Phase-2 contribution ledger + materialised cells for
     *  the built-in metrics. Admin-only — used before a fresh
     *  re-ingest when operators want a known-clean baseline. */
    @Transactional
    public Map<String, Integer> resetBuiltIns() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final String code : List.of(
                AnalyticsSeed.EVENT_COUNT_CODE,
                AnalyticsSeed.ENROLLMENT_COUNT_CODE)) {
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinitionByCode(code);
            if (defOpt.isEmpty()) {
                out.put(code, 0);
                continue;
            }
            final AnalyticsDefinition def = defOpt.get();
            final int contribs = jdbc.update(
                    "DELETE FROM der.analytics_contribution "
                  + " WHERE metric_id = ? AND definition_version = ?",
                    def.id(), def.definitionVersion());
            jdbc.update(
                    "DELETE FROM der.analytics_cell "
                  + " WHERE metric_id = ? AND definition_version = ?",
                    def.id(), def.definitionVersion());
            out.put(code, contribs);
        }
        return out;
    }
}
