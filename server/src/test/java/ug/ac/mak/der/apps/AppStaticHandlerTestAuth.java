package ug.ac.mak.der.apps;

import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Shared helper — mounts a minimal EdgeUserPrincipal into the Spring
 *  SecurityContext so AppStaticHandler's session gate returns true.
 *  AppStaticHandler was gated behind a session at Phase 2a; before that
 *  its tests called {@code serve()} directly with no auth context. */
final class AppStaticHandlerTestAuth {

    private AppStaticHandlerTestAuth() { }

    static void authenticate() {
        final Instant now = Instant.now();
        final EdgeUser user = new EdgeUser(
                UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP,
                null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession session = new EdgeSession(
                UUID.randomUUID(), user.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        SecurityContextHolder.getContext().setAuthentication(
                new EdgeUserPrincipal(user, session));
    }

    static void clear() {
        SecurityContextHolder.clearContext();
    }
}
