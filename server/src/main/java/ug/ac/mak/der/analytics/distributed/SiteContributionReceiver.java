package ug.ac.mak.der.analytics.distributed;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SRS FR-DIS-003 server-side consolidator receive surface.
 * Validates every incoming packet's SHA-256 checksum, dedups by
 * {@code (siteId, metricId, period, orgUnit, dim, sourceCursor)},
 * and persists accepted packets so a later roll-up pass folds them
 * into the central result (Gate 6.3).
 */
@Service
public class SiteContributionReceiver {

    private static final Logger LOG =
            LoggerFactory.getLogger(SiteContributionReceiver.class);

    private final SiteContributionRepository repo;
    private SiteSignatureVerifier verifier;

    public SiteContributionReceiver(final SiteContributionRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    /** Setter injection — the 1-arg ctor stays compatible with
     *  pre-Gate-6.4 tests that don't need a verifier. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setVerifier(final SiteSignatureVerifier verifier) {
        this.verifier = verifier;
    }

    public record IngestResult(
            int received,
            int accepted,
            int deduped,
            int rejectedChecksum,
            int rejectedSignature,
            long sitesTouched) {

        /** Legacy 5-arg form for pre-Gate-6.4 call sites + tests. */
        public IngestResult(final int received, final int accepted,
                             final int deduped,
                             final int rejectedChecksum,
                             final long sitesTouched) {
            this(received, accepted, deduped, rejectedChecksum,
                    0, sitesTouched);
        }
    }

    public IngestResult ingest(final List<SiteContributionPacket> packets) {
        Objects.requireNonNull(packets, "packets");
        int accepted = 0;
        int deduped = 0;
        int rejectedChecksum = 0;
        int rejectedSignature = 0;
        final java.util.Set<String> sites = new java.util.HashSet<>();
        for (final SiteContributionPacket p : packets) {
            if (p == null) {
                continue;
            }
            final String expected = p.checksumHex();
            final String actual = canonicalChecksum(p);
            if (expected == null || !expected.equalsIgnoreCase(actual)) {
                rejectedChecksum++;
                LOG.warn("rejected site packet {}: checksum mismatch "
                        + "(expected {}, actual {})",
                        p.packetId(), expected, actual);
                continue;
            }
            if (verifier != null) {
                final SiteSignatureVerifier.TrustState state =
                        verifier.verify(p);
                if (state != SiteSignatureVerifier.TrustState.OK) {
                    rejectedSignature++;
                    LOG.warn("rejected site packet {}: signature {}",
                            p.packetId(), state);
                    continue;
                }
            }
            final boolean fresh = repo.insertIfAbsent(p);
            if (fresh) {
                accepted++;
                sites.add(p.siteId());
            } else {
                deduped++;
            }
        }
        return new IngestResult(packets.size(), accepted, deduped,
                rejectedChecksum, rejectedSignature, sites.size());
    }

    /** SHA-256 over the canonical packet bytes. Must mirror
     *  {@link SiteContributionExporter}'s checksum exactly so a
     *  byte-identical packet validates round-trip. */
    private static String canonicalChecksum(
            final SiteContributionPacket p) {
        try {
            final MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(p.metricId().toString()
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Integer.toString(p.definitionVersion())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(p.periodKey().getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(p.orgUnitUid().getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(p.dimensionKey().getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Long.toString(p.count())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(p.sum()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(p.min()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(p.max()).getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(p.numerator())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(plain(p.denominator())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(Long.toString(p.sourceCursor())
                    .getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            md.update(p.producedAt().toString()
                    .getBytes(StandardCharsets.UTF_8));
            final byte[] digest = md.digest();
            final StringBuilder sb = new StringBuilder(digest.length * 2);
            for (final byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(
                    "SHA-256 unavailable on this JVM", ex);
        }
    }

    private static String plain(final BigDecimal v) {
        return v == null ? "" : v.toPlainString();
    }
}
