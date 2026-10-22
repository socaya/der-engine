package ug.ac.mak.der.dhis2.compatibility;

/**
 * Thrown when the observed central DHIS2 version is below the configured
 * minimum supported version and {@code der.dhis2.compatibility.allow-unsupported}
 * is {@code false}. ADR-0006 §Admission policy.
 */
public final class UnsupportedDhis2VersionException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final String observed;
    private final String minimum;

    public UnsupportedDhis2VersionException(final String observed, final String minimum) {
        super("DHIS2 version '" + observed + "' is below the minimum supported '" + minimum + "'. "
                + "Set der.dhis2.compatibility.allow-unsupported=true to override (not for production).");
        this.observed = observed;
        this.minimum = minimum;
    }

    public String observed() {
        return observed;
    }

    public String minimum() {
        return minimum;
    }
}
