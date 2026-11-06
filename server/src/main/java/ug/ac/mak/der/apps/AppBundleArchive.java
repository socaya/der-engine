package ug.ac.mak.der.apps;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Parse + validate the DHIS2-style zip bundle used by the install surface.
 *
 * <p>Structure:</p>
 * <pre>
 *   manifest.webapp   — JSON manifest, required
 *   bundle.js         — ESM entry, required (the signed artifact)
 *   icon.svg|png|…    — optional, resolved via manifest.icons
 * </pre>
 *
 * <p>The parser is intentionally strict because the install surface is
 * admin-only and a bad archive should fail loudly:</p>
 * <ul>
 *   <li>Cumulative entry byte limit (10 MB) + per-entry limit (5 MB)
 *       defend against zip-bomb-style archives.</li>
 *   <li>Entry count cap (20) keeps iteration bounded.</li>
 *   <li>Path safety: no {@code ..}, no absolute paths, no leading slash.</li>
 * </ul>
 *
 * <p>Successful parse returns the entry bytes keyed on the raw entry
 * name; the controller then pulls out {@code manifest.webapp},
 * {@code bundle.js} and (optionally) the icon.</p>
 */
public final class AppBundleArchive {

    /** Hard cap on the compressed upload. */
    public static final int MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;

    /** Per-entry decompressed cap — same as the single-file bundle cap. */
    public static final int MAX_ENTRY_BYTES = 5 * 1024 * 1024;

    /** Entry count cap. */
    public static final int MAX_ENTRIES = 20;

    /** Icon byte cap, measured on the decompressed entry. */
    public static final int MAX_ICON_BYTES = 256 * 1024;

    private final Map<String, byte[]> entries;

    private AppBundleArchive(final Map<String, byte[]> entries) {
        this.entries = Collections.unmodifiableMap(entries);
    }

    /** Raw entry map — keyed on the zip entry name verbatim. */
    public Map<String, byte[]> entries() {
        return entries;
    }

    /** Null if the entry is absent — callers decide the error message. */
    public byte[] entry(final String name) {
        return entries.get(name);
    }

    /**
     * Read a zip from {@code in}, enforcing the full set of limits.
     *
     * @throws ArchiveException on any validation failure.
     * @throws IOException on IO errors from the underlying stream.
     */
    public static AppBundleArchive parse(final InputStream in) throws IOException {
        Objects.requireNonNull(in, "in");
        final Map<String, byte[]> out = new LinkedHashMap<>();
        long cumulative = 0L;
        try (ZipInputStream zis = new ZipInputStream(in)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    // Directories carry no bytes we care about — skip.
                    continue;
                }
                if (out.size() >= MAX_ENTRIES) {
                    throw new ArchiveException("zip has too many entries (max "
                            + MAX_ENTRIES + ")");
                }
                final String name = entry.getName();
                if (!isPathSafe(name)) {
                    throw new ArchiveException("unsafe entry name: " + name);
                }
                final byte[] bytes = readLimited(zis, MAX_ENTRY_BYTES, name);
                cumulative += bytes.length;
                if (cumulative > MAX_ARCHIVE_BYTES) {
                    throw new ArchiveException("archive content exceeds "
                            + MAX_ARCHIVE_BYTES + " bytes");
                }
                out.put(name, bytes);
            }
        }
        return new AppBundleArchive(out);
    }

    /**
     * {@code true} if {@code name} is safe to use as a zip entry name:
     * non-null, non-blank, no {@code ..} segment, no leading slash, no
     * Windows-style drive prefix.
     */
    public static boolean isPathSafe(final String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        if (name.startsWith("/") || name.startsWith("\\")) {
            return false;
        }
        if (name.contains("..")) {
            return false;
        }
        // "C:\foo" — reject outright; same for a raw colon.
        if (name.length() > 1 && name.charAt(1) == ':') {
            return false;
        }
        return true;
    }

    /**
     * Resolve the MIME type for an icon from its filename extension.
     * Returns {@code null} if the extension is not in the supported set
     * (SVG, PNG, WEBP, JPEG).
     */
    public static String iconMimeFor(final String filename) {
        if (filename == null) {
            return null;
        }
        final String lower = filename.toLowerCase(Locale.ROOT);
        final int dot = lower.lastIndexOf('.');
        if (dot < 0 || dot == lower.length() - 1) {
            return null;
        }
        final String ext = lower.substring(dot + 1);
        return switch (ext) {
            case "svg" -> "image/svg+xml";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "jpg", "jpeg" -> "image/jpeg";
            default -> null;
        };
    }

    /** Read at most {@code limit} bytes from {@code in} into a fresh array. */
    private static byte[] readLimited(final InputStream in, final int limit,
                                       final String entryName) throws IOException {
        final ByteArrayOutputStream buf = new ByteArrayOutputStream();
        final byte[] chunk = new byte[8 * 1024];
        int total = 0;
        int n;
        while ((n = in.read(chunk)) > 0) {
            total += n;
            if (total > limit) {
                throw new ArchiveException("entry " + entryName
                        + " exceeds " + limit + " bytes");
            }
            buf.write(chunk, 0, n);
        }
        return buf.toByteArray();
    }

    /** Thrown on any zip structural / size / path violation. */
    public static final class ArchiveException extends IOException {
        private static final long serialVersionUID = 1L;

        public ArchiveException(final String message) {
            super(message);
        }
    }
}
