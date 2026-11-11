package ug.ac.mak.der.analytics.column.manifest;

import java.nio.charset.StandardCharsets;

/**
 * On-disk manifest format constants. A manifest file is
 * {@code [JSON body][12-byte trailer]}, where the trailer is
 * {@code "CRCMNF\0\0"} + CRC32 of the JSON body. Readers verify
 * the trailer first; a mismatch is a hard failure.
 *
 * <p>Manifest files live under {@code <root>/manifests/} and are
 * named with a zero-padded generation + {@code .json} extension
 * — {@code 000000042.json}. Zero-padding keeps lexicographic
 * directory listing ordered by generation.</p>
 */
public final class ManifestFormat {

    public static final byte[] TRAILER_MAGIC =
            "CRCMNF\0\0".getBytes(StandardCharsets.UTF_8);
    public static final int TRAILER_BYTES =
            TRAILER_MAGIC.length + 4;
    public static final int GENERATION_PAD_WIDTH = 9;
    public static final String MANIFEST_SUFFIX = ".json";
    public static final String MANIFESTS_DIR = "manifests";

    private ManifestFormat() {
    }

    public static String fileName(final long generation) {
        if (generation < 0) {
            throw new IllegalArgumentException(
                    "generation must be non-negative");
        }
        final String padded = String.format(
                "%0" + GENERATION_PAD_WIDTH + "d", generation);
        return padded + MANIFEST_SUFFIX;
    }

    public static Long parseGeneration(final String fileName) {
        if (fileName == null
                || !fileName.endsWith(MANIFEST_SUFFIX)
                || fileName.startsWith(".")) {
            return null;
        }
        final String stem = fileName.substring(
                0, fileName.length() - MANIFEST_SUFFIX.length());
        try {
            return Long.parseLong(stem);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
