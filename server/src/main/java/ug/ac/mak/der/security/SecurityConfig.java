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
 *   <li>Path gates use {@code hasAuthority("der.<module>.<verb>")} drawn
 *       from {@link AuthorityCatalog}.  Built-in roles (ADMIN / OPERATOR /
 *       REVIEWER) carry the authority grants seeded by V086, so existing
 *       deployments retain the previous role semantics while custom roles
 *       are now first-class citizens of the gate.</li>
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
            final SessionValidationService validator,
            final SecurityProperties props,
            final RoleDefinitionRepository roleRepository) {
        return new SessionCookieAuthenticationFilter(validator, props, roleRepository);
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
                        // V090 login page settings — the device shell
                        // needs to paint the sign-in screen before the
                        // operator has a session. Both reads are safe
                        // to expose; writes below require admin auth.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/edge-api/v1/public/signin-settings",
                                "/edge-api/v1/public/signin-settings/background").permitAll()
                        .requestMatchers("/edge-api/v1/admin/signin-settings",
                                "/edge-api/v1/admin/signin-settings/**")
                                .hasAuthority("der.system.settings.write")
                        // C-UI-5a app catalogue — three public GETs feed the
                        // device shell before the operator has a session
                        // (catalogue, signed bundle bytes, public key). The
                        // admin install/upgrade/enable/disable/delete surface
                        // below is gated by der.system.settings.write.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/edge-api/v1/apps",
                                "/edge-api/v1/apps/signing-key",
                                "/edge-api/v1/apps/*/*/bundle.js",
                                "/edge-api/v1/apps/*/*/icon").permitAll()
                        .requestMatchers("/edge-api/v1/admin/apps",
                                "/edge-api/v1/admin/apps/**")
                                .hasAuthority("der.system.settings.write")
                        /* §2.3.120 R-AQ — Spring forwards uncaught
                         * controller exceptions to /error. Without
                         * permitAll here the internal forward is
                         * seen by this filter chain as an anonymous
                         * request and the authentication entry
                         * point rewrites the response to 401,
                         * masking the real 500 + its payload (we
                         * hit this during the queue-detail 404
                         * debugging in 2.3.119). permitAll on /error
                         * lets DispatcherServlet's default error
                         * controller run with the actual status.
                         * This is safe: /error only ever renders
                         * for errors raised by other requests which
                         * already enforce their own auth. */
                        .requestMatchers("/error").permitAll()
                        /* §2.3.122 R-AQ/followup — browsers fetch
                         * /favicon.ico by default on every page load,
                         * even when the HTML <head> declares a
                         * different favicon link. Without this permit
                         * the request falls into
                         * .anyRequest().authenticated() and returns
                         * 403 for authenticated users (no handler
                         * exists) or 401 for anonymous — a stream of
                         * noise in DevTools either way. Icon content
                         * is public. */
                        .requestMatchers("/favicon.ico", "/favicon.svg").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        // §2 Observability — Prometheus scrape endpoint.
                        // Operators restrict reach via nginx / firewall;
                        // the content is non-sensitive counter / gauge data.
                        .requestMatchers("/actuator/prometheus").permitAll()
                        .requestMatchers("/actuator/metrics").hasAuthority("der.system.read")
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
                        .requestMatchers("/edge-api/v1/dhis2/**").hasAuthority("der.dhis2.connection.write")
                        .requestMatchers("/edge-api/v1/provisioning/**").hasAuthority("der.users.create")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/sync/notify").authenticated()
                        // Fine-grained split: metadata sync vs inbound data pull are
                        // separate authorities, but both fall under /sync/** paths.
                        // SYNC_WORKER holds both; REVIEWER holds neither.
                        .requestMatchers("/edge-api/v1/sync/metadata/**").hasAuthority("der.sync.metadata.run")
                        .requestMatchers("/edge-api/v1/sync/data/**").hasAuthority("der.sync.data.run")
                        .requestMatchers("/edge-api/v1/sync/drift/**").hasAuthority("der.sync.drift.resolve")
                        .requestMatchers("/edge-api/v1/sync/**").hasAuthority("der.sync.read")
                        .requestMatchers("/edge-api/v1/backup/**").hasAuthority("der.backup.trigger")
                        .requestMatchers("/edge-api/v1/restore/**").hasAuthority("der.restore.execute")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/system/org-unit").hasAuthority("der.system.settings.write")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/approvals/**").hasAuthority("der.drafts.publish.any")
                        // §2.3.11 — workflow runs are operator-level:
                        //   open run / contribute / reject by any authenticated user
                        //   (device auth or operator session). CRUD on the
                        //   catalogue stays ADMIN per the catch-all below.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/workflows/*/runs").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/workflows/runs/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/runs/**").authenticated()
                        // §2.3.16 — operator queue is any authenticated user.
                        //   The controller role-filters rows.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/queue").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/queue/stream").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/import-inbox/stream").authenticated()
                        // §2.3.60 — admin-only metrics dashboard aggregation.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/metrics").hasAuthority("der.workflows.read")
                        // §2.3.61 — admin troubleshooting feed/blockages/issues/conflicts.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/activity/**").hasAuthority("der.workflows.read")
                        // §2.3.60 — prefetch coordination (phase B).
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/prefetch/stream").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/workflows/prefetch/pending").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/workflows/prefetch/*/acked").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/workflows/**").hasAuthority("der.workflows.catalogue.write")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/edge-api/v1/workflows/**").hasAuthority("der.workflows.catalogue.write")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/edge-api/v1/workflows/**").hasAuthority("der.workflows.catalogue.write")
                        // ADR-0036 capture form API (data module).  Reads
                        // only in Phase 1 — writes still go through the
                        // existing /api/* emulator endpoints.
                        .requestMatchers("/edge-api/v1/capture/**").hasAuthority("der.capture.read")
                        // ADR-0019 device management — each lifecycle verb is its own
                        // authority so a role can hold "approve" without "revoke".
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/approve").hasAuthority("der.devices.approve")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/suspend").hasAuthority("der.devices.suspend")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/devices/*/revoke").hasAuthority("der.devices.revoke")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/edge-api/v1/devices/**").hasAuthority("der.devices.decommission")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/analytics/refresh").hasAuthority("der.system.analytics.refresh")
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/edge-api/v1/security/audit/verify").hasAuthority("der.audit.read")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/journal/*/next-hop").hasAuthority("der.referrals.escalate")
                        .requestMatchers("/edge-api/v1/admin/ops/**").hasAuthority("der.system.settings.write")
                        .requestMatchers("/edge-api/v1/admin/roles/**").hasAuthority("der.roles.write")
                        .requestMatchers("/edge-api/v1/admin/metrics").authenticated()
                        .requestMatchers("/edge-api/v1/tracked-entities", "/edge-api/v1/tracked-entities/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/aggregate/completion").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/referral/inbox/*/accept").hasAuthority("der.referrals.accept")
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/edge-api/v1/referral/inbox/*/dismiss").hasAuthority("der.referrals.dismiss")
                        // Phase N1-N5 Network module — reads for all authenticated
                        // users, writes gated to ADMIN. Device self-enrol +
                        // DHCP-lease ingest are authenticated-only (devices /
                        // DHCP server have their own bootstrap credential).
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/network/enroll",
                            "/edge-api/v1/network/leases").authenticated()
                        // Split: firewall/lease vs peer/topology.  Peer config is
                        // day-to-day; firewall/lease is isolation-critical.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,  "/edge-api/v1/network/firewall/**").hasAuthority("der.network.firewall.write")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,   "/edge-api/v1/network/firewall/**").hasAuthority("der.network.firewall.write")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,"/edge-api/v1/network/firewall/**").hasAuthority("der.network.firewall.write")
                        .requestMatchers(org.springframework.http.HttpMethod.POST,  "/edge-api/v1/network/peers/**").hasAuthority("der.network.peer.write")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,   "/edge-api/v1/network/peers/**").hasAuthority("der.network.peer.write")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,"/edge-api/v1/network/peers/**").hasAuthority("der.network.peer.write")
                        .requestMatchers(org.springframework.http.HttpMethod.POST,  "/edge-api/v1/network/**").hasAuthority("der.network.topology.write")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,   "/edge-api/v1/network/**").hasAuthority("der.network.topology.write")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,"/edge-api/v1/network/**").hasAuthority("der.network.topology.write")
                        .requestMatchers("/edge-api/v1/network/**").authenticated()
                        // Peer lifecycle — invite redeem is reachable
                        // from peer edges across the WireGuard tunnel
                        // (trust comes from the tunnel + the token
                        // itself); the rest of the surface is UI/admin.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/peer-lifecycle/invites/redeem").permitAll()
                        .requestMatchers("/edge-api/v1/peer-lifecycle/**").authenticated()
                        // §1 Peer mesh — adjacency announcements come
                        // over the WireGuard tunnel from trusted peers;
                        // topology + CRDT catch-up require session auth.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/peer-mesh/adjacency").permitAll()
                        .requestMatchers("/edge-api/v1/peer-mesh/**").authenticated()
                        // §1 WebRTC signalling — devices need session.
                        .requestMatchers("/edge-api/v1/webrtc/**").authenticated()
                        // §4 Hardware — LED poll from a tiny Pi-side
                        // daemon is unauthenticated (reach restricted
                        // via nginx / LAN); everything else needs
                        // session.  Writes gated to ADMIN.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/system/hardware/leds").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                            "/edge-api/v1/system/hardware/**").hasAuthority("der.system.hardware.write")
                        .requestMatchers("/edge-api/v1/system/hardware/**").authenticated()
                        // §6 Security hardening — read-only probes;
                        // Vault secret fetch is admin-only.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/security/hardening/vault/**").hasAuthority("der.system.vault.read")
                        .requestMatchers("/edge-api/v1/security/hardening/**").authenticated()
                        // §8 Fleet view + per-operator preferences.
                        .requestMatchers("/edge-api/v1/fleet/**").authenticated()
                        .requestMatchers("/edge-api/v1/user-prefs/**").authenticated()
                        // §9 Testing harness — chaos / load / soak / golden.
                        .requestMatchers("/edge-api/v1/testing/**").hasAuthority("der.system.testing.run")
                        // §10 Packaging — artefact registry + HW kit catalogue.
                        .requestMatchers("/edge-api/v1/packaging/**").authenticated()
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
                            "/edge-api/v1/compliance/**").hasAuthority("der.compliance.manage")
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                            "/edge-api/v1/compliance/**").hasAuthority("der.compliance.read")
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
