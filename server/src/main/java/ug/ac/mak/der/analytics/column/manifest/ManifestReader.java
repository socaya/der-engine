package ug.ac.mak.der.analytics.column.manifest;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.zip.CRC32;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Parse a manifest file written by {@link ManifestWriter}.
 * Verifies trailer magic + CRC32 before returning; any corruption
 * surfaces as {@link IllegalStateException}.
 */
public final class ManifestReader {

    private final ObjectMapper json;

    public ManifestReader(final ObjectMapper json) {
        this.json = Objects.requireNonNull(json, "json");
    }

    public Manifest parseBytes(final byte[] bytes) {
        Objects.requireNonNull(bytes, "bytes");
        if (bytes.length < ManifestFormat.TRAILER_BYTES) {
            throw new IllegalStateException(
                    "manifest too short to carry a trailer");
        }
        final int trailerStart = bytes.length
                - ManifestFormat.TRAILER_BYTES;
        for (int i = 0; i < ManifestFormat.TRAILER_MAGIC.length; i++) {
            if (bytes[trailerStart + i]
                    != ManifestFormat.TRAILER_MAGIC[i]) {
                throw new IllegalStateException(
                        "manifest trailer magic mismatch — file "
                      + "truncated or corrupted");
            }
        }
        final int expected = ByteBuffer.wrap(bytes,
                trailerStart + ManifestFormat.TRAILER_MAGIC.length, 4)
                .getInt();
        final CRC32 crc = new CRC32();
        crc.update(bytes, 0, trailerStart);
        final int actual = (int) crc.getValue();
        if (expected != actual) {
            throw new IllegalStateException(
                    "manifest CRC32 mismatch — expected "
                  + Integer.toHexString(expected)
                  + ", actual " + Integer.toHexString(actual));
        }
        final byte[] bodyBytes = Arrays.copyOfRange(bytes, 0, trailerStart);
        return parseBody(bodyBytes);
    }

    public Manifest parseFile(final Path file) throws IOException {
        return parseBytes(Files.readAllBytes(file));
    }

    private Manifest parseBody(final byte[] body) {
        try {
            final JsonNode root = json.readTree(body);
            final long generation = root.path("generation").asLong();
            final Instant createdAt = Instant.parse(
                    root.path("createdAt").asText());
            final String metadataRevision = root.has("metadataRevision")
                    ? root.get("metadataRevision").asText() : null;
            final String engineVersion = root.path("engineVersion")
                    .asText();
            final Map<String, Long> checkpoint = new TreeMap<>();
            final JsonNode cpNode = root.get("sourceCheckpoint");
            if (cpNode != null && cpNode.isObject()) {
                cpNode.fields().forEachRemaining(e ->
                        checkpoint.put(e.getKey(),
                                e.getValue().asLong()));
            }
            final List<SegmentRef> segments = new ArrayList<>();
            final JsonNode segNode = root.get("segments");
            if (segNode != null && segNode.isArray()) {
                for (final JsonNode s : segNode) {
                    segments.add(new SegmentRef(
                            UUID.fromString(s.path("segmentId").asText()),
                            s.path("file").asText(),
                            UUID.fromString(s.path("metricId").asText()),
                            s.path("definitionVersion").asInt(),
                            s.path("periodKey").asText(),
                            s.path("orgUnitUid").asText(),
                            s.path("dimensionKey").asText(""),
                            s.path("rowCount").asInt()));
                }
            }
            return new Manifest(generation, createdAt,
                    metadataRevision, checkpoint, engineVersion,
                    segments);
        } catch (RuntimeException | IOException ex) {
            throw new IllegalStateException(
                    "manifest body parse failed", ex);
        }
    }
}
