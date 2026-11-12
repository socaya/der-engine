package ug.ac.mak.der.analytics.column.sink;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;

class AnalyticsColumnarCompactorTest {

    @TempDir Path root;

    @Test
    void retainsRollbackWindowAndDeletesUnreferencedSegments()
            throws Exception {
        final ObjectMapper json = new ObjectMapper();
        final ManifestWriter writer = new ManifestWriter(json);
        for (int generation = 1; generation <= 3; generation++) {
            final String relative = "facts/test/segment-" + generation + ".col";
            final Path segment = root.resolve(relative);
            Files.createDirectories(segment.getParent());
            Files.writeString(segment, "generation-" + generation);
            final SegmentRef ref = new SegmentRef(UUID.randomUUID(), relative,
                    UUID.randomUUID(), 1, "202611", "*", "", 1);
            writer.writeAtomically(new Manifest(generation, Instant.now(),
                    "meta-" + generation, Map.of(), "test", List.of(ref)),
                    root);
        }

        final var compactor = new AnalyticsColumnarCompactor(
                new AnalyticsColumnarProperties(true, root.toString(), 100),
                new AnalyticsColumnarLifecycleProperties(true, 2), json);
        final var result = compactor.compact();

        assertThat(result.manifestsDeleted()).isEqualTo(1);
        assertThat(result.segmentsDeleted()).isEqualTo(1);
        assertThat(Files.exists(root.resolve("facts/test/segment-1.col")))
                .isFalse();
        assertThat(Files.exists(root.resolve("facts/test/segment-2.col")))
                .isTrue();
        assertThat(Files.exists(root.resolve("facts/test/segment-3.col")))
                .isTrue();
    }
}
