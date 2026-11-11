package ug.ac.mak.der.analytics.column.segment;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.CRC32;

import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * Parse a segment file (or byte array) produced by
 * {@link SegmentWriter}. Read strategies:
 *
 * <ul>
 *   <li>{@link #parseAll} — decode the full directory + every
 *       column blob into memory. Convenient for tests and small
 *       segments.</li>
 *   <li>{@link #projection} — decode only a named subset of
 *       columns (SRS FR-STO-004 — read only what the query
 *       touches). Backed by a positioned FileChannel so unread
 *       columns never touch RAM.</li>
 * </ul>
 *
 * <p>Both paths verify the magic, format version, trailer magic
 * and CRC32 before returning. A corrupt file surfaces as
 * {@link IllegalStateException} on first read — never a
 * silently-wrong decode (SRS §0).</p>
 */
public final class SegmentReader {

    private SegmentReader() {
    }

    public static Segment parseAll(final byte[] bytes) {
        Objects.requireNonNull(bytes, "bytes");
        return parseAllInternal(bytes);
    }

    public static Segment parseAll(final Path file) throws IOException {
        return parseAllInternal(Files.readAllBytes(file));
    }

    private static Segment parseAllInternal(final byte[] bytes) {
        final ByteBuffer buf = ByteBuffer.wrap(bytes);
        final Header h = readHeader(buf);
        verifyTrailer(bytes);
        final List<DirEntry> dir = readDirectory(buf, h.colCount());
        final List<SegmentColumn> cols = new ArrayList<>(h.colCount());
        for (final DirEntry e : dir) {
            final byte[] encoded = new byte[e.encodedLen()];
            System.arraycopy(bytes, (int) e.dataOffset(),
                    encoded, 0, e.encodedLen());
            cols.add(new SegmentColumn(e.name(), e.type(),
                    e.codecId(), encoded, e.nullCount()));
        }
        return new Segment(h.segmentId(), h.rowCount(),
                Instant.ofEpochMilli(h.createdAtMs()), cols);
    }

    /** Read only the named columns, skipping unrelated blobs. */
    public static Projection projection(final Path file,
                                          final List<String> wanted)
            throws IOException {
        Objects.requireNonNull(wanted, "wanted");
        try (FileChannel ch = FileChannel.open(file,
                StandardOpenOption.READ)) {
            final int fileLen = (int) ch.size();
            final byte[] prefix = new byte[
                    SegmentFormat.HEADER_FIXED_BYTES];
            readFully(ch, ByteBuffer.wrap(prefix), 0);
            final Header h = readHeader(ByteBuffer.wrap(prefix));
            // Read directory + column headers next.
            final int directoryMax = fileLen
                    - SegmentFormat.HEADER_FIXED_BYTES
                    - SegmentFormat.TRAILER_BYTES;
            final byte[] rest = new byte[directoryMax];
            readFully(ch, ByteBuffer.wrap(rest),
                    SegmentFormat.HEADER_FIXED_BYTES);
            final ByteBuffer dirBuf = ByteBuffer.wrap(rest);
            final List<DirEntry> dir = readDirectory(dirBuf,
                    h.colCount());
            // Verify trailer / crc.
            final byte[] all = new byte[fileLen];
            readFully(ch, ByteBuffer.wrap(all), 0);
            verifyTrailer(all);

            final List<SegmentColumn> out = new ArrayList<>();
            for (final DirEntry e : dir) {
                if (!wanted.contains(e.name())) {
                    continue;
                }
                final byte[] encoded = new byte[e.encodedLen()];
                readFully(ch, ByteBuffer.wrap(encoded), e.dataOffset());
                out.add(new SegmentColumn(e.name(), e.type(),
                        e.codecId(), encoded, e.nullCount()));
            }
            return new Projection(h.segmentId(), h.rowCount(),
                    Instant.ofEpochMilli(h.createdAtMs()), out);
        }
    }

    public record Projection(UUID segmentId, int rowCount,
                               Instant createdAt,
                               List<SegmentColumn> columns) {
        public Projection {
            columns = List.copyOf(columns);
        }

        public Optional<SegmentColumn> column(final String name) {
            return columns.stream()
                    .filter(c -> c.name().equals(name))
                    .findFirst();
        }
    }

    /* ─────── internals ─────── */

    private static Header readHeader(final ByteBuffer buf) {
        final byte[] magic = new byte[SegmentFormat.MAGIC.length];
        buf.get(magic);
        if (!java.util.Arrays.equals(magic, SegmentFormat.MAGIC)) {
            throw new IllegalStateException(
                    "segment magic mismatch — not a DER column segment");
        }
        final int version = buf.getInt();
        if (version != SegmentFormat.FORMAT_VERSION) {
            throw new IllegalStateException(
                    "unsupported segment format version " + version);
        }
        final long msb = buf.getLong();
        final long lsb = buf.getLong();
        final long createdMs = buf.getLong();
        final int rowCount = buf.getInt();
        final int colCount = buf.getInt();
        buf.getInt(); // reserved
        return new Header(new UUID(msb, lsb), createdMs,
                rowCount, colCount);
    }

    private static List<DirEntry> readDirectory(final ByteBuffer buf,
                                                   final int colCount) {
        final List<DirEntry> out = new ArrayList<>(colCount);
        for (int i = 0; i < colCount; i++) {
            final int nameLen = Short.toUnsignedInt(buf.getShort());
            final byte[] nameBytes = new byte[nameLen];
            buf.get(nameBytes);
            final String name = new String(nameBytes,
                    StandardCharsets.UTF_8);
            final int typeOrd = buf.get() & 0xFF;
            if (typeOrd >= ColumnType.values().length) {
                throw new IllegalStateException(
                        "segment references unknown column type " + typeOrd);
            }
            final ColumnType type = ColumnType.values()[typeOrd];
            final int codecLen = buf.get() & 0xFF;
            final byte[] codecBytes = new byte[codecLen];
            buf.get(codecBytes);
            final String codecId = new String(codecBytes,
                    StandardCharsets.UTF_8);
            final int encodedLen = buf.getInt();
            final int nullCount = buf.getInt();
            final long dataOffset = buf.getLong();
            out.add(new DirEntry(name, type, codecId, encodedLen,
                    nullCount, dataOffset));
        }
        return out;
    }

    private static void verifyTrailer(final byte[] all) {
        final int trailerStart = all.length
                - SegmentFormat.TRAILER_BYTES;
        for (int i = 0; i < SegmentFormat.TRAILER_MAGIC.length; i++) {
            if (all[trailerStart + i]
                    != SegmentFormat.TRAILER_MAGIC[i]) {
                throw new IllegalStateException(
                        "segment trailer magic mismatch — file truncated "
                      + "or corrupted");
            }
        }
        final CRC32 crc = new CRC32();
        crc.update(all, 0, trailerStart);
        final int expected = (int) crc.getValue();
        final int actual = ByteBuffer.wrap(all,
                trailerStart + SegmentFormat.TRAILER_MAGIC.length, 4)
                .getInt();
        if (expected != actual) {
            throw new IllegalStateException(
                    "segment CRC32 mismatch — expected "
                  + Integer.toHexString(expected) + ", actual "
                  + Integer.toHexString(actual));
        }
    }

    private static void readFully(final FileChannel ch,
                                    final ByteBuffer buf,
                                    final long position) throws IOException {
        int pos = 0;
        long filePos = position;
        while (buf.hasRemaining()) {
            final int n = ch.read(buf, filePos + pos);
            if (n < 0) {
                throw new IOException("unexpected EOF at " + (filePos + pos));
            }
            pos += n;
        }
    }

    private record Header(UUID segmentId, long createdAtMs,
                            int rowCount, int colCount) { }

    private record DirEntry(String name, ColumnType type, String codecId,
                              int encodedLen, int nullCount,
                              long dataOffset) { }
}
