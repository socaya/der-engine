package ug.ac.mak.der.analytics.distributed;

import java.util.Objects;

import org.springframework.stereotype.Service;

/**
 * Consolidator-side gatekeeper that checks each packet's HMAC-
 * SHA256 signature against the sender site's expected shared
 * secret. Unknown sender → trustState = UNKNOWN_SITE; signature
 * mismatch → BAD_SIGNATURE; valid → OK. A packet without a
 * signature is accepted only when {@code rejectUnsigned=false}.
 */
@Service
public class SiteSignatureVerifier {

    public enum TrustState { OK, UNSIGNED, UNKNOWN_SITE, BAD_SIGNATURE }

    private final SiteTrustProperties properties;

    public SiteSignatureVerifier(final SiteTrustProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    public TrustState verify(final SiteContributionPacket packet) {
        Objects.requireNonNull(packet, "packet");
        final String signature = packet.signatureHex();
        if (signature == null || signature.isBlank()) {
            return properties.rejectUnsigned()
                    ? TrustState.UNSIGNED : TrustState.OK;
        }
        final String secret = properties.siteKeys().get(packet.siteId());
        if (secret == null || secret.isBlank()) {
            return TrustState.UNKNOWN_SITE;
        }
        final String expected = SiteSigner.hmac(secret,
                packet.checksumHex());
        return constantTimeEquals(expected, signature)
                ? TrustState.OK : TrustState.BAD_SIGNATURE;
    }

    /** Constant-time compare so a timing side channel can't
     *  distinguish a near-match from an early mismatch. */
    static boolean constantTimeEquals(final String a, final String b) {
        if (a == null || b == null || a.length() != b.length()) {
            return false;
        }
        int acc = 0;
        for (int i = 0; i < a.length(); i++) {
            acc |= a.charAt(i) ^ b.charAt(i);
        }
        return acc == 0;
    }
}
