package ug.ac.mak.der.workflows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;

class SyncStatusServiceTest {

    private SyncStatusService svc(final AggregateDataValueRepository repo) {
        return new SyncStatusService(repo);
    }

    @Test
    void returnsLocallyCommittedForExistingAggregateValue() {
        final AggregateDataValueRepository repo = mock(AggregateDataValueRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.existsById(id)).thenReturn(true);
        final var r = svc(repo).statusFor("aggregate_data_value", id.toString());
        assertThat(r.status()).isEqualTo(SyncStatusService.SyncStatus.LOCALLY_COMMITTED);
        verify(repo).existsById(id);
    }

    @Test
    void returnsUnknownForMissingAggregateValue() {
        final AggregateDataValueRepository repo = mock(AggregateDataValueRepository.class);
        when(repo.existsById(org.mockito.ArgumentMatchers.any(UUID.class))).thenReturn(false);
        final var r = svc(repo).statusFor("aggregate_data_value", UUID.randomUUID().toString());
        assertThat(r.status()).isEqualTo(SyncStatusService.SyncStatus.UNKNOWN);
    }

    @Test
    void returnsUnknownWhenEntityIdIsNotAUuid() {
        final AggregateDataValueRepository repo = mock(AggregateDataValueRepository.class);
        final var r = svc(repo).statusFor("aggregate_data_value", "not-a-uuid");
        assertThat(r.status()).isEqualTo(SyncStatusService.SyncStatus.UNKNOWN);
    }

    @Test
    void returnsUnknownForUnknownEntityType() {
        final AggregateDataValueRepository repo = mock(AggregateDataValueRepository.class);
        final var r = svc(repo).statusFor("mystery", UUID.randomUUID().toString());
        assertThat(r.status()).isEqualTo(SyncStatusService.SyncStatus.UNKNOWN);
    }

    @Test
    void rejectsBlankInputs() {
        final AggregateDataValueRepository repo = mock(AggregateDataValueRepository.class);
        assertThatThrownBy(() -> svc(repo).statusFor(null, "x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc(repo).statusFor("", "x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc(repo).statusFor("x", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc(repo).statusFor("x", "   ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNullDependency() {
        assertThatThrownBy(() -> new SyncStatusService(null)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void enumContainsExpectedConstants() {
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
