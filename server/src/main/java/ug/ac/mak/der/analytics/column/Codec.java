package ug.ac.mak.der.analytics.column;

/**
 * Column codec contract (SRS FR-STO-007). An implementation
 * converts between a {@link ColumnBatch} and a byte representation
 * suitable for persistence / network transport, and vice versa.
 * Every codec carries a stable {@link #codecId} that is written in
 * the segment header so a reader picks the right decoder without
 * guessing.
 *
 * <p>Implementations must be deterministic: encoding the same
 * batch twice must produce byte-identical output so segment
 * checksums stay stable on re-encode (FR-STO-006).</p>
 */
public interface Codec {

    /** Stable identifier for this codec family; written into the
     *  segment header. Must be ASCII-safe and &le; 16 chars. */
    String codecId();

    /** Column type this codec handles. */
    ColumnType columnType();

    /** Encode a batch into bytes. */
    byte[] encode(ColumnBatch batch);

    /** Decode a byte blob back into a batch. {@code rowCount} is
     *  the number of logical rows the blob represents (stored in
     *  the segment header alongside the blob so decoders don't
     *  have to re-derive it from the payload). */
    ColumnBatch decode(byte[] blob, int rowCount);
}
