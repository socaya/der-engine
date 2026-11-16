package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeSessionRepository;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityProperties;

/**
 * FR-02-10 — the default REVOKE_SESSION branch is covered by
 * {@code OperatorMetricsControllerTest}. This class pins the two
 * alternate policies (WARN_ONLY and REVOKE_ALL_FOR_USER) as plain
 * JUnit unit tests so a change to either branch surfaces.
 */
class ClockDriftAlternatePolicyTest {

    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> provider(final T instance) {
        final ObjectProvider<T> p = (ObjectProvider<T>) mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(instance);
        return p;
    }

    private static SecurityProperties propsWith(
            final SecurityProperties.ClockDrift.UnsafeAction action) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(100, 100),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(false),
                new SecurityProperties.FirstTimeOffline(
                        SecurityProperties.FirstTimeOffline.Policy.DISABLED),
                new SecurityProperties.BreakGlass(false, "/tmp/bg", ""),
                new SecurityProperties.ClockDrift(60_000L, action));
    }

    private static EdgeUserPrincipal principal(final UUID userId) {
        final EdgeUser u = new EdgeUser(userId, "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), NOW, NOW);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), userId, "h",
                NOW, NOW, NOW.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void warnOnlyPolicyAuditsButDoesNotRevoke() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final OperatorMetricsController ctrl = new OperatorMetricsController(
                provider(null), provider(null), audit,
                provider(sessions), provider(propsWith(
                        SecurityProperties.ClockDrift.UnsafeAction.WARN_ONLY)),
                provider(null),
                Clock.fixed(NOW, ZoneOffset.UTC));
        final UUID uid = UUID.randomUUID();
        final var body = new OperatorMetricsController.ClockReport(
                NOW.toEpochMilli() - 90_000L, null);
        final var resp = ctrl.clockReport(principal(uid), body);
        // The warn audit still fires.
        verify(audit).append(argThat((AuditEvent e) ->
                "CLOCK_DRIFT_WARN".equals(e.eventType())), any());
        // But the revoke audit does NOT — WARN_ONLY leaves the
        // session alone.
        verify(audit, never()).append(argThat((AuditEvent e) ->
                "CLOCK_DRIFT_SESSION_REVOKED".equals(e.eventType())), any());
        verify(sessions, never()).revoke(any(UUID.class), any());
        verify(sessions, never()).revokeAllForUser(any(), any());
        org.assertj.core.api.Assertions.assertThat(resp.getBody())
                .extracting("sessionRevoked").isEqualTo(false);
    }

    @Test
    void revokeAllForUserPolicyKillsEverySessionForTheCaller() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        when(sessions.revokeAllForUser(any(), any())).thenReturn(3);
        final OperatorMetricsController ctrl = new OperatorMetricsController(
                provider(null), provider(null), audit,
                provider(sessions), provider(propsWith(
                        SecurityProperties.ClockDrift.UnsafeAction.REVOKE_ALL_FOR_USER)),
                provider(null),
                Clock.fixed(NOW, ZoneOffset.UTC));
        final UUID uid = UUID.randomUUID();
        final var body = new OperatorMetricsController.ClockReport(
                NOW.toEpochMilli() - 90_000L, null);
        ctrl.clockReport(principal(uid), body);
        verify(sessions).revokeAllForUser(eq(uid), any());
        verify(sessions, never()).revoke(any(UUID.class), any());
        verify(audit).append(argThat((AuditEvent e) ->
                "CLOCK_DRIFT_SESSION_REVOKED".equals(e.eventType())
                        && "REVOKE_ALL_FOR_USER".equals(e.detail().get("action"))
                        && "3".equals(e.detail().get("sessionsRevoked"))), any());
    }
}
