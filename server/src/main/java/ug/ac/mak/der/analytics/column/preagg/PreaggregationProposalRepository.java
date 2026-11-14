package ug.ac.mak.der.analytics.column.preagg;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer for {@code der.analytics_preagg_proposal} (V119). All
 * writes funnel through {@link PreaggregationProposalService}; the
 * repository is deliberately thin so transitional logic stays in one
 * place.
 */
@Repository
public class PreaggregationProposalRepository {

    private final JdbcTemplate jdbc;

    public PreaggregationProposalRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public UUID insert(final PreaggregationProposalRecord r) {
        Objects.requireNonNull(r, "record");
        jdbc.update(
                "INSERT INTO der.analytics_preagg_proposal ("
              + "  proposal_id, shape_key, observations, "
              + "  avg_elapsed_millis, score, estimated_bytes, "
              + "  first_observed_at, last_observed_at, rationale, "
              + "  state, decision_reason, decided_by, decided_at, "
              + "  created_at, updated_at) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                r.proposalId(), r.shapeKey(), r.observations(),
                r.avgElapsedMillis(), r.score(), r.estimatedBytes(),
                Timestamp.from(r.firstObservedAt()),
                Timestamp.from(r.lastObservedAt()),
                r.rationale(), r.state().name(),
                r.decisionReason(), r.decidedBy(),
                r.decidedAt() == null ? null
                        : Timestamp.from(r.decidedAt()),
                Timestamp.from(r.createdAt()),
                Timestamp.from(r.updatedAt()));
        return r.proposalId();
    }

    public Optional<PreaggregationProposalRecord> findById(final UUID id) {
        Objects.requireNonNull(id, "proposalId");
        try {
            return Optional.of(jdbc.queryForObject(
                    "SELECT * FROM der.analytics_preagg_proposal "
                  + " WHERE proposal_id = ?",
                    rowMapper(), id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<PreaggregationProposalRecord> findOpenByShape(
            final String shapeKey) {
        Objects.requireNonNull(shapeKey, "shapeKey");
        try {
            return Optional.of(jdbc.queryForObject(
                    "SELECT * FROM der.analytics_preagg_proposal "
                  + " WHERE shape_key = ? "
                  + "   AND state IN ('PROPOSED', 'APPROVED')",
                    rowMapper(), shapeKey));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<PreaggregationProposalRecord> listByState(
            final PreaggregationProposalRecord.State state,
            final int limit) {
        if (state == null) {
            return jdbc.query(
                    "SELECT * FROM der.analytics_preagg_proposal "
                  + " ORDER BY score DESC, created_at DESC "
                  + " LIMIT ?",
                    rowMapper(), Math.max(1, limit));
        }
        return jdbc.query(
                "SELECT * FROM der.analytics_preagg_proposal "
              + " WHERE state = ? "
              + " ORDER BY score DESC, created_at DESC "
              + " LIMIT ?",
                rowMapper(), state.name(), Math.max(1, limit));
    }

    public int refreshMeasurements(final UUID proposalId,
                                      final long observations,
                                      final double avgElapsedMillis,
                                      final double score,
                                      final long estimatedBytes,
                                      final Instant lastObservedAt,
                                      final String rationale) {
        return jdbc.update(
                "UPDATE der.analytics_preagg_proposal "
              + "   SET observations = ?, avg_elapsed_millis = ?, "
              + "       score = ?, estimated_bytes = ?, "
              + "       last_observed_at = ?, rationale = ?, "
              + "       updated_at = now() "
              + " WHERE proposal_id = ? AND state = 'PROPOSED'",
                observations, avgElapsedMillis, score, estimatedBytes,
                Timestamp.from(lastObservedAt),
                rationale == null ? "" : rationale,
                proposalId);
    }

    public int transition(final UUID proposalId,
                              final PreaggregationProposalRecord.State target,
                              final UUID decidedBy,
                              final String decisionReason) {
        return jdbc.update(
                "UPDATE der.analytics_preagg_proposal "
              + "   SET state = ?, decided_by = ?, "
              + "       decision_reason = ?, decided_at = now(), "
              + "       updated_at = now() "
              + " WHERE proposal_id = ? "
              + "   AND state IN ('PROPOSED', 'APPROVED')",
                new Object[] {
                        target.name(), decidedBy, decisionReason, proposalId
                },
                new int[] {
                        Types.VARCHAR, Types.OTHER, Types.VARCHAR,
                        Types.OTHER
                });
    }

    private static RowMapper<PreaggregationProposalRecord> rowMapper() {
        return (rs, rn) -> new PreaggregationProposalRecord(
                UUID.fromString(rs.getString("proposal_id")),
                rs.getString("shape_key"),
                rs.getLong("observations"),
                rs.getDouble("avg_elapsed_millis"),
                rs.getDouble("score"),
                rs.getLong("estimated_bytes"),
                rs.getTimestamp("first_observed_at").toInstant(),
                rs.getTimestamp("last_observed_at").toInstant(),
                rs.getString("rationale"),
                PreaggregationProposalRecord.State.valueOf(
                        rs.getString("state")),
                rs.getString("decision_reason"),
                rs.getString("decided_by") == null ? null
                        : UUID.fromString(rs.getString("decided_by")),
                rs.getTimestamp("decided_at") == null ? null
                        : rs.getTimestamp("decided_at").toInstant(),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}
