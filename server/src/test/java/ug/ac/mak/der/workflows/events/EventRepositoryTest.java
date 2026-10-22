package ug.ac.mak.der.workflows.events;

import static org.assertj.core.api.Assertions.assertThat;
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
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;

class EventRepositoryTest {

    private Event sample() {
        return new Event(UUID.randomUUID(), UUID.randomUUID(), "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1,
                Map.of("de1", "1"));
    }

    @Test
    void upsertReturnsStoredVersion() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class),
                any(), any(), anyString(), anyString(), anyString(),
                any(Timestamp.class), anyString(), anyString(), any())).thenReturn(5);
        final Event stored = new EventRepository(jdbc).upsert(sample());
        assertThat(stored.eventVersion()).isEqualTo(5);
    }

    @Test
    void upsertHandlesNullReturnedVersion() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class),
                any(), any(), anyString(), anyString(), anyString(),
                any(Timestamp.class), anyString(), anyString(), any())).thenReturn(null);
        final Event stored = new EventRepository(jdbc).upsert(sample());
        assertThat(stored.eventVersion()).isEqualTo(1);
    }

    @Test
    void existsByIdTrue() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class))).thenReturn(1);
        assertThat(new EventRepository(jdbc).existsById(UUID.randomUUID())).isTrue();
    }

    @Test
    void existsByIdFalse() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class))).thenReturn(0);
        assertThat(new EventRepository(jdbc).existsById(UUID.randomUUID())).isFalse();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class))).thenReturn(null);
        assertThat(new EventRepository(jdbc).existsById(UUID.randomUUID())).isFalse();
    }

    @Test
    void findByIdMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EventRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID eventId = UUID.randomUUID();
        when(rs.getObject("event_id")).thenReturn(eventId);
        when(rs.getObject("enrollment_id")).thenReturn(null);
        when(rs.getString("program_uid")).thenReturn("p");
        when(rs.getString("program_stage_uid")).thenReturn("ps");
        when(rs.getString("org_unit_uid")).thenReturn("ou");
        when(rs.getTimestamp("occurred_at")).thenReturn(Timestamp.from(Instant.now()));
        when(rs.getString("status")).thenReturn("ACTIVE");
        when(rs.getString("attribute_option_combo_uid")).thenReturn("HllvX50cXC0");
        when(rs.getObject("created_by")).thenReturn(UUID.randomUUID());
        when(rs.getInt("event_version")).thenReturn(2);
        final ArgumentCaptor<RowMapper<Event>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq(eventId)))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final var opt = new EventRepository(jdbc).findById(eventId);
        assertThat(opt).isPresent();
        assertThat(opt.get().eventVersion()).isEqualTo(2);
    }

    @Test
    void findByProgramAndOrgUnitEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p"), eq("ou"), anyInt()))
                .thenReturn(List.of());
        assertThat(new EventRepository(jdbc).findByProgramAndOrgUnit("p", "ou", 10)).isEmpty();
    }

    @Test
    void findByProgramAndOrgUnitHit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final Event bare = new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of());
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p"), eq("ou"), anyInt()))
                .thenReturn(List.of(bare));
        // After withDataValues merges, result is non-empty
        assertThat(new EventRepository(jdbc).findByProgramAndOrgUnit("p", "ou", 10))
                .hasSize(1);
    }

    @Test
    void findForEnrollmentEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenReturn(List.of());
        assertThat(new EventRepository(jdbc).findForEnrollment(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findForEnrollmentHit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final Event bare = new Event(UUID.randomUUID(), UUID.randomUUID(), "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of());
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenReturn(List.of(bare));
        assertThat(new EventRepository(jdbc).findForEnrollment(UUID.randomUUID()))
                .hasSize(1);
    }

    @Test
    void findByProgramAndOrgUnitCapsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p"), eq("ou"), eq(500)))
                .thenReturn(List.of());
        new EventRepository(jdbc).findByProgramAndOrgUnit("p", "ou", 10_000);
    }

    @Test
    void findByProgramAndOrgUnitFloorsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p"), eq("ou"), eq(1)))
                .thenReturn(List.of());
        new EventRepository(jdbc).findByProgramAndOrgUnit("p", "ou", 0);
    }

    @Test
    void withDataValuesCallbackCovered() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final Event bare = new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.now(), Event.Status.ACTIVE, null, UUID.randomUUID(), 1, Map.of());
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenReturn(List.of(bare));
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("data_element_uid")).thenReturn("de1");
        when(rs.getString("value_text")).thenReturn("v1");
        final ArgumentCaptor<RowCallbackHandler> cap =
                ArgumentCaptor.forClass(RowCallbackHandler.class);
        org.mockito.Mockito.doAnswer(inv -> {
            cap.getValue().processRow(rs);
            return null;
        }).when(jdbc).query(anyString(), cap.capture(), any(UUID.class));
        new EventRepository(jdbc).findForEnrollment(UUID.randomUUID());
    }
}
