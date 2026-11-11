package ug.ac.mak.der.analytics.column.manifest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ManifestStoreTest {

    private final ObjectMapper json = new ObjectMapper();
    private ManifestWriter writer;
    private ManifestReader reader;

    @TempDir Path tmp;

    @BeforeEach
    void setUp() {
        writer = new ManifestWriter(json);
        reader = new ManifestReader(json);
    }

    private Manifest manifest(final long generation) {
        return new Manifest(generation, Instant.now(),
                "metadata-rev-" + generation,
                Map.of("EVENT", 1000L + generation,
                        "ENROLLMENT", 500L + generation),
                "der-analytics-0.1",
                List.of(new SegmentRef(UUID.randomUUID(),
                        "facts/event/site-a/202611/segment-x.col",
                        UUID.randomUUID(), 1, "202611", "OU-A", "",
                        123)));
    }

    @Test
    void roundTripPreservesEveryField() {
        final Manifest original = manifest(42);
        final byte[] bytes = writer.toBytes(original);
        final Manifest parsed = reader.parseBytes(bytes);

        assertThat(parsed.generation()).isEqualTo(42);
        assertThat(parsed.metadataRevision())
                .isEqualTo(original.metadataRevision());
        assertThat(parsed.sourceCheckpoint())
                .containsEntry("EVENT", 1042L);
        assertThat(parsed.engineVersion()).isEqualTo("der-analytics-0.1");
        assertThat(parsed.segments()).hasSize(1);
        assertThat(parsed.segments().get(0).periodKey())
                .isEqualTo("202611");
    }

    @Test
    void writeAtomicallyLandsExactFileThenNoTemp() throws IOException {
        writer.writeAtomically(manifest(7), tmp);

        final Path manifestFile = tmp.resolve("manifests/000000007.json");
        assertThat(Files.exists(manifestFile)).isTrue();

        final long tempLeftovers = Files.list(
                        tmp.resolve("manifests"))
                .filter(p -> p.getFileName().toString().startsWith("."))
                .count();
        assertThat(tempLeftovers).isZero();
    }

    @Test
    void storePicksHighestGeneration() throws IOException {
        final ManifestStore store = new ManifestStore(tmp, reader, writer);
        store.publish(manifest(1));
        store.publish(manifest(5));
        store.publish(manifest(3));

        final Manifest current = store.currentGeneration()
                .orElseThrow();
        assertThat(current.generation()).isEqualTo(5);
        assertThat(store.generations()).containsExactly(5L, 3L, 1L);
    }

    @Test
    void corruptHighestFallsBackToPrevious() throws IOException {
        final ManifestStore store = new ManifestStore(tmp, reader, writer);
        store.publish(manifest(1));
        store.publish(manifest(2));

        // Corrupt generation 2
        final Path g2 = tmp.resolve("manifests/000000002.json");
        final byte[] bytes = Files.readAllBytes(g2);
        bytes[bytes.length - 1] ^= 0x01; // flip crc byte
        Files.write(g2, bytes);

        final Manifest current = store.currentGeneration().orElseThrow();
        assertThat(current.generation()).isEqualTo(1);
    }

    @Test
    void emptyDirectoryReturnsEmpty() throws IOException {
        final ManifestStore store = new ManifestStore(tmp, reader, writer);
        assertThat(store.currentGeneration()).isEmpty();
        assertThat(store.generations()).isEmpty();
    }

    @Test
    void trailerMagicMismatchIsRejected() {
        final byte[] bytes = writer.toBytes(manifest(1));
        bytes[bytes.length - ManifestFormat.TRAILER_BYTES] = 'Z';

        assertThatThrownBy(() -> reader.parseBytes(bytes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("trailer");
    }

    @Test
    void crcMismatchIsRejected() {
        final byte[] bytes = writer.toBytes(manifest(1));
        bytes[bytes.length - 1] ^= 0x01;

        assertThatThrownBy(() -> reader.parseBytes(bytes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CRC32");
    }

    @Test
    void fileNamingUsesZeroPadding() {
        assertThat(ManifestFormat.fileName(0)).isEqualTo("000000000.json");
        assertThat(ManifestFormat.fileName(7)).isEqualTo("000000007.json");
        assertThat(ManifestFormat.fileName(1_234_567L))
                .isEqualTo("001234567.json");
    }

    @Test
    void parseGenerationIgnoresNoise() {
        assertThat(ManifestFormat.parseGeneration("000000007.json"))
                .isEqualTo(7L);
        assertThat(ManifestFormat.parseGeneration(".tempfile.json"))
                .isNull();
        assertThat(ManifestFormat.parseGeneration("not-a-number.json"))
                .isNull();
        assertThat(ManifestFormat.parseGeneration("1.txt"))
                .isNull();
    }
}
