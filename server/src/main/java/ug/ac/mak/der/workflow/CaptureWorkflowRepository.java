package ug.ac.mak.der.workflow;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * JDBC repository for the capture-workflow bundle (ADR-0018 slice A).
 * Reads + writes the full {@link CaptureWorkflow} graph.
 */
@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class CaptureWorkflowRepository {

    private final JdbcTemplate jdbc;

    public CaptureWorkflowRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<CaptureWorkflow> findAll() {
        final List<HeaderRow> headers = jdbc.query(
                "SELECT workflow_id, display_name, bound_metadata_kind, "
                        + "bound_metadata_id, enabled, version, created_at, updated_at, "
                        + "created_by FROM der.capture_workflow "
                        + "ORDER BY display_name ASC",
                headerMapper());
        final List<CaptureWorkflow> out = new ArrayList<>(headers.size());
        for (final HeaderRow h : headers) {
            out.add(hydrate(h));
        }
        return out;
    }

    public Optional<CaptureWorkflow> findById(final UUID workflowId) {
        if (workflowId == null) {
            return Optional.empty();
        }
        try {
            final HeaderRow h = jdbc.queryForObject(
                    "SELECT workflow_id, display_name, bound_metadata_kind, "
                            + "bound_metadata_id, enabled, version, created_at, updated_at, "
                            + "created_by FROM der.capture_workflow WHERE workflow_id = ?",
                    headerMapper(), workflowId);
            return Optional.of(hydrate(Objects.requireNonNull(h)));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<CaptureWorkflow> findEnabledForBinding(
            final CaptureWorkflow.BindingKind kind, final String metadataId) {
        if (kind == null || metadataId == null || metadataId.isBlank()) {
            return Optional.empty();
        }
        try {
            final HeaderRow h = jdbc.queryForObject(
                    "SELECT workflow_id, display_name, bound_metadata_kind, "
                            + "bound_metadata_id, enabled, version, created_at, updated_at, "
                            + "created_by FROM der.capture_workflow "
                            + "WHERE enabled = TRUE AND bound_metadata_kind = ? "
                            + "  AND bound_metadata_id = ? ORDER BY version DESC LIMIT 1",
                    headerMapper(), kind.name(), metadataId);
            return Optional.of(hydrate(Objects.requireNonNull(h)));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    @Transactional
    public CaptureWorkflow upsert(final CaptureWorkflow w) {
        Objects.requireNonNull(w, "w");
        final int rows = jdbc.update(
                "INSERT INTO der.capture_workflow "
                        + "(workflow_id, display_name, bound_metadata_kind, bound_metadata_id, "
                        + " enabled, version, created_at, updated_at, created_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (workflow_id) DO UPDATE SET "
                        + "  display_name = EXCLUDED.display_name, "
                        + "  bound_metadata_kind = EXCLUDED.bound_metadata_kind, "
                        + "  bound_metadata_id = EXCLUDED.bound_metadata_id, "
                        + "  enabled = EXCLUDED.enabled, "
                        + "  version = EXCLUDED.version, "
                        + "  updated_at = EXCLUDED.updated_at",
                w.workflowId(), w.displayName(), w.boundMetadataKind().name(),
                w.boundMetadataId(), w.enabled(), w.version(),
                Timestamp.from(w.createdAt() == null ? Instant.now() : w.createdAt()),
                Timestamp.from(w.updatedAt() == null ? Instant.now() : w.updatedAt()),
                w.createdBy());
        jdbc.update("DELETE FROM der.capture_workflow_step WHERE workflow_id = ?",
                w.workflowId());
        for (final CaptureWorkflowStep s : w.steps()) {
            jdbc.update(
                    "INSERT INTO der.capture_workflow_step "
                            + "(step_id, workflow_id, ordinal, display_name, owner_role, step_kind) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    s.stepId(), w.workflowId(), s.ordinal(), s.displayName(),
                    s.ownerRole().name(), s.stepKind().name());
            for (final CaptureWorkflowField f : s.fields()) {
                jdbc.update("INSERT INTO der.capture_workflow_field "
                                + "(step_id, field_ref, requirement) VALUES (?, ?, ?)",
                        s.stepId(), f.fieldRef(), f.requirement().name());
            }
        }
        for (final CaptureWorkflowDependency d : w.dependencies()) {
            jdbc.update("INSERT INTO der.capture_workflow_dependency "
                            + "(step_id, depends_on_step_id, dependency_kind) VALUES (?, ?, ?)",
                    d.stepId(), d.dependsOnStepId(), d.kind().name());
        }
        if (rows == 0) {
            throw new IllegalStateException("upsert returned 0 affected rows");
        }
        return w;
    }

    public int delete(final UUID workflowId) {
        if (workflowId == null) {
            return 0;
        }
        return jdbc.update("DELETE FROM der.capture_workflow WHERE workflow_id = ?",
                workflowId);
    }

    @Transactional
    public CaptureWorkflowRun insertRun(final CaptureWorkflowRun run) {
        Objects.requireNonNull(run, "run");
        jdbc.update(
                "INSERT INTO der.capture_workflow_run "
                        + "(run_id, workflow_id, workflow_version, business_key, "
                        + " current_step_id, state, created_at, updated_at, created_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                run.runId(), run.workflowId(), run.workflowVersion(), run.businessKey(),
                run.currentStepId(), run.state().name(),
                Timestamp.from(run.createdAt()),
                Timestamp.from(run.updatedAt()),
                run.createdBy());
        return run;
    }

    public List<CaptureWorkflowRun> findRuns(final UUID workflowId) {
        if (workflowId == null) {
            return List.of();
        }
        return jdbc.query(
                "SELECT run_id, workflow_id, workflow_version, business_key, "
                        + "current_step_id, state, created_at, updated_at, created_by "
                        + "FROM der.capture_workflow_run WHERE workflow_id = ? "
                        + "ORDER BY created_at DESC",
                runMapper(), workflowId);
    }

    public Optional<CaptureWorkflowRun> findRunByKey(final UUID workflowId,
                                                        final int workflowVersion,
                                                        final String businessKey) {
        if (workflowId == null || businessKey == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT run_id, workflow_id, workflow_version, business_key, "
                            + "current_step_id, state, created_at, updated_at, created_by "
                            + "FROM der.capture_workflow_run "
                            + "WHERE workflow_id = ? AND workflow_version = ? "
                            + "  AND business_key = ?",
                    runMapper(), workflowId, workflowVersion, businessKey));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    private CaptureWorkflow hydrate(final HeaderRow h) {
        final List<CaptureWorkflowStep> steps = jdbc.query(
                "SELECT step_id, workflow_id, ordinal, display_name, owner_role, step_kind "
                        + "FROM der.capture_workflow_step WHERE workflow_id = ? "
                        + "ORDER BY ordinal ASC",
                (ResultSet rs, int row) -> {
                    final UUID stepId = (UUID) rs.getObject("step_id");
                    final List<CaptureWorkflowField> fields = jdbc.query(
                            "SELECT step_id, field_ref, requirement "
                                    + "FROM der.capture_workflow_field WHERE step_id = ? "
                                    + "ORDER BY field_ref ASC",
                            (fr, fi) -> new CaptureWorkflowField(
                                    (UUID) fr.getObject("step_id"),
                                    fr.getString("field_ref"),
                                    CaptureWorkflowField.Requirement.valueOf(
                                            fr.getString("requirement"))),
                            stepId);
                    return new CaptureWorkflowStep(stepId,
                            (UUID) rs.getObject("workflow_id"),
                            rs.getInt("ordinal"),
                            rs.getString("display_name"),
                            CaptureWorkflowStep.OwnerRole.valueOf(rs.getString("owner_role")),
                            CaptureWorkflowStep.StepKind.valueOf(rs.getString("step_kind")),
                            fields);
                }, h.workflowId);
        final List<CaptureWorkflowDependency> deps = jdbc.query(
                "SELECT step_id, depends_on_step_id, dependency_kind "
                        + "FROM der.capture_workflow_dependency "
                        + "WHERE step_id IN (SELECT step_id FROM der.capture_workflow_step "
                        + "                  WHERE workflow_id = ?)",
                (ResultSet rs, int row) -> new CaptureWorkflowDependency(
                        (UUID) rs.getObject("step_id"),
                        (UUID) rs.getObject("depends_on_step_id"),
                        CaptureWorkflowDependency.Kind.valueOf(rs.getString("dependency_kind"))),
                h.workflowId);
        return new CaptureWorkflow(h.workflowId, h.displayName,
                CaptureWorkflow.BindingKind.valueOf(h.boundKind),
                h.boundId, h.enabled, h.version, h.createdAt, h.updatedAt, h.createdBy,
                steps, deps);
    }

    private RowMapper<HeaderRow> headerMapper() {
        return (ResultSet rs, int row) -> new HeaderRow(
                (UUID) rs.getObject("workflow_id"),
                rs.getString("display_name"),
                rs.getString("bound_metadata_kind"),
                rs.getString("bound_metadata_id"),
                rs.getBoolean("enabled"),
                rs.getInt("version"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                (UUID) rs.getObject("created_by"));
    }

    private RowMapper<CaptureWorkflowRun> runMapper() {
        return (ResultSet rs, int row) -> new CaptureWorkflowRun(
                (UUID) rs.getObject("run_id"),
                (UUID) rs.getObject("workflow_id"),
                rs.getInt("workflow_version"),
                rs.getString("business_key"),
                (UUID) rs.getObject("current_step_id"),
                CaptureWorkflowRun.State.valueOf(rs.getString("state")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                (UUID) rs.getObject("created_by"));
    }

    private record HeaderRow(UUID workflowId, String displayName, String boundKind,
                              String boundId, boolean enabled, int version,
                              Instant createdAt, Instant updatedAt, UUID createdBy) { }
}
