package ug.ac.mak.der.analytics.column.governor;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;

/**
 * Reference to a byte-oriented spill file on disk. Opened via
 * {@link SpillStore#allocate}, backed by one file under
 * {@code <spill-root>/<queryId>/<auto-id>.bin}. Thread-unsafe —
 * one operator owns one handle at a time.
 */
public final class SpillHandle {

    private final UUID queryId;
    private final UUID spillId;
    private final Path file;
    private boolean released;

    SpillHandle(final UUID queryId, final UUID spillId,
                  final Path file) {
        this.queryId = Objects.requireNonNull(queryId, "queryId");
        this.spillId = Objects.requireNonNull(spillId, "spillId");
        this.file = Objects.requireNonNull(file, "file");
    }

    public UUID queryId() {
        return queryId;
    }

    public UUID spillId() {
        return spillId;
    }

    public Path file() {
        return file;
    }

    public long sizeBytes() throws IOException {
        if (!Files.exists(file)) {
            return 0L;
        }
        return Files.size(file);
    }

    /** Write the full blob. Overwrites any prior content. */
    public void write(final byte[] bytes) throws IOException {
        if (released) {
            throw new IllegalStateException(
                    "spill handle " + spillId + " already released");
        }
        Objects.requireNonNull(bytes, "bytes");
        Files.write(file, bytes);
    }

    /** Append bytes. Used by multi-page spills. */
    public void append(final byte[] bytes) throws IOException {
        if (released) {
            throw new IllegalStateException(
                    "spill handle " + spillId + " already released");
        }
        Objects.requireNonNull(bytes, "bytes");
        Files.write(file, bytes, java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND);
    }

    public byte[] read() throws IOException {
        if (released) {
            throw new IllegalStateException(
                    "spill handle " + spillId + " already released");
        }
        if (!Files.exists(file)) {
            return new byte[0];
        }
        return Files.readAllBytes(file);
    }

    /** Mark released. The store removes the file on the next
     *  {@link SpillStore#cleanup(java.util.UUID)} call or when the
     *  query token completes. */
    void release() {
        released = true;
    }

    public boolean released() {
        return released;
    }
}
