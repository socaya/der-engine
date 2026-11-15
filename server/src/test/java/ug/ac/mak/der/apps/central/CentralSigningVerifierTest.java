package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.EdECPublicKey;
import java.util.Base64;

import org.junit.jupiter.api.Test;

class CentralSigningVerifierTest {

    @Test
    void unconfiguredKeyMeansNoVerification() {
        final CentralSigningVerifier v = new CentralSigningVerifier("");
        assertThat(v.pinnedKeyConfigured()).isFalse();
        assertThat(v.verify(new byte[]{1, 2}, "whatever")).isFalse();
    }

    @Test
    void malformedKeyFallsBackToUnconfigured() {
        final CentralSigningVerifier v = new CentralSigningVerifier("not-base64!!");
        assertThat(v.pinnedKeyConfigured()).isFalse();
    }

    @Test
    void acceptsValidSignatureRejectsTamperedBundle() throws Exception {
        final KeyPairGenerator gen = KeyPairGenerator.getInstance("Ed25519");
        final KeyPair kp = gen.generateKeyPair();
        final byte[] rawPub = rawFromEdec((EdECPublicKey) kp.getPublic());
        final String b64 = Base64.getEncoder().encodeToString(rawPub);
        final byte[] bundle = "hello world".getBytes();
        final Signature sig = Signature.getInstance("Ed25519");
        sig.initSign(kp.getPrivate());
        sig.update(bundle);
        final String goodSig = Base64.getEncoder().encodeToString(sig.sign());
        final CentralSigningVerifier v = new CentralSigningVerifier(b64);
        assertThat(v.pinnedKeyConfigured()).isTrue();
        assertThat(v.verify(bundle, goodSig)).isTrue();
        // Tamper the bundle: signature should no longer verify.
        final byte[] tampered = "hello worlX".getBytes();
        assertThat(v.verify(tampered, goodSig)).isFalse();
        // Garbage signature does not throw.
        assertThat(v.verify(bundle, "not-base64!!")).isFalse();
        assertThat(v.verify(bundle, "")).isFalse();
        assertThat(v.verify(bundle, null)).isFalse();
    }

    /** Extract the little-endian 32-byte raw public key from an
     *  Ed25519 {@link EdECPublicKey}. JDK encodes the y-coordinate
     *  big-endian in the {@code point}, and sets the high bit of the
     *  last byte when x is odd — exactly the on-wire raw form. */
    private static byte[] rawFromEdec(final EdECPublicKey key) {
        final byte[] y = key.getPoint().getY().toByteArray();
        // Strip a potential leading zero introduced by BigInteger's
        // sign byte, then pad to 32, then reverse to little-endian.
        final byte[] trimmed = stripLeadingZero(y);
        final byte[] padded = leftPad(trimmed, 32);
        reverseInPlace(padded);
        if (key.getPoint().isXOdd()) {
            padded[31] |= (byte) 0x80;
        }
        return padded;
    }

    private static byte[] stripLeadingZero(final byte[] b) {
        if (b.length > 1 && b[0] == 0) {
            final byte[] out = new byte[b.length - 1];
            System.arraycopy(b, 1, out, 0, out.length);
            return out;
        }
        return b;
    }

    private static byte[] leftPad(final byte[] b, final int target) {
        if (b.length >= target) {
            return b;
        }
        final byte[] out = new byte[target];
        System.arraycopy(b, 0, out, target - b.length, b.length);
        return out;
    }

    private static void reverseInPlace(final byte[] b) {
        for (int i = 0, j = b.length - 1; i < j; i++, j--) {
            final byte t = b[i];
            b[i] = b[j];
            b[j] = t;
        }
    }
}
