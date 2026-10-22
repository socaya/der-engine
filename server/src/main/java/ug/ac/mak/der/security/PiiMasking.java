package ug.ac.mak.der.security;

/**
 * Stateless helpers for masking PII before it lands in log output.
 * ADR-0017. Lossy on purpose — operators correlate via user_id
 * UUIDs rather than via the mask.
 */
public final class PiiMasking {

    private PiiMasking() {
        /* static-only */
    }

    /**
     * Reveals only the first and last character; everything else is
     * {@code *}. Null → {@code null}; blank → unchanged; length ≤ 2 →
     * fully masked.
     */
    public static String maskUsername(final String raw) {
        if (raw == null) {
            return null;
        }
        if (raw.isBlank()) {
            return raw;
        }
        final int len = raw.length();
        if (len <= 2) {
            return "*".repeat(len);
        }
        final StringBuilder sb = new StringBuilder(len);
        sb.append(raw.charAt(0));
        sb.append("*".repeat(len - 2));
        sb.append(raw.charAt(len - 1));
        return sb.toString();
    }

    /**
     * Masks the local part of an email; preserves the domain so
     * ops teams can still spot the organisational source. Non-emails
     * fall back to {@link #maskUsername}.
     */
    public static String maskEmail(final String raw) {
        if (raw == null) {
            return null;
        }
        final int at = raw.indexOf('@');
        if (at <= 0 || at == raw.length() - 1) {
            return maskUsername(raw);
        }
        return maskUsername(raw.substring(0, at)) + raw.substring(at);
    }

    /**
     * Masks each whitespace-separated token independently:
     * {@code "Alice Jane Example"} → {@code "A**** J*** E******"}.
     * One-character tokens stay (initials remain useful).
     */
    public static String maskDisplayName(final String raw) {
        if (raw == null) {
            return null;
        }
        if (raw.isBlank()) {
            return raw;
        }
        final String[] tokens = raw.trim().split("\\s+");
        final StringBuilder out = new StringBuilder();
        for (int i = 0; i < tokens.length; i++) {
            if (i > 0) {
                out.append(' ');
            }
            final String t = tokens[i];
            if (t.length() <= 1) {
                out.append(t);
            } else {
                out.append(t.charAt(0)).append("*".repeat(t.length() - 1));
            }
        }
        return out.toString();
    }
}
