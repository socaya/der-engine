package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
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
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class AuthenticationServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-21T12:00:00Z");

    private static SecurityProperties props(final int ipLimit, final int userLimit) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1), "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(ipLimit, userLimit),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(false));
    }

    private static EdgeUser user(final boolean disabled) {
        return new EdgeUser(UUID.randomUUID(), "alice", "Alice", EdgeUser.Origin.BOOTSTRAP, null, disabled,
                EnumSet.of(EdgeRole.OPERATOR), NOW, NOW);
    }

    @Test
    void successIssuesSession() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        final EdgeUser alice = user(false);

        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(users.findVerifier(alice.userId())).thenReturn(Optional.of("stored-verifier"));
        when(hasher.verify("hunter2", "stored-verifier")).thenReturn(true);
        when(issuer.issueToken()).thenReturn("raw-token");
        when(issuer.hash("raw-token")).thenReturn("hash");
        when(sessions.insert(any())).thenAnswer(inv -> inv.getArgument(0));

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), clock);
        final AuthenticationService.SignInOutcome outcome = svc.signIn("Alice", "hunter2", "1.1.1.1", "UA");

        assertThat(outcome).isInstanceOf(AuthenticationService.SignInOutcome.Success.class);
        final AuthenticationService.SignInOutcome.Success ok = (AuthenticationService.SignInOutcome.Success) outcome;
        assertThat(ok.rawToken()).isEqualTo("raw-token");
        assertThat(ok.user().username()).isEqualTo("alice");
        verify(audit).append(any(AuditEvent.class), eq(NOW));
    }

    @Test
    void unknownUserForcesDummyVerifierPath() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);

        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(anyString())).thenReturn(Optional.empty());
        when(hasher.verify(eq("anything"), eq(AuthenticationService.DUMMY_VERIFIER))).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        final AuthenticationService.SignInOutcome outcome = svc.signIn("ghost", "anything", "ip", "ua");

        assertThat(outcome).isInstanceOf(AuthenticationService.SignInOutcome.InvalidCredentials.class);
        verify(hasher).verify(eq("anything"), eq(AuthenticationService.DUMMY_VERIFIER));
        verify(sessions, never()).insert(any());
    }

    @Test
    void disabledUserIsDenied() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        final EdgeUser disabled = user(true);

        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername("alice")).thenReturn(Optional.of(disabled));
        when(users.findVerifier(disabled.userId())).thenReturn(Optional.of("v"));
        when(hasher.verify(any(), eq("v"))).thenReturn(true);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.signIn("alice", "x", "ip", "ua"))
                .isInstanceOf(AuthenticationService.SignInOutcome.InvalidCredentials.class);
        verify(sessions, never()).insert(any());
    }

    @Test
    void rateLimitedBeforePasswordCheck() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);

        when(limiter.tryAcquire(eq(RateLimiter.Scope.SIGN_IN_IP), any(), anyInt())).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.signIn("alice", "x", "1.1.1.1", "ua"))
                .isInstanceOf(AuthenticationService.SignInOutcome.RateLimited.class);
        verify(users, never()).findByUsername(any());
    }

    @Test
    void perUserRateLimitAlsoBlocks() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);

        when(limiter.tryAcquire(eq(RateLimiter.Scope.SIGN_IN_IP), any(), anyInt())).thenReturn(true);
        when(limiter.tryAcquire(eq(RateLimiter.Scope.SIGN_IN_USER), any(), anyInt())).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.signIn("alice", "x", "1.1.1.1", "ua"))
                .isInstanceOf(AuthenticationService.SignInOutcome.RateLimited.class);
    }

    @Test
    void signOutRevokesSessionAndAudits() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);

        final UUID sid = UUID.randomUUID();
        final UUID uid = UUID.randomUUID();
        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        svc.signOut(sid, uid, "ip", "ua");
        verify(sessions).revoke(sid, NOW);
        verify(audit).append(any(AuditEvent.class), eq(NOW));
    }

    @Test
    void userWithoutStoredVerifierHitsDummy() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        final EdgeUser alice = user(false);

        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(users.findVerifier(alice.userId())).thenReturn(Optional.empty());
        when(hasher.verify(any(), eq(AuthenticationService.DUMMY_VERIFIER))).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.signIn("alice", "x", "ip", "ua"))
                .isInstanceOf(AuthenticationService.SignInOutcome.InvalidCredentials.class);
    }

    @Test
    void nullUsernameNormalisesToEmptyAndIsRejected() {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);

        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername("")).thenReturn(Optional.empty());
        when(hasher.verify(any(), eq(AuthenticationService.DUMMY_VERIFIER))).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users, sessions, audit, hasher, issuer, limiter,
                props(10, 10), Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(svc.signIn(null, "x", "ip", "ua"))
                .isInstanceOf(AuthenticationService.SignInOutcome.InvalidCredentials.class);
    }

    @Test
    void outcomeFactoriesAreSingletons() {
        assertThat(AuthenticationService.SignInOutcome.invalidCredentials())
                .isSameAs(AuthenticationService.SignInOutcome.invalidCredentials());
        assertThat(AuthenticationService.SignInOutcome.rateLimited())
                .isSameAs(AuthenticationService.SignInOutcome.rateLimited());
        final AuthenticationService.SignInOutcome.Success s = (AuthenticationService.SignInOutcome.Success)
                AuthenticationService.SignInOutcome.success(user(false),
                        new EdgeSession(UUID.randomUUID(), UUID.randomUUID(), "h", NOW, NOW, NOW.plusSeconds(1),
                                null, null, null),
                        "raw");
        assertThat(s.rawToken()).isEqualTo("raw");
    }

    // ---- FR-02-07 first-time-offline policy -----------------------

    private static SecurityProperties propsWithPolicy(
            final SecurityProperties.FirstTimeOffline.Policy policy) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(100, 100),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(false),
                new SecurityProperties.FirstTimeOffline(policy),
                null, null,
                // FR-02-06 disabled for FR-02-07 policy tests — those
                // predate FR-02-06 and shouldn't cross-interfere.
                new SecurityProperties.OfflineCredential(0));
    }

    private AuthenticationService svcWithUser(final EdgeUser u,
                                                final boolean hasEverSignedIn,
                                                final SecurityProperties props) {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(u.username())).thenReturn(Optional.of(u));
        when(users.findVerifier(u.userId())).thenReturn(Optional.of("v"));
        when(hasher.verify(anyString(), anyString())).thenReturn(true);
        when(issuer.issueToken()).thenReturn("tok");
        when(issuer.hash(anyString())).thenReturn("h");
        when(sessions.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(audit.hasEverSignedInSuccessfully(u.userId())).thenReturn(hasEverSignedIn);
        return new AuthenticationService(users, sessions, audit, hasher, issuer,
                limiter, props, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static EdgeUser userWithOrigin(final EdgeUser.Origin origin) {
        return new EdgeUser(UUID.randomUUID(), "u-" + origin.name().toLowerCase(),
                "U " + origin.name(), origin, null, false,
                EnumSet.of(EdgeRole.OPERATOR), NOW, NOW);
    }

    @Test
    void firstTimeOfflineAllowedForBootstrapUnderDefaultPolicy() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.BOOTSTRAP);
        final AuthenticationService svc = svcWithUser(u, false,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .REQUIRE_ONLINE_FIRST));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void firstTimeOfflineAllowedForDhis2OriginUnderDefaultPolicy() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final AuthenticationService svc = svcWithUser(u, false,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .REQUIRE_ONLINE_FIRST));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void firstTimeOfflineDeniedUnderBootstrapOnlyForDhis2User() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final AuthenticationService svc = svcWithUser(u, false,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .BOOTSTRAP_ONLY));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.FirstTimeOfflineDenied.class);
    }

    @Test
    void firstTimeOfflineAllowedUnderBootstrapOnlyForBootstrapUser() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.BOOTSTRAP);
        final AuthenticationService svc = svcWithUser(u, false,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .BOOTSTRAP_ONLY));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void priorSignInBypassesPolicyEvenUnderStrict() {
        // Even under BOOTSTRAP_ONLY — a user who has signed in before
        // is no longer "first-time." The policy gates onboarding, not
        // ongoing sign-in.
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final AuthenticationService svc = svcWithUser(u, true,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .BOOTSTRAP_ONLY));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void disabledPolicyLetsAnyFirstTimeUserIn() {
        // Belt-and-braces check that DISABLED actually turns the gate
        // off — a hypothetical user with no origin at all still signs
        // in. (We can't actually construct one without an origin, so
        // DHIS2-origin + first-time acts as the probe.)
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final AuthenticationService svc = svcWithUser(u, false,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .DISABLED));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void firstTimeDeniedAuditsReasonAndDoesNotIssueSession() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(anyString())).thenReturn(Optional.of(u));
        when(users.findVerifier(any())).thenReturn(Optional.of("v"));
        when(hasher.verify(anyString(), anyString())).thenReturn(true);
        when(audit.hasEverSignedInSuccessfully(u.userId())).thenReturn(false);

        final AuthenticationService svc = new AuthenticationService(users,
                sessions, audit, hasher, issuer, limiter,
                propsWithPolicy(SecurityProperties.FirstTimeOffline.Policy
                        .BOOTSTRAP_ONLY),
                Clock.fixed(NOW, ZoneOffset.UTC));
        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.FirstTimeOfflineDenied.class);
        // Session NOT issued; audit captures the reason.
        verify(sessions, never()).insert(any());
        verify(audit).append(
                org.mockito.ArgumentMatchers.argThat((AuditEvent e) ->
                        "SIGN_IN_FAILURE".equals(e.eventType())
                                && "FIRST_TIME_OFFLINE_DENIED"
                                    .equals(e.detail().get("reason"))),
                any());
    }

    // ---- FR-02-06 offline credential-age ------------------------

    private static SecurityProperties propsWithOfflineMaxAge(final int days) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(100, 100),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(false),
                new SecurityProperties.FirstTimeOffline(
                        SecurityProperties.FirstTimeOffline.Policy.DISABLED),
                null, null,
                new SecurityProperties.OfflineCredential(days));
    }

    @SuppressWarnings("unchecked")
    private static org.springframework.beans.factory.ObjectProvider<
            ug.ac.mak.der.network.CentralReachabilityGate> gateProvider(
            final ug.ac.mak.der.network.CentralReachabilityGate g) {
        final var p = (org.springframework.beans.factory.ObjectProvider<
                ug.ac.mak.der.network.CentralReachabilityGate>)
                mock(org.springframework.beans.factory.ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(g);
        return p;
    }

    @Test
    void offlineExpiredDhis2UserIsDenied() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(u.username())).thenReturn(Optional.of(u));
        when(users.findVerifier(u.userId())).thenReturn(Optional.of("v"));
        when(hasher.verify(anyString(), anyString())).thenReturn(true);
        when(audit.hasEverSignedInSuccessfully(u.userId())).thenReturn(true);
        // Last witness 60 days ago — well over the 30-day window.
        when(users.findLastCentralSyncAt(u.userId()))
                .thenReturn(Optional.of(NOW.minus(60, java.time.temporal.ChronoUnit.DAYS)));

        final AuthenticationService svc = new AuthenticationService(users, sessions,
                audit, hasher, issuer, limiter,
                propsWithOfflineMaxAge(30), Clock.fixed(NOW, ZoneOffset.UTC));
        // Central is OFFLINE — the gate otherwise auto-refreshes.
        svc.setGate(gateProvider(offlineGate()));

        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.OfflineCredentialExpired.class);
        verify(sessions, never()).insert(any());
        verify(audit).append(
                org.mockito.ArgumentMatchers.argThat((AuditEvent e) ->
                        "SIGN_IN_FAILURE".equals(e.eventType())
                                && "OFFLINE_CREDENTIAL_EXPIRED"
                                    .equals(e.detail().get("reason"))),
                any());
    }

    @Test
    void offlineFreshDhis2UserSignsIn() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final AuthenticationService svc = svcWithUser(u, true,
                propsWithOfflineMaxAge(30));
        svc.setGate(gateProvider(offlineGate()));
        // Witness 5 days ago — inside the 30-day window.
        final var repo = mock(EdgeUserRepository.class);
        when(repo.findLastCentralSyncAt(u.userId()))
                .thenReturn(Optional.of(NOW.minus(5, java.time.temporal.ChronoUnit.DAYS)));
        // Stub-swap isn't trivial on the private repo — build a full
        // fresh service for this case instead.
        final var outcome = fullyWiredSvc(u, 30,
                Optional.of(NOW.minus(5, java.time.temporal.ChronoUnit.DAYS)),
                /* reachable */ false)
                .signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void bootstrapUserBypassesOfflineAgeGate() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.BOOTSTRAP);
        // 10 years ago — doesn't matter, bootstrap is always exempt.
        final var outcome = fullyWiredSvc(u, 30,
                Optional.of(NOW.minus(3650, java.time.temporal.ChronoUnit.DAYS)),
                false).signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    @Test
    void reachableCentralRefreshesWitnessAndAllowsSignIn() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(u.username())).thenReturn(Optional.of(u));
        when(users.findVerifier(u.userId())).thenReturn(Optional.of("v"));
        when(hasher.verify(anyString(), anyString())).thenReturn(true);
        when(issuer.issueToken()).thenReturn("tok");
        when(issuer.hash(anyString())).thenReturn("h");
        when(sessions.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(audit.hasEverSignedInSuccessfully(u.userId())).thenReturn(true);
        // Witness 100 days ago — would be denied if central were offline.
        when(users.findLastCentralSyncAt(u.userId()))
                .thenReturn(Optional.of(NOW.minus(100, java.time.temporal.ChronoUnit.DAYS)));

        final AuthenticationService svc = new AuthenticationService(users, sessions,
                audit, hasher, issuer, limiter,
                propsWithOfflineMaxAge(30), Clock.fixed(NOW, ZoneOffset.UTC));
        svc.setGate(gateProvider(reachableGate()));

        final var outcome = svc.signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
        // The gate refresh MUST fire. Without it, next offline sign-in
        // would also expire — the whole point is that an online
        // sign-in resets the window.
        verify(users).markCentralSyncAt(eq(u.userId()), eq(NOW));
    }

    @Test
    void disabledOfflineAgeGateLetsAncientUserIn() {
        final EdgeUser u = userWithOrigin(EdgeUser.Origin.DHIS2);
        // 10 years ago, gate disabled — allowed.
        final var outcome = fullyWiredSvc(u, 0,
                Optional.of(NOW.minus(3650, java.time.temporal.ChronoUnit.DAYS)),
                false).signIn(u.username(), "pw", "1.1.1.1", "UA");
        assertThat(outcome).isInstanceOf(
                AuthenticationService.SignInOutcome.Success.class);
    }

    private static ug.ac.mak.der.network.CentralReachabilityGate reachableGate() {
        return new ug.ac.mak.der.network.CentralReachabilityGate(
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ug.ac.mak.der.network.CentralReachabilityGate offlineGate() {
        final var g = new ug.ac.mak.der.network.CentralReachabilityGate(
                Clock.fixed(NOW, ZoneOffset.UTC));
        g.observe(false);
        g.observe(false);
        return g;
    }

    private AuthenticationService fullyWiredSvc(final EdgeUser u, final int maxAgeDays,
                                                  final Optional<Instant> witness,
                                                  final boolean reachable) {
        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        final SessionIssuer issuer = mock(SessionIssuer.class);
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);
        when(users.findByUsername(u.username())).thenReturn(Optional.of(u));
        when(users.findVerifier(u.userId())).thenReturn(Optional.of("v"));
        when(hasher.verify(anyString(), anyString())).thenReturn(true);
        when(issuer.issueToken()).thenReturn("tok");
        when(issuer.hash(anyString())).thenReturn("h");
        when(sessions.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(audit.hasEverSignedInSuccessfully(u.userId())).thenReturn(true);
        when(users.findLastCentralSyncAt(u.userId())).thenReturn(witness);
        final AuthenticationService svc = new AuthenticationService(users, sessions,
                audit, hasher, issuer, limiter,
                propsWithOfflineMaxAge(maxAgeDays), Clock.fixed(NOW, ZoneOffset.UTC));
        svc.setGate(gateProvider(reachable ? reachableGate() : offlineGate()));
        return svc;
    }
}
