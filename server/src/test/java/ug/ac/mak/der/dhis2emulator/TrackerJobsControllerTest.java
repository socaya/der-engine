package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class TrackerJobsControllerTest {

    @Test
    void returns404OnMalformedId() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        final var res = new TrackerJobsController(repo).notifications("not-a-uuid");
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void returns404WhenJobUnknown() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        final var res = new TrackerJobsController(repo)
                .notifications(UUID.randomUUID().toString());
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void runningJobEmitsOneNotification() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(
                new TrackerJobRepository.Row(id, "RUNNING", UUID.randomUUID(),
                        Instant.parse("2026-11-15T10:00:00Z"),
                        null, Map.of(), null)));
        final ResponseEntity<List<Map<String, Object>>> res =
                new TrackerJobsController(repo).notifications(id.toString());
        assertThat(res.getBody()).hasSize(1);
        assertThat(res.getBody().get(0)).containsEntry("completed", false);
        assertThat(res.getBody().get(0)).containsEntry("level", "INFO");
    }

    @Test
    void completedJobEmitsTerminalNotification() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(
                new TrackerJobRepository.Row(id, "COMPLETED", UUID.randomUUID(),
                        Instant.parse("2026-11-15T10:00:00Z"),
                        Instant.parse("2026-11-15T10:00:01Z"),
                        Map.of("imported", 3), null)));
        final ResponseEntity<List<Map<String, Object>>> res =
                new TrackerJobsController(repo).notifications(id.toString());
        assertThat(res.getBody()).hasSize(2);
        assertThat(res.getBody().get(1)).containsEntry("completed", true);
        assertThat(res.getBody().get(1)).containsEntry("level", "INFO");
    }

    @Test
    void failedJobSurfacesErrorMessage() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(
                new TrackerJobRepository.Row(id, "FAILED", UUID.randomUUID(),
                        Instant.parse("2026-11-15T10:00:00Z"),
                        Instant.parse("2026-11-15T10:00:01Z"),
                        Map.of(), "SQL boom")));
        final ResponseEntity<List<Map<String, Object>>> res =
                new TrackerJobsController(repo).notifications(id.toString());
        assertThat(res.getBody()).hasSize(2);
        assertThat((String) res.getBody().get(1).get("message")).contains("SQL boom");
        assertThat(res.getBody().get(1)).containsEntry("level", "ERROR");
    }

    @Test
    void reportReturnsPersistedSummary() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(
                new TrackerJobRepository.Row(id, "COMPLETED", UUID.randomUUID(),
                        Instant.parse("2026-11-15T10:00:00Z"),
                        Instant.parse("2026-11-15T10:00:01Z"),
                        Map.of("imported", 3, "status", "OK"), null)));
        final ResponseEntity<Map<String, Object>> res =
                new TrackerJobsController(repo).report(id.toString());
        assertThat(res.getBody()).containsEntry("imported", 3);
    }
}
