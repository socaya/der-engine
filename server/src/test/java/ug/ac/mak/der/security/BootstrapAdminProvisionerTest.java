package ug.ac.mak.der.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class BootstrapAdminProvisionerTest {

    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private SecurityProperties props(final String user, final String pwd) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1), "C", false, "Strict", "s"),
                new SecurityProperties.SignIn(10, 10),
                new SecurityProperties.Bootstrap(user, pwd));
    }

    @Test
    void noOpWhenAdminAlreadyExists() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(users.anyUserHasRole(EdgeRole.ADMIN)).thenReturn(true);
        new BootstrapAdminProvisioner(users, hasher, audit, props("u", "p"), CLOCK).run(null);
        verify(users, never()).upsert(any(), any());
        verify(audit, never()).append(any(), any());
    }

    @Test
    void warnsAndSkipsWhenBootstrapEnvMissing() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(users.anyUserHasRole(EdgeRole.ADMIN)).thenReturn(false);
        new BootstrapAdminProvisioner(users, hasher, audit, props("", ""), CLOCK).run(null);
        verify(users, never()).upsert(any(), any());
    }

    @Test
    void provisionsAdminOnFirstBoot() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        when(users.anyUserHasRole(EdgeRole.ADMIN)).thenReturn(false);
        when(hasher.hash("hunter2")).thenReturn("verifier");

        new BootstrapAdminProvisioner(users, hasher, audit, props("Der-Admin", "hunter2"), CLOCK).run(null);

        final ArgumentCaptor<EdgeUser> cap = ArgumentCaptor.forClass(EdgeUser.class);
        verify(users).upsert(cap.capture(), eq("verifier"));
        final EdgeUser saved = cap.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.username()).isEqualTo("der-admin");
        org.assertj.core.api.Assertions.assertThat(saved.roles()).containsExactly(EdgeRole.ADMIN);
        verify(audit).append(any(AuditEvent.class), eq(NOW));
    }
}
