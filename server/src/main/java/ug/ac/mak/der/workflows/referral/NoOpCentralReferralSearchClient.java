package ug.ac.mak.der.workflows.referral;

import java.time.Instant;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default alpha.4 implementation — returns an empty candidate list.
 * The real HTTP-based client ships in alpha.5 and will be registered
 * as a primary bean, taking over via Spring's bean replacement.
 */
@Component
@ConditionalOnMissingBean(CentralReferralSearchClient.class)
public class NoOpCentralReferralSearchClient implements CentralReferralSearchClient {

    @Override
    public List<Candidate> findReferrals(final String boundOrgUnitUid, final Instant since) {
        return List.of();
    }
}
