package ug.ac.mak.der.security;

import java.time.Clock;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

/**
 * Phase 02 Spring Security configuration.
 *
 * <p>Rules:</p>
 * <ul>
 *   <li>No HTTP session; DER manages its own via {@link EdgeSession}.</li>
 *   <li>CSRF is off because the API accepts only cookie-authenticated POSTs
 *       and does not render HTML forms. The cookie is {@code SameSite=Strict};
 *       Phase 06 revisits this when cross-origin admin tooling lands.</li>
 *   <li>{@code /edge-api/v1/system/health} and {@code /edge-api/v1/auth/sign-in}
 *       are open; everything else requires an {@link EdgeUserPrincipal}.</li>
 *   <li>{@code /edge-api/v1/dhis2/**} and {@code /edge-api/v1/provisioning/**}
 *       require the {@code ADMIN} role.</li>
 *   <li>Anonymous access to a guarded endpoint returns {@code 401}, not {@code 403}.</li>
 * </ul>
 */
@Configuration
@EnableConfigurationProperties(SecurityProperties.class)
@Profile("!test")
public class SecurityConfig {

    @Bean
    public PasswordHasher passwordHasher() {
        return new PasswordHasher();
    }

    @Bean
    public SessionIssuer sessionIssuer() {
        return new SessionIssuer();
    }

    @Bean
    public RateLimiter rateLimiter(final Clock clock) {
        return new RateLimiter(clock);
    }

    @Bean
    public SessionCookieAuthenticationFilter sessionCookieAuthenticationFilter(
            final SessionValidationService validator, final SecurityProperties props) {
        return new SessionCookieAuthenticationFilter(validator, props);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(final HttpSecurity http,
                                                   final SessionCookieAuthenticationFilter cookieFilter)
            throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/edge-api/v1/system/health").permitAll()
                        .requestMatchers("/edge-api/v1/auth/sign-in").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        // §2 Observability — Prometheus scrape endpoint.
                        // Operators restrict reach via nginx / firewall;
                        // the content is non-sensitive counter / gauge data.
                        .requestMatchers("/actuator/prometheus").permitAll()
                        .requestMatchers("/actuator/metrics").hasRole("ADMIN")
                        // ADR-0033: admin UI static shell is public so the
                        // login screen renders; AuthContext inside the SPA
                        // then calls /edge-api/v1/auth/sign-in. All data
                        // calls remain session-gated by the matchers below.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/admin", "/admin/", "/admin/**").permitAll()
                        // Lightweight reachability probe used by the runtime
                        // indicator in every authenticated UI session — admin
                        // + operator both need to see "central is down" when
                        // it's down. Full /dhis2/compat etc. remain admin-only.
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/edge-api/v1/dhis2/ping").authenticated()
                        .requestMatchers("/edge-api/v1/dhis2/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/provisioning/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/sync/notify").authenticated()
                        .requestMatchers("/edge-api/v1/sync/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/backup/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/restore/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/system/org-unit").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/approvals/**").hasAnyRole("REVIEWER", "ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/workflows/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/edge-api/v1/workflows/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/edge-api/v1/workflows/**").hasRole("ADMIN")
                        // ADR-0019 device management:
                        //   enrol + heartbeat are self-service for any authenticated user
                        //   approve/suspend/revoke/delete + list are ADMIN
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/approve").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/suspend").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/revoke").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/edge-api/v1/devices/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/analytics/refresh").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/edge-api/v1/security/audit/verify").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/journal/*/next-hop").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/admin/ops/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/admin/metrics").authenticated()
                        .requestMatchers("/edge-api/v1/tracked-entities", "/edge-api/v1/tracked-entities/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/aggregate/completion").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/referral/inbox/*/accept").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/referral/inbox/*/dismiss").hasRole("ADMIN")
                        // Phase N1-N5 Network module — reads for all authenticated
                        // users, writes gated to ADMIN. Device self-enrol +
                        // DHCP-lease ingest are authenticated-only (devices /
                        // DHCP server have their own bootstrap credential).
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/network/enroll",
                            "/edge-api/v1/network/leases").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST,  "/edge-api/v1/network/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,   "/edge-api/v1/network/**").hasRole("ADMIN")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,"/edge-api/v1/network/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/network/**").authenticated()
                        // Peer lifecycle — invite redeem is reachable
                        // from peer edges across the WireGuard tunnel
                        // (trust comes from the tunnel + the token
                        // itself); the rest of the surface is UI/admin.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/peer-lifecycle/invites/redeem").permitAll()
                        .requestMatchers("/edge-api/v1/peer-lifecycle/**").authenticated()
                        // Phase N5 — DER-MSG v1 device-to-device bus.
                        // Every authenticated device may publish, pull,
                        // subscribe, and update cursors. Admin surface
                        // (stats / log / subscriptions) same policy.
                        // Phase N5 v2 — the /relay inbound hook accepts
                        // messages from peer edges reaching us over the
                        // WireGuard tunnel; trust comes from the tunnel.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/messaging/relay").permitAll()
                        .requestMatchers("/edge-api/v1/messaging/**").authenticated()
                        // §7 Compliance — retention, erasure, audit export.
                        // Writes require ADMIN; reads require session.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/compliance/**").hasRole("ADMIN")
                        .requestMatchers("/edge-api/v1/compliance/**").authenticated()
                        .requestMatchers("/edge-api/v1/apps/**").authenticated()
                        .requestMatchers("/edge-api/v1/**").authenticated()
                        // ADR-0004: DER emulates the DHIS2 Web API at /api/**.
                        // Same cookie session as /edge-api/v1/**; any authenticated
                        // user may read metadata. Writes are added in Phase 03.5.
                        .requestMatchers("/api/**").authenticated()
                        // ADR-0005: custom DHIS2 apps served at /dhis-web-<key>/**.
                        .requestMatchers("/dhis-web-**/**").authenticated()
                        .anyRequest().denyAll()
                )
                .addFilterBefore(cookieFilter, BasicAuthenticationFilter.class);
        return http.build();
    }
}
