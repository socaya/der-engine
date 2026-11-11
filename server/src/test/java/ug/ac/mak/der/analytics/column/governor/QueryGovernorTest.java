package ug.ac.mak.der.analytics.column.governor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class QueryGovernorTest {

    private QueryGovernor newGovernor(final int maxConcurrent,
                                         final long maxDurationMs,
                                         final long maxBytes) {
        return new QueryGovernor(new GovernorProperties(
                maxConcurrent, maxDurationMs, maxBytes));
    }

    @Test
    void beginIssuesTokenAndTracksInFlight() {
        final QueryGovernor g = newGovernor(4, 60_000L,
                256L * 1024 * 1024);

        final QueryToken t = g.begin("op");
        assertThat(t.principal()).isEqualTo("op");
        assertThat(t.state()).isEqualTo(QueryToken.State.RUNNING);
        assertThat(g.inFlightCount()).isEqualTo(1);
    }

    @Test
    void completeRemovesFromInFlight() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000_000L);

        final QueryToken t = g.begin("op");
        g.complete(t);
        assertThat(g.inFlightCount()).isZero();
        assertThat(t.state()).isEqualTo(QueryToken.State.COMPLETED);
    }

    @Test
    void cancelByIdFlipsState() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000_000L);

        final QueryToken t = g.begin("op");
        assertThat(g.cancel(t.queryId())).isTrue();
        // After cancel the token is still visible until the
        // executor finishes.
        assertThatThrownBy(t::throwIfAborted)
                .isInstanceOf(QueryAbortedException.class)
                .hasMessageContaining("cancelled");
    }

    @Test
    void cancelOnMissingQueryReturnsFalse() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000_000L);
        assertThat(g.cancel(java.util.UUID.randomUUID())).isFalse();
    }

    @Test
    void saturatedGovernorRejectsNewQuery() {
        final QueryGovernor g = newGovernor(2, 60_000L, 1_000_000L);
        g.begin("a");
        g.begin("b");
        assertThatThrownBy(() -> g.begin("c"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("saturated");
    }

    @Test
    void deadlineExceededAborts() throws InterruptedException {
        final QueryGovernor g = newGovernor(4, 10L, 1_000_000L);
        final QueryToken t = g.begin("op");
        Thread.sleep(20);
        assertThatThrownBy(t::throwIfAborted)
                .isInstanceOf(QueryAbortedException.class)
                .hasMessageContaining("deadline");
        assertThat(t.state())
                .isEqualTo(QueryToken.State.DEADLINE_EXCEEDED);
    }

    @Test
    void memoryBudgetAborts() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000L);
        final QueryToken t = g.begin("op");
        t.accountBytes(500);
        t.throwIfAborted(); // still under budget
        t.accountBytes(600);
        assertThatThrownBy(t::throwIfAborted)
                .isInstanceOf(QueryAbortedException.class)
                .hasMessageContaining("memory");
    }

    @Test
    void listReturnsEveryInFlightToken() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000_000L);
        g.begin("a");
        g.begin("b");
        assertThat(g.list()).hasSize(2);
    }

    @Test
    void findLocatesTokenById() {
        final QueryGovernor g = newGovernor(4, 60_000L, 1_000_000L);
        final QueryToken t = g.begin("op");
        assertThat(g.find(t.queryId())).isPresent();
        g.complete(t);
        assertThat(g.find(t.queryId())).isEmpty();
    }
}
