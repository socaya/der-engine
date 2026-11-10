package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(JournalStateController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class JournalStateControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean JdbcTemplate jdbc;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void unauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "EVENT")
                        .param("refs", "a"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidEntityType() throws Exception {
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "NOPE")
                        .param("refs", "a")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ENTITY_TYPE_INVALID"));
    }

    @Test
    void emptyRefsReturnsEmptyMap() throws Exception {
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "EVENT")
                        .param("refs", "")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refs").isMap());
    }

    @Test
    void tooManyRefsRejected() throws Exception {
        final StringBuilder refs = new StringBuilder("a0");
        for (int i = 1; i <= 500; i++) {
            refs.append(",a").append(i);
        }
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "EVENT")
                        .param("refs", refs.toString())
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REFS_TOO_MANY"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnsLatestStatePerRef() throws Exception {
        // jdbc.query(sql, args, rowMapper) — simulate 2 rows coming back.
        when(jdbc.query(anyString(), any(Object[].class),
                any(RowMapper.class)))
                .thenAnswer(inv -> {
                    final RowMapper<Object> rm = inv.getArgument(2);
                    final java.sql.ResultSet rs1 = org.mockito.Mockito.mock(
                            java.sql.ResultSet.class);
                    when(rs1.getString("entity_ref")).thenReturn("evt-1");
                    when(rs1.getString("operation_id")).thenReturn("op-1");
                    when(rs1.getString("state")).thenReturn("CENTRAL_ACCEPTED");
                    when(rs1.getInt("attempt_count")).thenReturn(1);
                    when(rs1.getTimestamp("updated_at"))
                            .thenReturn(Timestamp.from(Instant.parse(
                                    "2026-11-10T12:00:00Z")));
                    when(rs1.getString("last_error")).thenReturn(null);
                    rm.mapRow(rs1, 0);

                    final java.sql.ResultSet rs2 = org.mockito.Mockito.mock(
                            java.sql.ResultSet.class);
                    when(rs2.getString("entity_ref")).thenReturn("evt-2");
                    when(rs2.getString("operation_id")).thenReturn("op-2");
                    when(rs2.getString("state")).thenReturn("RETRYABLE");
                    when(rs2.getInt("attempt_count")).thenReturn(3);
                    when(rs2.getTimestamp("updated_at")).thenReturn(null);
                    when(rs2.getString("last_error")).thenReturn("boom");
                    rm.mapRow(rs2, 1);
                    return java.util.List.of();
                });
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "EVENT")
                        .param("refs", "evt-1,evt-2,evt-3")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityType").value("EVENT"))
                .andExpect(jsonPath("$.refs['evt-1'].state")
                        .value("CENTRAL_ACCEPTED"))
                .andExpect(jsonPath("$.refs['evt-1'].attemptCount").value(1))
                .andExpect(jsonPath("$.refs['evt-1'].updatedAt")
                        .value("2026-11-10T12:00:00Z"))
                .andExpect(jsonPath("$.refs['evt-2'].state").value("RETRYABLE"))
                .andExpect(jsonPath("$.refs['evt-2'].lastError").value("boom"))
                .andExpect(jsonPath("$.refs['evt-3']").doesNotExist());
    }

    @Test
    @SuppressWarnings("unchecked")
    void whitespaceAndEmptyRefsSkipped() throws Exception {
        when(jdbc.query(anyString(), any(Object[].class),
                any(RowMapper.class))).thenReturn(java.util.List.of());
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "EVENT")
                        .param("refs", " , ,evt-1, ,evt-2")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    @SuppressWarnings("unchecked")
    void supportsTrackedEntityType() throws Exception {
        when(jdbc.query(anyString(), any(Object[].class),
                any(RowMapper.class))).thenReturn(java.util.List.of());
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "TRACKED_ENTITY")
                        .param("refs", "tei-1")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityType").value("TRACKED_ENTITY"));
        // Also confirm the EVENT path isn't accidentally the only case allowed.
        mockMvc.perform(get("/edge-api/v1/journal/state")
                        .param("entityType", "ENROLLMENT")
                        .param("refs", "en-1")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }
}
