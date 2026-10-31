package ug.ac.mak.der.workflow;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * §37–§42 — workflow pinning to a metadata snapshot. A pinned
 * workflow continues to resolve its metadata (field candidates, rule
 * variables, program rules) against the snapshot it was last known
 * to work with, even when upstream DHIS2 drifts.
 *
 * Reads + writes {@code capture_workflow.pinned_snapshot_id}
 * (migration V059). Null means "float with the live mirror" — the
 * historical behaviour.
 */
@Service
public class WorkflowPinningService {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowPinningService.class);

    private final JdbcTemplate jdbc;

    public WorkflowPinningService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Optional<Long> getPinnedSnapshot(final UUID workflowId) {
        try {
            final Long id = jdbc.queryForObject(
                    "SELECT pinned_snapshot_id FROM der.capture_workflow WHERE workflow_id = ?",
                    Long.class, workflowId);
            return Optional.ofNullable(id);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Pin a workflow to the given snapshot. {@code null} unpins. */
    public void pin(final UUID workflowId, final Long snapshotId, final UUID actor) {
        final int rows = jdbc.update(
                "UPDATE der.capture_workflow SET pinned_snapshot_id = ?, updated_at = now() "
                        + "WHERE workflow_id = ?",
                snapshotId, workflowId);
        if (rows == 0) {
            throw new IllegalArgumentException("workflow not found: " + workflowId);
        }
        LOG.info("workflow {} pinned to snapshot {} by {}", workflowId, snapshotId, actor);
    }
}
