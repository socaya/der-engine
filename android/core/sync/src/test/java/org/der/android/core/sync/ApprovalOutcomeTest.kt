package org.der.android.core.sync

import org.der.android.core.domain.ApprovalOutcome
import org.der.android.core.domain.ReferralOutcome
import org.junit.Assert.assertEquals
import org.junit.Test

class ApprovalOutcomeTest {
    @Test fun approved() = assertEquals(ApprovalOutcome.APPROVED, ApprovalOutcome.parse("APPROVED"))
    @Test fun rejected() = assertEquals(ApprovalOutcome.REJECTED, ApprovalOutcome.parse("REJECTED"))
    @Test fun alreadyDecided() = assertEquals(
        ApprovalOutcome.ALREADY_DECIDED,
        ApprovalOutcome.parse("APPROVAL_ALREADY_DECIDED"),
    )
    @Test fun notRequired() = assertEquals(
        ApprovalOutcome.NOT_REQUIRED,
        ApprovalOutcome.parse("APPROVAL_NOT_REQUIRED"),
    )
    @Test fun unknownFalls() = assertEquals(
        ApprovalOutcome.UNKNOWN,
        ApprovalOutcome.parse("SOMETHING_ELSE"),
    )
}

class ReferralOutcomeTest {
    @Test fun accepted() = assertEquals(
        ReferralOutcome.ACCEPTED,
        ReferralOutcome.parse(status = "ACCEPTED", code = null),
    )
    @Test fun dismissed() = assertEquals(
        ReferralOutcome.DISMISSED,
        ReferralOutcome.parse(status = "DISMISSED", code = null),
    )
    @Test fun ingestUnavailable() = assertEquals(
        ReferralOutcome.INGEST_UNAVAILABLE,
        ReferralOutcome.parse(status = null, code = "INGEST_UNAVAILABLE"),
    )
    @Test fun ingestFailed() = assertEquals(
        ReferralOutcome.INGEST_FAILED,
        ReferralOutcome.parse(status = null, code = "INGEST_FAILED"),
    )
    @Test fun ingestRejected() = assertEquals(
        ReferralOutcome.INGEST_REJECTED,
        ReferralOutcome.parse(status = null, code = "INGEST_REJECTED"),
    )
}
