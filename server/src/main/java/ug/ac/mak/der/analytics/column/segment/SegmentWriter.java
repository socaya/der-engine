package ug.ac.mak.der.analytics.column.segment;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Objects;
import java.util.zip.CRC32;

import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * Serialise a {@link Segment} into the on-disk format. Two entry
 * points:
 *
 * <ol>
 *   <li>{@link #toBytes} — pure in-memory serialisation, useful
 *       for shipping a segment over the wire or for tests.</li>
 *   <li>{@link #writeAtomically} — write to a temp file in the
 *       same directory, fsync, then atomic-rename to the target
 *       path (SRS FR-STO-006). On failure the target path is
 *       untouched.</li>
 * </ol>
 */
public final class SegmentWriter {

    private SegmentWriter() {
    }

    public static byte[] toBytes(final Segment segment) {
        Objects.requireNonNull(segment, "segment");
        final int colCount = segment.columns().size();

        // Pass 1 — compute per-column name / codec sizes and the
        // overall directory byte count.
        final byte[][] nameBytes = new byte[colCount][];
        final byte[][] codecBytes = new byte[colCount][];
        int directoryBytes = 0;
        for (int i = 0; i < colCount; i++) {
            final SegmentColumn c = segment.columns().get(i);
            nameBytes[i] = c.name().getBytes(StandardCharsets.UTF_8);
            codecBytes[i] = c.codecId().getBytes(StandardCharsets.UTF_8);
            if (nameBytes[i].length > 0xFFFF) {
                throw new IllegalArgumentException(
                        "column name > 65535 bytes: " + c.name());
            }
            if (codecBytes[i].length > 0xFF) {
                throw new IllegalArgumentException(
                        "codec id > 255 bytes: " + c.codecId());
            }
            directoryBytes += 2 + nameBytes[i].length    // name
                           + 1                            // type
                           + 1 + codecBytes[i].length    // codec
                           + 4                            // encodedLen
                           + 4                            // nullCount
                           + 8;                           // dataOffset
        }
        // Pad directory + header to 8-byte alignment so column blobs
        // start on a word boundary — modest scan speedup, zero cost.
        int preDataBytes = SegmentFormat.HEADER_FIXED_BYTES + directoryBytes;
        final int padBytes = (8 - (preDataBytes & 7)) & 7;
        preDataBytes += padBytes;

        // Pass 2 — allocate the full buffer and fill.
        int totalData = 0;
        for (final SegmentColumn c : segment.columns()) {
            totalData += c.encoded().length;
        }
        final int totalSize = preDataBytes + totalData
                + SegmentFormat.TRAILER_BYTES;
        final ByteBuffer buf = ByteBuffer.allocate(totalSize);

        // Header
        buf.put(SegmentFormat.MAGIC);
        buf.putInt(SegmentFormat.FORMAT_VERSION);
        buf.putLong(segment.segmentId().getMostSignificantBits());
        buf.putLong(segment.segmentId().getLeastSignificantBits());
        buf.putLong(segment.createdAt().toEpochMilli());
        buf.putInt(segment.rowCount());
        buf.putInt(colCount);
        buf.putInt(0); // reserved

        // Directory
        long dataOffset = preDataBytes;
        for (int i = 0; i < colCount; i++) {
            final SegmentColumn c = segment.columns().get(i);
            buf.putShort((short) nameBytes[i].length);
            buf.put(nameBytes[i]);
            buf.put((byte) c.type().ordinal());
            buf.put((byte) codecBytes[i].length);
            buf.put(codecBytes[i]);
            buf.putInt(c.encoded().length);
            buf.putInt(c.nullCount());
            buf.putLong(dataOffset);
            dataOffset += c.encoded().length;
        }
        // Zero-pad to 8 bytes
        for (int i = 0; i < padBytes; i++) {
            buf.put((byte) 0);
        }
        // Column blobs
        for (final SegmentColumn c : segment.columns()) {
            buf.put(c.encoded());
        }
        // Trailer: magic + crc32 of everything before it
        final byte[] bytes = buf.array();
        final CRC32 crc = new CRC32();
        crc.update(bytes, 0, totalSize - SegmentFormat.TRAILER_BYTES);
        final int checksum = (int) crc.getValue();

        buf.put(SegmentFormat.TRAILER_MAGIC);
        buf.putInt(checksum);
        return bytes;
    }

    /** Write a segment to {@code target} atomically — same-directory
     *  temp file, fsync, atomic-rename. On failure, the target
     *  path is untouched. */
    public static void writeAtomically(final Segment segment,
                                          final Path target)
            throws IOException {
        Objects.requireNonNull(target, "target");
        final byte[] bytes = toBytes(segment);
        final Path dir = target.getParent();
        if (dir != null) {
            Files.createDirectories(dir);
        }
        final Path temp = (dir == null
                ? Path.of(".") : dir)
                .resolve("." + target.getFileName() + ".tmp-"
                        + segment.segmentId());
        try (FileChannel ch = FileChannel.open(temp,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE)) {
            final ByteBuffer out = ByteBuffer.wrap(bytes);
            while (out.hasRemaining()) {
                ch.write(out);
            }
            ch.force(true);
        }
        try {
            Files.move(temp, target,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            Files.deleteIfExists(temp);
            throw ex;
        }
    }

    /** @return the on-disk size (bytes) a given segment will
     *  occupy — exposed so manifests can budget without a
     *  dry-run write. */
    public static int sizeInBytes(final Segment segment) {
        return toBytes(segment).length;
    }

    /** Tiny helper to expose {@link ColumnType} ordinals under a
     *  stable name. Never consumed outside the package but useful
     *  for diagnostics. */
    static int typeOrdinal(final ColumnType type) {
        return type.ordinal();
    }
}
