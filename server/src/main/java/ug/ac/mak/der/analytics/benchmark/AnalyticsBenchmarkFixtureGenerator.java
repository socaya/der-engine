package ug.ac.mak.der.analytics.benchmark;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Synthetic workload seeder for the Analytics benchmark harness
 * (spec §14.1 reference workload). All seeded rows carry a known
 * marker so {@link #cleanup} can remove them in one shot without
 * touching real capture data:
 *
 * <ul>
 *   <li>TEI UIDs are 11-char alphanumerics starting with
 *       {@code "BENC"} so the DHIS2 UID regex accepts them while
 *       operators can still spot benchmark rows at a glance.</li>
 *   <li>Enrollments and events carry the fixed program UID
 *       {@code "BENCHMARK01"} (reserved for this harness).</li>
 * </ul>
 *
 * <p>Cleanup is a cascade from the program UID, so repeated
 * seed → benchmark → cleanup cycles are safe. The generator is
 * intentionally deterministic given the same (seed, counts, OU)
 * tuple so runs are reproducible.</p>
 */
@Service
public class AnalyticsBenchmarkFixtureGenerator {

    /** Fixed marker program UID. Matches the DHIS2 UID regex
     *  {@code [A-Za-z][A-Za-z0-9]{10}}. */
    static final String BENCHMARK_PROGRAM_UID = "BENCHMARK01";
    static final String BENCHMARK_STAGE_UID = "BENCHMARKS1";
    static final String BENCHMARK_TET_UID = "BENCHMARKT1";

    /** Hard safety ceiling so a typo doesn't seed an eye-watering
     *  amount of data. Operators running the 1 M soak need to
     *  bump this intentionally. */
    private static final int MAX_EVENTS_PER_RUN = 100_000;

    private final JdbcTemplate jdbc;

    public AnalyticsBenchmarkFixtureGenerator(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public record SeedRequest(
            String orgUnitUid,
            int teiCount,
            int eventsPerTei,
            long seed) {
    }

    public record SeedResult(
            int teisCreated,
            int enrollmentsCreated,
            int eventsCreated,
            String programUid) {
    }

    public record CleanupResult(
            int eventsDeleted,
            int enrollmentsDeleted,
            int teisDeleted) {
    }

    /** Seed synthetic events for a benchmark run. Returns counts
     *  of rows actually inserted. */
    @Transactional
    public SeedResult seed(final SeedRequest req, final UUID createdBy) {
        Objects.requireNonNull(req, "request");
        if (req.orgUnitUid() == null || req.orgUnitUid().isBlank()) {
            throw new IllegalArgumentException("orgUnitUid required");
        }
        final int teiCount = Math.max(1, Math.min(10_000, req.teiCount()));
        final int perTei = Math.max(1, Math.min(1_000, req.eventsPerTei()));
        if ((long) teiCount * perTei > MAX_EVENTS_PER_RUN) {
            throw new IllegalArgumentException(
                    "ceiling " + MAX_EVENTS_PER_RUN
                  + " events per run exceeded");
        }
        final java.util.Random rng = new java.util.Random(req.seed());

        final List<String> teiUids = new ArrayList<>(teiCount);
        for (int i = 0; i < teiCount; i++) {
            teiUids.add(deterministicUid("BENC", i));
        }
        final List<Object[]> teiArgs = new ArrayList<>(teiCount);
        for (final String uid : teiUids) {
            teiArgs.add(new Object[] {
                uid, BENCHMARK_TET_UID, req.orgUnitUid(),
                "{}", createdBy,
            });
        }
        jdbc.batchUpdate(
                "INSERT INTO der.tracked_entity ("
              + "  tei_uid, tracked_entity_type, org_unit_uid, "
              + "  attributes, created_by) "
              + "VALUES (?, ?, ?, CAST(? AS JSONB), ?) "
              + "ON CONFLICT (tei_uid) DO NOTHING",
                teiArgs);

        final List<String> enrollmentUids = new ArrayList<>(teiCount);
        for (int i = 0; i < teiCount; i++) {
            enrollmentUids.add(deterministicUid("BENE", i));
        }
        final List<Object[]> enrollArgs = new ArrayList<>(teiCount);
        for (int i = 0; i < teiCount; i++) {
            enrollArgs.add(new Object[] {
                enrollmentUids.get(i), teiUids.get(i),
                BENCHMARK_PROGRAM_UID, req.orgUnitUid(),
                "ACTIVE",
                Date.valueOf(LocalDate.now().minusDays(rng.nextInt(90))),
                createdBy,
            });
        }
        jdbc.batchUpdate(
                "INSERT INTO der.edge_enrollment ("
              + "  enrollment_uid, tei_uid, program_uid, org_unit_uid, "
              + "  status, enrollment_date, created_by) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (enrollment_uid) DO NOTHING",
                enrollArgs);

        int eventCounter = 0;
        final List<Object[]> eventArgs = new ArrayList<>();
        for (int t = 0; t < teiCount; t++) {
            for (int e = 0; e < perTei; e++) {
                final String eventUid = deterministicUid("BENV",
                        eventCounter++);
                final LocalDate day = LocalDate.now()
                        .minusDays(rng.nextInt(180));
                eventArgs.add(new Object[] {
                    eventUid, enrollmentUids.get(t),
                    BENCHMARK_PROGRAM_UID, BENCHMARK_STAGE_UID,
                    req.orgUnitUid(), "COMPLETED",
                    Date.valueOf(day), "{}", createdBy,
                });
            }
        }
        jdbc.batchUpdate(
                "INSERT INTO der.edge_tracker_event ("
              + "  event_uid, enrollment_uid, program_uid, "
              + "  program_stage_uid, org_unit_uid, status, "
              + "  occurred_date, data_values, created_by) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?) "
              + "ON CONFLICT (event_uid) DO NOTHING",
                eventArgs);
        return new SeedResult(teiArgs.size(), enrollArgs.size(),
                eventArgs.size(), BENCHMARK_PROGRAM_UID);
    }

    /** Remove every row seeded by {@link #seed}. Safe to call
     *  when nothing has been seeded — returns zero counts. */
    @Transactional
    public CleanupResult cleanup() {
        final int events = jdbc.update(
                "DELETE FROM der.edge_tracker_event "
              + " WHERE program_uid = ?",
                BENCHMARK_PROGRAM_UID);
        final int enrollments = jdbc.update(
                "DELETE FROM der.edge_enrollment "
              + " WHERE program_uid = ?",
                BENCHMARK_PROGRAM_UID);
        // TEIs tagged by the benchmark TET UID. A real pilot never
        // uses this TET value so the match is unambiguous.
        final int teis = jdbc.update(
                "DELETE FROM der.tracked_entity "
              + " WHERE tracked_entity_type = ?",
                BENCHMARK_TET_UID);
        return new CleanupResult(events, enrollments, teis);
    }

    /** Build a DHIS2-shape 11-char UID from a prefix + counter.
     *  The DHIS2 regex demands an alpha first char then
     *  alphanumeric; we zero-pad the counter in base-36 so the
     *  character set stays legal. Deterministic for a given index. */
    static String deterministicUid(final String prefix, final int index) {
        final String tail = Integer.toString(Math.abs(index), 36);
        final String padded = ("00000000" + tail)
                .substring(Math.max(0, tail.length() + 8 - 7));
        return (prefix + padded).substring(0, 11);
    }
}
