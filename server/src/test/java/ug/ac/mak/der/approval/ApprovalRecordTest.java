package ug.ac.mak.der.approval;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class ApprovalRecordTest {

    private ApprovalRecord with(final boolean requires, final Instant approvedAt,
                                  final Instant rejectedAt) {
        return new ApprovalRecord(UUID.randomUUID(), requires,
                approvedAt == null ? null : UUID.randomUUID(), approvedAt,
                rejectedAt == null ? null : UUID.randomUUID(), rejectedAt,
                rejectedAt == null ? null : "nope");
    }

    @Test
    void awaiting() {
        assertThat(with(true, null, null).isAwaiting()).isTrue();
    }

    @Test
    void approvedBranches() {
        final ApprovalRecord r = with(true, Instant.now(), null);
        assertThat(r.isApproved()).isTrue();
        assertThat(r.isRejected()).isFalse();
        assertThat(r.isAwaiting()).isFalse();
    }

    @Test
    void rejectedBranches() {
        final ApprovalRecord r = with(true, null, Instant.now());
        assertThat(r.isApproved()).isFalse();
        assertThat(r.isRejected()).isTrue();
        assertThat(r.isAwaiting()).isFalse();
    }

    @Test
    void requiresFalseIsNeverAwaiting() {
        assertThat(with(false, null, null).isAwaiting()).isFalse();
    }

    @Test
    void decisionEnumExposesExpectedValues() {
        assertThat(ApprovalRecord.Decision.values())
                .containsExactly(ApprovalRecord.Decision.APPROVE,
                                 ApprovalRecord.Decision.REJECT);
    }
}
