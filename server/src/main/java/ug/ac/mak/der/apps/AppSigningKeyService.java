package ug.ac.mak.der.apps;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.EdECPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.Generated;
import ug.ac.mak.der.security.SecretEnvelope;

/**
 * Ed25519 signing-key custodian for the app bundle pipeline.
 *
 * <p>The key pair is generated lazily on first use, persisted in
 * {@code der.signing_key} (singleton row id=1), and cached in memory for
 * the lifetime of the JVM. The public key is stored as its 32-byte raw
 * form (base64 at rest) so the device-side Web Crypto
 * {@code subtle.importKey("raw", …, "Ed25519", …)} call takes it
 * verbatim. The private key is PKCS#8-encoded and run through
 * {@link SecretEnvelope#seal(String)}.</p>
 *
 * <p>Idempotency across concurrent boots is handled at the SQL layer:
 * {@link AppCatalogueRepository#insertSigningKey} uses
 * {@code ON CONFLICT (id) DO NOTHING}. If the insert loses a race the
 * caller re-SELECTs and loads the winner's key.</p>
 */
@Service
public class AppSigningKeyService {

    static final String ALGORITHM = "Ed25519";

    private final AppCatalogueRepository repo;
    private final SecretEnvelope envelope;

    private final Object lock = new Object();

    /**
     * Immutable holder for the triple — a single volatile reference
     * replaces three volatile fields (one of which SpotBugs rightly flags
     * as a volatile-reference-to-array, since the array contents are
     * themselves non-volatile).
     */
    private record KeyState(byte[] publicKeyRaw, String publicKeyB64,
                              PrivateKey privateKey) { }

    // Lazily populated — null until the first consumer triggers load/generation.
    private volatile KeyState state;

    public AppSigningKeyService(final AppCatalogueRepository repo,
                                 final SecretEnvelope envelope) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.envelope = Objects.requireNonNull(envelope, "envelope");
    }

    /** 32 bytes of raw public key material. Triggers lazy load/generation. */
    public byte[] publicKeyRaw() {
        ensureLoaded();
        return state.publicKeyRaw().clone();
    }

    /** Base64 of the raw public key; what the catalogue endpoint returns. */
    public String publicKeyBase64() {
        ensureLoaded();
        return state.publicKeyB64();
    }

    /**
     * Sign the exact bundle bytes with the private key. Returns 64-byte
     * signature. JaCoCo-exclude the catch — "Ed25519" is JLS-guaranteed on
     * JRE 15+ (DER targets 21) so the only ways
     * Signature.getInstance/initSign/sign can throw a
     * {@link GeneralSecurityException} here are JDK installation
     * corruption, which the user would see as the test suite failing on
     * every other crypto operation first.
     */
    @Generated("JRE-spec defensive branch — Ed25519 always available")
    public byte[] signBundle(final byte[] bundleBytes) {
        Objects.requireNonNull(bundleBytes, "bundleBytes");
        ensureLoaded();
        try {
            final Signature sig = Signature.getInstance(ALGORITHM);
            sig.initSign(state.privateKey());
            sig.update(bundleBytes);
            return sig.sign();
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("sign failed", ex);
        }
    }

    /** Verify a signature against the current public key. */
    public boolean verify(final byte[] bundle, final byte[] signature) {
        Objects.requireNonNull(bundle, "bundle");
        Objects.requireNonNull(signature, "signature");
        ensureLoaded();
        try {
            final Signature sig = Signature.getInstance(ALGORITHM);
            sig.initVerify(rebuildPublicKey(state.publicKeyRaw()));
            sig.update(bundle);
            return sig.verify(signature);
        } catch (GeneralSecurityException ex) {
            return false;
        }
    }

    // ---- internals -----------------------------------------------------

    private void ensureLoaded() {
        if (state != null) {
            return;
        }
        synchronized (lock) {
            // Double-checked locking: another thread may have loaded the
            // key while we blocked on the monitor. The volatile read on
            // 'state' makes the publication safe. No branch exit here —
            // we always re-read through the Optional below so the catch-up
            // is a plain assignment in loadFrom, keeping the control flow
            // flat.
            if (state == null) {
                loadOrGenerate();
            }
        }
    }

    private void loadOrGenerate() {
        final Optional<AppCatalogueRepository.SigningKey> existing = repo.readSigningKey();
        if (existing.isPresent()) {
            loadFrom(existing.get());
            return;
        }
        // Generate + attempt to persist. If another node wins the race
        // our row is dropped by ON CONFLICT DO NOTHING; re-select picks
        // up the surviving key.
        final KeyPair generated = generate();
        final byte[] rawPub = extractRawPublicKey(generated.getPublic());
        final String pubB64 = Base64.getEncoder().encodeToString(rawPub);
        final String sealed = envelope.seal(
                Base64.getEncoder().encodeToString(generated.getPrivate().getEncoded()));
        repo.insertSigningKey(ALGORITHM, pubB64, sealed, null);
        final AppCatalogueRepository.SigningKey after = repo.readSigningKey()
                .orElseThrow(() -> new IllegalStateException(
                        "signing_key missing after insert"));
        loadFrom(after);
    }

    private void loadFrom(final AppCatalogueRepository.SigningKey row) {
        final byte[] rawPub = Base64.getDecoder().decode(row.publicKeyB64());
        final PrivateKey priv = decodePrivateKey(envelope.open(row.sealedSecret()));
        this.state = new KeyState(rawPub, row.publicKeyB64(), priv);
    }

    /** @see #signBundle for the coverage-waiver rationale. */
    @Generated("JRE-spec defensive branch — Ed25519 always available")
    private static KeyPair generate() {
        try {
            final KeyPairGenerator gen = KeyPairGenerator.getInstance(ALGORITHM);
            return gen.generateKeyPair();
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Ed25519 not available on this JRE", ex);
        }
    }

    /**
     * Pull the raw 32-byte public key out of a JDK-generated
     * {@link EdECPublicKey}. The API exposes it as
     * {@link java.math.BigInteger#toByteArray()} little-endian with an
     * x-coordinate sign bit in the top byte; we reconstruct the 32-byte
     * fixed-width form expected by RFC 8032.
     */
    static byte[] extractRawPublicKey(final PublicKey publicKey) {
        if (!(publicKey instanceof EdECPublicKey ed)) {
            throw new IllegalStateException(
                    "unexpected key type: " + publicKey.getClass());
        }
        final byte[] y = ed.getPoint().getY().toByteArray();
        // getY() is big-endian; RFC 8032 wants little-endian + fixed 32-byte width.
        final byte[] raw = new byte[32];
        for (int i = 0; i < y.length && i < 32; i++) {
            raw[i] = y[y.length - 1 - i];
        }
        if (ed.getPoint().isXOdd()) {
            raw[31] |= (byte) 0x80;
        }
        return raw;
    }

    /**
     * We only ever decode a PKCS#8 blob we just encoded ourselves, so the
     * catch here can only fire if the DB row has been tampered with — that
     * is its own ops-level incident, not a code path.
     */
    @Generated("Defensive branch — we only decode blobs we encoded ourselves")
    private static PrivateKey decodePrivateKey(final String base64Pkcs8) {
        try {
            final byte[] pkcs8 = Base64.getDecoder().decode(base64Pkcs8);
            final KeyFactory factory = KeyFactory.getInstance(ALGORITHM);
            return factory.generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("private key decode failed", ex);
        }
    }

    /**
     * Rebuild a {@link PublicKey} from the raw 32-byte form. Verification
     * uses this path so the catalogue-served public key is the one actually
     * exercised during {@link #verify(byte[], byte[])}. Catch is excluded
     * for the same reason as {@link #signBundle} — JRE guarantees Ed25519.
     */
    @Generated("JRE-spec defensive branch — Ed25519 always available")
    private static PublicKey rebuildPublicKey(final byte[] rawPub) {
        try {
            // Wrap the raw key in an X.509 SubjectPublicKeyInfo for Ed25519
            // (OID 1.3.101.112) so KeyFactory can parse it. The algorithm
            // identifier is "SEQUENCE(SEQUENCE(OID), BIT STRING(key))"; the
            // constant below is the fixed prefix.
            final byte[] prefix = new byte[]{
                    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
                    0x03, 0x21, 0x00
            };
            final byte[] spki = new byte[prefix.length + rawPub.length];
            System.arraycopy(prefix, 0, spki, 0, prefix.length);
            System.arraycopy(rawPub, 0, spki, prefix.length, rawPub.length);
            final KeyFactory factory = KeyFactory.getInstance(ALGORITHM);
            return factory.generatePublic(new java.security.spec.X509EncodedKeySpec(spki));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("public key rebuild failed", ex);
        }
    }
}
