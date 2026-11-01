package ug.ac.mak.der.workflow;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * §2.3.42 — envelope encryption for the peer service-account
 * password. AES-256-GCM with a key material derived (SHA-256) from
 * {@code DER_PEER_SECRET_KEY}. Ciphertext is base64-url: {@code
 * ENC:<iv>:<ct+tag>}.
 *
 * Backward compat: {@link #decrypt} tolerates plaintext values that
 * were written by 2.3.35 so pilots don't need a one-shot migration
 * script. Those legacy values stay plaintext until the next
 * rotation / credential update, which re-writes them encrypted.
 *
 * When the env var is missing the component falls back to a
 * deterministic warning key so dev + tests work; pilots should set a
 * real random secret in {@code /etc/der/pilot.env}.
 */
@Component
public class PeerSecretCrypto {

    private static final Logger LOG = LoggerFactory.getLogger(PeerSecretCrypto.class);
    private static final String PREFIX = "ENC:";
    private static final int IV_LEN = 12;
    private static final int TAG_LEN = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public PeerSecretCrypto(
            @Value("${der.peer.secret-key:}") final String envKey) {
        final String raw;
        if (envKey == null || envKey.isBlank()) {
            LOG.warn("DER_PEER_SECRET_KEY unset — using an insecure dev-only key. "
                    + "Set a random 32+ char secret in /etc/der/pilot.env.");
            raw = "der-peer-dev-only-insecure-key-do-not-ship";
        } else {
            raw = envKey;
        }
        try {
            final byte[] k = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(k, "AES");
        } catch (Exception ex) {
            throw new IllegalStateException("key derivation failed", ex);
        }
    }

    public String encrypt(final String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            final byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            final Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LEN, iv));
            final byte[] ct = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            final ByteBuffer buf = ByteBuffer.allocate(IV_LEN + ct.length);
            buf.put(iv);
            buf.put(ct);
            return PREFIX + Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(buf.array());
        } catch (Exception ex) {
            throw new IllegalStateException("encrypt failed", ex);
        }
    }

    public String decrypt(final String stored) {
        if (stored == null) {
            return null;
        }
        if (!stored.startsWith(PREFIX)) {
            // Legacy plaintext (pre-§2.3.42). Return as-is so the
            // peer push still works until the operator rotates.
            return stored;
        }
        try {
            final byte[] all = Base64.getUrlDecoder()
                    .decode(stored.substring(PREFIX.length()));
            final byte[] iv = new byte[IV_LEN];
            System.arraycopy(all, 0, iv, 0, IV_LEN);
            final byte[] ct = new byte[all.length - IV_LEN];
            System.arraycopy(all, IV_LEN, ct, 0, ct.length);
            final Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LEN, iv));
            return new String(c.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            LOG.warn("decrypt failed: {}", ex.getMessage());
            return null;
        }
    }

    public boolean isEncrypted(final String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }
}
