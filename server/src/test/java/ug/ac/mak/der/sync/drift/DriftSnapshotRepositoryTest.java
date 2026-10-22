package ug.ac.mak.der.sync.drift;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DriftSnapshotRepositoryTest {

    @Test
    void insert() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class),
                any(), any(), any(), any(), any(), any())).thenReturn(42L);
        final DriftSnapshot in = new DriftSnapshot(null, Instant.now(), 1L, 2L, "a", "b", "{}", "t");
        assertThat(new DriftSnapshotRepository(jdbc).insert(in).driftId()).isEqualTo(42L);
    }

    @Test
    void findLatestEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new DriftSnapshotRepository(jdbc).findLatest()).isEmpty();
    }

    @Test
    void findLatestHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("drift_id")).thenReturn(1L);
        when(rs.getTimestamp("captured_at")).thenReturn(Timestamp.from(Instant.now()));
        when(rs.getLong("snapshot_from")).thenReturn(1L);
        when(rs.getLong("snapshot_to")).thenReturn(2L);
        when(rs.getString("fingerprint_from")).thenReturn("f1");
        when(rs.getString("fingerprint_to")).thenReturn("f2");
        when(rs.getString("deltas_json")).thenReturn("{}");
        when(rs.getString("triggered_by")).thenReturn("test");
        final ArgumentCaptor<RowMapper<DriftSnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new DriftSnapshotRepository(jdbc).findLatest()).isPresent();
    }

    @Test
    void findRecentCapsAndFloors() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyInt())).thenReturn(List.of());
        new DriftSnapshotRepository(jdbc).findRecent(10_000);
        new DriftSnapshotRepository(jdbc).findRecent(0);
    }

    @Test
    void driftSnapshotRejectsNulls() {
        assertThatThrownBy(() -> new DriftSnapshot(null, null, 1, 2, "f", "f", "{}", "t"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new DriftSnapshot(null, Instant.now(), 1, 2, "f", "f", null, "t"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new DriftSnapshot(null, Instant.now(), 1, 2, "f", "f", "{}", null))
                .isInstanceOf(NullPointerException.class);
    }
}
