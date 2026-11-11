package ug.ac.mak.der.analytics.column.governor;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SRS FR-QRY-013 spill-to-disk store. Operators whose intermediate
 * state would exceed the governor's per-query memory budget
 * allocate a {@link SpillHandle} from this store, serialise the
 * blob onto it, and free the heap allocation. The store enforces
 * both per-query and global byte ceilings — crossing either is a
 * hard failure so a query can't pad into unbounded disk usage.
 *
 * <p>Lifecycle: allocate → write → read → release.
 * {@link #cleanup(UUID)} removes all files for a query on commit
 * (whether success or failure). The query governor is the
 * canonical caller.</p>
 */
@Service
public class SpillStore {

    private static final Logger LOG =
            LoggerFactory.getLogger(SpillStore.class);

    private final SpillProperties properties;
    private final ConcurrentHashMap<UUID, List<SpillHandle>> byQuery
            = new ConcurrentHashMap<>();
    private final AtomicLong globalBytes = new AtomicLong();

    public SpillStore(final SpillProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    /** Allocate a fresh handle for {@code queryId}. The returned
     *  handle references a file under
     *  {@code <root>/<queryId>/<spillId>.bin} that doesn't exist
     *  yet — a subsequent {@link SpillHandle#write} creates it. */
    public SpillHandle allocate(final UUID queryId) throws IOException {
        Objects.requireNonNull(queryId, "queryId");
        final Path dir = properties.rootPathResolved()
                .resolve(queryId.toString());
        Files.createDirectories(dir);
        final UUID spillId = UUID.randomUUID();
        final Path file = dir.resolve(spillId + ".bin");
        final SpillHandle handle = new SpillHandle(queryId, spillId, file);
        byQuery.computeIfAbsent(queryId, k -> new ArrayList<>())
                .add(handle);
        return handle;
    }

    /** Called by the operator after writing to the handle so the
     *  store can enforce the per-query and global ceilings. A
     *  violation rolls back the write and surfaces to the caller
     *  (which will typically propagate as a QueryAbortedException). */
    public void acknowledgeWrite(final SpillHandle handle,
                                    final long bytes)
            throws IOException {
        Objects.requireNonNull(handle, "handle");
        if (bytes < 0L) {
            throw new IllegalArgumentException(
                    "bytes must be non-negative");
        }
        final long perQueryUsage = currentBytes(handle.queryId())
                + bytes;
        if (perQueryUsage > properties.perQueryByteLimit()) {
            Files.deleteIfExists(handle.file());
            throw new IOException("spill exceeds per-query limit "
                    + properties.perQueryByteLimit() + " bytes "
                    + "(would reach " + perQueryUsage + ")");
        }
        final long globalUsage = globalBytes.get() + bytes;
        if (globalUsage > properties.globalByteLimit()) {
            Files.deleteIfExists(handle.file());
            throw new IOException("spill exceeds global limit "
                    + properties.globalByteLimit() + " bytes "
                    + "(would reach " + globalUsage + ")");
        }
        globalBytes.addAndGet(bytes);
    }

    /** Remove every spilled file for {@code queryId}. Called by the
     *  governor on query commit (success or failure). Idempotent. */
    public void cleanup(final UUID queryId) {
        Objects.requireNonNull(queryId, "queryId");
        final List<SpillHandle> handles = byQuery.remove(queryId);
        if (handles == null) {
            return;
        }
        for (final SpillHandle handle : handles) {
            try {
                if (Files.exists(handle.file())) {
                    final long size = Files.size(handle.file());
                    Files.deleteIfExists(handle.file());
                    globalBytes.addAndGet(-size);
                }
                handle.release();
            } catch (IOException ex) {
                LOG.warn("spill cleanup failed for {}: {}",
                        handle.file(), ex.getMessage());
            }
        }
        final Path dir = properties.rootPathResolved()
                .resolve(queryId.toString());
        try {
            if (Files.exists(dir)) {
                Files.deleteIfExists(dir);
            }
        } catch (IOException ex) {
            // Leftover files — operator cleans up offline.
            LOG.warn("spill directory remove failed for {}: {}",
                    dir, ex.getMessage());
        }
    }

    public long currentBytes(final UUID queryId) {
        final List<SpillHandle> handles = byQuery.get(queryId);
        if (handles == null) {
            return 0L;
        }
        long sum = 0L;
        for (final SpillHandle handle : handles) {
            try {
                sum += handle.sizeBytes();
            } catch (IOException ex) {
                // Missing file — treat as zero bytes.
            }
        }
        return sum;
    }

    public long globalBytes() {
        return globalBytes.get();
    }

    public long perQueryByteLimit() {
        return properties.perQueryByteLimit();
    }

    public long globalByteLimit() {
        return properties.globalByteLimit();
    }

    /** Snapshot of per-query usage sorted by size desc. Used by the
     *  admin endpoint. */
    public List<Map.Entry<UUID, Long>> listUsage() {
        final List<Map.Entry<UUID, Long>> out = new ArrayList<>();
        for (final UUID queryId : byQuery.keySet()) {
            out.add(Map.entry(queryId, currentBytes(queryId)));
        }
        out.sort(Comparator.<Map.Entry<UUID, Long>>comparingLong(
                Map.Entry::getValue).reversed());
        return out;
    }
}
