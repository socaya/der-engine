package ug.ac.mak.der.analytics.column;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Pick the best codec for a column batch by measurement (SRS
 * FR-STO-007). Every candidate codec that matches the batch's
 * {@link ColumnType} is given the batch; the one producing the
 * smallest encoded byte array wins. The plain codec is always
 * in the candidate set so a selection can never make the output
 * larger than the uncompressed baseline.
 *
 * <p>This is deliberately a measurement step, not a heuristic.
 * SRS §0: "cost-based and adaptive optimization must be
 * deterministic and measurable". The winner's id is written into
 * the segment header so the reader knows which codec to dispatch.</p>
 */
public final class CodecSelector {

    private final List<Codec> candidates;

    public CodecSelector(final List<Codec> candidates) {
        this.candidates = List.copyOf(
                Objects.requireNonNull(candidates, "candidates"));
    }

    public static CodecSelector defaultSelector() {
        final List<Codec> out = new ArrayList<>();
        // One plain codec per primitive is always eligible — acts as
        // the uncompressed floor. Compressed codecs are added
        // alongside and only win when they measurably beat it.
        for (final ColumnType t : ColumnType.values()) {
            out.add(PlainCodec.forType(t));
        }
        final DictionaryStringCodec dict = new DictionaryStringCodec();
        final BitPackedInt64Codec bp = new BitPackedInt64Codec();
        final DeltaInt64Codec delta = new DeltaInt64Codec();
        final RleInt64Codec rleI64 = new RleInt64Codec();
        final RleStringCodec rleStr = new RleStringCodec();
        out.add(dict);
        out.add(bp);
        out.add(delta);
        out.add(rleI64);
        out.add(rleStr);

        // Wrap the typed encoders in Zstd + LZ4 so the entropy
        // coders compete with the structural codecs. Zstd is level
        // 3 (default); LZ4 is the fast decompressor — selector
        // picks whichever saves more bytes on the measured batch.
        final Compressor zstd = new ZstdCompressor();
        final Compressor lz4 = new Lz4Compressor();
        for (final Compressor comp : new Compressor[] { zstd, lz4 }) {
            for (final ColumnType t : ColumnType.values()) {
                out.add(new CompressedCodec(comp,
                        PlainCodec.forType(t),
                        BuiltinCodecs::lookup));
            }
            for (final Codec inner : new Codec[] {
                    dict, bp, delta, rleI64, rleStr }) {
                out.add(new CompressedCodec(comp, inner,
                        BuiltinCodecs::lookup));
            }
        }
        return new CodecSelector(out);
    }

    public record Choice(Codec codec, byte[] encoded,
                           long plainBytes, long chosenBytes) {
        public double ratio() {
            return plainBytes == 0
                    ? 1.0
                    : (double) chosenBytes / (double) plainBytes;
        }
    }

    /** Measure every applicable codec and return the smallest. */
    public Choice select(final ColumnBatch batch) {
        Objects.requireNonNull(batch, "batch");
        byte[] bestEncoded = null;
        Codec bestCodec = null;
        long plainBytes = -1;
        for (final Codec c : candidates) {
            if (c.columnType() != batch.type()) {
                continue;
            }
            final byte[] encoded = c.encode(batch);
            if (c instanceof PlainCodec.PlainInt64
                    || c instanceof PlainCodec.PlainDecimal
                    || c instanceof PlainCodec.PlainString
                    || c instanceof PlainCodec.PlainBool
                    || c instanceof PlainCodec.PlainDate) {
                plainBytes = encoded.length;
            }
            if (bestEncoded == null
                    || encoded.length < bestEncoded.length) {
                bestEncoded = encoded;
                bestCodec = c;
            }
        }
        if (bestEncoded == null || bestCodec == null) {
            throw new IllegalStateException(
                    "no codec applicable for " + batch.type());
        }
        return new Choice(bestCodec, bestEncoded,
                plainBytes < 0 ? bestEncoded.length : plainBytes,
                bestEncoded.length);
    }

    public List<Codec> candidates() {
        return candidates;
    }
}
