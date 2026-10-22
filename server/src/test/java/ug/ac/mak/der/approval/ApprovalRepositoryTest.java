package ug.ac.mak.der.approval;

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
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ApprovalRepositoryTest {

    @Test
    void findByIdEmptyForNull() {
        assertThat(new ApprovalRepository(mock(JdbcTemplate.class)).findById(null)).isEmpty();
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new ApprovalRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHydrates() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID op = UUID.randomUUID();
        final UUID approver = UUID.randomUUID();
        when(rs.getObject("operation_id")).thenReturn(op);
        when(rs.getBoolean("requires_approval")).thenReturn(true);
        when(rs.getObject("approved_by")).thenReturn(approver);
        when(rs.getTimestamp("approved_at"))
                .thenReturn(Timestamp.from(Instant.parse("2026-10-22T00:00:00Z")));
        when(rs.getObject("rejected_by")).thenReturn(null);
        when(rs.getTimestamp("rejected_at")).thenReturn(null);
        when(rs.getString("rejection_reason")).thenReturn(null);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(op)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final ApprovalRecord r = new ApprovalRepository(jdbc).findById(op).orElseThrow();
        assertThat(r.isApproved()).isTrue();
        assertThat(r.approvedBy()).isEqualTo(approver);
    }

    @Test
    void findAwaitingDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10))).thenReturn(List.of());
        assertThat(new ApprovalRepository(jdbc).findAwaiting(10)).isEmpty();
    }

    @Test
    void findAwaitingCapsLimits() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(500))).thenReturn(List.of());
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1))).thenReturn(List.of());
        new ApprovalRepository(jdbc).findAwaiting(9999);
        new ApprovalRepository(jdbc).findAwaiting(-5);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(500));
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(1));
    }

    @Test
    void pendingRowMapperIncludesEntityDetails() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID op = UUID.randomUUID();
        final UUID sub = UUID.randomUUID();
        when(rs.getObject("operation_id")).thenReturn(op);
        when(rs.getString("entity_type")).thenReturn("AGGREGATE_DATA_VALUE");
        when(rs.getString("entity_ref")).thenReturn("de/ou/2026Q1");
        when(rs.getObject("submitted_by")).thenReturn(sub);
        when(rs.getTimestamp("created_at"))
                .thenReturn(Timestamp.from(Instant.parse("2026-10-22T00:00:00Z")));
        when(jdbc.query(anyString(), any(RowMapper.class), eq(5)))
                .thenAnswer(inv -> List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1)));
        final List<ApprovalRepository.PendingApprovalRow> rows =
                new ApprovalRepository(jdbc).findAwaiting(5);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).entityType()).isEqualTo("AGGREGATE_DATA_VALUE");
        assertThat(rows.get(0).submittedBy()).isEqualTo(sub);
    }

    @Test
    void approveAndReject() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID op = UUID.randomUUID();
        final UUID actor = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(actor), eq(op))).thenReturn(1);
        assertThat(new ApprovalRepository(jdbc).approve(op, actor)).isEqualTo(1);

        when(jdbc.update(anyString(), eq(actor), eq("too high"), eq(op))).thenReturn(1);
        assertThat(new ApprovalRepository(jdbc).reject(op, actor, "too high")).isEqualTo(1);
    }

    @Test
    void countAwaiting() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(7);
        assertThat(new ApprovalRepository(jdbc).countAwaiting()).isEqualTo(7);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(null);
        assertThat(new ApprovalRepository(jdbc).countAwaiting()).isZero();
    }
}
