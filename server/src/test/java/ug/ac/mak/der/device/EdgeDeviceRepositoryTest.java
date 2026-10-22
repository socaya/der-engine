package ug.ac.mak.der.device;

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
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class EdgeDeviceRepositoryTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    @Test
    void findAllDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        assertThat(new EdgeDeviceRepository(jdbc).findAll()).isEmpty();
    }

    @Test
    void findByIdNullEmpty() {
        assertThat(new EdgeDeviceRepository(mock(JdbcTemplate.class)).findById(null))
                .isEmpty();
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeDeviceRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void mapperReadsRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID id = UUID.randomUUID();
        when(rs.getObject("device_id")).thenReturn(id);
        when(rs.getObject("assigned_user_id")).thenReturn(null);
        when(rs.getString("enrolment_token_hash")).thenReturn("h");
        when(rs.getTimestamp("enrolled_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getObject("approved_by")).thenReturn(null);
        when(rs.getTimestamp("approved_at")).thenReturn(null);
        when(rs.getTimestamp("last_seen_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getString("user_agent")).thenReturn("chrome");
        when(rs.getString("firmware_version")).thenReturn(null);
        when(rs.getString("status")).thenReturn("APPROVED");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(id)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final EdgeDevice d = new EdgeDeviceRepository(jdbc).findById(id).orElseThrow();
        assertThat(d.status()).isEqualTo(EdgeDevice.Status.APPROVED);
        assertThat(d.enrolmentTokenHash()).isEqualTo("h");
    }

    @Test
    void upsertEnrolRequiresDeviceId() {
        assertThatThrownBy(() -> new EdgeDeviceRepository(mock(JdbcTemplate.class))
                .upsertEnrol(null, UUID.randomUUID(), "ua", "h"))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void upsertEnrolThrowsWhenRowMissingAfterInsert() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThatThrownBy(() -> new EdgeDeviceRepository(jdbc)
                .upsertEnrol(UUID.randomUUID(), UUID.randomUUID(), "ua", "h"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void updateStatusApproveUsesApprovedBy() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        final UUID actor = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(actor), eq(id))).thenReturn(1);
        assertThat(new EdgeDeviceRepository(jdbc).updateStatus(id,
                EdgeDevice.Status.APPROVED, actor)).isEqualTo(1);
    }

    @Test
    void updateStatusNonApproveSkipsApprovedBy() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.update(anyString(), eq("SUSPENDED"), eq(id))).thenReturn(1);
        assertThat(new EdgeDeviceRepository(jdbc).updateStatus(id,
                EdgeDevice.Status.SUSPENDED, UUID.randomUUID())).isEqualTo(1);
    }

    @Test
    void heartbeatNullReturnsZero() {
        assertThat(new EdgeDeviceRepository(mock(JdbcTemplate.class)).heartbeat(null))
                .isZero();
    }

    @Test
    void heartbeatDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(id))).thenReturn(1);
        assertThat(new EdgeDeviceRepository(jdbc).heartbeat(id)).isEqualTo(1);
    }

    @Test
    void deleteNullReturnsZero() {
        assertThat(new EdgeDeviceRepository(mock(JdbcTemplate.class)).delete(null)).isZero();
    }

    @Test
    void deleteDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(id))).thenReturn(1);
        assertThat(new EdgeDeviceRepository(jdbc).delete(id)).isEqualTo(1);
        verify(jdbc).update(anyString(), eq(id));
    }
}
