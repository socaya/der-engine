package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityAuditRepository.FilterSpec;
import ug.ac.mak.der.security.SecurityAuditRepository.Row;

@WebMvcTest(SecurityAuditEventsController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SecurityAuditEventsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean SecurityAuditRepository repo;

    private static RequestPostProcessor admin() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ad", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private static Row row(final long id, final String type, final String whenIso) {
        return new Row(id, type, null, null, null, null, "SUCCESS", "{}",
                Instant.parse(whenIso));
    }

    @Test
    void listReturnsEventsAndPageSizeDefaults() throws Exception {
        when(repo.findPage(any(FilterSpec.class), anyInt()))
                .thenReturn(List.of(row(1, "USER_SIGNED_IN", "2026-11-05T10:00:00Z")));
        mockMvc.perform(get("/edge-api/v1/security/audit/events").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events[0].auditId").value(1))
                .andExpect(jsonPath("$.events[0].eventType").value("USER_SIGNED_IN"))
                .andExpect(jsonPath("$.pageSize").value(100))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
    }

    @Test
    void listEmitsNextCursorWhenPageIsFull() throws Exception {
        /* pageSize=2, repo returns 2 rows → nextCursor must be set to the
         * last row's (observedAt, auditId) base64-url-encoded. */
        final Row last = row(10, "FOO", "2026-11-05T10:00:00Z");
        when(repo.findPage(any(FilterSpec.class), eq(2)))
                .thenReturn(List.of(row(11, "FOO", "2026-11-05T10:05:00Z"), last));
        final String expectedCursor = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("2026-11-05T10:00:00Z|10").getBytes());
        mockMvc.perform(get("/edge-api/v1/security/audit/events")
                        .param("pageSize", "2").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.nextCursor").value(expectedCursor));
    }

    @Test
    void listDecodesCursorAndPassesItToRepo() throws Exception {
        final String cursor = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("2026-11-05T09:00:00Z|42").getBytes());
        when(repo.findPage(any(FilterSpec.class), anyInt())).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/security/audit/events")
                        .param("cursor", cursor).with(admin()))
                .andExpect(status().isOk());
        verify(repo).findPage(argThat((FilterSpec s) ->
                s.cursorAuditId() != null && s.cursorAuditId() == 42L
                && s.cursorObservedAt() != null
                && s.cursorObservedAt().equals(Instant.parse("2026-11-05T09:00:00Z"))),
                anyInt());
    }

    @Test
    void listRejectsMalformedCursor() throws Exception {
        mockMvc.perform(get("/edge-api/v1/security/audit/events")
                        .param("cursor", "not-base64!!!").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AUDIT_FILTER_INVALID"));
    }

    @Test
    void listPassesFromToEventTypeAndSubjectToRepo() throws Exception {
        final UUID subjectId = UUID.randomUUID();
        when(repo.findPage(any(FilterSpec.class), anyInt())).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/security/audit/events")
                        .param("from", "2026-11-01T00:00:00Z")
                        .param("to",   "2026-11-05T23:59:59Z")
                        .param("eventType", "USER_SIGNED_IN")
                        .param("eventType", "USER_SIGNED_OUT")
                        .param("subjectUserId", subjectId.toString())
                        .with(admin()))
                .andExpect(status().isOk());
        verify(repo).findPage(argThat((FilterSpec s) ->
                s.from() != null && s.from().equals(Instant.parse("2026-11-01T00:00:00Z"))
                && s.to() != null && s.to().equals(Instant.parse("2026-11-05T23:59:59Z"))
                && s.eventTypes() != null && s.eventTypes().size() == 2
                && s.eventTypes().contains("USER_SIGNED_IN")
                && s.eventTypes().contains("USER_SIGNED_OUT")
                && subjectId.equals(s.subjectUserId())),
                anyInt());
    }

    @Test
    void listRejectsMalformedFromTimestamp() throws Exception {
        mockMvc.perform(get("/edge-api/v1/security/audit/events")
                        .param("from", "not-a-date").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AUDIT_FILTER_INVALID"));
    }

    @Test
    void exportCsvStreamsCsvWithFilenameAndCount() throws Exception {
        when(repo.findForExport(any(FilterSpec.class), eq(10_000)))
                .thenReturn(List.of(
                        row(1, "USER_SIGNED_IN", "2026-11-05T10:00:00Z"),
                        new Row(2, "USER_SIGNED_IN",
                                UUID.fromString("00000000-0000-0000-0000-000000000001"),
                                null, "10.0.0.1", "curl",
                                "SUCCESS", "{\"a\":1}",
                                Instant.parse("2026-11-05T11:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/security/audit/events/export.csv").with(admin()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("X-Audit-Export-Count", "2"))
                .andExpect(header().string("X-Audit-Export-Cap", "10000"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("der-audit-events-")))
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString(
                                "audit_id,observed_at,event_type")))
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString(
                                "1,2026-11-05T10:00:00Z,USER_SIGNED_IN")))
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString(
                                "2026-11-05T11:00:00Z,USER_SIGNED_IN,SUCCESS")));
    }

    @Test
    void exportCsvEscapesQuotesAndCommas() throws Exception {
        when(repo.findForExport(any(FilterSpec.class), anyInt()))
                .thenReturn(List.of(new Row(7, "ODD,TYPE", null, null,
                        null, "with \"quote\", comma", "SUCCESS", "{\"k\":\"v\"}",
                        Instant.parse("2026-11-05T12:00:00Z"))));
        final String body = mockMvc.perform(get("/edge-api/v1/security/audit/events/export.csv")
                        .with(admin()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        /* Field with a comma inside is quoted; embedded quotes doubled. */
        assertThat(body).contains("\"ODD,TYPE\"");
        assertThat(body).contains("\"with \"\"quote\"\", comma\"");
    }

    @Test
    void exportCsvAnonymousIs401() throws Exception {
        mockMvc.perform(get("/edge-api/v1/security/audit/events/export.csv"))
                .andExpect(status().isUnauthorized());
    }
}
