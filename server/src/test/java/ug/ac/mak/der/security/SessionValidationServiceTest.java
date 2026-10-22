package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SessionValidationServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-21T12:00:00Z");

    private EdgeUser user(final boolean disabled) {
        return new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, disabled,
                Set.of(), NOW, NOW);
    }

    private EdgeSession activeSession(final UUID uid) {
        return new EdgeSession(UUID.randomUUID(), uid, "h", NOW, NOW, NOW.plusSeconds(600), null, null, null);
    }

    @Test
    void resolvesHappyPath() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SessionIssuer issuer = new SessionIssuer();
        final EdgeUser alice = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), NOW, NOW);
        final EdgeSession session = activeSession(alice.userId());
        when(sessions.findByTokenHash(issuer.hash("raw"))).thenReturn(Optional.of(session));
        when(users.findById(alice.userId())).thenReturn(Optional.of(alice));

        final SessionValidationService svc = new SessionValidationService(users, sessions, issuer,
                Clock.fixed(NOW, ZoneOffset.UTC));
        final Optional<SessionValidationService.Resolved> result = svc.resolve("raw");
        assertThat(result).isPresent();
        assertThat(result.get().user()).isSameAs(alice);
        verify(sessions).touch(session.sessionId(), NOW);
    }

    @Test
    void emptyTokenRejected() {
        final SessionValidationService svc = new SessionValidationService(
                mock(EdgeUserRepository.class), mock(EdgeSessionRepository.class),
                new SessionIssuer(), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve(null)).isEmpty();
        assertThat(svc.resolve("")).isEmpty();
        assertThat(svc.resolve("   ")).isEmpty();
    }

    @Test
    void unknownSessionRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        when(sessions.findByTokenHash(org.mockito.ArgumentMatchers.anyString())).thenReturn(Optional.empty());
        final SessionValidationService svc = new SessionValidationService(users, sessions, new SessionIssuer(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve("x")).isEmpty();
        verify(users, never()).findById(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void expiredSessionRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final UUID uid = UUID.randomUUID();
        final EdgeSession expired = new EdgeSession(UUID.randomUUID(), uid, "h", NOW.minusSeconds(600),
                NOW.minusSeconds(500), NOW.minusSeconds(60), null, null, null);
        when(sessions.findByTokenHash(org.mockito.ArgumentMatchers.anyString())).thenReturn(Optional.of(expired));
        final SessionValidationService svc = new SessionValidationService(users, sessions, new SessionIssuer(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve("x")).isEmpty();
        verify(users, never()).findById(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void revokedSessionRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final UUID uid = UUID.randomUUID();
        final EdgeSession revoked = new EdgeSession(UUID.randomUUID(), uid, "h", NOW, NOW, NOW.plusSeconds(600),
                NOW, null, null);
        when(sessions.findByTokenHash(org.mockito.ArgumentMatchers.anyString())).thenReturn(Optional.of(revoked));
        final SessionValidationService svc = new SessionValidationService(users, sessions, new SessionIssuer(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve("x")).isEmpty();
    }

    @Test
    void disabledUserRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final EdgeUser u = user(true);
        when(sessions.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(Optional.of(activeSession(u.userId())));
        when(users.findById(u.userId())).thenReturn(Optional.of(u));
        final SessionValidationService svc = new SessionValidationService(users, sessions, new SessionIssuer(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve("x")).isEmpty();
    }

    @Test
    void missingUserRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final UUID uid = UUID.randomUUID();
        when(sessions.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(Optional.of(activeSession(uid)));
        when(users.findById(uid)).thenReturn(Optional.empty());
        final SessionValidationService svc = new SessionValidationService(users, sessions, new SessionIssuer(),
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.resolve("x")).isEmpty();
    }
}
