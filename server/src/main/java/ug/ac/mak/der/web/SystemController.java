package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import ug.ac.mak.der.build.BuildInfo;
import ug.ac.mak.der.build.BuildInfoProvider;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfig;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.ops.PreflightService;
import ug.ac.mak.der.security.DeviceApprovalPolicy;

/**
 * System endpoints. Exposes {@code GET /edge-api/v1/system/health} with
 * build identity and a {@code dhis2Integrated} flag computed from the
 * runtime connection config — <em>true</em> when a central base URL and
 * at least one credential (password or PAT) are configured.
 *
 * <p>The health endpoint is unauthenticated by design: it is the
 * readiness probe for the reverse proxy and local operations tooling.
 * It MUST NOT leak secrets, database descriptors or privileged
 * configuration.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/system", produces = MediaType.APPLICATION_JSON_VALUE)
public class SystemController {

    private final BuildInfoProvider buildInfo;
    private final Clock clock;
    private final Dhis2ConnectionConfigRepository dhis2;
    private final DeviceApprovalPolicy deviceApprovalPolicy;

    private PreflightService preflight;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setPreflight(final PreflightService svc) {
        this.preflight = svc;
    }

    public SystemController(final BuildInfoProvider buildInfo, final Clock clock,
                              final Dhis2ConnectionConfigRepository dhis2,
                              @org.springframework.beans.factory.annotation.Autowired(required = false)
                              final DeviceApprovalPolicy deviceApprovalPolicy) {
        this.buildInfo = buildInfo;
        this.clock = clock;
        this.dhis2 = dhis2;
        this.deviceApprovalPolicy = deviceApprovalPolicy;
    }

    @GetMapping("/health")
    public SystemHealthResponse health() {
        final BuildInfo info = buildInfo.buildInfo();
        // By the time this controller services a request the Spring context
        // is fully up — report "UP" so the UI runtime indicator doesn't
        // stay on "Starting" forever (see 2.1.66 offline-sweep notes).
        return new SystemHealthResponse(
                "der-server",
                "UP",
                info.release(),
                info.commit(),
                info.branch(),
                info.dirty(),
                info.buildTime(),
                isIntegrated(),
                new SystemHealthResponse.Dhis2Reference(info.dhis2ReferenceVersion()),
                Instant.now(clock)
        );
    }

    /** Public — the current device-approval policy mode. Exposes only
     *  the strict/permissive boolean so clients can tailor their pending
     *  banner copy without exposing any other admin configuration.
     *  Returns {@code required=true} when the policy service isn't wired
     *  (the strict default per SecurityProperties). */
    @GetMapping("/device-approval-mode")
    public Map<String, Object> deviceApprovalMode() {
        final boolean required = deviceApprovalPolicy == null
                ? true : deviceApprovalPolicy.required();
        return Map.of("required", required);
    }

    /** FR-01-04 — pre-flight bundle. Aggregates time/dns/certs/
     *  storage/database/network/dependencies into one operator-visible
     *  readiness report. Returns 503 when the service isn't wired. */
    @GetMapping("/preflight")
    public org.springframework.http.ResponseEntity<PreflightService.PreflightReport> preflight() {
        if (preflight == null) {
            return org.springframework.http.ResponseEntity.status(503).build();
        }
        return org.springframework.http.ResponseEntity.ok(preflight.run());
    }

    /** True when the runtime config carries a central base URL and at
     *  least one credential (password or personal access token) — i.e.
     *  the server is bound to a DHIS2. Does not probe reachability;
     *  that lives on {@code /edge-api/v1/dhis2/ping}. */
    private boolean isIntegrated() {
        try {
            final Dhis2ConnectionConfig c = dhis2.read();
            if (c == null) {
                return false;
            }
            final boolean hasUrl = c.baseUrl() != null && !c.baseUrl().isBlank();
            final boolean hasCred = (c.passwordSealed() != null && !c.passwordSealed().isBlank())
                                   || (c.patTokenSealed() != null && !c.patTokenSealed().isBlank());
            return hasUrl && hasCred;
        } catch (final RuntimeException ex) {
            return false;
        }
    }
}
