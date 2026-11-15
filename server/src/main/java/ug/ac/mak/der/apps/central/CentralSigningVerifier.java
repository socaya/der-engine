package ug.ac.mak.der.apps.central;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-008 — Ed25519 verifier for the pinned
 * central-side signing key.
 *
 * <p>Separate from {@code AppSigningKeyService} because the latter
 * verifies against DER's <em>own</em> key (the one it uses to sign
 * client-bound bundles). This verifier takes a <em>remote</em>
 * public key from {@code der.apps.central.signing-key} and verifies
 * that central-provided signatures match the bundle bytes we just
 * downloaded.</p>
 *
 * <p>When the config key is unset the verifier reports
 * {@link #pinnedKeyConfigured()}=false and the sync service keeps
 * the pre-FR-SYNC-008 behaviour (no central-side verification).
 * D2 in the plan allows an admin to override the unsigned path via
 * a separate system setting handled in {@link CentralAppSyncService}.</p>
 */
@Component
public class CentralSigningVerifier {

    /** Ed25519 raw-public-key SPKI prefix (OID 1.3.101.112).
     *  See {@code AppSigningKeyService.rebuildPublicKey} for details. */
    private static final byte[] SPKI_PREFIX = new byte[]{
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
            0x03, 0x21, 0x00
    };

    private final PublicKey pinnedKey;

    @Autowired
    public CentralSigningVerifier(
            @Value("${der.apps.central.signing-key:}") final String pinnedKeyB64) {
        this.pinnedKey = parse(pinnedKeyB64);
    }

    public boolean pinnedKeyConfigured() {
        return pinnedKey != null;
    }

    /** Verify {@code signatureB64} covers {@code bundleBytes} under
     *  the pinned key. Returns false when the signature is absent,
     *  malformed, or does not verify. Never throws. */
    public boolean verify(final byte[] bundleBytes,
                           final String signatureB64) {
        if (pinnedKey == null || bundleBytes == null
                || signatureB64 == null || signatureB64.isBlank()) {
            return false;
        }
        final byte[] signature;
        try {
            signature = Base64.getDecoder().decode(signatureB64);
        } catch (IllegalArgumentException ex) {
            return false;
        }
        try {
            final Signature sig = Signature.getInstance("Ed25519");
            sig.initVerify(pinnedKey);
            sig.update(bundleBytes);
            return sig.verify(signature);
        } catch (GeneralSecurityException ex) {
            return false;
        }
    }

    private static PublicKey parse(final String rawB64) {
        if (rawB64 == null || rawB64.isBlank()) {
            return null;
        }
        final byte[] rawPub;
        try {
            rawPub = Base64.getDecoder().decode(rawB64.trim());
        } catch (IllegalArgumentException ex) {
            // Mis-configured key — treat as "no pinned key" rather than
            // failing boot, since the admin may legitimately be rotating.
            return null;
        }
        if (rawPub.length != 32) {
            return null;
        }
        final byte[] spki = new byte[SPKI_PREFIX.length + rawPub.length];
        System.arraycopy(SPKI_PREFIX, 0, spki, 0, SPKI_PREFIX.length);
        System.arraycopy(rawPub, 0, spki, SPKI_PREFIX.length, rawPub.length);
        try {
            final KeyFactory factory = KeyFactory.getInstance("Ed25519");
            return factory.generatePublic(new X509EncodedKeySpec(spki));
        } catch (GeneralSecurityException ex) {
            return null;
        }
    }

    /** Package-private override hook for tests that want to inject a
     *  pre-built key without going through the Spring config path. */
    CentralSigningVerifier(final PublicKey pinnedKey) {
        this.pinnedKey = Objects.requireNonNull(pinnedKey, "pinnedKey");
    }
}
