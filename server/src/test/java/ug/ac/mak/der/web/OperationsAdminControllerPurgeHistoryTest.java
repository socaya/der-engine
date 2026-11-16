package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * Focused tests for the FR-09-10 evidence-export endpoint. The rest
 * of OperationsAdminController has existing live-smoke coverage; this
 * file keeps the per-FR surface narrow.
 */
class OperationsAdminControllerPurgeHistoryTest {

    private static final Instant NOW = Instant.parse("2026-11-16T04:00:00Z");

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> missing() {
        return mock(ObjectProvider.class);
    }

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ad", "Ad",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static SecurityAuditRepository.Row auditRow(
            final long id, final String source, final int rows,
            final int days) {
        final String detail = "{\"source\":\"" + source + "\","
                + "\"rowsPurged\":" + rows + ","
                + "\"olderThanDays\":" + days + "}";
        return new SecurityAuditRepository.Row(id,
                "JOURNAL_RETENTION_PURGE", null, null, null, null,
                "SUCCESS", detail, NOW.minusSeconds(id * 60L));
    }

    private OperationsAdminController ctl(final SecurityAuditRepository audit) {
        return new OperationsAdminController(
                mock(EdgeUserRepository.class),
                missing(), missing(), missing(),
                audit, new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC),
                missing());
    }

    @Test
    void anonymousIs401() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                ctl(audit).purgeHistory(null, 50);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void emptyHistoryReturnsZeroCounts() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(audit.findRecent(eq("JOURNAL_RETENTION_PURGE"),
                any(), anyInt())).thenReturn(List.of());
        final ResponseEntity<Map<String, Object>> res =
                ctl(audit).purgeHistory(principal(), 50);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("count", 0);
        assertThat(res.getBody()).containsEntry("totalRowsPurged", 0);
        assertThat(res.getBody()).containsEntry("scheduledRuns", 0);
        assertThat(res.getBody()).containsEntry("operatorRuns", 0);
    }

    @Test
    @SuppressWarnings("unchecked")
    void aggregatesCountsAcrossSources() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(audit.findRecent(eq("JOURNAL_RETENTION_PURGE"),
                any(), anyInt())).thenReturn(List.of(
                        auditRow(1L, "SCHEDULED", 10, 90),
                        auditRow(2L, "OPERATOR", 3, 60),
                        auditRow(3L, "SCHEDULED", 7, 90)));
        final ResponseEntity<Map<String, Object>> res =
                ctl(audit).purgeHistory(principal(), 50);
        assertThat(res.getBody()).containsEntry("count", 3);
        assertThat(res.getBody()).containsEntry("totalRowsPurged", 20);
        assertThat(res.getBody()).containsEntry("scheduledRuns", 2);
        assertThat(res.getBody()).containsEntry("operatorRuns", 1);
        final List<Map<String, Object>> items =
                (List<Map<String, Object>>) res.getBody().get("items");
        assertThat(items).hasSize(3);
        assertThat(items.get(0)).containsEntry("source", "SCHEDULED");
        assertThat(items.get(0)).containsEntry("rowsPurged", 10);
    }

    @Test
    void limitIsClampedToUpperBound() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(audit.findRecent(any(), any(), anyInt())).thenReturn(List.of());
        ctl(audit).purgeHistory(principal(), 10_000);
        // Capped at 200 per request so the payload stays bounded.
        org.mockito.Mockito.verify(audit).findRecent(any(), any(), eq(200));
    }

    @Test
    void malformedDetailJsonTolerated() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final var bad = new SecurityAuditRepository.Row(
                1L, "JOURNAL_RETENTION_PURGE", null, null, null, null,
                "SUCCESS", "not-json", NOW);
        when(audit.findRecent(any(), any(), anyInt())).thenReturn(List.of(bad));
        final ResponseEntity<Map<String, Object>> res =
                ctl(audit).purgeHistory(principal(), 10);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("count", 1);
        assertThat(res.getBody()).containsEntry("totalRowsPurged", 0);
    }
}
