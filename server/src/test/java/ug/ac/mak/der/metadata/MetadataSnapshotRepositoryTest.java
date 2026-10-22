package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class MetadataSnapshotRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    private MetadataSnapshot bare() {
        return new MetadataSnapshot(0L, "http://central/dhis", UUID.randomUUID(), NOW,
                new MetadataSnapshot.Counts(1, 2, 3, 4, 5), "2.44-SNAPSHOT", "abc123", "fp");
    }

    @Test
    void insertUsesReturningAndWritesAllColumns() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final MetadataSnapshot in = bare();
        when(jdbc.queryForObject(anyString(), eq(Long.class),
                anyString(), any(), any(Timestamp.class),
                anyInt(), anyInt(), anyInt(), anyInt(), anyInt(),
                any(), any(), any())).thenReturn(42L);

        final MetadataSnapshot out = new MetadataSnapshotRepository(jdbc).insert(in);
        assertThat(out.snapshotId()).isEqualTo(42L);
        verify(jdbc).queryForObject(contains("RETURNING snapshot_id"), eq(Long.class),
                eq(in.importedFrom()), eq(in.importedBy()), any(Timestamp.class),
                eq(1), eq(2), eq(3), eq(4), eq(5),
                eq("2.44-SNAPSHOT"), eq("abc123"), eq("fp"));
    }

    @Test
    void insertHandlesNullReturnedId() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class),
                anyString(), any(), any(Timestamp.class), anyInt(), anyInt(), anyInt(), anyInt(), anyInt(),
                any(), any(), any())).thenReturn(null);
        final MetadataSnapshot out = new MetadataSnapshotRepository(jdbc).insert(bare());
        assertThat(out.snapshotId()).isZero();
    }

    @Test
    void findLatestEmptyOnNoRows() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new MetadataSnapshotRepository(jdbc).findLatest()).isEmpty();
    }

    @Test
    void findLatestHydratesRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final MetadataSnapshot sample = bare();
        when(jdbc.queryForObject(anyString(), any(RowMapper.class))).thenReturn(sample);
        final var opt = new MetadataSnapshotRepository(jdbc).findLatest();
        assertThat(opt).contains(sample);
    }

    @Test
    void findRecentPassesLimitAfterCapping() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyInt())).thenReturn(List.of());
        new MetadataSnapshotRepository(jdbc).findRecent(10_000);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), cap.capture());
        assertThat(cap.getValue()).isEqualTo(100);
    }

    @Test
    void findRecentFloorsAt1() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyInt())).thenReturn(List.of());
        new MetadataSnapshotRepository(jdbc).findRecent(0);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), cap.capture());
        assertThat(cap.getValue()).isEqualTo(1);
    }

    @Test
    void rowMapperReadsExpectedShape() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("snapshot_id")).thenReturn(7L);
        when(rs.getString("imported_from")).thenReturn("central");
        when(rs.getObject("imported_by", UUID.class)).thenReturn(null);
        when(rs.getTimestamp("imported_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getInt("organisation_units_count")).thenReturn(1);
        when(rs.getInt("data_elements_count")).thenReturn(2);
        when(rs.getInt("data_sets_count")).thenReturn(3);
        when(rs.getInt("programs_count")).thenReturn(4);
        when(rs.getInt("tracked_entity_types_count")).thenReturn(5);
        when(rs.getString("central_version")).thenReturn("v");
        when(rs.getString("central_revision")).thenReturn("r");
        when(rs.getString("fingerprint")).thenReturn("fp");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var opt = new MetadataSnapshotRepository(jdbc).findLatest();
        assertThat(opt).isPresent();
        assertThat(opt.get().snapshotId()).isEqualTo(7L);
        assertThat(opt.get().counts().total()).isEqualTo(15);
    }
}
