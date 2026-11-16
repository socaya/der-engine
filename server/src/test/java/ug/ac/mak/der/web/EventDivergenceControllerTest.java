package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

class EventDivergenceControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static SecurityAuditRepository.Row row(final String evt) {
        return new SecurityAuditRepository.Row(
                1L, evt, null, null, null, null,
                "SUCCESS", "{\"eventId\":\"e-1\"}",
                Instant.parse("2026-11-15T10:00:00Z"));
    }

    @Test
    void anonymousIs401() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                new EventDivergenceController(audit).recent(null, null, 100);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void unknownClassIs400() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                new EventDivergenceController(audit)
                        .recent(principal(), "NOT_A_REAL_CLASS", 100);
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getBody()).containsEntry("code", "UNKNOWN_CLASS");
    }

    @Test
    void listsOnlyDivergencePrefixedRows() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(audit.findRecent(any(), any(), anyInt())).thenReturn(List.of(
                row("EVENT_DIVERGENCE_CENTRAL_DIVERGED"),
                row("DATA_PULL_OVERWRITE"),            // not a divergence — must be filtered
                row("EVENT_DIVERGENCE_CENTRAL_DELETED")));
        final ResponseEntity<Map<String, Object>> res =
                new EventDivergenceController(audit).recent(principal(), null, 100);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat((int) res.getBody().get("count")).isEqualTo(2);
    }

    @Test
    void klassFilterNarrowsToSingleType() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(audit.findRecent(eq("EVENT_DIVERGENCE_CENTRAL_DELETED"),
                any(), anyInt()))
                .thenReturn(List.of(row("EVENT_DIVERGENCE_CENTRAL_DELETED")));
        final ResponseEntity<Map<String, Object>> res =
                new EventDivergenceController(audit)
                        .recent(principal(), "central_deleted", 50);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat((int) res.getBody().get("count")).isEqualTo(1);
    }
}
