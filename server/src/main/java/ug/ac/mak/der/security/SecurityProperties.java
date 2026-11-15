package ug.ac.mak.der.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/**
 * Typed Phase 02 security configuration.
 *
 * @param session         session cookie policy
 * @param signIn          rate-limit bounds applied to {@code /auth/sign-in}
 * @param bootstrap       first-boot administrator provisioning
 * @param deviceApproval  ADR-0019 slice B — gate app access on APPROVED trust
 */
@ConfigurationProperties(prefix = "der.security")
public record SecurityProperties(Session session, SignIn signIn, Bootstrap bootstrap,
                                    DeviceApproval deviceApproval,
                                    FirstTimeOffline firstTimeOffline,
                                    BreakGlass breakGlass) {

    @ConstructorBinding
    public SecurityProperties {
        if (session == null) {
            session = new Session(Duration.ofHours(4), "DER_SESSION", false, "Strict", "");
        }
        if (signIn == null) {
            signIn = new SignIn(30, 10);
        }
        if (bootstrap == null) {
            bootstrap = new Bootstrap("", "");
        }
        if (deviceApproval == null) {
            deviceApproval = new DeviceApproval(true);
        }
        if (firstTimeOffline == null) {
            firstTimeOffline = new FirstTimeOffline(FirstTimeOffline.Policy.REQUIRE_ONLINE_FIRST);
        }
        if (breakGlass == null) {
            breakGlass = new BreakGlass(false,
                    "/var/lib/der/break-glass.token", "");
        }
    }

    /** Pre-FR-02-07 convenience ctor. */
    public SecurityProperties(final Session session, final SignIn signIn,
                                final Bootstrap bootstrap,
                                final DeviceApproval deviceApproval) {
        this(session, signIn, bootstrap, deviceApproval, null, null);
    }

    /** Pre-FR-02-09 convenience ctor — FR-02-07 landed first. */
    public SecurityProperties(final Session session, final SignIn signIn,
                                final Bootstrap bootstrap,
                                final DeviceApproval deviceApproval,
                                final FirstTimeOffline firstTimeOffline) {
        this(session, signIn, bootstrap, deviceApproval, firstTimeOffline, null);
    }

    /**
     * @param ttl             how long a newly issued session is valid before it expires
     * @param cookieName      HTTP cookie name used to carry the opaque token
     * @param cookieSecure    whether the cookie is marked Secure (set to true in production over TLS)
     * @param cookieSameSite  SameSite policy; typically {@code Strict} for cookie-only APIs
     * @param secret          per-host secret seed (opaque; MUST NOT be committed; see .env.local.example)
     */
    public record Session(Duration ttl, String cookieName, boolean cookieSecure,
                          String cookieSameSite, String secret) { }

    /**
     * @param rateLimitPerIpPerMinute   maximum sign-in attempts from a single client IP per minute
     * @param rateLimitPerUserPerMinute maximum sign-in attempts for a single username per minute
     */
    public record SignIn(int rateLimitPerIpPerMinute, int rateLimitPerUserPerMinute) { }

    /**
     * @param adminUsername when non-blank at first boot and no ADMIN exists, provisions the admin
     * @param adminPassword corresponding plaintext passphrase; MUST be unset after bootstrap
     */
    public record Bootstrap(String adminUsername, String adminPassword) {
        public boolean isConfigured() {
            return adminUsername != null && !adminUsername.isBlank()
                    && adminPassword != null && !adminPassword.isBlank();
        }
    }

    /**
     * ADR-0019 slice B — gate client-app access on device trust.
     *
     * @param required when {@code true}, only devices with
     *                 {@code network_client.trust = APPROVED} may fetch
     *                 app bundles or write; see
     *                 {@code DeviceApprovalInterceptor}. When
     *                 {@code false}, the server reverts to the slice-A
     *                 non-blocking banner posture.
     */
    public record DeviceApproval(boolean required) { }

    /**
     * FR-02-07 — "Deny first-time offline authentication unless a
     * specifically approved provisioning method exists." The gate
     * fires in {@link AuthenticationService#signIn} after password
     * verification when the user has no prior {@code SIGN_IN_SUCCESS}
     * audit row.
     *
     * @param policy which users bypass the gate.
     */
    public record FirstTimeOffline(Policy policy) {

        public FirstTimeOffline {
            policy = policy == null ? Policy.REQUIRE_ONLINE_FIRST : policy;
        }

        /**
         * Approved-provisioning-method tiers, strictest last:
         *
         * <ul>
         *   <li>{@code DISABLED} — the gate is off. Any password-
         *     correct user signs in on first contact. Not for
         *     production; useful in test / demo environments.</li>
         *   <li>{@code REQUIRE_ONLINE_FIRST} — default. A user with
         *     no prior {@code SIGN_IN_SUCCESS} can only sign in if
         *     their origin is {@link EdgeUser.Origin#DHIS2} (their
         *     verifier was mirrored from central during an online
         *     reconciliation) or {@link EdgeUser.Origin#BOOTSTRAP}
         *     (first-boot admin, provisioned by an operator with
         *     physical access).</li>
         *   <li>{@code BOOTSTRAP_ONLY} — strictest; only the
         *     bootstrap admin may sign in without a prior success.
         *     DHIS2-mirrored users must have completed at least one
         *     online sign-in (e.g. during initial onboarding) before
         *     the device is permitted to authenticate them offline.
         *     Right posture for high-assurance deployments post-
         *     provisioning.</li>
         * </ul>
         */
        public enum Policy {
            DISABLED,
            REQUIRE_ONLINE_FIRST,
            BOOTSTRAP_ONLY
        }
    }

    /**
     * FR-02-09 — audited break-glass admin-recovery flow. Gated by
     * host-filesystem proof-of-presence: a one-time token written to
     * {@link #tokenPath} by someone with shell-level access to the
     * appliance. Disabled by default; even when enabled, the endpoint
     * returns 404 unless the token file is present AND the submitted
     * token matches constant-time.
     *
     * @param enabled        when {@code false} (default) the recover
     *                       endpoint responds 404 regardless of input.
     * @param tokenPath      file the operator places on the host; its
     *                       contents are the one-use token the request
     *                       body must echo back.
     * @param adminUsername  which account to recover when triggered.
     *                       Blank → fall back to
     *                       {@link Bootstrap#adminUsername} → then the
     *                       oldest ADMIN row in {@code edge_user}.
     */
    public record BreakGlass(boolean enabled, String tokenPath,
                               String adminUsername) {

        public BreakGlass {
            if (tokenPath == null || tokenPath.isBlank()) {
                tokenPath = "/var/lib/der/break-glass.token";
            }
            if (adminUsername == null) {
                adminUsername = "";
            }
        }
    }
}
