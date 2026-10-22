package ug.ac.mak.der.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class ApprovalServiceTest {

    private ApprovalRecord awaiting(final UUID op) {
        return new ApprovalRecord(op, true, null, null, null, null, null);
    }

    private ApprovalRecord approved(final UUID op) {
        return new ApprovalRecord(op, true, UUID.randomUUID(), Instant.now(), null, null, null);
    }

    @Test
    void pendingDelegates() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        when(repo.findAwaiting(5)).thenReturn(List.of());
        assertThat(new ApprovalService(repo).pending(5)).isEmpty();
    }

    @Test
    void statusDelegates() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.of(awaiting(op)));
        assertThat(new ApprovalService(repo).status(op)).isPresent();
    }

    @Test
    void approveHappy() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.of(awaiting(op)));
        when(repo.approve(any(UUID.class), any(UUID.class))).thenReturn(1);
        assertThat(new ApprovalService(repo).approve(op, UUID.randomUUID()))
                .isEqualTo(ApprovalService.Outcome.APPROVED);
        verify(repo).approve(any(UUID.class), any(UUID.class));
    }

    @Test
    void rejectHappy() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.of(awaiting(op)));
        when(repo.reject(any(UUID.class), any(UUID.class), anyString())).thenReturn(1);
        assertThat(new ApprovalService(repo).reject(op, UUID.randomUUID(), "too high"))
                .isEqualTo(ApprovalService.Outcome.REJECTED);
    }

    @Test
    void notFound() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.empty());
        assertThat(new ApprovalService(repo).approve(op, UUID.randomUUID()))
                .isEqualTo(ApprovalService.Outcome.NOT_FOUND);
        assertThat(new ApprovalService(repo).reject(op, UUID.randomUUID(), "x"))
                .isEqualTo(ApprovalService.Outcome.NOT_FOUND);
    }

    @Test
    void notRequired() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op))
                .thenReturn(Optional.of(new ApprovalRecord(op, false, null, null, null, null, null)));
        assertThat(new ApprovalService(repo).approve(op, UUID.randomUUID()))
                .isEqualTo(ApprovalService.Outcome.NOT_REQUIRED);
    }

    @Test
    void alreadyDecided() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.of(approved(op)));
        assertThat(new ApprovalService(repo).approve(op, UUID.randomUUID()))
                .isEqualTo(ApprovalService.Outcome.ALREADY_DECIDED);
        assertThat(new ApprovalService(repo).reject(op, UUID.randomUUID(), "x"))
                .isEqualTo(ApprovalService.Outcome.ALREADY_DECIDED);
    }

    @Test
    void raceConditionZeroRowsReturnsAlreadyDecided() {
        final ApprovalRepository repo = mock(ApprovalRepository.class);
        final UUID op = UUID.randomUUID();
        when(repo.findById(op)).thenReturn(Optional.of(awaiting(op)));
        when(repo.approve(any(UUID.class), any(UUID.class))).thenReturn(0);
        when(repo.reject(any(UUID.class), any(UUID.class), anyString())).thenReturn(0);
        assertThat(new ApprovalService(repo).approve(op, UUID.randomUUID()))
                .isEqualTo(ApprovalService.Outcome.ALREADY_DECIDED);
        assertThat(new ApprovalService(repo).reject(op, UUID.randomUUID(), "x"))
                .isEqualTo(ApprovalService.Outcome.ALREADY_DECIDED);
    }
}
