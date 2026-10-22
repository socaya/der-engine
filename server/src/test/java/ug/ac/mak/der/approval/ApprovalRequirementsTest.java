package ug.ac.mak.der.approval;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry.EntityType;

class ApprovalRequirementsTest {

    @Test
    void defaultsOff() {
        final ApprovalRequirements r = new ApprovalRequirements(false, false, false);
        for (final EntityType t : EntityType.values()) {
            assertThat(r.requiresApproval(t)).isFalse();
        }
        assertThat(r.requireAggregate()).isFalse();
        assertThat(r.requireEvent()).isFalse();
        assertThat(r.requireTracker()).isFalse();
    }

    @Test
    void aggregateEnabled() {
        final ApprovalRequirements r = new ApprovalRequirements(true, false, false);
        assertThat(r.requiresApproval(EntityType.AGGREGATE_DATA_VALUE)).isTrue();
        assertThat(r.requiresApproval(EntityType.EVENT)).isFalse();
    }

    @Test
    void eventCoversProgramStageEvents() {
        final ApprovalRequirements r = new ApprovalRequirements(false, true, false);
        assertThat(r.requiresApproval(EntityType.EVENT)).isTrue();
        assertThat(r.requiresApproval(EntityType.PROGRAM_STAGE_EVENT)).isTrue();
        assertThat(r.requiresApproval(EntityType.TRACKED_ENTITY)).isFalse();
    }

    @Test
    void trackerCoversEnrolment() {
        final ApprovalRequirements r = new ApprovalRequirements(false, false, true);
        assertThat(r.requiresApproval(EntityType.TRACKED_ENTITY)).isTrue();
        assertThat(r.requiresApproval(EntityType.ENROLLMENT)).isTrue();
        assertThat(r.requiresApproval(EntityType.EVENT)).isFalse();
    }
}
