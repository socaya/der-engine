package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OperationJournalRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private final ObjectMapper json = new ObjectMapper();

    private OperationJournalEntry entry() {
        return new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "k",
                json.createObjectNode(),
                OperationJournalEntry.State.PENDING,
                0, null, UUID.randomUUID(), NOW, NOW);
    }

    @Test
    void insertEmitsAllColumns() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final OperationJournalEntry e = entry();
        new OperationJournalRepository(jdbc, json).insert(e);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.operation_journal"),
                eq(e.operationId()), eq("AGGREGATE_DATA_VALUE"), eq("k"),
                anyString(), eq("PENDING"), eq(0), eq((Object) null),
                eq(e.submittedBy()), any(Timestamp.class), any(Timestamp.class));
    }

    @Test
    void writeJsonFailureSurfaces() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") { });
        assertThatThrownBy(() -> new OperationJournalRepository(jdbc, broken).insert(entry()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("serialise");
    }

    @Test
    void findByIdEmptyOnMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new OperationJournalRepository(jdbc, json).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHydratesRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("operation_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("entity_type")).thenReturn("AGGREGATE_DATA_VALUE");
        when(rs.getString("entity_ref")).thenReturn("k");
        when(rs.getString("payload_json")).thenReturn("{\"x\":1}");
        when(rs.getString("state")).thenReturn("PENDING");
        when(rs.getInt("attempt_count")).thenReturn(0);
        when(rs.getString("last_error")).thenReturn(null);
        when(rs.getObject("submitted_by", UUID.class)).thenReturn(null);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var opt = new OperationJournalRepository(jdbc, json).findById(UUID.randomUUID());
        assertThat(opt).isPresent();
    }

    @Test
    void readJsonFailureSurfaces() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.readTree(anyString())).thenThrow(new JsonProcessingException("bad") { });
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("operation_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("entity_type")).thenReturn("AGGREGATE_DATA_VALUE");
        when(rs.getString("entity_ref")).thenReturn("k");
        when(rs.getString("payload_json")).thenReturn("junk");
        when(rs.getString("state")).thenReturn("PENDING");
        when(rs.getInt("attempt_count")).thenReturn(0);
        when(rs.getString("last_error")).thenReturn(null);
        when(rs.getObject("submitted_by", UUID.class)).thenReturn(null);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThatThrownBy(() -> new OperationJournalRepository(jdbc, broken).findById(UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("parse");
    }

    @Test
    void findPendingCapsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyInt()))
                .thenReturn(List.of());
        new OperationJournalRepository(jdbc, json).findPending(100_000);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), anyString(), cap.capture());
        assertThat(cap.getValue()).isEqualTo(500);
    }

    @Test
    void findPendingFloorsAtOne() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyInt()))
                .thenReturn(List.of());
        new OperationJournalRepository(jdbc, json).findPending(0);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), anyString(), cap.capture());
        assertThat(cap.getValue()).isEqualTo(1);
    }

    @Test
    void countByStateHandlesNullAndNumber() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("PENDING"))).thenReturn(null, 7);
        final OperationJournalRepository repo = new OperationJournalRepository(jdbc, json);
        assertThat(repo.countByState(OperationJournalEntry.State.PENDING)).isZero();
        assertThat(repo.countByState(OperationJournalEntry.State.PENDING)).isEqualTo(7);
    }
}
