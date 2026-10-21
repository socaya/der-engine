package ug.ac.mak.der.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/**
 * JSON contract for {@code GET /edge-api/v1/system/health}.
 *
 * <p>This contract is intentionally minimal at Phase 00. The {@code dhis2Reference}
 * sub-object will acquire additional fields in Phase 01 (pinned patch, compatibility
 * matrix link). Breaking changes require a MAJOR DER release and a changelog entry.</p>
 *
 * @param service             service identifier, always {@code "der-server"}
 * @param status              coarse runtime readiness ({@code "starter-ready"} at Phase 00)
 * @param version             DER release version (matches root {@code VERSION})
 * @param commit              git commit SHA at build time ({@code "unknown"} when absent)
 * @param branch              git branch at build time ({@code "unknown"} when absent)
 * @param dirty               {@code true} iff the working tree had uncommitted changes
 * @param buildTime           ISO-8601 UTC timestamp of the build
 * @param dhis2Integrated     always {@code false} until Phase 01+ proves otherwise
 * @param dhis2Reference      pinned DHIS2 reference descriptor (version only at Phase 00)
 * @param timestamp           response time (server clock)
 */
public record SystemHealthResponse(
        @JsonProperty("service") String service,
        @JsonProperty("status") String status,
        @JsonProperty("version") String version,
        @JsonProperty("commit") String commit,
        @JsonProperty("branch") String branch,
        @JsonProperty("dirty") boolean dirty,
        @JsonProperty("buildTime") Instant buildTime,
        @JsonProperty("dhis2Integrated") boolean dhis2Integrated,
        @JsonProperty("dhis2Reference") Dhis2Reference dhis2Reference,
        @JsonProperty("timestamp") Instant timestamp
) {

    public record Dhis2Reference(@JsonProperty("version") String version) { }
}
