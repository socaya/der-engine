package ug.ac.mak.der.workflows.referral;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Component;

/**
 * Default alpha.4 implementation — returns an empty candidate list.
 * The real HTTP-based client ships in alpha.5 and takes over by being
 * marked {@code @Primary}; this bean always registers so DI never
 * fails when the HTTP client is disabled.
 */
@Component
public class NoOpCentralReferralSearchClient implements CentralReferralSearchClient {

    @Override
    public List<Candidate> findReferrals(final String boundOrgUnitUid, final Instant since) {
        return List.of();
    }
}
