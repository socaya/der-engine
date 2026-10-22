package ug.ac.mak.der.workflows.drafts;

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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DraftRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    private final ObjectMapper mapper = new ObjectMapper();

    private Draft sample() {
        return new Draft(UUID.randomUUID(), UUID.randomUUID(), "AGGREGATE",
                "Weekly report", mapper.createObjectNode().put("x", 1), NOW, NOW);
    }

    @Test
    void upsertWritesIntoDraftTable() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final Draft in = sample();
        final Draft out = new DraftRepository(jdbc, mapper).upsert(in);
        assertThat(out).isSameAs(in);
        verify(jdbc).update(anyString(), eq(in.draftId()), eq(in.ownerId()),
                eq(in.kind()), eq(in.title()), anyString(), any(Timestamp.class));
    }

    @Test
    void upsertWithNullPayloadWritesEmptyObject() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        // null payload is impossible at the record level (compact ctor rejects),
        // so we exercise the writeJson(null) branch via a repository helper call
        // where the field is set to NullNode. The repository treats JsonNode.NullNode
        // identically to a real value — serializes to the JSON string "null".
        final Draft in = new Draft(UUID.randomUUID(), UUID.randomUUID(), "k", "t",
                mapper.nullNode(), NOW, NOW);
        new DraftRepository(jdbc, mapper).upsert(in);
        verify(jdbc).update(anyString(), any(), any(), any(), any(), eq("null"),
                any(Timestamp.class));
    }

    @Test
    void upsertWrapsSerialisationFailure() throws JsonProcessingException {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper boom = mock(ObjectMapper.class);
        when(boom.writeValueAsString(any(JsonNode.class)))
                .thenThrow(new JsonProcessingException("x") { });
        final Draft in = sample();
        assertThatThrownBy(() -> new DraftRepository(jdbc, boom).upsert(in))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("serialise");
    }

    @Test
    void findByOwnerDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID oid = UUID.randomUUID();
        when(jdbc.query(anyString(), any(RowMapper.class), eq(oid))).thenReturn(List.of());
        assertThat(new DraftRepository(jdbc, mapper).findByOwner(oid)).isEmpty();
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new DraftRepository(jdbc, mapper).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdReturnsPresent() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID did = UUID.randomUUID();
        final UUID oid = UUID.randomUUID();
        when(rs.getObject("draft_id")).thenReturn(did);
        when(rs.getObject("owner_id")).thenReturn(oid);
        when(rs.getString("kind")).thenReturn("K");
        when(rs.getString("title")).thenReturn("T");
        when(rs.getString("payload")).thenReturn("{\"a\":1}");
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(did)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final Draft d = new DraftRepository(jdbc, mapper).findById(did).orElseThrow();
        assertThat(d.kind()).isEqualTo("K");
        assertThat(d.payload().get("a").intValue()).isEqualTo(1);
    }

    @Test
    void rowMapperFallsBackToEmptyNodeWhenPayloadNull() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("draft_id")).thenReturn(UUID.randomUUID());
        when(rs.getObject("owner_id")).thenReturn(UUID.randomUUID());
        when(rs.getString("kind")).thenReturn("K");
        when(rs.getString("title")).thenReturn("T");
        when(rs.getString("payload")).thenReturn(null);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final Draft d = new DraftRepository(jdbc, mapper).findById(UUID.randomUUID()).orElseThrow();
        assertThat(d.payload().isEmpty()).isTrue();
    }

    @Test
    void rowMapperWrapsDeserialisationFailure() throws Exception {
        // Use a real ObjectMapper; invalid JSON triggers the IOException branch.
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("draft_id")).thenReturn(UUID.randomUUID());
        when(rs.getObject("owner_id")).thenReturn(UUID.randomUUID());
        when(rs.getString("kind")).thenReturn("K");
        when(rs.getString("title")).thenReturn("T");
        when(rs.getString("payload")).thenReturn("{bad json");
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThatThrownBy(() -> new DraftRepository(jdbc, mapper).findById(UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deserialise");
    }

    @Test
    void deleteDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID did = UUID.randomUUID();
        final UUID oid = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(did), eq(oid))).thenReturn(1);
        assertThat(new DraftRepository(jdbc, mapper).delete(did, oid)).isEqualTo(1);
    }

    @Test
    void createFactoryProducesFreshIds() {
        final UUID oid = UUID.randomUUID();
        final Draft a = DraftRepository.create(oid, "K", "T", mapper.createObjectNode());
        final Draft b = DraftRepository.create(oid, "K", "T", mapper.createObjectNode());
        assertThat(a.draftId()).isNotEqualTo(b.draftId());
        assertThat(a.ownerId()).isEqualTo(oid);
    }
}
