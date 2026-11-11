package ug.ac.mak.der.analytics.distributed;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SiteSignatureTest {

    private SiteContributionPacket packet(final String site,
                                             final String checksum,
                                             final String signature) {
        return new SiteContributionPacket(site, UUID.randomUUID(),
                UUID.randomUUID(), 1, "202611", "OU-A", "",
                1L, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE,
                null, null, 1L, Instant.now(), checksum, signature);
    }

    @Test
    void signerReturnsNullWhenNoSecretConfigured() {
        final SiteSigner s = new SiteSigner(
                new SiteTrustProperties(null, Map.of(), false));
        assertThat(s.sign("abc")).isNull();
    }

    @Test
    void signerProducesStableBase64Hmac() {
        final SiteSigner s = new SiteSigner(
                new SiteTrustProperties("my-secret", Map.of(), false));
        final String sig1 = s.sign("hello");
        final String sig2 = s.sign("hello");
        assertThat(sig1).isNotNull();
        assertThat(sig1).isEqualTo(sig2);
        assertThat(s.sign("world")).isNotEqualTo(sig1);
    }

    @Test
    void verifierOkOnMatchingSignature() {
        final SiteSigner signer = new SiteSigner(
                new SiteTrustProperties("site-a-secret", Map.of(),
                        false));
        final String checksum = "deadbeef";
        final String sig = signer.sign(checksum);

        final SiteSignatureVerifier v = new SiteSignatureVerifier(
                new SiteTrustProperties(null,
                        Map.of("site-a", "site-a-secret"), false));
        assertThat(v.verify(packet("site-a", checksum, sig)))
                .isEqualTo(SiteSignatureVerifier.TrustState.OK);
    }

    @Test
    void verifierBadSignatureOnTamperedPacket() {
        final SiteSignatureVerifier v = new SiteSignatureVerifier(
                new SiteTrustProperties(null,
                        Map.of("site-a", "site-a-secret"), false));
        // Forged signature — any garbage that happens to be the
        // right length rejects.
        assertThat(v.verify(packet("site-a", "deadbeef",
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")))
                .isEqualTo(SiteSignatureVerifier.TrustState.BAD_SIGNATURE);
    }

    @Test
    void verifierUnknownSiteWhenKeyAbsent() {
        final SiteSignatureVerifier v = new SiteSignatureVerifier(
                new SiteTrustProperties(null, Map.of(), false));
        assertThat(v.verify(packet("site-x", "deadbeef", "abc")))
                .isEqualTo(SiteSignatureVerifier.TrustState.UNKNOWN_SITE);
    }

    @Test
    void verifierAcceptsUnsignedWhenNotRequired() {
        final SiteSignatureVerifier v = new SiteSignatureVerifier(
                new SiteTrustProperties(null, Map.of(), false));
        assertThat(v.verify(packet("site-a", "deadbeef", null)))
                .isEqualTo(SiteSignatureVerifier.TrustState.OK);
    }

    @Test
    void verifierRejectsUnsignedWhenRequired() {
        final SiteSignatureVerifier v = new SiteSignatureVerifier(
                new SiteTrustProperties(null, Map.of(), true));
        assertThat(v.verify(packet("site-a", "deadbeef", null)))
                .isEqualTo(SiteSignatureVerifier.TrustState.UNSIGNED);
    }

    @Test
    void constantTimeCompareHandlesLengthMismatch() {
        assertThat(SiteSignatureVerifier.constantTimeEquals("abc",
                "abcd")).isFalse();
        assertThat(SiteSignatureVerifier.constantTimeEquals(null,
                "abc")).isFalse();
        assertThat(SiteSignatureVerifier.constantTimeEquals("abc",
                "abc")).isTrue();
    }
}
