package ug.ac.mak.der.sync.policy;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Reads + writes {@link SyncPolicy} rows. Pure JDBC — no caching
 *  at this layer; cache lives in {@link SyncPolicyService}. */
@Repository
public class SyncPolicyRepository {

    private final JdbcTemplate jdbc;

    public SyncPolicyRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<SyncPolicy> findAll() {
        return jdbc.query(
                "SELECT scope, mode, schedule_cron, paused_reason, "
              + "       updated_by, updated_at "
              + "FROM sync_policy ORDER BY scope",
                ROW_MAPPER);
    }

    public Optional<SyncPolicy> findByScope(final String scope) {
        Objects.requireNonNull(scope, "scope");
        final List<SyncPolicy> rows = jdbc.query(
                "SELECT scope, mode, schedule_cron, paused_reason, "
              + "       updated_by, updated_at "
              + "FROM sync_policy WHERE scope = ?",
                ROW_MAPPER, scope);
        return rows.isEmpty() ? Optional.empty()
                : Optional.of(rows.get(0));
    }

    public SyncPolicy upsert(final SyncPolicy p) {
        Objects.requireNonNull(p, "policy");
        jdbc.update(
                "INSERT INTO sync_policy "
              + "  (scope, mode, schedule_cron, paused_reason, "
              + "   updated_by, updated_at) "
              + "VALUES (?, ?, ?, ?, ?, ?) "
              + "ON CONFLICT (scope) DO UPDATE SET "
              + "  mode          = EXCLUDED.mode, "
              + "  schedule_cron = EXCLUDED.schedule_cron, "
              + "  paused_reason = EXCLUDED.paused_reason, "
              + "  updated_by    = EXCLUDED.updated_by, "
              + "  updated_at    = EXCLUDED.updated_at",
                p.scope(),
                p.mode().name(),
                p.scheduleCron(),
                p.pausedReason(),
                p.updatedBy(),
                OffsetDateTime.ofInstant(p.updatedAt(),
                        java.time.ZoneOffset.UTC));
        return p;
    }

    public int deleteByScope(final String scope) {
        Objects.requireNonNull(scope, "scope");
        if ("GLOBAL".equals(scope)) {
            throw new IllegalArgumentException(
                    "GLOBAL policy cannot be deleted (reset mode instead)");
        }
        return jdbc.update(
                "DELETE FROM sync_policy WHERE scope = ?", scope);
    }

    private static final RowMapper<SyncPolicy> ROW_MAPPER = (rs, i) -> {
        final UUID actor = (UUID) rs.getObject("updated_by");
        final Instant ts = rs.getObject("updated_at",
                OffsetDateTime.class).toInstant();
        return new SyncPolicy(
                rs.getString("scope"),
                SyncPolicyMode.valueOf(rs.getString("mode")),
                rs.getString("schedule_cron"),
                rs.getString("paused_reason"),
                actor, ts);
    };
}
