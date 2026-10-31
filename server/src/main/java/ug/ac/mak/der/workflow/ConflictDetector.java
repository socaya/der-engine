package ug.ac.mak.der.workflow;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Spec §12 + §48–§50. Scans every contribution landed on a run and
 *  emits one {@code workflow_conflict} row per divergent identity.
 *
 *  <p>Three identity shapes handled in 2.3.12:
 *  <ul>
 *    <li><b>AGGREGATE_CELL</b> — same {@code (DE, CoC, AOC, OU, period)}
 *        across contributions, different value.</li>
 *    <li><b>EVENT_DATA_VALUE</b> — same {@code (event, DE)}, different
 *        value.</li>
 *    <li><b>TEI_ATTRIBUTE</b> — same {@code (trackedEntity, attribute)},
 *        different value.</li>
 *  </ul>
 *  The caller (coordinator) decides what to do with
 *  {@code PENDING_REVIEW} rows — currently it blocks run completion.</p>
 */
@Service
public class ConflictDetector {

    private static final Logger LOG = LoggerFactory.getLogger(ConflictDetector.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ConflictDetector(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /** Re-run detection for a given run. Each run of this method is
     *  idempotent — the (run_id, identity_key) UNIQUE constraint
     *  means repeated contributions on the same cell update the same
     *  conflict row rather than piling up new ones. */
    public List<DetectedConflict> detect(final UUID runId, final int canonicalRevision,
                                            final List<CaptureWorkflowContribution> contributions) {
        if (contributions == null || contributions.isEmpty()) {
            return List.of();
        }
        // identity_key → list of versions
        final Map<String, List<Version>> byIdentity = new LinkedHashMap<>();
        final Map<String, IdentityDescriptor> descriptors = new HashMap<>();

        for (final CaptureWorkflowContribution c : contributions) {
            try {
                final JsonNode payload = mapper.readTree(c.payload());
                scanAggregate(c, payload, byIdentity, descriptors);
                scanEvents(c, payload, byIdentity, descriptors);
                scanTeiAttributes(c, payload, byIdentity, descriptors);
            } catch (Exception ex) {
                LOG.warn("conflict detector failed to parse contribution {}", c.contributionId(), ex);
            }
        }

        final List<DetectedConflict> detected = new ArrayList<>();
        for (final Map.Entry<String, List<Version>> e : byIdentity.entrySet()) {
            final List<Version> versions = e.getValue();
            if (versions.size() < 2) {
                continue;
            }
            // All values identical? Not a conflict (spec §12 "same value").
            final String firstValue = String.valueOf(versions.get(0).value);
            final boolean allSame = versions.stream()
                    .allMatch((v) -> String.valueOf(v.value).equals(firstValue));
            if (allSame) {
                continue;
            }
            final IdentityDescriptor id = descriptors.get(e.getKey());
            detected.add(new DetectedConflict(id, versions));
        }
        upsertDetected(runId, canonicalRevision, detected);
        return detected;
    }

    public boolean hasPending(final UUID runId) {
        final Long n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM der.workflow_conflict "
          + "WHERE run_id = ? AND status = 'PENDING_REVIEW'",
            Long.class, runId);
        return n != null && n > 0;
    }

    public List<Map<String, Object>> list(final UUID runId) {
        return jdbc.query(
            "SELECT conflict_id, run_id, canonical_revision, category, "
          + "identity_json::text AS id_text, versions::text AS v_text, "
          + "status, resolution_strategy, resolution_value::text AS res_text, "
          + "resolved_by, resolved_at, detected_at, updated_at "
          + "FROM der.workflow_conflict WHERE run_id = ? ORDER BY detected_at ASC",
            (ResultSet rs, int row) -> rowToMap(rs), runId);
    }

    /** Mark a conflict resolved. {@code resolutionValue} is the value
     *  chosen (or null for DISMISSED). */
    public int resolve(final UUID conflictId, final String strategy,
                         final JsonNode resolutionValue, final UUID resolvedBy) {
        final String status = "DISMISSED".equalsIgnoreCase(strategy) ? "DISMISSED"
                : "RESOLVED_MANUALLY";
        try {
            return jdbc.update(
                "UPDATE der.workflow_conflict SET "
              + "  status = ?, resolution_strategy = ?, "
              + "  resolution_value = ?::jsonb, resolved_by = ?, "
              + "  resolved_at = now(), updated_at = now() "
              + "WHERE conflict_id = ? AND status = 'PENDING_REVIEW'",
                status, strategy,
                resolutionValue == null ? null : mapper.writeValueAsString(resolutionValue),
                resolvedBy, conflictId);
        } catch (Exception ex) {
            LOG.warn("resolve failed for conflict {}", conflictId, ex);
            return 0;
        }
    }

    /* ─── scanners ───────────────────────────────────────────────── */

    private void scanAggregate(final CaptureWorkflowContribution c, final JsonNode payload,
                                 final Map<String, List<Version>> byIdentity,
                                 final Map<String, IdentityDescriptor> descriptors) {
        final JsonNode arr = payload.path("dataValues");
        if (!arr.isArray()) {
            return;
        }
        for (final JsonNode v : arr) {
            final String de  = v.path("dataElement").asText("");
            final String coc = v.path("categoryOptionCombo").asText("");
            final String aoc = v.path("attributeOptionCombo").asText("");
            final String ou  = v.path("orgUnit").asText("");
            final String p   = v.path("period").asText("");
            if (de.isEmpty()) {
                continue;
            }
            final String key = "cell|" + de + "|" + coc + "|" + aoc + "|" + ou + "|" + p;
            final String value = v.path("value").asText("");
            byIdentity.computeIfAbsent(key, (k) -> new ArrayList<>())
                .add(new Version(c.contributionId(), c.stepId(), value,
                                  c.submittedBy(), c.submittedDeviceId(), c.submittedAt()));
            descriptors.computeIfAbsent(key, (k) -> {
                final ObjectNode id = mapper.createObjectNode();
                id.put("kind", "AGGREGATE_CELL");
                id.put("dataElement", de);
                if (!coc.isEmpty()) {
                    id.put("categoryOptionCombo", coc);
                }
                if (!aoc.isEmpty()) {
                    id.put("attributeOptionCombo", aoc);
                }
                if (!ou.isEmpty()) {
                    id.put("orgUnit", ou);
                }
                if (!p.isEmpty()) {
                    id.put("period", p);
                }
                return new IdentityDescriptor("VALUE_CONFLICT", id);
            });
        }
    }

    private void scanEvents(final CaptureWorkflowContribution c, final JsonNode payload,
                              final Map<String, List<Version>> byIdentity,
                              final Map<String, IdentityDescriptor> descriptors) {
        final JsonNode events = payload.path("events");
        if (!events.isArray()) {
            return;
        }
        for (final JsonNode event : events) {
            final String eventUid = event.path("event").asText("");
            // Only track events with a stable UID — otherwise we'd
            // false-positive the within-event field-level merge path.
            if (eventUid.isEmpty()) {
                continue;
            }
            final JsonNode dvs = event.path("dataValues");
            if (!dvs.isArray()) {
                continue;
            }
            for (final JsonNode dv : dvs) {
                final String de = dv.path("dataElement").asText("");
                if (de.isEmpty()) {
                    continue;
                }
                final String key = "evt|" + eventUid + "|" + de;
                final String value = dv.path("value").asText("");
                byIdentity.computeIfAbsent(key, (k) -> new ArrayList<>())
                    .add(new Version(c.contributionId(), c.stepId(), value,
                                      c.submittedBy(), c.submittedDeviceId(), c.submittedAt()));
                descriptors.computeIfAbsent(key, (k) -> {
                    final ObjectNode id = mapper.createObjectNode();
                    id.put("kind", "EVENT_DATA_VALUE");
                    id.put("event", eventUid);
                    id.put("dataElement", de);
                    return new IdentityDescriptor("EVENT_DATA_VALUE_CONFLICT", id);
                });
            }
        }
    }

    private void scanTeiAttributes(final CaptureWorkflowContribution c, final JsonNode payload,
                                     final Map<String, List<Version>> byIdentity,
                                     final Map<String, IdentityDescriptor> descriptors) {
        final JsonNode trackedEntity = payload.path("trackedEntity");
        final String teUid = trackedEntity.isTextual() ? trackedEntity.asText("")
                : payload.path("trackedEntity").path("trackedEntity").asText("");
        final JsonNode attrs = payload.path("attributes");
        if (!attrs.isArray()) {
            return;
        }
        for (final JsonNode a : attrs) {
            final String attrUid = a.path("attribute").asText("");
            if (attrUid.isEmpty()) {
                continue;
            }
            // TEI attributes conflict across contributions regardless
            // of TE UID (same workflow run = one TE anyway).
            final String key = "tei|" + teUid + "|" + attrUid;
            final String value = a.path("value").asText("");
            byIdentity.computeIfAbsent(key, (k) -> new ArrayList<>())
                .add(new Version(c.contributionId(), c.stepId(), value,
                                  c.submittedBy(), c.submittedDeviceId(), c.submittedAt()));
            descriptors.computeIfAbsent(key, (k) -> {
                final ObjectNode id = mapper.createObjectNode();
                id.put("kind", "TEI_ATTRIBUTE");
                if (!teUid.isEmpty()) {
                    id.put("trackedEntity", teUid);
                }
                id.put("attribute", attrUid);
                return new IdentityDescriptor("TEI_ATTRIBUTE_CONFLICT", id);
            });
        }
    }

    /* ─── persistence ────────────────────────────────────────────── */

    private void upsertDetected(final UUID runId, final int canonicalRevision,
                                  final List<DetectedConflict> detected) {
        for (final DetectedConflict d : detected) {
            try {
                final ArrayNode versionsArr = mapper.createArrayNode();
                for (final Version v : d.versions) {
                    final ObjectNode row = mapper.createObjectNode();
                    row.put("contributionId", v.contributionId.toString());
                    row.put("stepId", v.stepId.toString());
                    row.put("value", String.valueOf(v.value));
                    row.put("submittedBy", v.submittedBy == null ? null : v.submittedBy.toString());
                    row.put("submittedDeviceId",
                        v.submittedDeviceId == null ? null : v.submittedDeviceId.toString());
                    row.put("submittedAt", v.submittedAt.toString());
                    versionsArr.add(row);
                }
                final String identityKey = d.identity.identityNode.toString();
                jdbc.update(
                    "INSERT INTO der.workflow_conflict "
                  + "(conflict_id, run_id, canonical_revision, category, "
                  + " identity_key, identity_json, versions) "
                  + "VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb) "
                  + "ON CONFLICT (run_id, identity_key) DO UPDATE SET "
                  + "  canonical_revision = EXCLUDED.canonical_revision, "
                  + "  versions = EXCLUDED.versions, "
                  + "  updated_at = now()",
                    UUID.randomUUID(), runId, canonicalRevision,
                    d.identity.category, identityKey,
                    mapper.writeValueAsString(d.identity.identityNode),
                    mapper.writeValueAsString(versionsArr));
            } catch (Exception ex) {
                LOG.warn("conflict upsert failed for run {}", runId, ex);
            }
        }
    }

    private Map<String, Object> rowToMap(final ResultSet rs) {
        try {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("conflictId", rs.getString("conflict_id"));
            m.put("runId", rs.getString("run_id"));
            m.put("canonicalRevision", rs.getInt("canonical_revision"));
            m.put("category", rs.getString("category"));
            m.put("identity", mapper.readTree(rs.getString("id_text")));
            m.put("versions", mapper.readTree(rs.getString("v_text")));
            m.put("status", rs.getString("status"));
            m.put("resolutionStrategy", rs.getString("resolution_strategy"));
            final String resText = rs.getString("res_text");
            m.put("resolutionValue", resText == null ? null : mapper.readTree(resText));
            m.put("resolvedBy", rs.getString("resolved_by"));
            m.put("resolvedAt",
                rs.getTimestamp("resolved_at") == null ? null
                    : rs.getTimestamp("resolved_at").toInstant().toString());
            m.put("detectedAt", rs.getTimestamp("detected_at").toInstant().toString());
            m.put("updatedAt", rs.getTimestamp("updated_at").toInstant().toString());
            return m;
        } catch (Exception ex) {
            return Map.of();
        }
    }

    /* ─── value types ────────────────────────────────────────────── */

    public record DetectedConflict(IdentityDescriptor identity, List<Version> versions) { }

    private record Version(UUID contributionId, UUID stepId, Object value,
                             UUID submittedBy, UUID submittedDeviceId,
                             Instant submittedAt) { }

    public record IdentityDescriptor(String category, ObjectNode identityNode) { }
}
