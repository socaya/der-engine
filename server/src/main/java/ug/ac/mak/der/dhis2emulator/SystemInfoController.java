package ug.ac.mak.der.dhis2emulator;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.build.BuildInfoProvider;
import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER's emulation of {@code GET /api/system/info}. Shape-compatible with
 * DHIS2 2.44 so {@code @dhis2/app-runtime}'s Data Engine accepts DER as the
 * backend without changes.
 *
 * <p>Deliberately returns DER's identity rather than impersonating central:
 * {@code systemId} is DER's build commit, {@code systemName} is "DER …". The
 * {@code version} field carries the pinned central version so client code
 * that gates on DHIS2 version strings behaves correctly.</p>
 */
@RestController
@RequestMapping(path = "/api/system/info", produces = MediaType.APPLICATION_JSON_VALUE)
public class SystemInfoController {

    private final BuildInfoProvider build;
    private final Dhis2Properties props;
    private final Clock clock;

    public SystemInfoController(final BuildInfoProvider build,
                                 final Dhis2Properties props,
                                 final Clock clock) {
        this.build = build;
        this.props = props;
        this.clock = clock;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> info(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final var info = build.buildInfo();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("version", props.compatibility().pinnedVersion());
        body.put("revision", info.commit());
        body.put("buildTime", info.buildTime().toString());
        body.put("serverDate", Instant.now(clock).toString());
        body.put("systemId", info.commit());
        body.put("systemName", "DER Edge Runtime " + info.release());
        body.put("instanceBaseUrl", "/");
        body.put("contextPath", "");
        body.put("systemMetadataVersion", "");
        // DER-specific fields are prefixed so a stock DHIS2 client ignores them
        // while a DER-aware client can observe the emulation.
        body.put("derRelease", info.release());
        body.put("derDhis2ReferenceVersion", info.dhis2ReferenceVersion());
        body.put("derServedAt", "edge");
        return ResponseEntity.ok(body);
    }
}
