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

    /** §2.3.88 R-C/2.3 — scoped listing used by the cross-module
     *  Drafts chip filter from Workflow Monitoring. Null runId falls
     *  back to the full owner view. */
    public List<Draft> findByOwner(final UUID ownerId, final UUID workflowRunId) {
        if (workflowRunId == null) {
            return findByOwner(ownerId);
        }
        return jdbc.query(
                "SELECT draft_id, owner_id, kind, title, payload::text AS payload, "
                        + "created_at, updated_at FROM der.draft "
                        + "WHERE owner_id = ? AND workflow_run_id = ? "
                        + "ORDER BY updated_at DESC",
                rowMapper(), ownerId, workflowRunId);
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

    /**
     * E6 — mark a draft to be published automatically at or after
     * {@code publishAt}. Returns the number of rows updated: 0 means
     * either no such draft or owner mismatch (caller treats both as
     * 404). Caller is responsible for rejecting past timestamps —
     * the repository itself accepts whatever is handed to it so a
     * backfill or re-schedule for "the past" is still mechanically
     * possible if a controller intentionally allows it.
     */
    public int markScheduled(final UUID draftId, final UUID ownerId, final Instant publishAt) {
        Objects.requireNonNull(draftId, "draftId");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(publishAt, "publishAt");
        return jdbc.update(
                "UPDATE der.draft SET scheduled_publish_at = ? "
                        + "WHERE draft_id = ? AND owner_id = ?",
                Timestamp.from(publishAt), draftId, ownerId);
    }

    /** Cancel a pending schedule without deleting the draft itself. */
    public int clearSchedule(final UUID draftId, final UUID ownerId) {
        Objects.requireNonNull(draftId, "draftId");
        Objects.requireNonNull(ownerId, "ownerId");
        return jdbc.update(
                "UPDATE der.draft SET scheduled_publish_at = NULL "
                        + "WHERE draft_id = ? AND owner_id = ?",
                draftId, ownerId);
    }

    /**
     * Read-only variant used by the Quartz tick — the scheduler needs
     * {@code (draftId, ownerId, scheduledAt)} but not the full payload
     * which would be an expensive JSON parse per row.
     */
    public List<ScheduledDraftRef> findMaturedScheduled(final Instant now, final int limit) {
        Objects.requireNonNull(now, "now");
        final int capped = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT draft_id, owner_id, scheduled_publish_at FROM der.draft "
                        + "WHERE scheduled_publish_at IS NOT NULL "
                        + "  AND scheduled_publish_at <= ? "
                        + "ORDER BY scheduled_publish_at ASC "
                        + "LIMIT " + capped,
                (ResultSet rs, int row) -> new ScheduledDraftRef(
                        (UUID) rs.getObject("draft_id"),
                        (UUID) rs.getObject("owner_id"),
                        rs.getTimestamp("scheduled_publish_at").toInstant()),
                Timestamp.from(now));
    }

    /** Look up a single draft's current schedule timestamp (if any). */
    public Optional<Instant> findScheduledAt(final UUID draftId) {
        Objects.requireNonNull(draftId, "draftId");
        try {
            final Timestamp ts = jdbc.queryForObject(
                    "SELECT scheduled_publish_at FROM der.draft WHERE draft_id = ?",
                    Timestamp.class, draftId);
            return Optional.ofNullable(ts).map(Timestamp::toInstant);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Lightweight schedule row used by the Quartz tick. */
    public record ScheduledDraftRef(UUID draftId, UUID ownerId, Instant scheduledAt) { }

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
