package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BreakGlassServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-15T20:00:00Z");

    private static SecurityProperties props(final boolean enabled,
                                             final String tokenPath,
                                             final String adminUsername) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(100, 100),
                new SecurityProperties.Bootstrap("boot-admin", ""),
                new SecurityProperties.DeviceApproval(false),
                new SecurityProperties.FirstTimeOffline(
                        SecurityProperties.FirstTimeOffline.Policy.DISABLED),
                new SecurityProperties.BreakGlass(enabled, tokenPath,
                        adminUsername));
    }

    private static EdgeUser admin(final String username, final boolean disabled) {
        return new EdgeUser(UUID.randomUUID(), username, "Admin",
                EdgeUser.Origin.BOOTSTRAP, null, disabled,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
    }

    private BreakGlassService build(final SecurityProperties p,
                                      final EdgeUserRepository users,
                                      final SecurityAuditRepository audit) {
        final PasswordHasher hasher = mock(PasswordHasher.class);
        when(hasher.hash(anyString())).thenReturn("$argon2$verifier");
        return new BreakGlassService(users, hasher, audit, p,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void constantTimeEqualsHandlesNullAndLengthMismatch() {
        assertThat(BreakGlassService.constantTimeEquals("abc", "abc")).isTrue();
        assertThat(BreakGlassService.constantTimeEquals("abc", "abd")).isFalse();
        assertThat(BreakGlassService.constantTimeEquals("abc", "abcd")).isFalse();
        assertThat(BreakGlassService.constantTimeEquals(null, "")).isTrue();
        assertThat(BreakGlassService.constantTimeEquals("a", null)).isFalse();
    }

    @Test
    void disabledReturnsDisabledOutcomeAndAuditsAttempt() {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final var svc = build(props(false, "/nope/token", ""), users, audit);
        final var out = svc.recover("anything", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Disabled.class);
        // ATTEMPTED audit even when disabled — fingerprint protection.
        verify(audit).append(argThat((AuditEvent e) ->
                BreakGlassService.EVENT_ATTEMPTED.equals(e.eventType())), any());
        verify(users, never()).upsert(any(), any());
    }

    @Test
    void enabledButTokenFileAbsentReturnsDenied(@TempDir final Path tmp) {
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final var svc = build(props(true,
                tmp.resolve("token").toString(), ""), users, audit);
        final var out = svc.recover("whatever", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Denied.class);
        assertThat(((BreakGlassService.Outcome.Denied) out).reason())
                .isEqualTo("TOKEN_FILE_ABSENT");
        verify(audit).append(argThat((AuditEvent e) ->
                BreakGlassService.EVENT_DENIED.equals(e.eventType())
                        && "TOKEN_FILE_ABSENT".equals(e.detail().get("reason"))),
                any());
    }

    @Test
    void tokenMismatchReturnsDeniedWithoutRotating(@TempDir final Path tmp)
            throws Exception {
        final Path tok = tmp.resolve("token");
        Files.writeString(tok, "correct-secret", StandardCharsets.UTF_8);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final var svc = build(props(true, tok.toString(), ""), users, audit);
        final var out = svc.recover("wrong", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Denied.class);
        assertThat(((BreakGlassService.Outcome.Denied) out).reason())
                .isEqualTo("TOKEN_MISMATCH");
        verify(users, never()).upsert(any(), any());
        // Token file must still exist after a mismatch.
        assertThat(Files.isRegularFile(tok)).isTrue();
    }

    @Test
    void successRotatesAdminReenablesAndDeletesToken(@TempDir final Path tmp)
            throws Exception {
        final Path tok = tmp.resolve("token");
        Files.writeString(tok, "correct-secret\n", StandardCharsets.UTF_8);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeUser existing = admin("boot-admin", true);  // disabled → must flip
        when(users.findByUsername("boot-admin")).thenReturn(Optional.of(existing));
        when(users.upsert(any(), anyString())).thenAnswer(i -> i.getArgument(0));
        final var svc = build(props(true, tok.toString(), "boot-admin"),
                users, audit);
        final var out = svc.recover("correct-secret", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Success.class);
        final var ok = (BreakGlassService.Outcome.Success) out;
        assertThat(ok.username()).isEqualTo("boot-admin");
        assertThat(ok.password()).isNotBlank();
        // Verifier rotated with a fresh password + admin re-enabled.
        verify(users).upsert(argThat((EdgeUser u) ->
                !u.disabled()
                        && u.roles().contains(EdgeRole.ADMIN)
                        && "boot-admin".equals(u.username())), anyString());
        verify(audit).append(argThat((AuditEvent e) ->
                BreakGlassService.EVENT_SUCCESS.equals(e.eventType())
                        && "boot-admin".equals(e.detail().get("username"))),
                any());
        // Token file consumed.
        assertThat(Files.isRegularFile(tok)).isFalse();
    }

    @Test
    void successForcesAdminRoleEvenIfStrippedFromExistingRow(@TempDir final Path tmp)
            throws Exception {
        final Path tok = tmp.resolve("token");
        Files.writeString(tok, "t", StandardCharsets.UTF_8);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeUser stripped = new EdgeUser(UUID.randomUUID(), "boot-admin",
                "Admin", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), NOW, NOW);
        when(users.findByUsername("boot-admin")).thenReturn(Optional.of(stripped));
        when(users.upsert(any(), anyString())).thenAnswer(i -> i.getArgument(0));
        final var svc = build(props(true, tok.toString(), "boot-admin"),
                users, audit);
        final var out = svc.recover("t", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Success.class);
        verify(users).upsert(argThat((EdgeUser u) ->
                u.roles().contains(EdgeRole.ADMIN)), anyString());
    }

    @Test
    void fallbackToOldestAdminWhenConfiguredUsernameMissing(@TempDir final Path tmp)
            throws Exception {
        final Path tok = tmp.resolve("token");
        Files.writeString(tok, "t", StandardCharsets.UTF_8);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        when(users.findByUsername(anyString())).thenReturn(Optional.empty());
        when(users.findOldestByRole(EdgeRole.ADMIN))
                .thenReturn(Optional.of(admin("another-admin", false)));
        when(users.upsert(any(), anyString())).thenAnswer(i -> i.getArgument(0));
        final var svc = build(props(true, tok.toString(), "absent-user"),
                users, audit);
        final var out = svc.recover("t", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.Success.class);
        assertThat(((BreakGlassService.Outcome.Success) out).username())
                .isEqualTo("another-admin");
    }

    @Test
    void noAdminAnywhereReturnsNoAdminOutcome(@TempDir final Path tmp)
            throws Exception {
        final Path tok = tmp.resolve("token");
        Files.writeString(tok, "t", StandardCharsets.UTF_8);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        when(users.findByUsername(anyString())).thenReturn(Optional.empty());
        when(users.findOldestByRole(EdgeRole.ADMIN)).thenReturn(Optional.empty());
        final var svc = build(props(true, tok.toString(), ""), users, audit);
        final var out = svc.recover("t", "1.1.1.1", "UA");
        assertThat(out).isInstanceOf(BreakGlassService.Outcome.NoAdmin.class);
        verify(audit).append(argThat((AuditEvent e) ->
                BreakGlassService.EVENT_DENIED.equals(e.eventType())
                        && "NO_ADMIN_FOUND".equals(e.detail().get("reason"))),
                any());
        verify(users, never()).upsert(any(), any());
    }
}
