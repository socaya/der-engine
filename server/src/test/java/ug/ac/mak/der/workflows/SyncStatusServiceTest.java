package ug.ac.mak.der.workflows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SyncStatusServiceTest {

    private final SyncStatusService service = new SyncStatusService();

    @Test
    void phase03AlwaysReturnsUnknown() {
        final var r = service.statusFor("TrackedEntity", "abc12345678");
        assertThat(r.status()).isEqualTo(SyncStatusService.SyncStatus.UNKNOWN);
        assertThat(r.entityType()).isEqualTo("TrackedEntity");
        assertThat(r.entityId()).isEqualTo("abc12345678");
        assertThat(r.note()).contains("Phase 04");
    }

    @Test
    void rejectsBlankInputs() {
        assertThatThrownBy(() -> service.statusFor(null, "x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.statusFor("", "x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.statusFor("x", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.statusFor("x", "   ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void enumContainsExpectedConstants() {
        // Explicit assertion so Phase 04 cannot silently rename a value.
        assertThat(SyncStatusService.SyncStatus.values())
                .containsExactly(
                        SyncStatusService.SyncStatus.LOCALLY_COMMITTED,
                        SyncStatusService.SyncStatus.PENDING_CENTRAL,
                        SyncStatusService.SyncStatus.CENTRAL_ACCEPTED,
                        SyncStatusService.SyncStatus.CENTRAL_REJECTED,
                        SyncStatusService.SyncStatus.CONFLICT_REVIEW,
                        SyncStatusService.SyncStatus.UNKNOWN);
    }
}
