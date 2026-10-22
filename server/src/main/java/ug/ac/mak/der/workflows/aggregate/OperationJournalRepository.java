package ug.ac.mak.der.workflows.aggregate;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Repository for {@code der.operation_journal}. Phase 03.5 only inserts
 * PENDING rows alongside the actual business write; Phase 04 adds the
 * worker that transitions states and the backlog queries.
 */
@Repository
public class OperationJournalRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public OperationJournalRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public OperationJournalEntry insert(final OperationJournalEntry entry) {
        jdbc.update(
                "INSERT INTO der.operation_journal "
                        + "(operation_id, entity_type, entity_ref, payload_json, state, "
                        + " attempt_count, last_error, submitted_by, created_at, updated_at) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?)",
                entry.operationId(),
                entry.entityType().name(),
                entry.entityRef(),
                writeJson(entry.payload()),
                entry.state().name(),
                entry.attemptCount(),
                entry.lastError(),
                entry.submittedBy(),
                Timestamp.from(entry.createdAt()),
                Timestamp.from(entry.updatedAt())
        );
        return entry;
    }

    public Optional<OperationJournalEntry> findById(final UUID operationId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                            + "attempt_count, last_error, submitted_by, created_at, updated_at "
                            + "FROM der.operation_journal WHERE operation_id = ?",
                    rowMapper(),
                    operationId
            ));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<OperationJournalEntry> findPending(final int limit) {
        return findByState(OperationJournalEntry.State.PENDING, limit);
    }

    public List<OperationJournalEntry> findByState(final OperationJournalEntry.State state,
                                                    final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT operation_id, entity_type, entity_ref, payload_json, state, "
                        + "attempt_count, last_error, submitted_by, created_at, updated_at "
                        + "FROM der.operation_journal WHERE state = ? "
                        + "ORDER BY created_at ASC LIMIT ?",
                rowMapper(),
                state.name(),
                capped
        );
    }

    public int countByState(final OperationJournalEntry.State state) {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.operation_journal WHERE state = ?",
                Integer.class,
                state.name()
        );
        return n == null ? 0 : n;
    }

    private String writeJson(final JsonNode node) {
        try {
            return json.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialise journal payload", ex);
        }
    }

    private JsonNode readJson(final String raw) {
        try {
            return json.readTree(raw);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to parse journal payload", ex);
        }
    }

    private RowMapper<OperationJournalEntry> rowMapper() {
        return (ResultSet rs, int rowNum) -> new OperationJournalEntry(
                rs.getObject("operation_id", UUID.class),
                OperationJournalEntry.EntityType.valueOf(rs.getString("entity_type")),
                rs.getString("entity_ref"),
                readJson(rs.getString("payload_json")),
                OperationJournalEntry.State.valueOf(rs.getString("state")),
                rs.getInt("attempt_count"),
                rs.getString("last_error"),
                rs.getObject("submitted_by", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }
}
