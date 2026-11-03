package ug.ac.mak.der.observability;

import java.util.Objects;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * Phase 12.3 — DER-specific Prometheus counters.
 *
 * <p>Audit events (via {@link ug.ac.mak.der.security.SecurityAuditRepository})
 * capture every meaningful transition in the system, but they're a
 * compliance surface — not a dashboarding one. Operators running
 * a Grafana board over Prometheus want numeric counters they can
 * graph, rate(), and alert on without reading the audit DB.</p>
 *
 * <p>Each counter is lazily instantiated via the Micrometer builder;
 * tags are stable (small cardinality) so Prometheus storage stays
 * cheap. Downstream label additions should go through this class
 * so the metric name universe stays discoverable.</p>
 */
@Component
public class DerMetrics {

    private static final String METRIC_DRAIN_OUTCOME =
            "der_journal_drain_outcome_total";
    private static final String METRIC_INFLIGHT_REAPED =
            "der_journal_inflight_reaped_total";
    private static final String METRIC_PULL_OUTCOME =
            "der_data_pull_outcome_total";
    private static final String METRIC_REFERRAL_DELIVERED =
            "der_referral_delivered_total";
    private static final String METRIC_REFERRAL_ESCALATED =
            "der_referral_escalated_total";

    private final MeterRegistry registry;

    public DerMetrics(final MeterRegistry registry) {
        this.registry = Objects.requireNonNull(registry, "registry");
    }

    /** Counter per terminal state of a drain attempt. The sum across
     *  outcomes equals the total number of rows the drain worker
     *  processed. */
    public void drainOutcome(final String outcome) {
        Counter.builder(METRIC_DRAIN_OUTCOME)
                .tag("outcome", outcome.toLowerCase())
                .description("Journal drain outcomes (sum over outcome tag = rows processed)")
                .register(registry).increment();
    }

    /** Counter of IN_FLIGHT rows requeued by either the boot reaper
     *  or the runtime (continuous) reaper. */
    public void inflightReaped(final String origin, final int count) {
        if (count <= 0) {
            return;
        }
        Counter.builder(METRIC_INFLIGHT_REAPED)
                .tag("origin", origin.toLowerCase())
                .description("IN_FLIGHT journal rows requeued by Phase 11.1 (boot) + 12.1 (runtime) reapers")
                .register(registry).increment(count);
    }

    /** Counter per data-pull tick outcome, split by entity type and
     *  terminal result so operators can graph pull throughput + failure
     *  rates separately per family. */
    public void pullOutcome(final String entityType, final String outcome) {
        Counter.builder(METRIC_PULL_OUTCOME)
                .tag("entity_type", entityType.toLowerCase())
                .tag("outcome", outcome.toLowerCase())
                .description("Data-pull outcomes per entity type (aggregate/event/tracker)")
                .register(registry).increment();
    }

    /** Phase 10.3 referral ack endpoint received a fresh delivery
     *  (not a duplicate replay). */
    public void referralDelivered() {
        Counter.builder(METRIC_REFERRAL_DELIVERED)
                .description("Referrals that transitioned to DELIVERED via /referrals/ack")
                .register(registry).increment();
    }

    /** Phase 10.3.2 escalation service produced a REFERRAL_UNDELIVERED
     *  audit event (ack never arrived within threshold). */
    public void referralEscalated(final int count) {
        if (count <= 0) {
            return;
        }
        Counter.builder(METRIC_REFERRAL_ESCALATED)
                .description("Referrals escalated after threshold without ack")
                .register(registry).increment(count);
    }
}
