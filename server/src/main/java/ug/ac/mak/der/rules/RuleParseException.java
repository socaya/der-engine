package ug.ac.mak.der.rules;

/** Raised by {@link RuleLexer} and {@link RuleParser} on malformed expressions. */
public final class RuleParseException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public RuleParseException(final String message) {
        super(message);
    }
}
