package ug.ac.mak.der.dhis2;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration for the DER→DHIS2 connection.
 *
 * <p>Properties are populated from {@code application.yml} and environment
 * variables under the {@code der.dhis2} prefix. All fields are optional at
 * configuration time; the compatibility guard enforces that the required
 * fields are present when the service actually tries to talk to DHIS2.</p>
 *
 * @param central           connection and credentials for the pinned central DHIS2
 * @param compatibility     policy for the version guard
 */
@ConfigurationProperties(prefix = "der.dhis2")
public record Dhis2Properties(Central central, Compatibility compatibility) {

    public Dhis2Properties {
        if (central == null) {
            central = new Central(null, null, null, 10_000);
        }
        if (compatibility == null) {
            compatibility = new Compatibility("2.44-SNAPSHOT", false);
        }
    }

    /**
     * @param baseUrl       canonical base URL of the central DHIS2 ({@code .../dhis}),
     *                      without a trailing slash. Example: {@code http://localhost:8080/dhis}
     * @param username      Web API user with the minimum scope DER needs
     * @param password      corresponding password; MUST NOT be logged
     * @param connectTimeoutMillis bounded connect timeout for every outbound call
     */
    public record Central(String baseUrl, String username, String password, int connectTimeoutMillis) {
    }

    /**
     * @param pinnedVersion       exact {@code info.version} prefix the central must report.
     *                            Phase 01 default is {@code "2.44-SNAPSHOT"} (ADR-0002).
     * @param allowMismatch       development override; when {@code true}, mismatch logs
     *                            at WARN but the service continues. MUST NOT be set in a
     *                            released configuration.
     */
    public record Compatibility(String pinnedVersion, boolean allowMismatch) {
    }
}
