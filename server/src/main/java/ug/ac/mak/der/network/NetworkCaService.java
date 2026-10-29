package ug.ac.mak.der.network;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Phase N2 — Internal Ed25519 CA. Generates a per-edge keypair on
 *  first access, persists it to {@code der.network_ca}, and signs
 *  per-device attestations issued through {@code /network/enroll}.
 *
 *  <p>Chosen over X.509/RSA because Ed25519 is JDK-built-in (Java 15+),
 *  32-byte keys, 64-byte sigs — a credible trust story for a Phase N2
 *  edge box without pulling BouncyCastle onto the classpath.</p>
 *
 *  <p>Attestation format: a single-line, two-field blob
 *  <code>EDGE-ATTEST v1 {payload-base64}.{signature-base64}</code>
 *  where <code>payload</code> is the SHA-256 of the device-presented
 *  public key concatenated with the issued-at epoch seconds. A device
 *  verifies by base64-decoding the public key off GET /network/ca and
 *  calling Ed25519.verify. */
@Service
public class NetworkCaService {

    private static final Logger LOG = LoggerFactory.getLogger(NetworkCaService.class);
    private static final String ATTEST_PREFIX = "EDGE-ATTEST v1 ";

    private final JdbcTemplate jdbc;
    private final Object initLock = new Object();
    private volatile KeyPair cached;
    private volatile String cachedFingerprint;
    private volatile Instant cachedCreatedAt;

    public NetworkCaService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Lazy init — generate the CA keypair on first access if the
     *  singleton row isn't present. Idempotent across concurrent
     *  callers via a synchronized block. */
    @Transactional
    public void ensureCa() {
        if (cached != null) {
            return;
        }
        synchronized (initLock) {
            if (cached != null) {
                return;
            }
            final Optional<Row> existing = loadRow();
            if (existing.isPresent()) {
                cached = reconstruct(existing.get());
                cachedFingerprint = existing.get().fingerprint;
                cachedCreatedAt   = existing.get().createdAt;
                return;
            }
            try {
                final KeyPairGenerator g = KeyPairGenerator.getInstance("Ed25519");
                g.initialize(255, new SecureRandom());
                final KeyPair kp = g.generateKeyPair();
                final byte[] pkcs8  = kp.getPrivate().getEncoded();
                final byte[] x509   = kp.getPublic().getEncoded();
                final String pubB64 = Base64.getEncoder().encodeToString(x509);
                final String fp     = fingerprint(x509);
                jdbc.update(
                    "INSERT INTO der.network_ca "
                  + "(id, algorithm, private_key_pkcs8, public_key_x509, "
                  + " public_key_base64, fingerprint_sha256) "
                  + "VALUES (1, 'Ed25519', ?, ?, ?, ?)",
                    pkcs8, x509, pubB64, fp);
                cached = kp;
                cachedFingerprint = fp;
                cachedCreatedAt   = Instant.now();
                LOG.info("DER internal CA generated — fingerprint {}", fp);
            } catch (final Exception ex) {
                throw new IllegalStateException("could not initialise CA", ex);
            }
        }
    }

    public String fingerprint() {
        ensureCa();
        return cachedFingerprint;
    }

    public String publicKeyBase64() {
        ensureCa();
        return Base64.getEncoder().encodeToString(cached.getPublic().getEncoded());
    }

    public Instant createdAt() {
        ensureCa();
        return cachedCreatedAt;
    }

    /** Sign an attestation binding the device's public key to this
     *  edge's CA. Returns the full ATTEST blob. */
    public Attestation issueAttestation(final String devicePublicKeyB64) {
        ensureCa();
        if (devicePublicKeyB64 == null || devicePublicKeyB64.isBlank()) {
            throw new IllegalArgumentException("device public key required");
        }
        final byte[] devPub = Base64.getDecoder().decode(devicePublicKeyB64);
        final Instant issued = Instant.now();
        final String payload = Base64.getEncoder().withoutPadding().encodeToString(
            sha256(concat(devPub, Long.toString(issued.getEpochSecond())
                                          .getBytes(StandardCharsets.UTF_8))));
        try {
            final Signature sig = Signature.getInstance("Ed25519");
            sig.initSign(cached.getPrivate());
            sig.update(payload.getBytes(StandardCharsets.US_ASCII));
            final String sigB64 = Base64.getEncoder().withoutPadding()
                                        .encodeToString(sig.sign());
            final String blob = ATTEST_PREFIX + payload + "." + sigB64;
            final String fp = fingerprint(blob.getBytes(StandardCharsets.UTF_8));
            return new Attestation(blob, fp, issued);
        } catch (final Exception ex) {
            throw new IllegalStateException("could not sign attestation", ex);
        }
    }

    public record Attestation(String blob, String fingerprint, Instant issuedAt) { }

    private Optional<Row> loadRow() {
        try {
            final Row r = jdbc.queryForObject(
                "SELECT algorithm, private_key_pkcs8, public_key_x509, "
              + "       fingerprint_sha256, created_at "
              + "  FROM der.network_ca WHERE id = 1",
                (rs, i) -> new Row(
                    rs.getString("algorithm"),
                    rs.getBytes("private_key_pkcs8"),
                    rs.getBytes("public_key_x509"),
                    rs.getString("fingerprint_sha256"),
                    rs.getTimestamp("created_at").toInstant()));
            return Optional.ofNullable(r);
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private static KeyPair reconstruct(final Row r) {
        try {
            final KeyFactory kf = KeyFactory.getInstance(r.algorithm);
            final PrivateKey pk = kf.generatePrivate(new PKCS8EncodedKeySpec(r.pkcs8));
            final PublicKey  pub = kf.generatePublic(new X509EncodedKeySpec(r.x509));
            return new KeyPair(pub, pk);
        } catch (final Exception ex) {
            throw new IllegalStateException("could not reload CA key", ex);
        }
    }

    private static byte[] sha256(final byte[] in) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(in);
        } catch (final Exception ex) {
            throw new IllegalStateException("SHA-256 missing", ex);
        }
    }

    private static byte[] concat(final byte[] a, final byte[] b) {
        final byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0,        a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    private static String fingerprint(final byte[] bytes) {
        return HexFormat.of().formatHex(sha256(bytes)).toUpperCase()
                        .replaceAll("(..)", "$1:")
                        .replaceAll(":$", "");
    }

    private record Row(String algorithm, byte[] pkcs8, byte[] x509,
                        String fingerprint, Instant createdAt) { }
}
