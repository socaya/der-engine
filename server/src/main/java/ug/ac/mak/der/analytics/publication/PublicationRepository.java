package ug.ac.mak.der.analytics.publication;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

/**
 * JDBC layer for {@code der.analytics_publication_mapping} and
 * {@code der.analytics_publication} (V112).
 *
 * <p>Read-heavy by design: the proposal generator reads cells +
 * mappings in bulk, writes proposals in a batch, and review
 * operations touch single rows via the PK. No background worker
 * writes here directly; everything funnels through
 * {@link PublicationProposalService}.</p>
 */
@Repository
public class PublicationRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public PublicationRepository(final JdbcTemplate jdbc,
                                   final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    /* ─────── mapping CRUD ─────── */

    public UUID insertMapping(final PublicationMapping m) {
        Objects.requireNonNull(m, "mapping");
        jdbc.update(
                "INSERT INTO der.analytics_publication_mapping ("
              + "  mapping_id, metric_id, definition_version, dataset_uid, "
              + "  data_element_uid, category_option_combo_uid, "
              + "  attribute_option_combo_uid, dimension_filter, "
              + "  publication_mode, overlap_policy) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?, ?)",
                m.mappingId(), m.metricId(), m.definitionVersion(),
                m.datasetUid(), m.dataElementUid(),
                m.categoryOptionComboUid(),
                m.attributeOptionComboUid(),
                writeJson(m.dimensionFilter()),
                m.publicationMode().name(), m.overlapPolicy());
        return m.mappingId();
    }

    public List<PublicationMapping> listMappings(final UUID metricId) {
        if (metricId == null) {
            return jdbc.query(
                    "SELECT mapping_id, metric_id, definition_version, "
                  + "       dataset_uid, data_element_uid, "
                  + "       category_option_combo_uid, "
                  + "       attribute_option_combo_uid, "
                  + "       dimension_filter::text AS dim_filter, "
                  + "       publication_mode, overlap_policy, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_publication_mapping "
                  + " ORDER BY created_at",
                    mappingMapper(json));
        }
        return jdbc.query(
                "SELECT mapping_id, metric_id, definition_version, "
              + "       dataset_uid, data_element_uid, "
              + "       category_option_combo_uid, "
              + "       attribute_option_combo_uid, "
              + "       dimension_filter::text AS dim_filter, "
              + "       publication_mode, overlap_policy, "
              + "       created_at, updated_at "
              + "  FROM der.analytics_publication_mapping "
              + " WHERE metric_id = ? ORDER BY created_at",
                mappingMapper(json), metricId);
    }

    public Optional<PublicationMapping> findMapping(final UUID mappingId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT mapping_id, metric_id, definition_version, "
                  + "       dataset_uid, data_element_uid, "
                  + "       category_option_combo_uid, "
                  + "       attribute_option_combo_uid, "
                  + "       dimension_filter::text AS dim_filter, "
                  + "       publication_mode, overlap_policy, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_publication_mapping "
                  + " WHERE mapping_id = ?",
                    mappingMapper(json), mappingId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int deleteMapping(final UUID mappingId) {
        return jdbc.update(
                "DELETE FROM der.analytics_publication_mapping "
              + " WHERE mapping_id = ?", mappingId);
    }

    /* ─────── proposal CRUD ─────── */

    public UUID upsertProposal(final PublicationProposal p) {
        return jdbc.queryForObject(
                "INSERT INTO der.analytics_publication ("
              + "  proposal_id, mapping_id, metric_id, definition_version, "
              + "  dataset_uid, data_element_uid, "
              + "  category_option_combo_uid, attribute_option_combo_uid, "
              + "  period_key, org_unit_uid, proposed_value, state, "
              + "  provenance) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB)) "
              + "ON CONFLICT (mapping_id, period_key, org_unit_uid) "
              + "DO UPDATE SET "
              + "  proposed_value = EXCLUDED.proposed_value, "
              + "  provenance = EXCLUDED.provenance, "
              + "  updated_at = now() "
              + "RETURNING proposal_id",
                UUID.class,
                p.proposalId(), p.mappingId(), p.metricId(),
                p.definitionVersion(), p.datasetUid(),
                p.dataElementUid(),
                p.categoryOptionComboUid(),
                p.attributeOptionComboUid(),
                p.periodKey(), p.orgUnitUid(), p.proposedValue(),
                p.state().name(),
                p.provenanceJson() == null ? "{}" : p.provenanceJson());
    }

    public List<PublicationProposal> listProposals(
            final UUID metricId, final String state) {
        final StringBuilder sql = new StringBuilder(
                "SELECT proposal_id, mapping_id, metric_id, "
              + "       definition_version, dataset_uid, "
              + "       data_element_uid, category_option_combo_uid, "
              + "       attribute_option_combo_uid, period_key, "
              + "       org_unit_uid, proposed_value, reviewed_value, "
              + "       state, review_reason, reviewed_by, "
              + "       reviewed_at, provenance::text AS provenance, "
              + "       created_at, updated_at "
              + "  FROM der.analytics_publication WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (metricId != null) {
            sql.append(" AND metric_id = ? ");
            args.add(metricId);
        }
        if (state != null && !state.isBlank()) {
            sql.append(" AND state = ? ");
            args.add(state);
        }
        sql.append(" ORDER BY period_key DESC, created_at ");
        return jdbc.query(sql.toString(), PROPOSAL_MAPPER, args.toArray());
    }

    public Optional<PublicationProposal> findProposal(final UUID id) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT proposal_id, mapping_id, metric_id, "
                  + "       definition_version, dataset_uid, "
                  + "       data_element_uid, category_option_combo_uid, "
                  + "       attribute_option_combo_uid, period_key, "
                  + "       org_unit_uid, proposed_value, reviewed_value, "
                  + "       state, review_reason, reviewed_by, "
                  + "       reviewed_at, provenance::text AS provenance, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_publication "
                  + " WHERE proposal_id = ?",
                    PROPOSAL_MAPPER, id));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Fetch the most-recently-reviewed proposal for a mapping /
     *  period / orgUnit tuple. Used by AUTO_APPROVE_EXACT and
     *  AUTO_APPROVE_UNDER_THRESHOLD to compare the new proposed
     *  value against the prior approved value. */
    public Optional<PublicationProposal> findPriorForCell(
            final UUID mappingId, final String periodKey,
            final String orgUnitUid) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT proposal_id, mapping_id, metric_id, "
                  + "       definition_version, dataset_uid, "
                  + "       data_element_uid, category_option_combo_uid, "
                  + "       attribute_option_combo_uid, period_key, "
                  + "       org_unit_uid, proposed_value, reviewed_value, "
                  + "       state, review_reason, reviewed_by, "
                  + "       reviewed_at, provenance::text AS provenance, "
                  + "       created_at, updated_at "
                  + "  FROM der.analytics_publication "
                  + " WHERE mapping_id = ? AND period_key = ? "
                  + "   AND org_unit_uid = ?",
                    PROPOSAL_MAPPER, mappingId, periodKey, orgUnitUid));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Count proposals in a given state — used by the drain worker's
     *  idle-tick short-circuit. */
    public int countByState(final PublicationProposal.State state) {
        final Integer v = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.analytics_publication "
              + " WHERE state = ?", Integer.class, state.name());
        return v == null ? 0 : v;
    }

    public int review(final UUID proposalId, final PublicationProposal.State state,
                        final BigDecimal reviewedValue, final String reason,
                        final UUID reviewer) {
        return jdbc.update(
                "UPDATE der.analytics_publication "
              + "   SET state = ?, "
              + "       reviewed_value = ?, "
              + "       review_reason = ?, "
              + "       reviewed_by = ?, "
              + "       reviewed_at = now(), "
              + "       updated_at = now() "
              + " WHERE proposal_id = ?",
                state.name(), reviewedValue, reason, reviewer, proposalId);
    }

    public Map<String, Integer> stateCounts() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final PublicationProposal.State s
                : PublicationProposal.State.values()) {
            out.put(s.name(), 0);
        }
        jdbc.query(
                "SELECT state, COUNT(*)::int AS n "
              + "  FROM der.analytics_publication GROUP BY state",
                (rs, i) -> {
                    out.put(rs.getString("state"), rs.getInt("n"));
                    return null;
                });
        return out;
    }

    /* ─────── mappers + helpers ─────── */

    private static RowMapper<PublicationMapping> mappingMapper(
            final ObjectMapper json) {
        return (rs, i) -> {
            final Map<String, String> filter =
                    parseStringMap(json, rs.getString("dim_filter"));
            return new PublicationMapping(
                    (UUID) rs.getObject("mapping_id"),
                    (UUID) rs.getObject("metric_id"),
                    rs.getInt("definition_version"),
                    rs.getString("dataset_uid"),
                    rs.getString("data_element_uid"),
                    rs.getString("category_option_combo_uid"),
                    rs.getString("attribute_option_combo_uid"),
                    filter,
                    PublicationMapping.Mode.valueOf(
                            rs.getString("publication_mode")),
                    rs.getString("overlap_policy"),
                    toInstant(rs.getTimestamp("created_at")),
                    toInstant(rs.getTimestamp("updated_at")));
        };
    }

    private static final RowMapper<PublicationProposal> PROPOSAL_MAPPER =
        (rs, i) -> new PublicationProposal(
                (UUID) rs.getObject("proposal_id"),
                (UUID) rs.getObject("mapping_id"),
                (UUID) rs.getObject("metric_id"),
                rs.getInt("definition_version"),
                rs.getString("dataset_uid"),
                rs.getString("data_element_uid"),
                rs.getString("category_option_combo_uid"),
                rs.getString("attribute_option_combo_uid"),
                rs.getString("period_key"),
                rs.getString("org_unit_uid"),
                rs.getBigDecimal("proposed_value"),
                rs.getBigDecimal("reviewed_value"),
                PublicationProposal.State.valueOf(rs.getString("state")),
                rs.getString("review_reason"),
                (UUID) rs.getObject("reviewed_by"),
                toInstant(rs.getTimestamp("reviewed_at")),
                rs.getString("provenance"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at")));

    private String writeJson(final Object v) {
        try {
            return v == null ? "{}" : json.writeValueAsString(v);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private static Map<String, String> parseStringMap(
            final ObjectMapper json, final String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            final JsonNode n = json.readTree(raw);
            if (!n.isObject()) {
                return Map.of();
            }
            final Map<String, String> out = new LinkedHashMap<>();
            n.fields().forEachRemaining(e ->
                    out.put(e.getKey(),
                            e.getValue() == null || e.getValue().isNull()
                                    ? "" : e.getValue().asText("")));
            return out;
        } catch (RuntimeException | java.io.IOException ex) {
            return Map.of();
        }
    }

    private static java.time.Instant toInstant(final Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
