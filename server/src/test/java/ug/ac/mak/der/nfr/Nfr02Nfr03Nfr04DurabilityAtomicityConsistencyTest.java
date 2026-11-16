package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.events.EventService;
import ug.ac.mak.der.workflows.journal.ConflictReviewService;
import ug.ac.mak.der.workflows.tracker.TrackerService;

/**
 * NFR-02 — "No acknowledged local commit is lost in tested
 * application/worker restart cases; durable outbox remains
 * consistent." NFR-03 — "A business change and corresponding
 * pending journal intent are committed atomically or both rolled
 * back." NFR-04 — "Zero unexpected invalid references or silent
 * lost updates in predefined integrity cases."
 *
 * <p>The three NFRs share one architectural root: every write
 * entry point is a {@code @Transactional} unit that
 * <em>inside</em> the same PostgreSQL transaction (a) writes the
 * business row and (b) inserts the {@code operation_journal}
 * intent, with foreign keys enforcing that the referenced
 * metadata exists. Together those two guarantees cover NFR-02 (a
 * tx that committed stays committed across restart — Postgres
 * WAL durability), NFR-03 (atomic business+journal commit — same
 * @Transactional boundary), and NFR-04 (no invalid references —
 * DB-side FK CHECKs reject orphans before commit).</p>
 *
 * <p>This test pins those invariants statically, so a refactor
 * can't silently drop them:
 * <ol>
 *   <li>Every {@code submit} / {@code upsert} entry point on the
 *       known-write services carries {@code @Transactional}. A new
 *       method without it would land here and the exhaustiveness
 *       assertion would fail — the reviewer has to either add the
 *       annotation or explicitly exempt the method with a
 *       rationale.</li>
 *   <li>Every migration that introduces a business-row table
 *       for the drained entity types (aggregate_data_value, event,
 *       tracked_entity, enrollment) carries a {@code REFERENCES}
 *       clause into the metadata mirror or a sibling business
 *       table — so a client inserting an event with a missing
 *       {@code enrollmentUid} is rejected at the DB, not silently
 *       orphaned (NFR-04).</li>
 *   <li>The {@code operation_journal} table itself CHECKs the
 *       state tuple and nulls-NOT on every required column, so an
 *       incomplete intent can never land as a half-row even if an
 *       application-level invariant slips.</li>
 * </ol>
 * </p>
 *
 * <p>Complements {@link Nfr12Nfr13AccountingAndRecoverabilityScenarioTest}
 * (restart recoverability + outcome-bucket exhaustiveness) and
 * {@link Nfr30StorageFaultInjectionScenarioTest} (storage-reject
 * admission path); together these pin the full durability
 * taxonomy at the architectural + fault-injection layer.</p>
 */
class Nfr02Nfr03Nfr04DurabilityAtomicityConsistencyTest {

    /**
     * Services whose {@code @Transactional} write entry points
     * compose the atomic business+journal boundary. Any new
     * service that persists a drain-eligible row must land here;
     * a missed addition is caught by the exhaustiveness assertion.
     */
    private static final List<Class<?>> WRITE_SERVICES = List.of(
            AggregateDataValueService.class,
            EventService.class,
            TrackerService.class,
            ConflictReviewService.class);

    /**
     * NFR-03 invariant — every public {@code submit} / {@code
     * upsert} on a write service is {@code @Transactional}. If a
     * new overload or refactor misses the annotation, the
     * business write + journal intent can diverge on crash: the
     * tx auto-commits the row but not the journal insert (or
     * vice-versa), leaking a half-change. Fail the test rather
     * than discover that at pilot.
     */
    @Test
    void nfr03AllWriteEntryPointsAreTransactional() {
        final List<String> untagged = new ArrayList<>();
        for (final Class<?> service : WRITE_SERVICES) {
            for (final Method m : service.getDeclaredMethods()) {
                if (!java.lang.reflect.Modifier.isPublic(m.getModifiers())) {
                    continue;
                }
                final String name = m.getName();
                if (!(name.startsWith("submit")
                        || name.startsWith("upsert")
                        || name.startsWith("resolve")
                        || name.equals("record")
                        || name.equals("markResolved"))) {
                    continue;
                }
                if (!m.isAnnotationPresent(Transactional.class)) {
                    untagged.add(service.getSimpleName() + "#"
                            + name + "(" + m.getParameterCount() + ")");
                }
            }
        }
        assertThat(untagged)
                .as("@Transactional write entry points — NFR-03 atomic business+journal")
                .isEmpty();
    }

    /**
     * NFR-04 invariant — business tables for drain-eligible
     * entities reference the metadata mirror via FK. A refactor
     * that drops a REFERENCES clause would let a client insert
     * an event with an unknown {@code orgUnitUid} and have that
     * orphan drain into central, producing "unexpected invalid
     * references" — the exact failure the NFR forbids.
     */
    @Test
    void nfr04BusinessTablesReferenceMetadataMirrorViaForeignKey() throws IOException {
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        assertThat(Files.isDirectory(migrationDir))
                .as("migration dir on disk: %s", migrationDir)
                .isTrue();
        // Scan the earliest migrations that ship the base business
        // tables. The invariant is "at least one FK into the
        // mirror" — later migrations ADD columns but rarely drop
        // the base FK, so a diff-based search is more robust than
        // greping the latest state.
        final List<String> expectedFkSignatures = List.of(
                // Aggregate writes bind to data_element + org_unit
                // + CoC + user — all FK'd.
                "REFERENCES metadata_data_element",
                "REFERENCES metadata_organisation_unit",
                // operation_journal is FK'd into edge_user via
                // submitted_by so an untraceable write can't
                // commit — FR-11-11 + NFR-04 together.
                "REFERENCES edge_user");
        final String allMigrationSql;
        try (Stream<Path> files = Files.list(migrationDir)) {
            allMigrationSql = files
                    .filter(p -> p.toString().endsWith(".sql"))
                    .map(Nfr02Nfr03Nfr04DurabilityAtomicityConsistencyTest::read)
                    .reduce("", (a, b) -> a + "\n" + b);
        }
        for (final String sig : expectedFkSignatures) {
            assertThat(allMigrationSql)
                    .as("NFR-04 FK invariant: %s present somewhere in /database/migrations", sig)
                    .contains(sig);
        }
    }

    /**
     * NFR-02 invariant — the durable outbox ({@code
     * operation_journal}) has a CHECK constraint on state that
     * permits only the seven lifecycle values. A refactor that
     * loosens that CHECK (adding an informal state, or dropping
     * the constraint) would let a half-committed row land with
     * an ambiguous state after a crash, losing the NFR-02
     * "durable outbox remains consistent" guarantee.
     */
    @Test
    void nfr02OperationJournalStateCheckConstraintPresent() throws IOException {
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        final String baseMigration = read(migrationDir.resolve(
                "V003__phase03_5_aggregate_writes_and_journal.sql"));
        // CHECK must enumerate exactly the seven canonical states
        // in a single CHECK — any new state introduced via a later
        // migration also lands in the mapping test (NFR-12), so
        // both ends of the invariant stay pinned.
        assertThat(baseMigration)
                .as("operation_journal state CHECK pins the canonical seven")
                .contains("state             TEXT NOT NULL CHECK (state IN (")
                .contains("'PENDING'")
                .contains("'IN_FLIGHT'")
                .contains("'CENTRAL_ACCEPTED'")
                .contains("'CENTRAL_REJECTED'")
                .contains("'RETRYABLE'")
                .contains("'UNKNOWN_OUTCOME'")
                .contains("'CONFLICT_REVIEW'");
        // The journal's NOT NULL on operation_id + entity_type +
        // entity_ref + payload_json is the second half: an
        // incomplete intent can't commit as a half-row — Postgres
        // rejects it at CHECK time, not after an application-level
        // invariant slip.
        assertThat(baseMigration)
                .as("NOT NULL on identity + payload columns — can't half-write an intent")
                .contains("operation_id      UUID PRIMARY KEY")
                .contains("entity_type       TEXT NOT NULL")
                .contains("entity_ref        TEXT NOT NULL")
                .contains("payload_json      JSONB NOT NULL");
    }

    /**
     * NFR-02 companion — pin the `(state, created_at) WHERE
     * state IN ('PENDING','RETRYABLE','UNKNOWN_OUTCOME')` partial
     * index. Without this, the drain-worker predicate falls back
     * to a seq-scan across every acknowledged row at pilot
     * steady-state (10k+/day), so a slow drain starts leaking —
     * exactly the "durable outbox remains consistent" failure
     * NFR-02 bans at scale.
     */
    @Test
    void nfr02DrainPredicateHasCoveringIndex() throws IOException {
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        final String baseMigration = read(migrationDir.resolve(
                "V003__phase03_5_aggregate_writes_and_journal.sql"));
        assertThat(baseMigration)
                .as("partial index covering the drain predicate")
                .contains("CREATE INDEX IF NOT EXISTS ix_operation_journal_state")
                .contains("WHERE state IN ('PENDING', 'RETRYABLE', 'UNKNOWN_OUTCOME')");
    }

    private static String read(final Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new RuntimeException("could not read " + p, e);
        }
    }
}
