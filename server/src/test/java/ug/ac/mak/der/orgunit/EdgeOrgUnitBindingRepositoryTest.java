package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class EdgeOrgUnitBindingRepositoryTest {

    @Test
    void readReturnsEmptyWhenSingletonMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).read().isBound()).isFalse();
    }

    @Test
    void readReturnsBoundWhenRowPopulated() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getTimestamp("org_unit_bound_at"))
                .thenReturn(Timestamp.from(Instant.parse("2026-10-22T00:00:00Z")));
        final UUID u = UUID.randomUUID();
        when(rs.getObject("org_unit_bound_by")).thenReturn(u);
        when(rs.getString("org_unit_id")).thenReturn("ou-1");
        when(rs.getString("org_unit_display_name")).thenReturn("Clinic");
        when(rs.getString("org_unit_path")).thenReturn("/root/ou-1");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final EdgeOrgUnitBinding b = new EdgeOrgUnitBindingRepository(jdbc).read();
        assertThat(b.isBound()).isTrue();
        assertThat(b.orgUnitPath()).isEqualTo("/root/ou-1");
    }

    @Test
    void readHandlesNullBoundAt() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getTimestamp("org_unit_bound_at")).thenReturn(null);
        when(rs.getObject("org_unit_bound_by")).thenReturn(null);
        when(rs.getString("org_unit_id")).thenReturn(null);
        when(rs.getString("org_unit_display_name")).thenReturn(null);
        when(rs.getString("org_unit_path")).thenReturn(null);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).read().boundAt()).isNull();
    }

    @Test
    void writePassesEveryField() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID u = UUID.randomUUID();
        final Instant now = Instant.parse("2026-10-22T00:00:00Z");
        final EdgeOrgUnitBinding b = new EdgeOrgUnitBinding("ou-1", "Clinic", "/root/ou-1", now, u);
        new EdgeOrgUnitBindingRepository(jdbc).write(b);
        verify(jdbc).update(anyString(), eq("ou-1"), eq("Clinic"), eq("/root/ou-1"),
                any(Timestamp.class), eq(u));
    }

    @Test
    void writeHandlesNullBoundAt() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeOrgUnitBinding empty = EdgeOrgUnitBinding.empty();
        new EdgeOrgUnitBindingRepository(jdbc).write(empty);
        verify(jdbc).update(anyString(), eq(null), eq(null), eq(null), eq(null), eq(null));
    }

    @Test
    void isUnderBoundSubtreeHappy() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeOrgUnitBindingRepository repo = new EdgeOrgUnitBindingRepository(jdbc);
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound("ou-1", "C", "/root/ou-1", UUID.randomUUID());
        assertThat(repo.isUnderBoundSubtree(bound, "/root/ou-1")).isTrue();
        assertThat(repo.isUnderBoundSubtree(bound, "/root/ou-1/outpost")).isTrue();
        assertThat(repo.isUnderBoundSubtree(bound, "/root/ou-2")).isFalse();
        assertThat(repo.isUnderBoundSubtree(bound, "/root/ou-1-sister")).isFalse();
        assertThat(repo.isUnderBoundSubtree(bound, null)).isFalse();
        assertThat(repo.isUnderBoundSubtree(null, "/root/ou-1")).isFalse();
        assertThat(repo.isUnderBoundSubtree(EdgeOrgUnitBinding.empty(), "/root/ou-1")).isFalse();
    }

    @Test
    void resolveOrgUnitPathAndDisplayName() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(String.class), eq("ou-1")))
                .thenReturn("/root/ou-1");
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitPath("ou-1"))
                .isEqualTo("/root/ou-1");

        when(jdbc.queryForObject(anyString(), eq(String.class), eq("ou-2")))
                .thenReturn("Village Clinic");
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitDisplayName("ou-2"))
                .isEqualTo("Village Clinic");

        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitPath(null)).isNull();
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitDisplayName(null)).isNull();
    }

    @Test
    void resolveHandlesMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(String.class), anyString()))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitPath("x")).isNull();
        assertThat(new EdgeOrgUnitBindingRepository(jdbc).resolveOrgUnitDisplayName("x"))
                .isEqualTo("x");
    }
}
