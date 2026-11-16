package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;

class UserSyncServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T02:00:00Z");

    @SuppressWarnings("unchecked")
    private static ObjectProvider<EdgeSessionRepository> sessionsProvider(
            final EdgeSessionRepository r) {
        final ObjectProvider<EdgeSessionRepository> p =
                (ObjectProvider<EdgeSessionRepository>) mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(r);
        return p;
    }

    private static Dhis2ReferenceClient centralReturning(final String json) throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(UserSyncService.USERS_PATH))
                .thenReturn(new ObjectMapper().readTree(json));
        return c;
    }

    private static UserSyncService svc(final Dhis2ReferenceClient central,
                                           final EdgeUserRepository users,
                                           final SecurityAuditRepository audit,
                                           final EdgeSessionRepository sessions) {
        final UserSyncService s = new UserSyncService(central, users, audit,
                Clock.fixed(NOW, ZoneOffset.UTC), true);
        s.setSessions(sessionsProvider(sessions));
        return s;
    }

    private static EdgeUser dhis2User(final UUID id, final String username,
                                           final String uid, final boolean disabled,
                                           final Set<EdgeRole> roles) {
        return new EdgeUser(id, username, "Display", EdgeUser.Origin.DHIS2,
                uid, disabled, roles, NOW.minusSeconds(3600), NOW.minusSeconds(3600));
    }

    @Test
    void newCentralUserIsMirroredAsOperatorAndStampsWitness() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var sessions = mock(EdgeSessionRepository.class);
        when(users.findByExternalUid("UID_A")).thenReturn(Optional.empty());
        when(users.findAll()).thenReturn(List.of());
        final var central = centralReturning("""
                {"users":[{"id":"UID_A","username":"alice",
                 "displayName":"Alice","disabled":false,
                 "userRoles":[{"name":"Data Entry","authorities":["F_RUN_VALIDATION"]}]}]}
                """);
        final var report = svc(central, users, audit, sessions).sweepNow("TEST");
        assertThat(report.upserts()).isEqualTo(1);
        verify(users).upsert(argThat((EdgeUser u) ->
                "alice".equals(u.username())
                        && "UID_A".equals(u.externalUid())
                        && u.origin() == EdgeUser.Origin.DHIS2
                        && !u.disabled()
                        && u.roles().equals(EnumSet.of(EdgeRole.OPERATOR))),
                eq(null));
        verify(users).markCentralSyncAt(any(UUID.class), eq(NOW));
        verify(audit).append(argThat((AuditEvent e) ->
                "USER_SYNC_UPSERT".equals(e.eventType())
                        && "UID_A".equals(e.detail().get("externalUid"))),
                any());
    }

    @Test
    void userWithAllAuthorityGetsAdminRole() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(users.findByExternalUid("UID_B")).thenReturn(Optional.empty());
        when(users.findAll()).thenReturn(List.of());
        final var central = centralReturning("""
                {"users":[{"id":"UID_B","username":"root",
                 "displayName":"Root","disabled":false,
                 "userRoles":[{"name":"Superuser","authorities":["ALL"]}]}]}
                """);
        svc(central, users, audit, mock(EdgeSessionRepository.class))
                .sweepNow("TEST");
        verify(users).upsert(argThat((EdgeUser u) ->
                u.roles().contains(EdgeRole.ADMIN)
                        && u.roles().contains(EdgeRole.OPERATOR)),
                eq(null));
    }

    @Test
    void existingLocalAdminStaysAdminEvenIfCentralDoesntSayAll() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final UUID uid = UUID.randomUUID();
        when(users.findByExternalUid("UID_C")).thenReturn(Optional.of(
                dhis2User(uid, "carol", "UID_C", false,
                        EnumSet.of(EdgeRole.ADMIN, EdgeRole.OPERATOR))));
        when(users.findAll()).thenReturn(List.of());
        final var central = centralReturning("""
                {"users":[{"id":"UID_C","username":"carol",
                 "displayName":"Carol","disabled":false,
                 "userRoles":[{"name":"Data Entry","authorities":["F_RUN_VALIDATION"]}]}]}
                """);
        svc(central, users, audit, mock(EdgeSessionRepository.class))
                .sweepNow("TEST");
        // Local admin posture wins — central-side misconfig can't
        // strip privileges unilaterally.
        verify(users).upsert(argThat((EdgeUser u) ->
                u.roles().contains(EdgeRole.ADMIN)),
                eq(null));
    }

    @Test
    void centralDisabledRevokesLocalSessions() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var sessions = mock(EdgeSessionRepository.class);
        final UUID uid = UUID.randomUUID();
        when(users.findByExternalUid("UID_D")).thenReturn(Optional.of(
                dhis2User(uid, "dan", "UID_D", /* previously enabled */ false,
                        EnumSet.of(EdgeRole.OPERATOR))));
        when(users.findAll()).thenReturn(List.of());
        final var central = centralReturning("""
                {"users":[{"id":"UID_D","username":"dan",
                 "displayName":"Dan","disabled":true,
                 "userRoles":[]}]}
                """);
        svc(central, users, audit, sessions).sweepNow("TEST");
        verify(users).upsert(argThat((EdgeUser u) -> u.disabled()), eq(null));
        verify(sessions).revokeAllForUser(eq(uid), any());
        verify(audit).append(argThat((AuditEvent e) ->
                "USER_SYNC_DISABLED".equals(e.eventType())),
                any());
    }

    @Test
    void localDhis2UserMissingFromCentralIsTombstoned() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var sessions = mock(EdgeSessionRepository.class);
        final UUID stale = UUID.randomUUID();
        when(users.findAll()).thenReturn(List.of(
                dhis2User(stale, "ghost", "UID_GHOST", false,
                        EnumSet.of(EdgeRole.OPERATOR))));
        // Central returns zero users.
        final var central = centralReturning("{\"users\":[]}");
        final var report = svc(central, users, audit, sessions).sweepNow("TEST");
        assertThat(report.tombstones()).isEqualTo(1);
        verify(users).setDisabled(eq(stale), eq(true));
        verify(sessions).revokeAllForUser(eq(stale), any());
        verify(audit).append(argThat((AuditEvent e) ->
                "USER_RECONCILIATION_REMOVED".equals(e.eventType())
                        && "UID_GHOST".equals(e.detail().get("externalUid"))),
                any());
    }

    @Test
    void bootstrapOriginIsNeverTombstoned() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var sessions = mock(EdgeSessionRepository.class);
        final UUID admin = UUID.randomUUID();
        final EdgeUser bootstrap = new EdgeUser(admin, "der-admin",
                "Admin", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
        when(users.findAll()).thenReturn(List.of(bootstrap));
        final var central = centralReturning("{\"users\":[]}");
        svc(central, users, audit, sessions).sweepNow("TEST");
        verify(users, never()).setDisabled(eq(admin), eq(true));
        verify(sessions, never()).revokeAllForUser(eq(admin), any());
    }

    @Test
    void centralUnreachableDoesNotTouchAnyUser() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var sessions = mock(EdgeSessionRepository.class);
        final var central = mock(Dhis2ReferenceClient.class);
        when(central.fetchJson(UserSyncService.USERS_PATH))
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException(
                        "central dark", null));
        final var report = svc(central, users, audit, sessions).sweepNow("TEST");
        assertThat(report.error()).contains("central dark");
        verify(users, never()).upsert(any(), any());
        verify(users, never()).setDisabled(any(), org.mockito.ArgumentMatchers.anyBoolean());
        verify(audit).append(argThat((AuditEvent e) ->
                "USER_SYNC_RUN".equals(e.eventType())
                        && e.outcome() == AuditEvent.Outcome.ERROR),
                any());
    }

    @Test
    void scheduledSweepIsGatedByEnabledFlag() throws Exception {
        final var users = mock(EdgeUserRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var central = mock(Dhis2ReferenceClient.class);
        final var s = new UserSyncService(central, users, audit,
                Clock.fixed(NOW, ZoneOffset.UTC), /* enabled */ false);
        s.dailySweep();
        verify(central, never()).fetchJson(any());
        verify(users, never()).findAll();
    }
}
