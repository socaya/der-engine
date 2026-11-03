package ug.ac.mak.der.workflows.pull;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

/**
 * Phase 13.3 — cross-entity topological pull order tripwire.
 *
 * <p>{@link TrackerPuller#pull} processes the central's response
 * in dependency order: TEI first (parent to enrolment), then
 * enrolment (parent to event), then stage event. If a future
 * refactor swaps the order (e.g. events merged before their parent
 * enrolment lands in the mirror), the three-way merge decision
 * misfires and operators see a wave of transient orphans the
 * reconciler then has to auto-heal.</p>
 *
 * <p>This test parses the puller source so the invariant is
 * enforced without a live Postgres container — same pattern as
 * the SelectCoverage and ApprovalFilter tripwires that already
 * guard the journal path.</p>
 */
class TrackerPullOrderTest {

    private static final Path PULLER_SRC = Path.of(
            "src/main/java/ug/ac/mak/der/workflows/pull/TrackerPuller.java");

    @Test
    void pullProcessesTeiThenEnrolmentThenEventInTopologicalOrder() throws Exception {
        final String src = Files.readString(PULLER_SRC);
        final int pullStart = src.indexOf("public DataPullService.PullerResult pull(");
        assertThat(pullStart)
                .as("TrackerPuller.pull entry point must exist")
                .isPositive();
        // Scan the pull body only (bail at the next top-level `}` line).
        final int bodyEnd = src.indexOf("\n    }\n", pullStart);
        final String body = src.substring(pullStart,
                bodyEnd > 0 ? bodyEnd : src.length());

        final int teiIdx = body.indexOf("safeArray(response, \"trackedEntities\")");
        final int enrolIdx = body.indexOf("safeArray(response, \"enrollments\")");
        final int evtIdx = body.indexOf("safeArray(response, \"events\")");

        assertThat(teiIdx)
                .as("TEI loop must be present")
                .isPositive();
        assertThat(enrolIdx)
                .as("enrolment loop must be present")
                .isPositive();
        assertThat(evtIdx)
                .as("event loop must be present")
                .isPositive();
        assertThat(teiIdx)
                .as("TEI loop MUST appear before enrolment loop — a refactor that "
                        + "swapped them re-opens the orphan-wave regression")
                .isLessThan(enrolIdx);
        assertThat(enrolIdx)
                .as("enrolment loop MUST appear before event loop — events need "
                        + "their parent enrolment resolved first")
                .isLessThan(evtIdx);
    }
}
