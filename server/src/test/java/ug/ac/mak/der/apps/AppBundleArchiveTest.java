package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.Test;

/** Unit coverage for {@link AppBundleArchive}. */
class AppBundleArchiveTest {

    private static byte[] zipOf(final Map<String, byte[]> entries) throws Exception {
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            for (final Map.Entry<String, byte[]> e : entries.entrySet()) {
                zos.putNextEntry(new ZipEntry(e.getKey()));
                zos.write(e.getValue());
                zos.closeEntry();
            }
        }
        return out.toByteArray();
    }

    @Test
    void parseReadsEntries() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("a.txt", "A".getBytes());
        m.put("b.txt", "BB".getBytes());
        final AppBundleArchive out = AppBundleArchive.parse(
                new ByteArrayInputStream(zipOf(m)));
        assertThat(out.entries().keySet()).containsExactly("a.txt", "b.txt");
        assertThat(out.entry("a.txt")).isEqualTo("A".getBytes());
        assertThat(out.entry("missing")).isNull();
    }

    @Test
    void parseSkipsDirectoryEntries() throws Exception {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bytes)) {
            zos.putNextEntry(new ZipEntry("dir/"));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("dir/a.txt"));
            zos.write("A".getBytes());
            zos.closeEntry();
        }
        final AppBundleArchive out = AppBundleArchive.parse(
                new ByteArrayInputStream(bytes.toByteArray()));
        assertThat(out.entries().keySet()).containsExactly("dir/a.txt");
    }

    @Test
    void parseRejectsPathTraversal() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("../evil", "X".getBytes());
        final byte[] zip = zipOf(m);
        assertThatThrownBy(() -> AppBundleArchive.parse(new ByteArrayInputStream(zip)))
                .isInstanceOf(AppBundleArchive.ArchiveException.class)
                .hasMessageContaining("unsafe entry name");
    }

    @Test
    void parseRejectsAbsolutePath() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("/etc/passwd", "X".getBytes());
        final byte[] zip = zipOf(m);
        assertThatThrownBy(() -> AppBundleArchive.parse(new ByteArrayInputStream(zip)))
                .isInstanceOf(AppBundleArchive.ArchiveException.class);
    }

    @Test
    void parseRejectsTooManyEntries() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        for (int i = 0; i < AppBundleArchive.MAX_ENTRIES + 1; i++) {
            m.put("f-" + i, "x".getBytes());
        }
        final byte[] zip = zipOf(m);
        assertThatThrownBy(() -> AppBundleArchive.parse(new ByteArrayInputStream(zip)))
                .isInstanceOf(AppBundleArchive.ArchiveException.class)
                .hasMessageContaining("too many entries");
    }

    @Test
    void parseRejectsEntryOverPerEntryLimit() throws Exception {
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("blob", new byte[AppBundleArchive.MAX_ENTRY_BYTES + 1]);
        final byte[] zip = zipOf(m);
        assertThatThrownBy(() -> AppBundleArchive.parse(new ByteArrayInputStream(zip)))
                .isInstanceOf(AppBundleArchive.ArchiveException.class);
    }

    @Test
    void parseRejectsCumulativeOverArchiveLimit() throws Exception {
        // Each entry under per-entry cap but together over the 10 MB cap.
        final int entrySize = AppBundleArchive.MAX_ENTRY_BYTES;
        final Map<String, byte[]> m = new LinkedHashMap<>();
        m.put("a", new byte[entrySize]);
        m.put("b", new byte[entrySize]);
        m.put("c", new byte[entrySize]);
        final byte[] zip = zipOf(m);
        assertThatThrownBy(() -> AppBundleArchive.parse(new ByteArrayInputStream(zip)))
                .isInstanceOf(AppBundleArchive.ArchiveException.class)
                .hasMessageContaining("archive content exceeds");
    }

    @Test
    void isPathSafeCovers() {
        assertThat(AppBundleArchive.isPathSafe("ok.txt")).isTrue();
        assertThat(AppBundleArchive.isPathSafe("sub/ok.txt")).isTrue();
        assertThat(AppBundleArchive.isPathSafe(null)).isFalse();
        assertThat(AppBundleArchive.isPathSafe("")).isFalse();
        assertThat(AppBundleArchive.isPathSafe("  ")).isFalse();
        assertThat(AppBundleArchive.isPathSafe("/root")).isFalse();
        assertThat(AppBundleArchive.isPathSafe("\\root")).isFalse();
        assertThat(AppBundleArchive.isPathSafe("../up")).isFalse();
        assertThat(AppBundleArchive.isPathSafe("C:/foo")).isFalse();
    }

    @Test
    void iconMimeForCoversExtensions() {
        assertThat(AppBundleArchive.iconMimeFor("x.svg")).isEqualTo("image/svg+xml");
        assertThat(AppBundleArchive.iconMimeFor("x.PNG")).isEqualTo("image/png");
        assertThat(AppBundleArchive.iconMimeFor("x.webp")).isEqualTo("image/webp");
        assertThat(AppBundleArchive.iconMimeFor("x.jpg")).isEqualTo("image/jpeg");
        assertThat(AppBundleArchive.iconMimeFor("x.jpeg")).isEqualTo("image/jpeg");
        assertThat(AppBundleArchive.iconMimeFor("x.bin")).isNull();
        assertThat(AppBundleArchive.iconMimeFor(null)).isNull();
        assertThat(AppBundleArchive.iconMimeFor("no-extension")).isNull();
        assertThat(AppBundleArchive.iconMimeFor("trailing.")).isNull();
    }

    @Test
    void archiveExceptionIsIOException() {
        final AppBundleArchive.ArchiveException ex =
                new AppBundleArchive.ArchiveException("boom");
        assertThat(ex).isInstanceOf(java.io.IOException.class);
        assertThat(ex.getMessage()).isEqualTo("boom");
    }
}
