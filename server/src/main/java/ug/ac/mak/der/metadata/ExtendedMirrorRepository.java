package ug.ac.mak.der.metadata;

import java.io.IOException;
import java.sql.ResultSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 03.6b additions to the metadata mirror.
 *
 * <p>Companion to {@link MetadataMirrorRepository}; separated so the Phase 02/03
 * repository stays stable and the Phase 03.6b entity types (COC, program
 * stages, program-stage data elements, tracked-entity attributes, program
 * rules + actions) can evolve independently.</p>
 */
@Repository
public class ExtendedMirrorRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public ExtendedMirrorRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    // Category option combos ----------------------------------------------

    @Transactional
    public int upsertCategoryOptionCombos(final List<MirroredCategoryOptionCombo> rows,
                                           final long snapshotId) {
        for (final MirroredCategoryOptionCombo r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_category_option_combo "
                            + "(dhis2_uid, display_name, category_combo_uid, payload, "
                            + " snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, "
                            + "category_combo_uid = EXCLUDED.category_combo_uid, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.categoryComboUid(),
                    writeJson(r.payload()), snapshotId);
        }
        return rows.size();
    }

    public boolean categoryOptionComboExists(final String uid) {
        final Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.metadata_category_option_combo WHERE dhis2_uid = ?",
                Integer.class, uid);
        return count != null && count > 0;
    }

    // Program stages ------------------------------------------------------

    @Transactional
    public int upsertProgramStages(final List<MirroredProgramStage> rows, final long snapshotId) {
        for (final MirroredProgramStage r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_program_stage "
                            + "(dhis2_uid, program_uid, display_name, repeatable, payload, "
                            + " snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "program_uid = EXCLUDED.program_uid, "
                            + "display_name = EXCLUDED.display_name, "
                            + "repeatable = EXCLUDED.repeatable, payload = EXCLUDED.payload, "
                            + "snapshot_id = EXCLUDED.snapshot_id, last_seen_at = now()",
                    r.dhis2Uid(), r.programUid(), r.displayName(), r.repeatable(),
                    writeJson(r.payload()), snapshotId);
            jdbc.update(
                    "DELETE FROM der.metadata_program_stage_data_element "
                            + "WHERE program_stage_uid = ?", r.dhis2Uid());
            for (final MirroredProgramStage.ProgramStageDataElement psde : r.dataElements()) {
                jdbc.update(
                        "INSERT INTO der.metadata_program_stage_data_element "
                                + "(program_stage_uid, data_element_uid, compulsory, sort_order) "
                                + "VALUES (?, ?, ?, ?)",
                        r.dhis2Uid(), psde.dataElementUid(), psde.compulsory(), psde.sortOrder());
            }
        }
        return rows.size();
    }

    public Optional<MirroredProgramStage> findProgramStage(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, program_uid, display_name, repeatable, payload "
                        + "FROM der.metadata_program_stage WHERE dhis2_uid = ?",
                programStageMapper(), uid));
    }

    public List<MirroredProgramStage.ProgramStageDataElement> findProgramStageDataElements(
            final String programStageUid) {
        return jdbc.query(
                "SELECT data_element_uid, compulsory, sort_order "
                        + "FROM der.metadata_program_stage_data_element "
                        + "WHERE program_stage_uid = ? "
                        + "ORDER BY COALESCE(sort_order, 0)",
                (ResultSet rs, int row) -> new MirroredProgramStage.ProgramStageDataElement(
                        rs.getString("data_element_uid"),
                        rs.getBoolean("compulsory"),
                        (Integer) rs.getObject("sort_order")),
                programStageUid);
    }

    // Tracked entity attributes -------------------------------------------

    @Transactional
    public int upsertTrackedEntityAttributes(final List<MirroredTrackedEntityAttribute> rows,
                                              final long snapshotId) {
        for (final MirroredTrackedEntityAttribute r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_tracked_entity_attribute "
                            + "(dhis2_uid, display_name, value_type, unique_attribute, payload, "
                            + " snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, "
                            + "value_type = EXCLUDED.value_type, "
                            + "unique_attribute = EXCLUDED.unique_attribute, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.valueType(), r.uniqueAttribute(),
                    writeJson(r.payload()), snapshotId);
        }
        return rows.size();
    }

    public Optional<MirroredTrackedEntityAttribute> findTrackedEntityAttribute(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, value_type, unique_attribute, payload "
                        + "FROM der.metadata_tracked_entity_attribute WHERE dhis2_uid = ?",
                trackedEntityAttributeMapper(), uid));
    }

    // Program rules + actions ---------------------------------------------

    @Transactional
    public int upsertProgramRules(final List<MirroredProgramRule> rules, final long snapshotId) {
        for (final MirroredProgramRule r : rules) {
            jdbc.update(
                    "INSERT INTO der.metadata_program_rule "
                            + "(dhis2_uid, program_uid, display_name, priority, condition, "
                            + " payload, snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "program_uid = EXCLUDED.program_uid, "
                            + "display_name = EXCLUDED.display_name, "
                            + "priority = EXCLUDED.priority, condition = EXCLUDED.condition, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.programUid(), r.displayName(), r.priority(),
                    r.condition(), writeJson(r.payload()), snapshotId);
            jdbc.update("DELETE FROM der.metadata_program_rule_action WHERE program_rule_uid = ?",
                    r.dhis2Uid());
            for (final MirroredProgramRuleAction a : r.actions()) {
                jdbc.update(
                        "INSERT INTO der.metadata_program_rule_action "
                                + "(dhis2_uid, program_rule_uid, action_type, "
                                + " data_element_uid, tracked_entity_attribute_uid, "
                                + " data_expression, content, payload, snapshot_id, "
                                + " imported_at, last_seen_at) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now())",
                        a.dhis2Uid(), r.dhis2Uid(), a.actionType(),
                        a.dataElementUid(), a.trackedEntityAttributeUid(),
                        a.dataExpression(), a.content(),
                        writeJson(a.payload()), snapshotId);
            }
        }
        return rules.size();
    }

    public List<MirroredProgramRule> findRulesByProgram(final String programUid) {
        final List<MirroredProgramRule> rules = jdbc.query(
                "SELECT dhis2_uid, program_uid, display_name, priority, condition, payload "
                        + "FROM der.metadata_program_rule WHERE program_uid = ? "
                        + "ORDER BY COALESCE(priority, 0) DESC",
                ruleMapper(), programUid);
        for (int i = 0; i < rules.size(); i++) {
            final MirroredProgramRule r = rules.get(i);
            final List<MirroredProgramRuleAction> actions = jdbc.query(
                    "SELECT dhis2_uid, program_rule_uid, action_type, data_element_uid, "
                            + "tracked_entity_attribute_uid, data_expression, content, payload "
                            + "FROM der.metadata_program_rule_action WHERE program_rule_uid = ?",
                    actionMapper(), r.dhis2Uid());
            rules.set(i, new MirroredProgramRule(r.dhis2Uid(), r.programUid(), r.displayName(),
                    r.priority(), r.condition(), actions, r.payload()));
        }
        return rules;
    }

    // Row mappers ---------------------------------------------------------

    private RowMapper<MirroredProgramStage> programStageMapper() {
        return (ResultSet rs, int row) -> new MirroredProgramStage(
                rs.getString("dhis2_uid"), rs.getString("program_uid"),
                rs.getString("display_name"), rs.getBoolean("repeatable"),
                List.of(), readJson(rs.getString("payload")));
    }

    private RowMapper<MirroredTrackedEntityAttribute> trackedEntityAttributeMapper() {
        return (ResultSet rs, int row) -> new MirroredTrackedEntityAttribute(
                rs.getString("dhis2_uid"), rs.getString("display_name"),
                rs.getString("value_type"), rs.getBoolean("unique_attribute"),
                readJson(rs.getString("payload")));
    }

    private RowMapper<MirroredProgramRule> ruleMapper() {
        return (ResultSet rs, int row) -> new MirroredProgramRule(
                rs.getString("dhis2_uid"), rs.getString("program_uid"),
                rs.getString("display_name"), (Integer) rs.getObject("priority"),
                rs.getString("condition"), List.of(),
                readJson(rs.getString("payload")));
    }

    private RowMapper<MirroredProgramRuleAction> actionMapper() {
        return (ResultSet rs, int row) -> new MirroredProgramRuleAction(
                rs.getString("dhis2_uid"), rs.getString("program_rule_uid"),
                rs.getString("action_type"), rs.getString("data_element_uid"),
                rs.getString("tracked_entity_attribute_uid"), rs.getString("data_expression"),
                rs.getString("content"), readJson(rs.getString("payload")));
    }

    // Helpers -------------------------------------------------------------

    private String writeJson(final JsonNode node) {
        try {
            return node == null ? "{}" : json.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to serialise payload JSON", ex);
        }
    }

    private JsonNode readJson(final String s) {
        try {
            return s == null ? json.createObjectNode() : json.readTree(s);
        } catch (IOException ex) {
            throw new IllegalStateException("failed to deserialise payload JSON", ex);
        }
    }

    private static <T> Optional<T> single(final SupplierThrowing<T> q) {
        try {
            return Optional.ofNullable(q.get());
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    @FunctionalInterface
    private interface SupplierThrowing<T> {
        T get() throws EmptyResultDataAccessException;
    }
}
