package ug.ac.mak.der.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.Dhis2CompatibilityGuard;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

/**
 * Phase 01 diagnostic endpoint. Returns the current state of the DHIS2
 * compatibility guard. Intended for operators and the Phase 01 live-probe
 * verification script, not for client workflows.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/dhis2", produces = MediaType.APPLICATION_JSON_VALUE)
public class Dhis2CompatibilityController {

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2CompatibilityController.class);

    private final Dhis2CompatibilityGuard guard;

    public Dhis2CompatibilityController(final Dhis2CompatibilityGuard guard) {
        this.guard = guard;
    }

    @GetMapping("/compatibility")
    public ResponseEntity<CompatibilityStatus> compatibility() {
        try {
            final Dhis2CompatibilityGuard.Result result = guard.check();
            return ResponseEntity.ok(CompatibilityStatus.of(result));
        } catch (Dhis2CompatibilityGuard.Dhis2VersionMismatchException ex) {
            LOG.warn("DHIS2 version mismatch surfaced on diagnostic endpoint: {}", ex.getMessage());
            final CompatibilityStatus body = new CompatibilityStatus(
                    "MISMATCH",
                    ex.observed(),
                    ex.pin(),
                    null,
                    null,
                    ex.getMessage());
            return ResponseEntity.status(409).body(body);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            LOG.warn("DHIS2 unreachable on diagnostic endpoint: {}", ex.getMessage());
            return ResponseEntity.status(503).body(new CompatibilityStatus(
                    "UNREACHABLE", null, null, null, null, ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            LOG.warn("DHIS2 responded with unexpected payload: {}", ex.getMessage());
            return ResponseEntity.status(502).body(new CompatibilityStatus(
                    "BAD_RESPONSE", null, null, null, null, ex.getMessage()));
        }
    }

    public record CompatibilityStatus(
            @JsonProperty("status") String status,
            @JsonProperty("observedVersion") String observedVersion,
            @JsonProperty("pinnedVersion") String pinnedVersion,
            @JsonProperty("revision") String revision,
            @JsonProperty("buildTime") String buildTime,
            @JsonProperty("message") String message
    ) {
        public static CompatibilityStatus of(final Dhis2CompatibilityGuard.Result result) {
            final Dhis2Version v = result.observed();
            return new CompatibilityStatus(
                    result.status().name(),
                    v == null ? null : v.version(),
                    result.pin(),
                    v == null ? null : v.revision(),
                    v == null ? null : v.buildTime(),
                    null
            );
        }
    }
}
