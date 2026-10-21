package ug.ac.mak.der.dhis2;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Fail-closed compatibility check (ADR-0002, ADR-0003).
 *
 * <p>Compares the actual DHIS2 server version against the pinned
 * {@code der.dhis2.compatibility.pinned-version}. Admission policy:</p>
 *
 * <ul>
 *   <li>If no central URL is configured, the guard reports
 *       {@link Status#NOT_CONFIGURED}. Startup is permitted — Phase 01's
 *       health endpoint still comes up for admin flows — but any attempt to
 *       speak to DHIS2 is a programmer error that will fail elsewhere.</li>
 *   <li>If the version prefix matches, {@link Status#OK}.</li>
 *   <li>If it does not, {@link Status#MISMATCH}. The guard throws
 *       {@link Dhis2VersionMismatchException} unless
 *       {@code der.dhis2.compatibility.allow-mismatch=true}, in which case it
 *       logs at WARN and returns {@link Status#MISMATCH_ALLOWED}.</li>
 *   <li>If the probe itself fails (I/O or malformed response), the guard
 *       re-throws the underlying exception; it never silently permits.</li>
 * </ul>
 *
 * <p>The guard is a plain class (not a {@code @Component}) so unit tests can
 * instantiate it with any client / properties combination. A Spring runner in
 * Phase 02 will invoke it at application startup; Phase 01 only exposes it
 * via explicit API and tests.</p>
 */
public class Dhis2CompatibilityGuard {

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2CompatibilityGuard.class);

    private final Dhis2ReferenceClient client;
    private final Dhis2Properties properties;

    public Dhis2CompatibilityGuard(final Dhis2ReferenceClient client, final Dhis2Properties properties) {
        this.client = Objects.requireNonNull(client, "client");
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    public Result check() throws Dhis2ReferenceClient.Dhis2UnreachableException,
                                 Dhis2ReferenceClient.Dhis2ResponseException,
                                 Dhis2VersionMismatchException {
        final String url = properties.central().baseUrl();
        if (url == null || url.isBlank()) {
            LOG.info("Phase 01 guard: der.dhis2.central.base-url not configured; status=NOT_CONFIGURED");
            return new Result(Status.NOT_CONFIGURED, null, properties.compatibility().pinnedVersion());
        }
        final Dhis2Version observed = client.fetchVersion();
        final String pin = Objects.requireNonNull(properties.compatibility().pinnedVersion(),
                "der.dhis2.compatibility.pinned-version is not set");
        if (observed.version().startsWith(pin)) {
            LOG.info("Phase 01 guard: DHIS2 version '{}' matches pin '{}' (revision={}, buildTime={})",
                    observed.version(), pin, observed.revision(), observed.buildTime());
            return new Result(Status.OK, observed, pin);
        }
        if (properties.compatibility().allowMismatch()) {
            LOG.warn("Phase 01 guard: DHIS2 version '{}' does NOT match pin '{}' but "
                    + "der.dhis2.compatibility.allow-mismatch=true (dev override).",
                    observed.version(), pin);
            return new Result(Status.MISMATCH_ALLOWED, observed, pin);
        }
        throw new Dhis2VersionMismatchException(observed.version(), pin);
    }

    public enum Status {
        OK,
        NOT_CONFIGURED,
        MISMATCH_ALLOWED
    }

    /**
     * Immutable outcome returned when the guard did not throw.
     *
     * @param status   terminal status
     * @param observed version observed on the central ({@code null} when
     *                 status is {@link Status#NOT_CONFIGURED})
     * @param pin      expected version prefix the guard matched against
     */
    public record Result(Status status, Dhis2Version observed, String pin) { }

    /** Thrown when the running DHIS2 version does not match the pinned prefix. */
    public static final class Dhis2VersionMismatchException extends Exception {
        private static final long serialVersionUID = 1L;
        private final String observed;
        private final String pin;

        public Dhis2VersionMismatchException(final String observed, final String pin) {
            super("DHIS2 version '" + observed + "' does not match pinned prefix '" + pin + "'");
            this.observed = observed;
            this.pin = pin;
        }

        public String observed() {
            return observed;
        }

        public String pin() {
            return pin;
        }
    }
}
