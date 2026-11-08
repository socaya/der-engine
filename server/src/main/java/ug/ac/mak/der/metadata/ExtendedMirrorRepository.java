package ug.ac.mak.der.metadata;

import java.io.IOException;
import java.sql.ResultSet;
import java.util.ArrayList;
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

    /** ADR-0036 — one-shot lookup used by the capture form API. */
    public Optional<MirroredCategoryOptionCombo> findCategoryOptionCombo(final String uid) {
        if (uid == null || uid.isBlank()) {
            return Optional.empty();
        }
        try {
            final MirroredCategoryOptionCombo row = jdbc.queryForObject(
                    "SELECT dhis2_uid, display_name, category_combo_uid, payload "
                            + "FROM der.metadata_category_option_combo WHERE dhis2_uid = ?",
                    categoryOptionComboMapper(), uid);
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    RowMapper<MirroredCategoryOptionCombo> categoryOptionComboMapper() {
        return (ResultSet rs, int rowNum) -> {
            final JsonNode payload;
            try {
                payload = json.readTree(rs.getString("payload"));
            } catch (IOException ex) {
                throw new IllegalStateException(
                        "metadata_category_option_combo.payload is not JSON", ex);
            }
            return new MirroredCategoryOptionCombo(
                    rs.getString("dhis2_uid"),
                    rs.getString("display_name"),
                    rs.getString("category_combo_uid"),
                    payload);
        };
    }

    // Program stages ------------------------------------------------------

    @Transactional
    public int upsertProgramStages(final List<MirroredProgramStage> rows, final long snapshotId) {
        for (final MirroredProgramStage r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_program_stage "
                            + "(dhis2_uid, program_uid, display_name, repeatable, "
                            + " form_type, data_entry_form_html, payload, "
                            + " snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "program_uid = EXCLUDED.program_uid, "
                            + "display_name = EXCLUDED.display_name, "
                            + "repeatable = EXCLUDED.repeatable, "
                            + "form_type = EXCLUDED.form_type, "
                            + "data_entry_form_html = EXCLUDED.data_entry_form_html, "
                            + "payload = EXCLUDED.payload, "
                            + "snapshot_id = EXCLUDED.snapshot_id, last_seen_at = now()",
                    r.dhis2Uid(), r.programUid(), r.displayName(), r.repeatable(),
                    r.formType(), r.dataEntryFormHtml(),
                    writeJson(r.payload()), snapshotId);
            jdbc.update(
                    "DELETE FROM der.metadata_program_stage_data_element "
                            + "WHERE program_stage_uid = ?", r.dhis2Uid());
            for (final MirroredProgramStage.ProgramStageDataElement psde : r.dataElements()) {
                jdbc.update(
                        "INSERT INTO der.metadata_program_stage_data_element "
                                + "(program_stage_uid, data_element_uid, compulsory, "
                                + " sort_order, render_type_desktop, render_type_mobile) "
                                + "VALUES (?, ?, ?, ?, ?, ?)",
                        r.dhis2Uid(), psde.dataElementUid(), psde.compulsory(),
                        psde.sortOrder(),
                        psde.renderTypeDesktop(), psde.renderTypeMobile());
            }
            // Sections are owned by the stage; wipe + reinsert so a
            // removed section in the latest DHIS2 metadata vanishes
            // from the mirror on the next sync.
            jdbc.update(
                    "DELETE FROM der.metadata_program_stage_section "
                            + "WHERE program_stage_uid = ?", r.dhis2Uid());
            for (final MirroredProgramStageSection sec : r.sections()) {
                jdbc.update(
                        "INSERT INTO der.metadata_program_stage_section "
                                + "(dhis2_uid, program_stage_uid, display_name, "
                                + " sort_order, render_type_desktop, render_type_mobile, "
                                + " payload, snapshot_id, imported_at, last_seen_at) "
                                + "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), "
                                + " ?, now(), now())",
                        sec.dhis2Uid(), sec.programStageUid(), sec.displayName(),
                        sec.sortOrder(), sec.renderTypeDesktop(), sec.renderTypeMobile(),
                        writeJson(sec.payload()), snapshotId);
                int idx = 0;
                for (final String deUid : sec.dataElementUids()) {
                    jdbc.update(
                            "INSERT INTO der.metadata_program_stage_section_data_element "
                                    + "(section_uid, data_element_uid, sort_order) "
                                    + "VALUES (?, ?, ?)",
                            sec.dhis2Uid(), deUid, idx++);
                }
            }
        }
        return rows.size();
    }

    public Optional<MirroredProgramStage> findProgramStage(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, program_uid, display_name, repeatable, "
                        + " form_type, data_entry_form_html, payload "
                        + "FROM der.metadata_program_stage WHERE dhis2_uid = ?",
                programStageMapper(), uid));
    }

    /** ADR-0036 phase 2 — list every mirrored stage belonging to a
     *  program, ordered by the stage's {@code sortOrder} payload
     *  field (defaulting to 0 when missing). The stage's own
     *  dataElements are not hydrated here — callers wanting field
     *  rows call {@link #findProgramStageDataElements(String)}. */
    public List<MirroredProgramStage> listProgramStagesForProgram(final String programUid) {
        if (programUid == null || programUid.isBlank()) {
            return List.of();
        }
        return jdbc.query(
                "SELECT dhis2_uid, program_uid, display_name, repeatable, "
                        + " form_type, data_entry_form_html, payload "
                        + "FROM der.metadata_program_stage "
                        + "WHERE program_uid = ? "
                        + "ORDER BY display_name",
                programStageMapper(), programUid);
    }

    public List<MirroredProgramStage.ProgramStageDataElement> findProgramStageDataElements(
            final String programStageUid) {
        return jdbc.query(
                "SELECT data_element_uid, compulsory, sort_order, "
                        + " render_type_desktop, render_type_mobile "
                        + "FROM der.metadata_program_stage_data_element "
                        + "WHERE program_stage_uid = ? "
                        + "ORDER BY COALESCE(sort_order, 0)",
                (ResultSet rs, int row) -> new MirroredProgramStage.ProgramStageDataElement(
                        rs.getString("data_element_uid"),
                        rs.getBoolean("compulsory"),
                        (Integer) rs.getObject("sort_order"),
                        rs.getString("render_type_desktop"),
                        rs.getString("render_type_mobile")),
                programStageUid);
    }

    /** Fetch the mirrored sections for a stage, ordered by
     *  sortOrder. Each row carries a cached list of data-element
     *  UIDs in the order the admin configured within the section
     *  (preserving DHIS2's within-section order). CaptureFormService
     *  uses this to emit per-section FormAssembly instead of the
     *  pre-Phase-1 lumped single-section fallback. */
    public List<MirroredProgramStageSection> findProgramStageSections(
            final String programStageUid) {
        final List<MirroredProgramStageSection> secs = jdbc.query(
                "SELECT dhis2_uid, program_stage_uid, display_name, sort_order, "
                        + " render_type_desktop, render_type_mobile, payload "
                        + "FROM der.metadata_program_stage_section "
                        + "WHERE program_stage_uid = ? "
                        + "ORDER BY COALESCE(sort_order, 0), display_name",
                (ResultSet rs, int row) -> new MirroredProgramStageSection(
                        rs.getString("dhis2_uid"),
                        rs.getString("program_stage_uid"),
                        rs.getString("display_name"),
                        (Integer) rs.getObject("sort_order"),
                        rs.getString("render_type_desktop"),
                        rs.getString("render_type_mobile"),
                        List.of(),
                        readJson(rs.getString("payload"))),
                programStageUid);
        final List<MirroredProgramStageSection> out = new ArrayList<>(secs.size());
        for (final MirroredProgramStageSection sec : secs) {
            final List<String> des = jdbc.query(
                    "SELECT data_element_uid "
                            + "FROM der.metadata_program_stage_section_data_element "
                            + "WHERE section_uid = ? "
                            + "ORDER BY COALESCE(sort_order, 0)",
                    (ResultSet rs, int row) -> rs.getString("data_element_uid"),
                    sec.dhis2Uid());
            out.add(new MirroredProgramStageSection(sec.dhis2Uid(),
                    sec.programStageUid(), sec.displayName(), sec.sortOrder(),
                    sec.renderTypeDesktop(), sec.renderTypeMobile(),
                    des, sec.payload()));
        }
        return out;
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

    /** ADR-0036 phase 3 — list every mirrored TEA, ordered by name. */
    public List<MirroredTrackedEntityAttribute> findAllTrackedEntityAttributes() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, value_type, unique_attribute, payload "
                        + "FROM der.metadata_tracked_entity_attribute "
                        + "ORDER BY display_name",
                trackedEntityAttributeMapper());
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
        return findRulesByProgramInSnapshot(programUid, null);
    }

    /**
     * §2.3.26 — pin-aware rule lookup. When {@code snapshotId != null}
     * we only match rows whose {@code snapshot_id} equals the pin.
     * The mirror's upsert-overwrite semantics mean rows carry only the
     * latest snapshot_id they were touched by, so this returns an
     * empty list once the pin becomes stale (the caller then falls
     * back to the unpinned query via {@link #findRulesByProgram}).
     */
    public List<MirroredProgramRule> findRulesByProgramInSnapshot(
            final String programUid, final Long snapshotId) {
        final String sql = snapshotId == null
                ? "SELECT dhis2_uid, program_uid, display_name, priority, condition, payload "
                        + "FROM der.metadata_program_rule WHERE program_uid = ? "
                        + "ORDER BY COALESCE(priority, 0) DESC"
                : "SELECT dhis2_uid, program_uid, display_name, priority, condition, payload "
                        + "FROM der.metadata_program_rule "
                        + "WHERE program_uid = ? AND snapshot_id = ? "
                        + "ORDER BY COALESCE(priority, 0) DESC";
        final List<MirroredProgramRule> rules = snapshotId == null
                ? jdbc.query(sql, ruleMapper(), programUid)
                : jdbc.query(sql, ruleMapper(), programUid, snapshotId);
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
                rs.getString("form_type"),
                rs.getString("data_entry_form_html"),
                List.of(), List.of(),
                readJson(rs.getString("payload")));
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
