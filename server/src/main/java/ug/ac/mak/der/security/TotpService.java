package ug.ac.mak.der.security;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

/**
 * ADR-0028. RFC 6238 TOTP generator / verifier. SHA-1 HMAC, 30s
 * step, 6-digit code. Pure Java; no external dependency.
 */
@Component
public class TotpService {

    private static final SecureRandom RAND = new SecureRandom();
    private static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private final Clock clock;

    public TotpService(final Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public String generateSecret() {
        final byte[] bytes = new byte[20];
        RAND.nextBytes(bytes);
        return base32Encode(bytes);
    }

    public String otpAuthUri(final String issuer, final String account, final String secret) {
        Objects.requireNonNull(secret, "secret");
        return "otpauth://totp/"
                + URLEncoder.encode(issuer, StandardCharsets.UTF_8)
                + ":"
                + URLEncoder.encode(account, StandardCharsets.UTF_8)
                + "?secret=" + secret
                + "&issuer=" + URLEncoder.encode(issuer, StandardCharsets.UTF_8)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    /**
     * Verifies the code with a +/- 1 step tolerance to accommodate
     * device clock drift. Returns {@code true} on match.
     */
    public boolean verify(final String secret, final String code) {
        if (secret == null || secret.isBlank() || code == null) {
            return false;
        }
        final String cleaned = code.trim();
        if (cleaned.length() != DIGITS || !cleaned.chars().allMatch(Character::isDigit)) {
            return false;
        }
        final long t = Instant.now(clock).getEpochSecond() / STEP_SECONDS;
        for (long delta = -1; delta <= 1; delta++) {
            if (cleaned.equals(generate(secret, t + delta))) {
                return true;
            }
        }
        return false;
    }

    String generate(final String secret, final long step) {
        final byte[] key = base32Decode(secret);
        final byte[] data = ByteBuffer.allocate(8).putLong(step).array();
        try {
            final Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            final byte[] hash = mac.doFinal(data);
            final int offset = hash[hash.length - 1] & 0x0f;
            final int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            final int otp = binary % 1_000_000;
            return String.format("%06d", otp);
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("TOTP generation failed", ex);
        }
    }

    static String base32Encode(final byte[] data) {
        final StringBuilder sb = new StringBuilder();
        int buffer = 0;
        int bufferBits = 0;
        for (final byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bufferBits += 8;
            while (bufferBits >= 5) {
                bufferBits -= 5;
                final int idx = (buffer >> bufferBits) & 0x1f;
                sb.append(BASE32_ALPHABET.charAt(idx));
            }
        }
        if (bufferBits > 0) {
            final int idx = (buffer << (5 - bufferBits)) & 0x1f;
            sb.append(BASE32_ALPHABET.charAt(idx));
        }
        return sb.toString();
    }

    static byte[] base32Decode(final String s) {
        final String clean = s.replace("=", "").toUpperCase(java.util.Locale.ROOT);
        final java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int buffer = 0;
        int bufferBits = 0;
        for (int i = 0; i < clean.length(); i++) {
            final int idx = BASE32_ALPHABET.indexOf(clean.charAt(i));
            if (idx < 0) {
                throw new IllegalArgumentException("invalid base32 char at " + i);
            }
            buffer = (buffer << 5) | idx;
            bufferBits += 5;
            if (bufferBits >= 8) {
                bufferBits -= 8;
                out.write((buffer >> bufferBits) & 0xff);
            }
        }
        return out.toByteArray();
    }
}
