package ug.ac.mak.der.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Objects;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * FR-16-07: at-rest encryption envelope for small secrets (TOTP, API
 * tokens). Uses AES-256-GCM with a 32-byte key derived from
 * {@code der.security.secret-key} (operator-provided, base64).
 *
 * <p>Rotation: operator provisions a new key, re-encrypts via
 * {@code POST /edge-api/v1/admin/ops/secrets/rotate} (future).
 * Alpha.2 ships the envelope only; the rotation endpoint is
 * follow-up work. When the key is unconfigured, encrypt/decrypt
 * fall through to plaintext — matches the pre-FR-16-07 behaviour.</p>
 */
@Component
public class SecretEnvelope {

    private static final String ALG = "AES";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private static final String PREFIX = "env:v1:";

    private final byte[] key;
    private final SecureRandom rand = new SecureRandom();

    public SecretEnvelope(@Value("${der.security.secret-key:}") final String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            this.key = new byte[0];
        } else {
            final byte[] decoded = Base64.getDecoder().decode(base64Key.trim());
            if (decoded.length != 32) {
                throw new IllegalStateException(
                        "der.security.secret-key must decode to 32 bytes");
            }
            this.key = decoded;
        }
    }

    public boolean isEnabled() {
        return key.length == 32;
    }

    /**
     * Encrypts the plaintext. Returns the ciphertext as
     * {@code env:v1:<base64(iv || cipher)>}. When no key is
     * configured, returns the plaintext unchanged.
     */
    public String seal(final String plaintext) {
        Objects.requireNonNull(plaintext, "plaintext");
        if (!isEnabled()) {
            return plaintext;
        }
        try {
            final byte[] iv = new byte[IV_BYTES];
            rand.nextBytes(iv);
            final Cipher c = Cipher.getInstance(CIPHER);
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, ALG),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            final byte[] body = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            final byte[] packed = new byte[iv.length + body.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(body, 0, packed, iv.length, body.length);
            return PREFIX + Base64.getEncoder().encodeToString(packed);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("seal failed", ex);
        }
    }

    /**
     * Decrypts an envelope. Returns the ciphertext unchanged when it
     * doesn't start with the prefix (i.e. plaintext legacy value).
     */
    public String open(final String maybeEnvelope) {
        Objects.requireNonNull(maybeEnvelope, "maybeEnvelope");
        if (!maybeEnvelope.startsWith(PREFIX)) {
            return maybeEnvelope;
        }
        if (!isEnabled()) {
            throw new IllegalStateException("secret key not configured, cannot open envelope");
        }
        try {
            final byte[] packed = Base64.getDecoder().decode(
                    maybeEnvelope.substring(PREFIX.length()));
            if (packed.length <= IV_BYTES) {
                throw new IllegalStateException("envelope too short");
            }
            final byte[] iv = new byte[IV_BYTES];
            final byte[] body = new byte[packed.length - IV_BYTES];
            System.arraycopy(packed, 0, iv, 0, IV_BYTES);
            System.arraycopy(packed, IV_BYTES, body, 0, body.length);
            final Cipher c = Cipher.getInstance(CIPHER);
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, ALG),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(c.doFinal(body), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("open failed", ex);
        }
    }
}
