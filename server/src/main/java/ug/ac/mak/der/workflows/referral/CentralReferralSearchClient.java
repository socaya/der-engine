package ug.ac.mak.der.workflows.referral;

import java.time.Instant;
import java.util.List;

/**
 * ADR-0027 alpha.4 scaffolding. The scanner delegates the actual
 * central query to this interface so alpha.5 can wire a real HTTP
 * client without touching the scanner's logic. Alpha.4 ships a
 * {@code NoOpCentralReferralSearchClient} that returns an empty list
 * — the poll job runs but discovers nothing.
 */
public interface CentralReferralSearchClient {

    /**
     * @param boundOrgUnitUid the OU this edge is bound to; central must
     *     return records whose referral marker encodes this UID.
     * @param since do not look back further than this instant.
     * @return candidate hits (one per matching DHIS2 entity).
     */
    List<Candidate> findReferrals(String boundOrgUnitUid, Instant since);

    record Candidate(ReferralInboxEntry.Kind kind, String sourceRef,
                       String payloadJson) { }
}
