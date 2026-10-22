package ug.ac.mak.der.workflows;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ActivityServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    @Test
    void queriesWithUserAndSurfaceList() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.query(anyString(), any(RowMapper.class), eq(uid), any(String[].class), eq(10)))
                .thenReturn(List.of(new ActivityService.ActivityEntry(1L, "SIGN_IN_SUCCESS", "SUCCESS", NOW)));
        final List<ActivityService.ActivityEntry> result = new ActivityService(jdbc).recentForUser(uid, 10);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).eventType()).isEqualTo("SIGN_IN_SUCCESS");
    }

    @Test
    void capsLimitTo100() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any())).thenReturn(List.of());
        new ActivityService(jdbc).recentForUser(UUID.randomUUID(), 10_000);
        final ArgumentCaptor<Integer> limit = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(), any(), limit.capture());
        assertThat(limit.getValue()).isEqualTo(100);
    }

    @Test
    void floorsLimitAt1() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any())).thenReturn(List.of());
        new ActivityService(jdbc).recentForUser(UUID.randomUUID(), 0);
        final ArgumentCaptor<Integer> limit = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(), any(), limit.capture());
        assertThat(limit.getValue()).isEqualTo(1);
    }

    @Test
    void rowMapperReadsExpectedShape() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("audit_id")).thenReturn(42L);
        when(rs.getString("event_type")).thenReturn("SIGN_IN_SUCCESS");
        when(rs.getString("outcome")).thenReturn("SUCCESS");
        when(rs.getTimestamp("observed_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.query(anyString(), any(RowMapper.class), any(), any(), any()))
                .thenAnswer(inv -> List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1)));
        final List<ActivityService.ActivityEntry> result = new ActivityService(jdbc)
                .recentForUser(UUID.randomUUID(), 20);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).auditId()).isEqualTo(42L);
    }

    @Test
    void entryRejectsNullFields() {
        assertThatThrownBy(() -> new ActivityService.ActivityEntry(1L, null, "S", NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ActivityService.ActivityEntry(1L, "T", null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ActivityService.ActivityEntry(1L, "T", "S", null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
