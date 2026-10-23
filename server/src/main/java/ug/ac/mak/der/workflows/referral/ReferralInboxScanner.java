package ug.ac.mak.der.workflows.referral;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;

/**
 * ADR-0027 alpha.4 scaffolding. Pulls referral candidates from central
 * via {@link CentralReferralSearchClient} and persists them in the
 * local inbox. Fail-open: lookup / HTTP failures log and return
 * {@link ScanResult#UNAVAILABLE}.
 */
@Service
@ConditionalOnBean(ReferralInboxRepository.class)
public class ReferralInboxScanner {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralInboxScanner.class);
    private static final Duration DEFAULT_LOOKBACK = Duration.ofHours(24);

    private final ReferralInboxRepository inbox;
    private final OrgUnitBindingService binding;
    private final CentralReferralSearchClient central;
    private final Clock clock;

    public ReferralInboxScanner(final ReferralInboxRepository inbox,
                                  final OrgUnitBindingService binding,
                                  final CentralReferralSearchClient central,
                                  final Clock clock) {
        this.inbox = Objects.requireNonNull(inbox, "inbox");
        this.binding = Objects.requireNonNull(binding, "binding");
        this.central = Objects.requireNonNull(central, "central");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public ScanResult scanOnce() {
        return scanOnce(DEFAULT_LOOKBACK);
    }

    public ScanResult scanOnce(final Duration lookback) {
        final EdgeOrgUnitBinding b = binding.current();
        if (!b.isBound()) {
            LOG.debug("referral scanner: edge not bound to an orgUnit; skipping");
            return ScanResult.NOT_BOUND;
        }
        final Instant now = Instant.now(clock);
        final Instant since = now.minus(lookback == null ? DEFAULT_LOOKBACK : lookback);
        final List<CentralReferralSearchClient.Candidate> candidates;
        try {
            candidates = central.findReferrals(b.orgUnitId(), since);
        } catch (RuntimeException ex) {
            LOG.warn("referral scanner: central lookup failed ({}); will retry next tick",
                    ex.getMessage());
            return ScanResult.UNAVAILABLE;
        }
        int inserted = 0;
        for (final CentralReferralSearchClient.Candidate c : candidates) {
            try {
                final int rows = inbox.insertIfAbsent(new ReferralInboxEntry(
                        UUID.randomUUID(), c.kind(), c.sourceRef(), b.orgUnitId(),
                        c.payloadJson(), now,
                        ReferralInboxEntry.Status.PENDING, null, null));
                inserted += rows;
            } catch (RuntimeException ex) {
                LOG.warn("referral scanner: insertIfAbsent failed for {}: {}",
                        c.sourceRef(), ex.getMessage());
            }
        }
        LOG.info("referral scanner: {} candidates returned by central, {} newly inserted",
                candidates.size(), inserted);
        return new ScanResult(ScanResult.Outcome.OK, candidates.size(), inserted);
    }

    public record ScanResult(Outcome outcome, int candidates, int inserted) {
        public static final ScanResult NOT_BOUND = new ScanResult(Outcome.NOT_BOUND, 0, 0);
        public static final ScanResult UNAVAILABLE = new ScanResult(Outcome.UNAVAILABLE, 0, 0);

        public enum Outcome { OK, NOT_BOUND, UNAVAILABLE }
    }
}
