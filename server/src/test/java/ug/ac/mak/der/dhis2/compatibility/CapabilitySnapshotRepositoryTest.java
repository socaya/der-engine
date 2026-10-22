package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

class CapabilitySnapshotRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T12:00:00Z");

    private static ObjectMapper mapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    private CapabilitySnapshot bareSnapshot() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        final CapabilityFlags caps = b.build();
        final ProbeReport report = new ProbeReport(NOW, 10L, true, "2.44-SNAPSHOT",
                List.of(new ProbeOutcome("/api/system/info", "GET", 200, 1L, "d", "n", true)));
        return new CapabilitySnapshot(null, NOW, "2.44-SNAPSHOT", "r", "b",
                2, 44, null, true, "V2_44", report, caps, "1.0.0", true, 10L,
                CapabilitySnapshot.Trigger.STARTUP, null);
    }

    @Test
    void insertUsesReturningSnapshotId() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class),
                any(Timestamp.class), anyString(), any(), any(),
                anyInt(), anyInt(), any(), any(Boolean.class),
                anyString(), anyString(), anyString(),
                anyString(), any(Boolean.class), any(Long.class),
                anyString(), any())).thenReturn(42L);
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.insert(bareSnapshot());
        assertThat(out.snapshotId()).isEqualTo(42L);
    }

    @Test
    void findLatestReturnsEmptyWhenNoRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThat(repo.findLatest()).isEmpty();
    }

    @Test
    void findLatestReturnsRowOnHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("snapshot_id")).thenReturn(5L);
        when(rs.getTimestamp("captured_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getString("central_version")).thenReturn("2.44-SNAPSHOT");
        when(rs.getString("central_revision")).thenReturn("r");
        when(rs.getString("central_build_time")).thenReturn("b");
        when(rs.getInt("major")).thenReturn(2);
        when(rs.getInt("minor")).thenReturn(44);
        when(rs.getObject("patch")).thenReturn(null);
        when(rs.getBoolean("is_snapshot")).thenReturn(true);
        when(rs.getString("profile_name")).thenReturn("V2_44");
        when(rs.getString("probe_report_json")).thenReturn(
                mapper().writeValueAsString(new ProbeReport(NOW, 10L, true, "2.44-SNAPSHOT",
                        List.of(new ProbeOutcome("/api/system/info", "GET", 200, 1L, "d", "n", true)))));
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        when(rs.getString("capability_json")).thenReturn(
                mapper().writeValueAsString(b.build()));
        when(rs.getString("engine_version")).thenReturn("1.0.0");
        when(rs.getBoolean("probe_reachable")).thenReturn(true);
        when(rs.getLong("probe_duration_ms")).thenReturn(10L);
        when(rs.getString("triggered_by")).thenReturn("STARTUP");
        when(rs.getObject("initiator_user")).thenReturn(null);

        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture())).thenAnswer(inv -> cap.getValue().mapRow(rs, 1));

        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        assertThat(out.snapshotId()).isEqualTo(5L);
        assertThat(out.profileName()).isEqualTo("V2_44");
        assertThat(out.probeReport().outcomes()).hasSize(1);
    }

    @Test
    void findRecentDelegatesQuery() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10)))
                .thenReturn(List.of());
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThat(repo.findRecent(10)).isEmpty();
    }

    @Test
    void findRecentClampsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(200)))
                .thenReturn(List.of());
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThat(repo.findRecent(10_000)).isEmpty();
    }

    @Test
    void findRecentClampsLowerBound() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1)))
                .thenReturn(List.of());
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThat(repo.findRecent(0)).isEmpty();
    }

    @Test
    void readProbeHandlesMalformedJson() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn("not-json");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThatThrownBy(repo::findLatest)
                .hasRootCauseInstanceOf(com.fasterxml.jackson.core.JsonProcessingException.class);
    }

    @Test
    void readCapabilitiesHandlesMalformedJson() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("capability_json")).thenReturn("not-json");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThatThrownBy(repo::findLatest)
                .hasRootCauseInstanceOf(com.fasterxml.jackson.core.JsonProcessingException.class);
    }

    @Test
    void readProbeHandlesPayloadWithoutVersionRawOrOutcomes() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn(
                "{\"startedAt\":\"2026-10-22T12:00:00Z\",\"totalDurationMs\":1,\"reachable\":true}");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        assertThat(out.probeReport().versionRaw()).isNull();
        assertThat(out.probeReport().outcomes()).isEmpty();
    }

    @Test
    void readProbeHandlesExplicitNullVersionRaw() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn(
                "{\"startedAt\":\"2026-10-22T12:00:00Z\",\"totalDurationMs\":1,"
                        + "\"reachable\":true,\"versionRaw\":null,\"outcomes\":[]}");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        assertThat(out.probeReport().versionRaw()).isNull();
    }

    @Test
    void readCapabilitiesWithExtrasPopulatesBuilder() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("capability_json")).thenReturn(
                "{\"trackerApi\":\"NONE\",\"importSummaryShape\":\"CLASSIC\","
                        + "\"webMessageShape\":\"DHIS2_2_41\",\"extras\":{\"custom\":42},"
                        + "\"supportedPeriodTypes\":[\"YEARLY\"],"
                        + "\"metadataFields\":{\"DATA_ELEMENT\":[\"id\"]}}");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        assertThat(out.capabilities().extras()).containsEntry("custom", 42);
        assertThat(out.capabilities().supportedPeriodTypes())
                .containsExactly(CapabilityFlags.PeriodType.YEARLY);
    }

    @Test
    void readProbeIgnoresOutcomesWhenValueIsNotArray() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn(
                "{\"startedAt\":\"2026-10-22T12:00:00Z\",\"totalDurationMs\":1,"
                        + "\"reachable\":true,\"outcomes\":\"not-an-array\"}");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        assertThat(repo.findLatest().orElseThrow().probeReport().outcomes()).isEmpty();
    }

    @Test
    void readProbeHandlesOutcomeWithoutShapeDigestField() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn(
                "{\"startedAt\":\"2026-10-22T12:00:00Z\",\"totalDurationMs\":1,"
                        + "\"reachable\":true,\"outcomes\":["
                        + "{\"endpoint\":\"/api/x\",\"method\":\"GET\",\"status\":200,"
                        + "\"durationMs\":1,\"reachable\":true}]}");
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        final ProbeOutcome o = out.probeReport().outcomes().get(0);
        assertThat(o.shapeDigest()).isNull();
        assertThat(o.notes()).isNull();
    }

    @Test
    void readProbeHandlesOutcomeWithNullNotesAndDigest() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        wireMinimalRow(rs, mapper());
        when(rs.getString("probe_report_json")).thenReturn(
                mapper().writeValueAsString(new ProbeReport(NOW, 1L, true, null,
                        List.of(new ProbeOutcome("/api/x", "GET", 200, 1L, null, null, true)))));
        final ArgumentCaptor<RowMapper<CapabilitySnapshot>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final CapabilitySnapshotRepository repo = new CapabilitySnapshotRepository(jdbc, mapper());
        final CapabilitySnapshot out = repo.findLatest().orElseThrow();
        assertThat(out.probeReport().outcomes().get(0).shapeDigest()).isNull();
        assertThat(out.probeReport().outcomes().get(0).notes()).isNull();
    }

    private static void wireMinimalRow(final ResultSet rs, final ObjectMapper m) throws Exception {
        when(rs.getLong("snapshot_id")).thenReturn(1L);
        when(rs.getTimestamp("captured_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getString("central_version")).thenReturn("2.44");
        when(rs.getString("central_revision")).thenReturn(null);
        when(rs.getString("central_build_time")).thenReturn(null);
        when(rs.getInt("major")).thenReturn(2);
        when(rs.getInt("minor")).thenReturn(44);
        when(rs.getObject("patch")).thenReturn(0);
        when(rs.getBoolean("is_snapshot")).thenReturn(false);
        when(rs.getString("profile_name")).thenReturn("V2_44");
        when(rs.getString("probe_report_json")).thenReturn(
                m.writeValueAsString(new ProbeReport(NOW, 1L, true, null, List.of())));
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        when(rs.getString("capability_json")).thenReturn(m.writeValueAsString(b.build()));
        when(rs.getString("engine_version")).thenReturn("1.0.0");
        when(rs.getBoolean("probe_reachable")).thenReturn(true);
        when(rs.getLong("probe_duration_ms")).thenReturn(1L);
        when(rs.getString("triggered_by")).thenReturn("STARTUP");
        when(rs.getObject("initiator_user")).thenReturn(null);
    }

    @Test
    void insertWrapsJsonFailure() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper mapper = mock(ObjectMapper.class);
        when(mapper.writeValueAsString(any()))
                .thenThrow(new JsonProcessingException("boom") { });
        assertThatThrownBy(() -> new CapabilitySnapshotRepository(jdbc, mapper).insert(bareSnapshot()))
                .isInstanceOf(IllegalStateException.class);
    }
}
