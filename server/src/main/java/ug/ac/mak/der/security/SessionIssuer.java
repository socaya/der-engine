package ug.ac.mak.der.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import ug.ac.mak.der.Generated;

/**
 * Mint and hash opaque session tokens.
 *
 * <p>Clients receive the raw token through the {@code DER_SESSION} cookie;
 * the server persists only {@link #hash(String)} so a database leak does not
 * expose live tokens. 256 bits of entropy is standard for Spring Security
 * session cookies.</p>
 */
public final class SessionIssuer {

    private static final int TOKEN_BYTES = 32;

    private final SecureRandom rng;

    public SessionIssuer() {
        this.rng = new SecureRandom();
    }

    SessionIssuer(final SecureRandom rng) {
        this.rng = rng;
    }

    /** Return a URL-safe base64 token of {@value #TOKEN_BYTES} random bytes. */
    public String issueToken() {
        final byte[] raw = new byte[TOKEN_BYTES];
        rng.nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    /** Hex-encoded SHA-256 of the token; used as the server-side lookup key. */
    public String hash(final String token) {
        if (token == null || token.isEmpty()) {
            throw new IllegalArgumentException("token must not be null or empty");
        }
        final byte[] digest = sha256(token.getBytes(StandardCharsets.UTF_8));
        final StringBuilder hex = new StringBuilder(digest.length * 2);
        for (final byte b : digest) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    /**
     * The SHA-256 digest. JaCoCo-excluded via {@link Generated} because the
     * JRE spec guarantees SHA-256 availability (JLS §21.5 / JEP 439); the
     * catch is a defensive compile-only safety net.
     */
    @Generated("JRE-spec defensive branch — SHA-256 is always available")
    private static byte[] sha256(final byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required by the JRE", ex);
        }
    }
}
