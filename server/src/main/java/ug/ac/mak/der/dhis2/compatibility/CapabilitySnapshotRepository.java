package ug.ac.mak.der.dhis2.compatibility;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
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

/** Persistence for {@link CapabilitySnapshot}. */
@Repository
public class CapabilitySnapshotRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CapabilitySnapshotRepository(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public CapabilitySnapshot insert(final CapabilitySnapshot in) {
        final String probeJson = writeJson(in.probeReport());
        final String capsJson = writeJson(in.capabilities());
        final Long id = jdbc.queryForObject(
                "INSERT INTO der.dhis2_capability_snapshot ("
                        + "captured_at, central_version, central_revision, central_build_time, "
                        + "major, minor, patch, is_snapshot, profile_name, probe_report_json, "
                        + "capability_json, engine_version, probe_reachable, probe_duration_ms, "
                        + "triggered_by, initiator_user) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), "
                        + "?, ?, ?, ?, ?) "
                        + "RETURNING snapshot_id",
                Long.class,
                Timestamp.from(in.capturedAt()),
                in.centralVersion(), in.centralRevision(), in.centralBuildTime(),
                in.major(), in.minor(), in.patch(), in.snapshot(),
                in.profileName(), probeJson, capsJson, in.engineVersion(),
                in.probeReachable(), in.probeDurationMs(),
                in.triggeredBy().name(),
                in.initiatorUser());
        return new CapabilitySnapshot(id, in.capturedAt(), in.centralVersion(),
                in.centralRevision(), in.centralBuildTime(), in.major(), in.minor(),
                in.patch(), in.snapshot(), in.profileName(), in.probeReport(),
                in.capabilities(), in.engineVersion(), in.probeReachable(),
                in.probeDurationMs(), in.triggeredBy(), in.initiatorUser());
    }

    public Optional<CapabilitySnapshot> findLatest() {
        try {
            final CapabilitySnapshot row = jdbc.queryForObject(
                    "SELECT * FROM der.dhis2_capability_snapshot "
                            + "ORDER BY captured_at DESC LIMIT 1",
                    rowMapper());
            return Optional.ofNullable(row);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<CapabilitySnapshot> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(200, limit));
        return jdbc.query(
                "SELECT * FROM der.dhis2_capability_snapshot "
                        + "ORDER BY captured_at DESC LIMIT ?",
                rowMapper(), capped);
    }

    private RowMapper<CapabilitySnapshot> rowMapper() {
        return (ResultSet rs, int row) -> new CapabilitySnapshot(
                rs.getLong("snapshot_id"),
                rs.getTimestamp("captured_at").toInstant(),
                rs.getString("central_version"),
                rs.getString("central_revision"),
                rs.getString("central_build_time"),
                rs.getInt("major"),
                rs.getInt("minor"),
                (Integer) rs.getObject("patch"),
                rs.getBoolean("is_snapshot"),
                rs.getString("profile_name"),
                readProbe(rs.getString("probe_report_json")),
                readCapabilities(rs.getString("capability_json")),
                rs.getString("engine_version"),
                rs.getBoolean("probe_reachable"),
                rs.getLong("probe_duration_ms"),
                CapabilitySnapshot.Trigger.valueOf(rs.getString("triggered_by")),
                (UUID) rs.getObject("initiator_user"));
    }

    private String writeJson(final Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("failed to serialise capability JSON", ex);
        }
    }

    private ProbeReport readProbe(final String s) throws SQLException {
        try {
            final JsonNode n = mapper.readTree(s);
            final java.time.Instant startedAt = java.time.Instant.parse(n.get("startedAt").asText());
            final long totalDurationMs = n.get("totalDurationMs").asLong();
            final boolean reachable = n.get("reachable").asBoolean();
            final String versionRaw = n.has("versionRaw") && !n.get("versionRaw").isNull()
                    ? n.get("versionRaw").asText() : null;
            final List<ProbeOutcome> outcomes = new ArrayList<>();
            if (n.has("outcomes") && n.get("outcomes").isArray()) {
                for (final JsonNode o : n.get("outcomes")) {
                    outcomes.add(new ProbeOutcome(
                            o.get("endpoint").asText(),
                            o.get("method").asText(),
                            o.get("status").asInt(),
                            o.get("durationMs").asLong(),
                            o.has("shapeDigest") && !o.get("shapeDigest").isNull()
                                    ? o.get("shapeDigest").asText() : null,
                            o.has("notes") && !o.get("notes").isNull() ? o.get("notes").asText() : null,
                            o.get("reachable").asBoolean()));
                }
            }
            return new ProbeReport(startedAt, totalDurationMs, reachable, versionRaw, outcomes);
        } catch (Exception ex) {
            throw new SQLException("probe_report_json is not readable", ex);
        }
    }

    @SuppressWarnings("unchecked")
    private CapabilityFlags readCapabilities(final String s) throws SQLException {
        try {
            final Map<String, Object> m = mapper.readValue(s, Map.class);
            final CapabilityFlags.Builder b = new CapabilityFlags.Builder()
                    .trackerApi(CapabilityFlags.TrackerApi.valueOf((String) m.get("trackerApi")))
                    .importSummaryShape(CapabilityFlags.ImportSummaryShape.valueOf(
                            (String) m.get("importSummaryShape")))
                    .webMessageShape(CapabilityFlags.WebMessageShape.valueOf(
                            (String) m.get("webMessageShape")))
                    .supportsCategoryOptionCombosEndpoint(
                            (Boolean) m.getOrDefault("supportsCategoryOptionCombosEndpoint", false))
                    .supportsProgramRulesEndpoint(
                            (Boolean) m.getOrDefault("supportsProgramRulesEndpoint", false))
                    .supportsMetadataBulkEndpoint(
                            (Boolean) m.getOrDefault("supportsMetadataBulkEndpoint", false))
                    .supportsPatchDataElements(
                            (Boolean) m.getOrDefault("supportsPatchDataElements", false));
            final List<String> periods = (List<String>) m.getOrDefault("supportedPeriodTypes", List.of());
            for (final String pt : periods) {
                b.addPeriodType(CapabilityFlags.PeriodType.valueOf(pt));
            }
            final Map<String, List<String>> fields =
                    (Map<String, List<String>>) m.getOrDefault("metadataFields", Map.of());
            for (final Map.Entry<String, List<String>> e : fields.entrySet()) {
                b.metadataFields(CapabilityFlags.MetadataEntityType.valueOf(e.getKey()), e.getValue());
            }
            final Map<String, Object> extras =
                    (Map<String, Object>) m.getOrDefault("extras", Map.of());
            for (final Map.Entry<String, Object> e : extras.entrySet()) {
                b.extra(e.getKey(), e.getValue());
            }
            final String audit = (String) m.get("auditSurface");
            if (audit != null) {
                b.auditSurface(CapabilityFlags.AuditSurface.valueOf(audit));
            }
            final List<String> programTypes =
                    (List<String>) m.getOrDefault("supportedProgramTypes", List.of());
            for (final String pt : programTypes) {
                b.addSupportedProgramType(CapabilityFlags.SupportedProgramType.valueOf(pt));
            }
            final Map<String, Map<String, Object>> endpoints =
                    (Map<String, Map<String, Object>>) m.getOrDefault("endpointPolicies", Map.of());
            for (final Map.Entry<String, Map<String, Object>> e : endpoints.entrySet()) {
                final Map<String, Object> ep = e.getValue();
                final String path = (String) ep.getOrDefault("path", "");
                final EndpointPolicy.Status status = EndpointPolicy.Status.valueOf(
                        (String) ep.getOrDefault("status", "NOT_APPLICABLE"));
                final Integer sinceMinor = (Integer) ep.get("sinceMinor");
                final Integer removedMinor = (Integer) ep.get("removedMinor");
                final String replacementStr = (String) ep.get("replacement");
                final EndpointId replacement = replacementStr == null ? null
                        : EndpointId.valueOf(replacementStr);
                final String notes = (String) ep.get("notes");
                b.endpoint(EndpointId.valueOf(e.getKey()),
                        new EndpointPolicy(path, status, sinceMinor, removedMinor, replacement, notes));
            }
            return b.build();
        } catch (Exception ex) {
            throw new SQLException("capability_json is not readable", ex);
        }
    }
}
