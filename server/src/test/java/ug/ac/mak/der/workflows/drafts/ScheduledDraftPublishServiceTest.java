package ug.ac.mak.der.workflows.drafts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.web.DraftController;

/** E6 — tick behaviour. */
class ScheduledDraftPublishServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private Draft draft(final UUID did, final UUID owner) {
        return new Draft(did, owner, "aggregate", "Weekly",
                mapper.createObjectNode(),
                Instant.parse("2026-11-01T00:00:00Z"),
                Instant.parse("2026-11-01T00:00:00Z"));
    }

    @Test
    void emptyBatchYieldsZeroCounts() {
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of());
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.scanned()).isZero();
        assertThat(r.published()).isZero();
        assertThat(r.failed()).isZero();
    }

    @Test
    void publishedSuccessAndConsumedIncrementsPublished() {
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        final UUID did = UUID.randomUUID();
        final UUID owner = UUID.randomUUID();
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of(
                new DraftRepository.ScheduledDraftRef(did, owner,
                        Instant.parse("2026-11-01T00:00:00Z"))));
        when(repo.findById(did)).thenReturn(Optional.of(draft(did, owner)));
        when(ctl.publishCore(any(), eq(owner), eq("scheduler"), eq("der-scheduler")))
                .thenReturn(ResponseEntity.ok(Map.of("draftConsumed", true, "imported", 1)));
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.published()).isEqualTo(1);
        assertThat(r.keptWithConflicts()).isZero();
        /* consumed drafts are deleted inside publishCore itself; the
         * tick doesn't call clearSchedule in that case because the
         * row is gone. */
        verify(repo, never()).clearSchedule(eq(did), eq(owner));
    }

    @Test
    void okButConflictsClearsScheduleAndCountsKept() {
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        final UUID did = UUID.randomUUID();
        final UUID owner = UUID.randomUUID();
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of(
                new DraftRepository.ScheduledDraftRef(did, owner, Instant.now())));
        when(repo.findById(did)).thenReturn(Optional.of(draft(did, owner)));
        when(ctl.publishCore(any(), eq(owner), any(), any()))
                .thenReturn(ResponseEntity.ok(Map.of("draftConsumed", false, "conflicts",
                        List.of("deBAD|ou1|2026W44"))));
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.published()).isZero();
        assertThat(r.keptWithConflicts()).isEqualTo(1);
        verify(repo).clearSchedule(did, owner);
    }

    @Test
    void non2xxClearsScheduleAndCountsFailed() {
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        final UUID did = UUID.randomUUID();
        final UUID owner = UUID.randomUUID();
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of(
                new DraftRepository.ScheduledDraftRef(did, owner, Instant.now())));
        when(repo.findById(did)).thenReturn(Optional.of(draft(did, owner)));
        when(ctl.publishCore(any(), any(), any(), any()))
                .thenReturn(ResponseEntity.badRequest().body(Map.of(
                        "code", "DRAFT_PAYLOAD_INVALID")));
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.failed()).isEqualTo(1);
        verify(repo).clearSchedule(did, owner);
    }

    @Test
    void runtimeExceptionLeavesScheduleIntact() {
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        final UUID did = UUID.randomUUID();
        final UUID owner = UUID.randomUUID();
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of(
                new DraftRepository.ScheduledDraftRef(did, owner, Instant.now())));
        when(repo.findById(did)).thenReturn(Optional.of(draft(did, owner)));
        when(ctl.publishCore(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("db offline"));
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.failed()).isEqualTo(1);
        verify(repo, never()).clearSchedule(eq(did), eq(owner));
    }

    @Test
    void deletedBetweenBatchAndIterateSkipsSilently() {
        /* Operator or scheduler deletes the draft after
         * findMaturedScheduled returned the row — findById misses. */
        final DraftRepository repo = mock(DraftRepository.class);
        final DraftController ctl = mock(DraftController.class);
        final UUID did = UUID.randomUUID();
        final UUID owner = UUID.randomUUID();
        when(repo.findMaturedScheduled(any(), anyInt())).thenReturn(List.of(
                new DraftRepository.ScheduledDraftRef(did, owner, Instant.now())));
        when(repo.findById(did)).thenReturn(Optional.empty());
        final ScheduledDraftPublishService.TickResult r =
                new ScheduledDraftPublishService(repo, ctl).runOnce();
        assertThat(r.scanned()).isEqualTo(1);
        assertThat(r.published()).isZero();
        assertThat(r.failed()).isZero();
        verify(ctl, never()).publishCore(any(), any(), any(), any());
    }

    @Test
    void constructorRejectsNullDeps() {
        org.junit.jupiter.api.Assertions.assertThrows(NullPointerException.class,
                () -> new ScheduledDraftPublishService(null, mock(DraftController.class)));
        org.junit.jupiter.api.Assertions.assertThrows(NullPointerException.class,
                () -> new ScheduledDraftPublishService(mock(DraftRepository.class), null));
    }
}
