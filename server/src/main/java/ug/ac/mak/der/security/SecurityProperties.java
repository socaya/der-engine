package ug.ac.mak.der.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed Phase 02 security configuration.
 *
 * @param session   session cookie policy
 * @param signIn    rate-limit bounds applied to {@code /auth/sign-in}
 * @param bootstrap first-boot administrator provisioning
 */
@ConfigurationProperties(prefix = "der.security")
public record SecurityProperties(Session session, SignIn signIn, Bootstrap bootstrap) {

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
}
