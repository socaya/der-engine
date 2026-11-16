package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredTrackedEntityAttribute;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventDivergenceClass;
import ug.ac.mak.der.workflows.events.EventDivergenceClassifier;
import ug.ac.mak.der.workflows.tracker.TeiUniquenessChecker;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;

/**
 * FR-10-10 — "Report true-positive / false-positive / false-negative
 * cases in experiments." NFR-10 — "100% of integrity-critical known
 * conflicts detected in seeded tests; report precision and recall."
 * NFR-11 — "Zero unintended duplicate business objects in the
 * defined repeat/lost-acknowledgement tests."
 *
 * <p>Seeded-corpus scenario that exercises the two surfaces whose
 * classification outputs feed the pilot's conflict-metrics evidence:
 * <ol>
 *   <li>{@link EventDivergenceClassifier} — pure (local, central)
 *       diff function; the journal's publisher + sweeper route its
 *       {@link EventDivergenceClass} output into
 *       {@code EVENT_DIVERGENCE_*} audits.</li>
 *   <li>{@link TeiUniquenessChecker} — pre-upsert local-collision
 *       guard; the only surface that can discover a
 *       {@code UNIQUE_ATTRIBUTE_COLLISION} class <em>before</em> it
 *       reaches central (post-drain central-side collisions are
 *       classified by {@code ResponseClassifier} downstream — not
 *       in scope here).</li>
 * </ol>
 * </p>
 *
 * <p>The corpus is deterministic: a single {@code Random(42)} drives
 * every (local, central) pair across all four classes, so a byte-
 * identical run on any host produces the same TP / FP / FN counts.
 * This is the harness side of NFR-31 — the generator contract is
 * seed+count→same corpus; here we add seed+count→same classifications.</p>
 *
 * <p>Acceptance thresholds pinned below (the FR / NFR text sets the
 * target; the test rejects any run that falls short):
 * <ul>
 *   <li><b>Recall ≥ 100 %</b> on integrity-critical classes —
 *       CENTRAL_DIVERGED, CENTRAL_DELETED, DUPLICATE_LOCAL, and
 *       UNIQUE_ATTRIBUTE_COLLISION. These are the four classes NFR-10
 *       calls "integrity-critical"; missing one means a real conflict
 *       slipped past.</li>
 *   <li><b>Precision ≥ 100 %</b> on the same classes under this
 *       controlled corpus. (Recall / precision degrade on a noisy
 *       pilot corpus; this test is the bound at the pure-function
 *       layer.)</li>
 *   <li><b>Zero duplicate landings</b> for NFR-11 — a seeded set of
 *       N identical-value writes against the same unique attribute
 *       yields exactly one accept + (N-1) collision rejections at the
 *       pre-upsert guard.</li>
 * </ul>
 * </p>
 */
class Fr1010Nfr10Nfr11ConflictPrecisionScenarioTest {

    private static final int PER_CLASS_COUNT = 50;
    private static final long CORPUS_SEED = 42L;
    /** Program / stage / OU constants kept stable so a byte-diff of
     *  the corpus across runs is driven only by the index + seed. */
    private static final String PROGRAM = "ur1Edk5Oe2n";
    private static final String STAGE = "EPEcjy3FWmI";
    private static final String OU = "DiszpKrYNg8";
    private static final UUID BOT = new UUID(0L, 0L);

    @Test
    void eventClassifierRecallAndPrecisionAreOneHundredPercent() {
        final Random rng = new Random(CORPUS_SEED);
        final List<LabeledPair> corpus = buildEventCorpus(rng);
        final Metrics agg = new Metrics();
        for (final LabeledPair pair : corpus) {
            final EventDivergenceClass got = EventDivergenceClassifier
                    .classify(pair.local, pair.central).klass();
            agg.record(pair.groundTruth, got);
        }
        // Precision = TP / (TP + FP). Recall = TP / (TP + FN). F1 =
        // 2·P·R / (P + R). All computed per class across the pinned
        // classification matrix.
        final Map<EventDivergenceClass, Metrics.PerClass> report =
                agg.perClass();
        // Pin each integrity-critical class to 100% recall + precision
        // against this seeded corpus. The tolerance is zero because
        // the classifier is a pure function + the corpus is seeded:
        // non-deterministic failure here means the classifier
        // regressed, not pilot-run noise.
        for (final EventDivergenceClass klass : List.of(
                EventDivergenceClass.CENTRAL_DIVERGED,
                EventDivergenceClass.CENTRAL_DELETED,
                EventDivergenceClass.IN_SYNC)) {
            final Metrics.PerClass p = report.getOrDefault(klass,
                    Metrics.PerClass.empty());
            assertThat(p.recall()).as("recall of %s", klass).isEqualTo(1.0);
            assertThat(p.precision()).as("precision of %s", klass).isEqualTo(1.0);
        }
        // DUPLICATE_LOCAL rides the dedicated classifyDuplicate entry;
        // the next test covers it.
    }

    @Test
    void duplicateLocalClassifierCatchesEverySeedCollision() {
        final Random rng = new Random(CORPUS_SEED);
        int tp = 0;
        for (int i = 0; i < PER_CLASS_COUNT; i++) {
            // Two local rows share the same event uid: historical
            // migration leak that the sweeper is supposed to catch.
            final UUID sharedId = new UUID(0xD00DL, rng.nextLong());
            final Event a = baseEvent(sharedId, i, rng, Event.Status.ACTIVE);
            final Event b = baseEvent(sharedId, i + 1000, rng, Event.Status.COMPLETED);
            final EventDivergenceClass got = EventDivergenceClassifier
                    .classifyDuplicate(a, b).klass();
            if (got == EventDivergenceClass.DUPLICATE_LOCAL) {
                tp += 1;
            }
        }
        final double recall = (double) tp / PER_CLASS_COUNT;
        assertThat(recall).as("DUPLICATE_LOCAL recall").isEqualTo(1.0);
    }

    @Test
    void uniqueAttributeCollisionGuardLandsExactlyOneOfNDuplicates() {
        // NFR-11: N repeat writes against a unique-attribute key
        // land exactly once. Simulates a retry storm (lost ack,
        // operator double-click, background re-sync) against the
        // pre-upsert collision guard.
        final int n = 100;
        final String uniqueAttrUid = "NIC_ATTR";
        final String nic = "CRVS-2026-0000001";

        final TrackedEntityRepository teis = mock(TrackedEntityRepository.class);
        // Track accepted writes so the mock behaves like a real
        // repo: the first write succeeds, subsequent writes see the
        // first one in the search result.
        final List<TrackedEntityRepository.TrackedEntity> accepted = new ArrayList<>();
        when(teis.search(any(), any(), any(), anyInt()))
                .thenAnswer(inv -> List.copyOf(accepted));

        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findAllTrackedEntityAttributes()).thenReturn(List.of(
                new MirroredTrackedEntityAttribute(uniqueAttrUid, "NIC",
                        "TEXT", true,
                        com.fasterxml.jackson.databind.node.JsonNodeFactory
                                .instance.objectNode())));

        @SuppressWarnings("unchecked")
        final ObjectProvider<ExtendedMirrorRepository> provider =
                mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mirror);

        final TeiUniquenessChecker checker = new TeiUniquenessChecker(teis, provider);

        int accepts = 0;
        int rejects = 0;
        for (int i = 0; i < n; i++) {
            // Each candidate has its own uid so none is the
            // self-update path. If the guard works, only the first
            // lands (nothing in `accepted` yet) and the rest collide
            // against the first-accepted row.
            final String candidateUid = String.format("TEI%08d", i);
            final TeiUniquenessChecker.Result r = checker.check(candidateUid,
                    Map.of(uniqueAttrUid, nic));
            if (r.passed()) {
                accepts += 1;
                accepted.add(new TrackedEntityRepository.TrackedEntity(
                        candidateUid, "nEenWmSyUEp", OU,
                        Map.of(uniqueAttrUid, nic),
                        UUID.randomUUID(),
                        Instant.now(), Instant.now(), 1, null));
            } else {
                rejects += 1;
                // Collision carries the existing-TEI uid per
                // FR-08-08. Pin that the diagnostic actually
                // surfaces who it collided with.
                assertThat(r.collisions()).hasSize(1);
                assertThat(r.collisions().get(0).attributeUid())
                        .isEqualTo(uniqueAttrUid);
                assertThat(r.collisions().get(0).existingTeiUid())
                        .isEqualTo(accepted.get(0).teiUid());
            }
        }
        // NFR-11 invariant — exactly one landed, all others rejected.
        assertThat(accepts).as("accepted writes").isEqualTo(1);
        assertThat(rejects).as("rejected duplicate writes").isEqualTo(n - 1);
    }

    @Test
    void metricsBreakdownEmitsEvidenceShape() {
        // FR-10-10 — the "report TP/FP/FN" obligation. Run the same
        // classifier, serialise per-class counters + aggregate
        // precision / recall into a Map, and pin that every expected
        // key is present. Future evidence-export scripts can lift
        // this Map shape without re-deriving it.
        final Random rng = new Random(CORPUS_SEED);
        final List<LabeledPair> corpus = buildEventCorpus(rng);
        final Metrics agg = new Metrics();
        for (final LabeledPair pair : corpus) {
            agg.record(pair.groundTruth,
                    EventDivergenceClassifier.classify(pair.local, pair.central).klass());
        }
        final Map<String, Object> evidence = agg.toEvidence();
        assertThat(evidence).containsKeys("perClass", "totals");
        @SuppressWarnings("unchecked")
        final Map<String, Object> totals = (Map<String, Object>) evidence.get("totals");
        assertThat(totals).containsKeys("corpusSize", "truePositives",
                "falsePositives", "falseNegatives",
                "aggregatePrecision", "aggregateRecall");
        assertThat(((Number) totals.get("corpusSize")).intValue())
                .isEqualTo(corpus.size());
        // Pin seeded totals so a drift in the generator or classifier
        // doesn't silently change the evidence shape under the same
        // seed. 50 rows × 3 classes = 150; classifier is exact so
        // TP = 150, FP = 0, FN = 0.
        assertThat(((Number) totals.get("truePositives")).intValue())
                .isEqualTo(corpus.size());
        assertThat(((Number) totals.get("falsePositives")).intValue()).isZero();
        assertThat(((Number) totals.get("falseNegatives")).intValue()).isZero();
    }

    // ---- corpus + metrics helpers ----

    /**
     * Seeded (local, central) pair corpus — PER_CLASS_COUNT rows per
     * non-DUPLICATE class, ground-truth label baked in so we can
     * confirm each classification against intent.
     */
    private static List<LabeledPair> buildEventCorpus(final Random rng) {
        final List<LabeledPair> rows = new ArrayList<>();
        for (int i = 0; i < PER_CLASS_COUNT; i++) {
            final UUID id = new UUID(0xA55EL, rng.nextLong());
            final Event local = baseEvent(id, i, rng, Event.Status.ACTIVE);
            // CENTRAL_DIVERGED — same uid, differing status + a
            // changed dataValue. Mirrors the field-level diff the
            // classifier emits.
            rows.add(new LabeledPair(
                    EventDivergenceClass.CENTRAL_DIVERGED,
                    local,
                    mutateForDiverge(local, rng)));
        }
        for (int i = 0; i < PER_CLASS_COUNT; i++) {
            final UUID id = new UUID(0xDEADL, rng.nextLong());
            final Event local = baseEvent(id, i, rng, Event.Status.COMPLETED);
            // CENTRAL_DELETED — central-side absent: null
            rows.add(new LabeledPair(
                    EventDivergenceClass.CENTRAL_DELETED,
                    local,
                    null));
        }
        for (int i = 0; i < PER_CLASS_COUNT; i++) {
            final UUID id = new UUID(0xBEEFL, rng.nextLong());
            final Event local = baseEvent(id, i, rng, Event.Status.ACTIVE);
            // IN_SYNC — local === central, byte-identical.
            rows.add(new LabeledPair(
                    EventDivergenceClass.IN_SYNC,
                    local,
                    local));
        }
        return rows;
    }

    private static Event mutateForDiverge(final Event local, final Random rng) {
        final Map<String, String> dv = new LinkedHashMap<>(local.dataValues());
        // Edit one data-value; swap status so the field-diff emits
        // both a top-level `status` and a `dataValues` row.
        final String firstKey = dv.keySet().iterator().next();
        dv.put(firstKey, dv.get(firstKey) + "-central");
        return new Event(local.eventId(), local.enrollmentId(),
                local.programUid(), local.programStageUid(), local.orgUnitUid(),
                local.occurredAt().plusSeconds(3600L * (rng.nextInt(24) + 1)),
                local.status() == Event.Status.ACTIVE
                        ? Event.Status.COMPLETED : Event.Status.ACTIVE,
                local.attributeOptionComboUid(),
                local.createdBy(), local.eventVersion(), dv,
                local.workflowRunId());
    }

    private static Event baseEvent(final UUID eventId, final int idx,
                                        final Random rng,
                                        final Event.Status status) {
        final Map<String, String> dv = new LinkedHashMap<>();
        dv.put("DE_PULSE", String.valueOf(60 + rng.nextInt(40)));
        dv.put("DE_SBP", String.valueOf(90 + rng.nextInt(60)));
        return new Event(eventId, new UUID(0xCAFEL, idx),
                PROGRAM, STAGE, OU,
                Instant.parse("2026-11-16T00:00:00Z")
                        .plusSeconds(idx * 3600L),
                status, "HllvX50cXC0", BOT, 1, dv, null);
    }

    private record LabeledPair(EventDivergenceClass groundTruth,
                                  Event local, Event central) { }

    /** TP / FP / FN counter aggregated per class. */
    private static final class Metrics {
        private final Map<EventDivergenceClass, int[]> counters =
                new LinkedHashMap<>();

        void record(final EventDivergenceClass truth,
                      final EventDivergenceClass predicted) {
            if (truth == predicted) {
                counters.computeIfAbsent(truth, k -> new int[3])[0] += 1; // TP
            } else {
                // FP on predicted, FN on truth.
                counters.computeIfAbsent(predicted, k -> new int[3])[1] += 1;
                counters.computeIfAbsent(truth, k -> new int[3])[2] += 1;
            }
        }

        Map<EventDivergenceClass, PerClass> perClass() {
            final Map<EventDivergenceClass, PerClass> out = new LinkedHashMap<>();
            for (final var e : counters.entrySet()) {
                final int tp = e.getValue()[0];
                final int fp = e.getValue()[1];
                final int fn = e.getValue()[2];
                out.put(e.getKey(), new PerClass(tp, fp, fn));
            }
            return out;
        }

        Map<String, Object> toEvidence() {
            final Map<String, Object> out = new LinkedHashMap<>();
            final Map<String, Object> perClass = new LinkedHashMap<>();
            int tp = 0;
            int fp = 0;
            int fn = 0;
            for (final var e : perClass().entrySet()) {
                tp += e.getValue().tp();
                fp += e.getValue().fp();
                fn += e.getValue().fn();
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put("truePositives", e.getValue().tp());
                row.put("falsePositives", e.getValue().fp());
                row.put("falseNegatives", e.getValue().fn());
                row.put("precision", e.getValue().precision());
                row.put("recall", e.getValue().recall());
                row.put("f1", e.getValue().f1());
                perClass.put(e.getKey().name(), row);
            }
            final Map<String, Object> totals = new LinkedHashMap<>();
            totals.put("corpusSize", tp + fn); // FP is a mislabel of
            // someone else's FN, so corpus = TP + FN.
            totals.put("truePositives", tp);
            totals.put("falsePositives", fp);
            totals.put("falseNegatives", fn);
            totals.put("aggregatePrecision",
                    tp + fp == 0 ? 1.0 : (double) tp / (tp + fp));
            totals.put("aggregateRecall",
                    tp + fn == 0 ? 1.0 : (double) tp / (tp + fn));
            out.put("perClass", perClass);
            out.put("totals", totals);
            return out;
        }

        record PerClass(int tp, int fp, int fn) {
            double precision() {
                return tp + fp == 0 ? 1.0 : (double) tp / (tp + fp);
            }

            double recall() {
                return tp + fn == 0 ? 1.0 : (double) tp / (tp + fn);
            }

            double f1() {
                final double p = precision();
                final double r = recall();
                return p + r == 0 ? 0.0 : 2 * p * r / (p + r);
            }

            static PerClass empty() {
                return new PerClass(0, 0, 0);
            }
        }
    }
}
