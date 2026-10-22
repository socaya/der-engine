package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

class SecurityAuditVerifierTest {

    @Test
    void verifyOkWhenNoBreaks() throws SQLException {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(42L);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(false);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenAnswer(inv -> {
            final ResultSetExtractor<SecurityAuditVerifier.Break> rse = inv.getArgument(1);
            return rse.extractData(rs);
        });
        final SecurityAuditVerifier v = new SecurityAuditVerifier(jdbc);
        final SecurityAuditVerifier.Result r = v.verify();
        assertThat(r.ok()).isTrue();
        assertThat(r.totalRows()).isEqualTo(42L);
        assertThat(r.firstBreak()).isNull();
    }

    @Test
    void verifyReportsBreak() throws SQLException {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(10L);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getLong("audit_id")).thenReturn(7L);
        when(rs.getString("reason")).thenReturn("PREV_HASH_MISMATCH");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenAnswer(inv -> {
            final ResultSetExtractor<SecurityAuditVerifier.Break> rse = inv.getArgument(1);
            return rse.extractData(rs);
        });
        final SecurityAuditVerifier.Result r = new SecurityAuditVerifier(jdbc).verify();
        assertThat(r.ok()).isFalse();
        assertThat(r.firstBreak().auditId()).isEqualTo(7L);
        assertThat(r.firstBreak().reason())
                .isEqualTo(SecurityAuditVerifier.Reason.PREV_HASH_MISMATCH);
    }

    @Test
    void verifyTreatsNullCountAsZero() throws SQLException {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(null);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenReturn(null);
        final SecurityAuditVerifier.Result r = new SecurityAuditVerifier(jdbc).verify();
        assertThat(r.totalRows()).isZero();
        assertThat(r.ok()).isTrue();
    }
}
