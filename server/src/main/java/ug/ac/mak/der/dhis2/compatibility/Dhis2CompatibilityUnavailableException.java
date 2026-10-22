package ug.ac.mak.der.dhis2.compatibility;

/**
 * Thrown when neither a reachable central nor a cached capability snapshot is
 * available at startup, so the engine cannot authoritatively tell callers which
 * Web API dialect to speak. ADR-0006 §Offline resilience.
 */
public final class Dhis2CompatibilityUnavailableException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public Dhis2CompatibilityUnavailableException(final String message, final Throwable cause) {
        super(message, cause);
    }
}
