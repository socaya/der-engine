package ug.ac.mak.der.workflows.periods;

/** Raised when a DHIS2 period code is unrecognised or out of range. */
public final class PeriodParseException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public PeriodParseException(final String message) {
        super(message);
    }
}
