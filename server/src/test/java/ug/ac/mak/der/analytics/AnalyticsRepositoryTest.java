package ug.ac.mak.der.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class AnalyticsRepositoryTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    @Test
    void summaryNoFiltersEmitsNoWhereParams() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        assertThat(new AnalyticsRepository(jdbc).summary(null, null)).isEmpty();
        verify(jdbc).query(
                argThat((String s) -> !s.contains("org_unit_id = ?")
                        && !s.contains("kind = ?")),
                any(RowMapper.class),
                any(Object[].class));
    }

    @Test
    void summaryWithOrgUnitFilter() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AnalyticsRepository(jdbc).summary("ou-1", null);
        verify(jdbc).query(
                argThat((String s) -> s.contains("org_unit_id = ?")
                        && !s.contains("kind = ?")),
                any(RowMapper.class),
                any(Object[].class));
    }

    @Test
    void summaryBlankOrgUnitSkipped() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AnalyticsRepository(jdbc).summary("", FacilitySummaryRow.Kind.AGGREGATE);
        verify(jdbc).query(
                argThat((String s) -> !s.contains("org_unit_id = ?")
                        && s.contains("kind = ?")),
                any(RowMapper.class),
                any(Object[].class));
    }

    @Test
    void summaryWithBothFilters() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AnalyticsRepository(jdbc).summary("ou-1", FacilitySummaryRow.Kind.EVENT);
        verify(jdbc).query(
                argThat((String s) -> s.contains("org_unit_id = ?")
                        && s.contains("kind = ?")),
                any(RowMapper.class),
                any(Object[].class));
    }

    @Test
    void rowMapperReadsAllColumns() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("org_unit_id")).thenReturn("ou-1");
        when(rs.getString("period")).thenReturn("202604");
        when(rs.getString("kind")).thenReturn("AGGREGATE");
        when(rs.getLong("n")).thenReturn(42L);
        when(rs.getTimestamp("refreshed_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(inv -> List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1)));
        final List<FacilitySummaryRow> rows = new AnalyticsRepository(jdbc).summary(null, null);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).n()).isEqualTo(42L);
        assertThat(rows.get(0).kind()).isEqualTo(FacilitySummaryRow.Kind.AGGREGATE);
    }

    @Test
    void recentRejectionsCapsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(5000))).thenReturn(10);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(1))).thenReturn(0);
        assertThat(new AnalyticsRepository(jdbc).recentRejections(999999)).isEqualTo(10);
        assertThat(new AnalyticsRepository(jdbc).recentRejections(0)).isZero();
    }

    @Test
    void recentRejectionsHandlesNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(500))).thenReturn(null);
        assertThat(new AnalyticsRepository(jdbc).recentRejections(500)).isZero();
    }

    @Test
    void lastRefreshedAtReadsFromResultSet() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getTimestamp(1)).thenReturn(Timestamp.from(NOW));
        when(jdbc.query(anyString(), any(ResultSetExtractor.class)))
                .thenAnswer(inv -> ((ResultSetExtractor<?>) inv.getArgument(1)).extractData(rs));
        assertThat(new AnalyticsRepository(jdbc).lastRefreshedAt()).isEqualTo(NOW);
    }

    @Test
    void lastRefreshedAtNullWhenEmpty() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getTimestamp(1)).thenReturn(null);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class)))
                .thenAnswer(inv -> ((ResultSetExtractor<?>) inv.getArgument(1)).extractData(rs));
        assertThat(new AnalyticsRepository(jdbc).lastRefreshedAt()).isNull();
    }

    @Test
    void lastRefreshedAtNullWhenNoRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(false);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class)))
                .thenAnswer(inv -> ((ResultSetExtractor<?>) inv.getArgument(1)).extractData(rs));
        assertThat(new AnalyticsRepository(jdbc).lastRefreshedAt()).isNull();
    }

    @Test
    void refreshDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new AnalyticsRepository(jdbc).refresh();
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY"));
    }
}
