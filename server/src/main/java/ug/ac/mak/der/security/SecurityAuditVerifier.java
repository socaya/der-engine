package ug.ac.mak.der.security;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * ADR-0021 D-AUD-4. Verifies the {@code security_audit} hash chain by
 * recomputing {@code prev_hash} and {@code row_hash} in Postgres (same
 * canonical function used by the BEFORE INSERT trigger). Reports the
 * first break (if any) and halts.
 */
@Component
@ConditionalOnBean(JdbcTemplate.class)
public class SecurityAuditVerifier {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityAuditVerifier.class);
    static final int MAX_ROWS = 500_000;

    private static final String VERIFY_SQL = ""
            + "WITH walk AS ("
            + "  SELECT audit_id, prev_hash, row_hash,"
            + "         der.security_audit_canonical_body("
            + "             event_type, actor_user_id, subject_user_id, client_ip,"
            + "             user_agent, outcome, detail, observed_at) AS body,"
            + "         lag(row_hash) OVER (ORDER BY audit_id) AS actual_prev"
            + "    FROM der.security_audit"
            + "   ORDER BY audit_id"
            + "   LIMIT " + MAX_ROWS
            + "), checked AS ("
            + "  SELECT audit_id, prev_hash, row_hash,"
            + "         coalesce(actual_prev, decode(repeat('00', 32), 'hex')) AS expected_prev,"
            + "         digest(coalesce(actual_prev, decode(repeat('00', 32), 'hex')) || body,"
            + "                'sha256') AS expected_row_hash"
            + "    FROM walk"
            + ") "
            + "SELECT audit_id, "
            + "       CASE "
            + "         WHEN prev_hash IS DISTINCT FROM expected_prev THEN 'PREV_HASH_MISMATCH' "
            + "         WHEN row_hash  IS DISTINCT FROM expected_row_hash THEN 'ROW_HASH_MISMATCH' "
            + "       END AS reason "
            + "  FROM checked "
            + " WHERE prev_hash IS DISTINCT FROM expected_prev "
            + "    OR row_hash  IS DISTINCT FROM expected_row_hash "
            + " ORDER BY audit_id ASC LIMIT 1";

    private static final String COUNT_SQL =
            "SELECT count(*) FROM der.security_audit";

    private final JdbcTemplate jdbc;

    public SecurityAuditVerifier(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Result verify() {
        final Long total = jdbc.queryForObject(COUNT_SQL, Long.class);
        final long totalRows = total == null ? 0L : total;
        final Break firstBreak = jdbc.query(VERIFY_SQL, rs ->
                rs.next() ? new Break(rs.getLong("audit_id"),
                        Reason.valueOf(rs.getString("reason"))) : null);
        if (firstBreak != null) {
            LOG.warn("audit chain break detected at audit_id={} reason={}",
                    firstBreak.auditId(), firstBreak.reason());
        }
        return new Result(firstBreak == null, totalRows, firstBreak);
    }

    public enum Reason { PREV_HASH_MISMATCH, ROW_HASH_MISMATCH }

    public record Break(long auditId, Reason reason) { }

    public record Result(boolean ok, long totalRows, Break firstBreak) { }
}
