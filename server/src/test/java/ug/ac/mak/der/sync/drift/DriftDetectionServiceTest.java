package ug.ac.mak.der.sync.drift;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.metadata.MetadataSnapshot;
import ug.ac.mak.der.metadata.MetadataSnapshotRepository;

class DriftDetectionServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private MetadataSnapshot snap(final long id, final String fingerprint) {
        return new MetadataSnapshot(id, "x", UUID.randomUUID(), Instant.now(),
                new MetadataSnapshot.Counts(0, 0, 0, 0, 0), "2.44", "r", fingerprint);
    }

    @Test
    void emptyWhenNotEnoughSnapshots() {
        final MetadataSnapshotRepository snaps = mock(MetadataSnapshotRepository.class);
        final DriftSnapshotRepository drifts = mock(DriftSnapshotRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(snaps.findRecent(2)).thenReturn(List.of(snap(1L, "f")));
        final var service = new DriftDetectionService(snaps, drifts, jdbc, mapper);
        final var report = service.recordLatestDelta("x");
        assertThat(report.snapshotFrom()).isEqualTo(0L);
        assertThat(report.perEntity()).isEmpty();
    }

    @Test
    void computesDeltaWhenTwoSnapshots() {
        final MetadataSnapshotRepository snaps = mock(MetadataSnapshotRepository.class);
        final DriftSnapshotRepository drifts = mock(DriftSnapshotRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(snaps.findRecent(2)).thenReturn(List.of(snap(2L, "f2"), snap(1L, "f1")));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(1L)))
                .thenReturn(List.of("a", "b"));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(2L)))
                .thenReturn(List.of("b", "c"));
        when(drifts.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        final var service = new DriftDetectionService(snaps, drifts, jdbc, mapper);
        final var report = service.recordLatestDelta("x");
        assertThat(report.perEntity().get("ORGANISATION_UNIT").added()).contains("c");
        assertThat(report.perEntity().get("ORGANISATION_UNIT").removed()).contains("a");
    }

    @Test
    void latestDelegates() {
        final MetadataSnapshotRepository snaps = mock(MetadataSnapshotRepository.class);
        final DriftSnapshotRepository drifts = mock(DriftSnapshotRepository.class);
        when(drifts.findLatest()).thenReturn(java.util.Optional.empty());
        final var service = new DriftDetectionService(snaps, drifts, mock(JdbcTemplate.class),
                mapper);
        assertThat(service.latest()).isEmpty();
    }

    @Test
    void computeHandlesJsonFailure() throws Exception {
        final MetadataSnapshotRepository snaps = mock(MetadataSnapshotRepository.class);
        final DriftSnapshotRepository drifts = mock(DriftSnapshotRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper m = mock(ObjectMapper.class);
        when(m.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") { });
        when(jdbc.queryForList(anyString(), eq(String.class), any(Long.class)))
                .thenReturn(List.of());
        final var service = new DriftDetectionService(snaps, drifts, jdbc, m);
        service.compute(snap(1L, "f1"), snap(2L, "f2"), "test");
    }

    @Test
    void deltaRecordAccessors() {
        final var d = new DriftDetectionService.EntityDelta(List.of("a"), List.of("b"), List.of("c"));
        assertThat(d.added()).containsExactly("a");
        assertThat(d.removed()).containsExactly("b");
        assertThat(d.changed()).containsExactly("c");
    }

    @Test
    void driftReportEmpty() {
        final var r = DriftDetectionService.DriftReport.empty();
        assertThat(r.snapshotFrom()).isEqualTo(0L);
    }
}
