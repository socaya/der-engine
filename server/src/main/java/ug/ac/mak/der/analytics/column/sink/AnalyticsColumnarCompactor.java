package ug.ac.mak.der.analytics.column.sink;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestFormat;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.stats.SegmentStatisticsStore;

/** Retains rollback generations and removes unreferenced immutable segments. */
@Service
public class AnalyticsColumnarCompactor {

    private final AnalyticsColumnarProperties properties;
    private final AnalyticsColumnarLifecycleProperties lifecycle;
    private final ObjectMapper json;

    public AnalyticsColumnarCompactor(
            final AnalyticsColumnarProperties properties,
            final AnalyticsColumnarLifecycleProperties lifecycle,
            final ObjectMapper json) {
        this.properties = properties;
        this.lifecycle = lifecycle;
        this.json = json;
    }

    public record CompactionResult(int manifestsDeleted,
                                   int segmentsDeleted,
                                   long bytesReclaimed) { }

    public CompactionResult compact() throws IOException {
        final Path root = properties.rootPathResolved();
        final ManifestReader reader = new ManifestReader(json);
        final ManifestStore store = new ManifestStore(root, reader,
                new ManifestWriter(json));
        final List<Long> generations = store.generations();
        if (generations.size() <= lifecycle.retainGenerations()) {
            return new CompactionResult(0, 0, 0L);
        }
        final Set<String> retainedSegments = new HashSet<>();
        for (final Long generation : generations.subList(
                0, lifecycle.retainGenerations())) {
            final Manifest manifest = reader.parseFile(root
                    .resolve(ManifestFormat.MANIFESTS_DIR)
                    .resolve(ManifestFormat.fileName(generation)));
            manifest.segments().forEach(s -> retainedSegments.add(s.file()));
        }

        int manifestsDeleted = 0;
        int segmentsDeleted = 0;
        long bytes = 0L;
        for (final Long generation : generations.subList(
                lifecycle.retainGenerations(), generations.size())) {
            final Path manifestPath = root
                    .resolve(ManifestFormat.MANIFESTS_DIR)
                    .resolve(ManifestFormat.fileName(generation));
            final Manifest manifest;
            try {
                manifest = reader.parseFile(manifestPath);
            } catch (RuntimeException ex) {
                Files.deleteIfExists(manifestPath);
                manifestsDeleted++;
                continue;
            }
            for (final var segment : manifest.segments()) {
                if (retainedSegments.contains(segment.file())) {
                    continue;
                }
                final Path file = root.resolve(segment.file());
                if (Files.exists(file)) {
                    bytes += Files.size(file);
                    Files.delete(file);
                    segmentsDeleted++;
                }
                final Path stats = SegmentStatisticsStore.sidecar(file);
                if (Files.exists(stats)) {
                    bytes += Files.size(stats);
                    Files.delete(stats);
                }
            }
            Files.deleteIfExists(manifestPath);
            manifestsDeleted++;
        }
        return new CompactionResult(manifestsDeleted, segmentsDeleted, bytes);
    }
}
