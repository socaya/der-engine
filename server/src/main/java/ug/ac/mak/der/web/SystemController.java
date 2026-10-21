package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.build.BuildInfo;
import ug.ac.mak.der.build.BuildInfoProvider;

/**
 * Phase 00 system endpoints. Only exposes {@code GET /edge-api/v1/system/health}
 * with build identity and the deliberately honest {@code dhis2Integrated=false}
 * flag; no authentication, metrics or privileged operations are implemented at
 * this phase. Authentication is a Phase 02 deliverable.
 *
 * <p>The health endpoint is unauthenticated by design: it is the readiness probe
 * for the reverse proxy and local operations tooling. It MUST NOT leak secrets,
 * database descriptors or privileged configuration.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/system", produces = MediaType.APPLICATION_JSON_VALUE)
public class SystemController {

    private final BuildInfoProvider buildInfo;
    private final Clock clock;

    public SystemController(final BuildInfoProvider buildInfo, final Clock clock) {
        this.buildInfo = buildInfo;
        this.clock = clock;
    }

    @GetMapping("/health")
    public SystemHealthResponse health() {
        final BuildInfo info = buildInfo.buildInfo();
        return new SystemHealthResponse(
                "der-server",
                "starter-ready",
                info.release(),
                info.commit(),
                info.branch(),
                info.dirty(),
                info.buildTime(),
                false,
                new SystemHealthResponse.Dhis2Reference(info.dhis2ReferenceVersion()),
                Instant.now(clock)
        );
    }
}
