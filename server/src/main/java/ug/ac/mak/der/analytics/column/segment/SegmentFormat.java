package ug.ac.mak.der.analytics.column.segment;

import java.nio.charset.StandardCharsets;

/**
 * On-disk segment binary format constants. Centralised so writer
 * and reader can't disagree.
 *
 * <p>Layout (big-endian throughout):</p>
 * <pre>
 *   HEADER
 *     magic:     8 bytes  = "DERCOL\0\0"
 *     format:    int32    = {@link #FORMAT_VERSION}
 *     segment:   16 bytes = UUID (high then low)
 *     createdAt: int64    = epoch millis
 *     rowCount:  int32
 *     colCount:  int32
 *     reserved:  int32    = 0
 *
 *   COLUMN DIRECTORY × colCount
 *     nameLen:        int16
 *     name:           utf8
 *     colType:        int8 (ColumnType.ordinal)
 *     codecIdLen:     int8
 *     codecId:        utf8
 *     encodedLen:     int32
 *     nullCount:      int32
 *     dataOffset:     int64 (absolute in file)
 *
 *   PADDING to 8-byte boundary
 *
 *   COLUMN BLOBS × colCount (at their declared dataOffset)
 *
 *   TRAILER
 *     trailerMagic: 8 bytes = "LOCRED\0\0"
 *     fileCrc32:    int32  (CRC32 of everything before the trailer)
 * </pre>
 */
public final class SegmentFormat {

    public static final byte[] MAGIC =
            "DERCOL\0\0".getBytes(StandardCharsets.UTF_8);
    public static final byte[] TRAILER_MAGIC =
            "LOCRED\0\0".getBytes(StandardCharsets.UTF_8);
    public static final int FORMAT_VERSION = 1;

    public static final int HEADER_FIXED_BYTES =
            8   // magic
          + 4   // format version
          + 16  // segment id
          + 8   // createdAt
          + 4   // rowCount
          + 4   // colCount
          + 4;  // reserved

    public static final int TRAILER_BYTES =
            8   // trailer magic
          + 4;  // crc32

    private SegmentFormat() {
    }
}
