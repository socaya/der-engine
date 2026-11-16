package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.network.CentralReachabilityGate;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.AuthenticationService;
import ug.ac.mak.der.security.AuthenticationService.SignInOutcome;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeSessionRepository;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.PasswordHasher;
import ug.ac.mak.der.security.RateLimiter;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityProperties;
import ug.ac.mak.der.security.SessionIssuer;

/**
 * NFR-14 — "Offline privilege + credential freshness decisions
 * follow documented deny/expiry policy."
 *
 * <p>End-to-end time-travel scenario proving the FR-02-06 offline-
 * credential-age window actually denies as time advances past the
 * configured bound, and that the online path refreshes the witness
 * so the window resets on the next sign-in. Matches the pilot
 * runbook's expected posture: a DHIS2-origin user who hasn't come
 * back online in {@code der.security.offline-credential.max-age-days}
 * days must re-validate against central.</p>
 *
 * <p>Timeline (max-age=30 days):
 * <pre>
 *   T0            witness stamp; central REACHABLE; sign-in → Success
 *   T+29 days     central OFFLINE; sign-in → Success (within window)
 *   T+31 days     central OFFLINE; sign-in → OfflineCredentialExpired
 *                 + audit SIGN_IN_FAILURE reason=OFFLINE_CREDENTIAL_EXPIRED
 *   T+31 days +   central REACHABLE; sign-in → Success
 *   1 hour        witness stamped fresh
 * </pre></p>
 *
 * <p>The scenario uses real {@link AuthenticationService} with
 * real {@link PasswordHasher}; only the repos / rate limiter /
 * session issuer are stubbed with in-memory state so Clock
 * substitution drives the timeline.</p>
 */
class Nfr14OfflineCredentialFreshnessScenarioTest {

    private static final Instant T0 = Instant.parse("2026-11-16T10:00:00Z");
    private static final String USERNAME = "nurse.alice";
    private static final String PASSWORD = "n0t-a-real-password";
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();

    @Test
    void offlineCredentialAgeTimelineHoldsEndToEnd() {
        final EdgeUser alice = new EdgeUser(USER_ID, USERNAME, "Alice",
                EdgeUser.Origin.DHIS2, "DHIS2_UID_ALICE", false,
                EnumSet.of(EdgeRole.OPERATOR), T0, T0);

        // In-memory witness state — the only thing the timeline mutates.
        final java.util.concurrent.atomic.AtomicReference<Instant> witness =
                new java.util.concurrent.atomic.AtomicReference<>(T0);

        final EdgeUserRepository users = mock(EdgeUserRepository.class);
        when(users.findByUsername(USERNAME)).thenReturn(Optional.of(alice));
        when(users.findVerifier(USER_ID)).thenReturn(Optional.of(
                new PasswordHasher().hash(PASSWORD)));
        // markCentralSyncAt mutates the in-memory witness (the real
        // repo would UPDATE der.edge_user.last_central_sync_at).
        when(users.markCentralSyncAt(eq(USER_ID), any()))
                .thenAnswer(inv -> { witness.set(inv.getArgument(1)); return 1; });
        // findLastCentralSyncAt reads the in-memory witness so the
        // timeline advances as `witness` moves.
        when(users.findLastCentralSyncAt(USER_ID))
                .thenAnswer(inv -> Optional.of(witness.get()));

        final EdgeSessionRepository sessions = mock(EdgeSessionRepository.class);
        when(sessions.insert(any())).thenAnswer(inv -> inv.getArgument(0));

        // In-memory audit sink — the real repo writes to the hash-
        // chained security_audit table; for this scenario we capture
        // the events into a list so the timeline can inspect them.
        // Also stub hasEverSignedInSuccessfully to read back the
        // captured events so FR-02-07 first-time policy sees state
        // that mutates as the timeline advances.
        final List<AuditEvent> auditEvents = new ArrayList<>();
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        doAnswer(inv -> { auditEvents.add(inv.getArgument(0)); return null; })
                .when(audit).append(any(), any());
        when(audit.hasEverSignedInSuccessfully(any())).thenAnswer(inv ->
                auditEvents.stream().anyMatch(e ->
                        "SIGN_IN_SUCCESS".equals(e.eventType())
                                && inv.<UUID>getArgument(0).equals(e.subjectUserId())));
        final SessionIssuer issuer = fixedIssuer();
        final RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.tryAcquire(any(), any(), anyInt())).thenReturn(true);

        // ---- T0: online sign-in; witness stamp happens via markCentralSyncAt
        final AuthenticationService svcT0 = build(users, sessions, audit, issuer,
                limiter, T0);
        svcT0.setGate(gateProvider(reachableGate(T0)));
        final var r0 = svcT0.signIn(USERNAME, PASSWORD, "1.1.1.1", "UA");
        assertThat(r0).isInstanceOf(SignInOutcome.Success.class);
        assertThat(witness.get()).isEqualTo(T0);

        // ---- T+29 days OFFLINE: inside the window; sign-in succeeds
        final Instant t29 = T0.plus(29, ChronoUnit.DAYS);
        final AuthenticationService svcT29 = build(users, sessions, audit, issuer,
                limiter, t29);
        svcT29.setGate(gateProvider(offlineGate(t29)));
        final var r29 = svcT29.signIn(USERNAME, PASSWORD, "1.1.1.1", "UA");
        assertThat(r29)
                .as("within 30-day window even while OFFLINE")
                .isInstanceOf(SignInOutcome.Success.class);
        // Witness wasn't refreshed (central OFFLINE).
        assertThat(witness.get()).isEqualTo(T0);

        // ---- T+31 days OFFLINE: window exceeded; sign-in DENIED
        final Instant t31 = T0.plus(31, ChronoUnit.DAYS);
        final AuthenticationService svcT31 = build(users, sessions, audit, issuer,
                limiter, t31);
        svcT31.setGate(gateProvider(offlineGate(t31)));
        final var r31 = svcT31.signIn(USERNAME, PASSWORD, "1.1.1.1", "UA");
        assertThat(r31)
                .as("31d OFFLINE must deny per FR-02-06 / NFR-14")
                .isInstanceOf(SignInOutcome.OfflineCredentialExpired.class);
        // The deny MUST emit an audit event with the structured
        // reason so operators can correlate the denial to policy.
        final AuditEvent denyEvent = auditEvents.stream()
                .filter(e -> "SIGN_IN_FAILURE".equals(e.eventType())
                        && "OFFLINE_CREDENTIAL_EXPIRED".equals(e.detail().get("reason")))
                .findFirst().orElse(null);
        assertThat(denyEvent)
                .as("SIGN_IN_FAILURE reason=OFFLINE_CREDENTIAL_EXPIRED must land on the audit chain")
                .isNotNull();
        assertThat(denyEvent.subjectUserId()).isEqualTo(USER_ID);
        assertThat(denyEvent.detail().get("maxAgeDays")).isEqualTo("30");
        // Witness unchanged — no session should have been issued.
        assertThat(witness.get()).isEqualTo(T0);

        // ---- T+31 days REACHABLE: window exceeded but online path
        // refreshes the witness BEFORE the age check, so sign-in
        // succeeds and the window resets.
        final Instant t31r = t31.plus(Duration.ofHours(1));
        final AuthenticationService svcT31r = build(users, sessions, audit, issuer,
                limiter, t31r);
        svcT31r.setGate(gateProvider(reachableGate(t31r)));
        final var r31r = svcT31r.signIn(USERNAME, PASSWORD, "1.1.1.1", "UA");
        assertThat(r31r)
                .as("REACHABLE auto-refreshes witness; sign-in succeeds")
                .isInstanceOf(SignInOutcome.Success.class);
        assertThat(witness.get())
                .as("witness stamped fresh by markCentralSyncAt")
                .isEqualTo(t31r);
    }

    // ---- scaffolding ----

    private static AuthenticationService build(
            final EdgeUserRepository users, final EdgeSessionRepository sessions,
            final SecurityAuditRepository audit, final SessionIssuer issuer,
            final RateLimiter limiter, final Instant at) {
        final SecurityProperties props = new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "scenario-seed"),
                new SecurityProperties.SignIn(100, 100),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(false),
                new SecurityProperties.FirstTimeOffline(
                        SecurityProperties.FirstTimeOffline.Policy.DISABLED),
                null, null,
                new SecurityProperties.OfflineCredential(30));
        return new AuthenticationService(users, sessions, audit,
                new PasswordHasher(), issuer, limiter, props,
                Clock.fixed(at, ZoneOffset.UTC));
    }

    private static SessionIssuer fixedIssuer() {
        final SessionIssuer real = new SessionIssuer();
        final SessionIssuer stub = mock(SessionIssuer.class);
        when(stub.issueToken()).thenReturn("tok-" + SESSION_ID);
        when(stub.hash(anyString())).thenAnswer(inv -> real.hash(inv.getArgument(0)));
        return stub;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<CentralReachabilityGate> gateProvider(
            final CentralReachabilityGate g) {
        final ObjectProvider<CentralReachabilityGate> p =
                (ObjectProvider<CentralReachabilityGate>) mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(g);
        return p;
    }

    private static CentralReachabilityGate reachableGate(final Instant at) {
        return new CentralReachabilityGate(Clock.fixed(at, ZoneOffset.UTC));
    }

    private static CentralReachabilityGate offlineGate(final Instant at) {
        final var g = new CentralReachabilityGate(
                Clock.fixed(at, ZoneOffset.UTC));
        g.observe(false);
        g.observe(false);
        return g;
    }

}
