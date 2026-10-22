package ug.ac.mak.der.workflows.drafts;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
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

@Repository
public class DraftRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public DraftRepository(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public Draft upsert(final Draft in) {
        final String payload = writeJson(in.payload());
        jdbc.update(
                "INSERT INTO der.draft (draft_id, owner_id, kind, title, payload, "
                        + "created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, now()) "
                        + "ON CONFLICT (draft_id) DO UPDATE SET "
                        + "kind = EXCLUDED.kind, title = EXCLUDED.title, "
                        + "payload = EXCLUDED.payload, updated_at = now()",
                in.draftId(), in.ownerId(), in.kind(), in.title(), payload,
                Timestamp.from(in.createdAt()));
        return in;
    }

    public List<Draft> findByOwner(final UUID ownerId) {
        return jdbc.query(
                "SELECT draft_id, owner_id, kind, title, payload::text AS payload, "
                        + "created_at, updated_at FROM der.draft "
                        + "WHERE owner_id = ? ORDER BY updated_at DESC",
                rowMapper(), ownerId);
    }

    public Optional<Draft> findById(final UUID draftId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT draft_id, owner_id, kind, title, payload::text AS payload, "
                            + "created_at, updated_at FROM der.draft WHERE draft_id = ?",
                    rowMapper(), draftId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int delete(final UUID draftId, final UUID ownerId) {
        return jdbc.update("DELETE FROM der.draft WHERE draft_id = ? AND owner_id = ?",
                draftId, ownerId);
    }

    private RowMapper<Draft> rowMapper() {
        return (ResultSet rs, int row) -> new Draft(
                (UUID) rs.getObject("draft_id"),
                (UUID) rs.getObject("owner_id"),
                rs.getString("kind"),
                rs.getString("title"),
                readJson(rs.getString("payload")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    private String writeJson(final JsonNode node) {
        try {
            return node == null ? "{}" : mapper.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to serialise draft payload", ex);
        }
    }

    private JsonNode readJson(final String s) {
        try {
            return s == null ? mapper.createObjectNode() : mapper.readTree(s);
        } catch (IOException ex) {
            throw new IllegalStateException("failed to deserialise draft payload", ex);
        }
    }

    /** Convenience factory used by DraftController. */
    public static Draft create(final UUID ownerId, final String kind, final String title,
                                final JsonNode payload) {
        final Instant now = Instant.now();
        return new Draft(UUID.randomUUID(), ownerId, kind, title, payload, now, now);
    }
}
