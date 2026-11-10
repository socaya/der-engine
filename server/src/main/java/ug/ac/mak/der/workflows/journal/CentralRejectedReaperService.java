package ug.ac.mak.der.workflows.journal;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * SM-4d — auto-retry window for {@code CENTRAL_REJECTED} rows.
 *
 * <p>Some central rejections resolve on their own: a concurrent
 * ACTIVE-enrolment clash whose other side gets completed, a
 * metadata-replication lag that catches up on the next pull, a
 * dependency-ordering collision whose parent lands after a retry.
 * Without this reaper such rows sit in the attention queue forever
 * even once the underlying condition clears.</p>
 *
 * <p>The reaper flips at most once per row: on first run the
 * {@code last_auto_retry_at} column is stamped, and future reaper
 * passes skip rows that already carry a stamp. If the row is
 * rejected a second time it stays terminal until a human reviews
 * it — avoiding infinite flip-flop loops for persistent errors
 * like {@code UID must be an alphanumeric string}.</p>
 */
@Service
public class CentralRejectedReaperService {

    private static final Logger LOG =
            LoggerFactory.getLogger(CentralRejectedReaperService.class);

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final boolean enabled;
    private final Duration coolDown;

    public CentralRejectedReaperService(
            final JdbcTemplate jdbc,
            final Clock clock,
            @Value("${der.journal.auto-retry-rejected.enabled:true}") final boolean enabled,
            @Value("${der.journal.auto-retry-rejected.cool-down:PT30M}") final Duration coolDown) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.enabled = enabled;
        this.coolDown = coolDown == null
                ? Duration.ofMinutes(30) : coolDown;
    }

    public int sweep() {
        if (!enabled) {
            return 0;
        }
        final Instant cutoff = Instant.now(clock).minus(coolDown);
        // Flip CENTRAL_REJECTED rows that:
        //  - have NOT already had an auto-retry (last_auto_retry_at IS NULL)
        //  - were last touched before `cutoff` (cool-down elapsed)
        //  - are NOT UID-shape errors (those need the migrate-UID
        //    action; otherwise we'd loop forever hitting the same
        //    UUID vs 11-char rejection).
        final int flipped = jdbc.update(
                "UPDATE der.operation_journal "
              + "SET state = 'PENDING', "
              + "    last_auto_retry_at = now(), "
              + "    next_attempt_at = NULL, "
              + "    updated_at = now() "
              + "WHERE state = 'CENTRAL_REJECTED' "
              + "  AND last_auto_retry_at IS NULL "
              + "  AND updated_at < ? "
              + "  AND (last_error IS NULL "
              + "       OR last_error NOT ILIKE '%UID must be an alphanumeric%')",
                java.sql.Timestamp.from(cutoff));
        if (flipped > 0) {
            LOG.info("auto-retried {} CENTRAL_REJECTED rows past "
                   + "the {} cool-down window", flipped, coolDown);
        }
        return flipped;
    }

    public boolean enabled() {
        return enabled;
    }

    public Duration coolDown() {
        return coolDown;
    }
}
