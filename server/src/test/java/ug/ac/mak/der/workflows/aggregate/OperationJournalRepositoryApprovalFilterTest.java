package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

/**
 * Phase 07.2 — approval-merge enforcement tripwire.
 *
 * <p>The journal drain SQL in {@link
 * OperationJournalRepository#findPendingReadyToDrain(int)} MUST
 * exclude rows that still require approval. Both conditions must
 * hold for a row to drain:</p>
 * <ul>
 *   <li>{@code requires_approval = FALSE} — row was never gated on
 *     approval; OR</li>
 *   <li>{@code approved_at IS NOT NULL} — row was gated AND an
 *     approver flipped the approved timestamp via
 *     {@code ApprovalController.POST /{opId}/approve}.</li>
 * </ul>
 *
 * <p>A regression that silently drops this filter would let
 * pending-approval rows push to central before an APPROVER has
 * reviewed them — the exact ADR-0016 scenario we're guarding
 * against. This test parses the repository source so it runs
 * without Testcontainers (matching the SelectCoverage tripwire
 * pattern).</p>
 */
class OperationJournalRepositoryApprovalFilterTest {

    private static final Path REPO_SRC = Path.of(
            "src/main/java/ug/ac/mak/der/workflows/aggregate/"
            + "OperationJournalRepository.java");

    @Test
    void findPendingReadyToDrainSqlEnforcesApprovalGate() throws Exception {
        final String src = Files.readString(REPO_SRC);
        final int methodStart = src.indexOf("findPendingReadyToDrain");
        assertThat(methodStart)
                .as("findPendingReadyToDrain must exist in the repository")
                .isPositive();
        // Grab the next `jdbc.query(` after the method header — that
        // is the SELECT we need to guard. Normalise whitespace so
        // concatenated string literals read as a single line.
        final int queryStart = src.indexOf("jdbc.query(", methodStart);
        assertThat(queryStart).isPositive();
        final int queryEnd = src.indexOf(");", queryStart);
        final String sqlBody = src.substring(queryStart, queryEnd)
                .replaceAll("\\s+", " ");
        assertThat(sqlBody)
                .as("drain SQL must gate on approval before draining — "
                        + "a missing filter re-opens the ADR-0016 regression "
                        + "where pending-approval rows push to central")
                .contains("requires_approval = FALSE")
                .contains("approved_at IS NOT NULL");
    }
}
