package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeSessionTest {

    private static final UUID SID = UUID.randomUUID();
    private static final UUID UID = UUID.randomUUID();
    private static final Instant T0 = Instant.parse("2026-10-21T00:00:00Z");

    @Test
    void requiresPositiveTtl() {
        assertThatThrownBy(() -> new EdgeSession(SID, UID, "h", T0, T0, T0, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void isActiveWhenNotRevokedAndBeforeExpiry() {
        final Instant exp = T0.plusSeconds(60);
        final EdgeSession s = new EdgeSession(SID, UID, "h", T0, T0, exp, null, null, null);
        assertThat(s.isActive(T0.plusSeconds(10))).isTrue();
        assertThat(s.isActive(exp)).isFalse();
    }

    /**
     * FR-02-10 "explicit decisions on token expiry" — the fail-safe
     * decision is NO grace window. This pins that invariant so a
     * future refactor can't silently introduce slack (which would
     * undermine the Phase 5g ETag concurrency + the audit-log
     * freshness contract).
     */
    @Test
    void isActiveStrictlyBoundedByExpiresAtNoGraceWindow() {
        final Instant exp = T0.plusSeconds(60);
        final EdgeSession s = new EdgeSession(SID, UID, "h", T0, T0, exp, null, null, null);
        // One nanosecond before expiry — still active.
        assertThat(s.isActive(exp.minusNanos(1))).isTrue();
        // Exactly at expiry — INACTIVE. Half-open interval
        // [issuedAt, expiresAt).
        assertThat(s.isActive(exp)).isFalse();
        // One second past — still inactive.
        assertThat(s.isActive(exp.plusSeconds(1))).isFalse();
    }

    @Test
    void isInactiveWhenRevoked() {
        final EdgeSession s = new EdgeSession(SID, UID, "h", T0, T0, T0.plusSeconds(60), T0.plusSeconds(5), null, null);
        assertThat(s.isActive(T0.plusSeconds(10))).isFalse();
    }

    @Test
    void rejectsNullTokenHash() {
        assertThatThrownBy(() -> new EdgeSession(SID, UID, null, T0, T0, T0.plusSeconds(60), null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("tokenHash");
    }

    @Test
    void rejectsNullSessionId() {
        assertThatThrownBy(() -> new EdgeSession(null, UID, "h", T0, T0, T0.plusSeconds(60), null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("sessionId");
    }

    @Test
    void rejectsNullUserId() {
        assertThatThrownBy(() -> new EdgeSession(SID, null, "h", T0, T0, T0.plusSeconds(60), null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("userId");
    }

    @Test
    void rejectsNullIssuedAt() {
        assertThatThrownBy(() -> new EdgeSession(SID, UID, "h", null, T0, T0.plusSeconds(60), null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("issuedAt");
    }

    @Test
    void rejectsNullLastSeenAt() {
        assertThatThrownBy(() -> new EdgeSession(SID, UID, "h", T0, null, T0.plusSeconds(60), null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("lastSeenAt");
    }

    @Test
    void rejectsNullExpiresAt() {
        assertThatThrownBy(() -> new EdgeSession(SID, UID, "h", T0, T0, null, null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("expiresAt");
    }
}
