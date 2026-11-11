package ug.ac.mak.der.analytics.distributed;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

/**
 * Sign the SHA-256 checksum of a {@link SiteContributionPacket}
 * with HMAC-SHA256 using the site's local shared secret. Output
 * is a base64 string carried in {@code signatureHex} on the wire.
 *
 * <p>Deterministic — same checksum + same secret gives identical
 * signatures so the receiver can match byte-for-byte without a
 * timing side channel.</p>
 */
@Service
public class SiteSigner {

    private static final String ALGORITHM = "HmacSHA256";

    private final SiteTrustProperties properties;

    public SiteSigner(final SiteTrustProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    /** @return base64(HMAC-SHA256(checksum, localSecret)) or null
     *  when no local secret is configured. */
    public String sign(final String checksumHex) {
        Objects.requireNonNull(checksumHex, "checksumHex");
        final String secret = properties.localSecret();
        if (secret == null || secret.isBlank()) {
            return null;
        }
        return hmac(secret, checksumHex);
    }

    static String hmac(final String keyBase64, final String message) {
        try {
            final byte[] keyBytes = decodeKey(keyBase64);
            final Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(keyBytes, ALGORITHM));
            final byte[] digest = mac.doFinal(
                    message.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException(
                    "HMAC-SHA256 failed", ex);
        }
    }

    private static byte[] decodeKey(final String keyBase64) {
        // Permissive — accept both base64 and raw UTF-8 secrets so
        // small pilots can set a passphrase without a base64 roundtrip.
        try {
            return Base64.getDecoder().decode(keyBase64);
        } catch (IllegalArgumentException ex) {
            return keyBase64.getBytes(StandardCharsets.UTF_8);
        }
    }
}
