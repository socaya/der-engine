package ug.ac.mak.der.analytics.column.stats;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.channels.FileChannel;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * Read + atomically write a {@link SegmentStatistics} sidecar
 * file next to its segment. File naming convention —
 * {@code <segment>.stats.json}.
 */
public final class SegmentStatisticsStore {

    private final ObjectMapper json;

    public SegmentStatisticsStore(final ObjectMapper json) {
        this.json = Objects.requireNonNull(json, "json");
    }

    public void writeAtomically(final SegmentStatistics stats,
                                  final Path segmentFile)
            throws IOException {
        final Path target = sidecar(segmentFile);
        final byte[] bytes = toBytes(stats);
        final Path dir = target.getParent();
        if (dir != null) {
            Files.createDirectories(dir);
        }
        final Path temp = (dir == null ? Path.of(".") : dir)
                .resolve("." + target.getFileName() + ".tmp-"
                        + stats.segmentId());
        try (FileChannel ch = FileChannel.open(temp,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE)) {
            final ByteBuffer out = ByteBuffer.wrap(bytes);
            while (out.hasRemaining()) {
                ch.write(out);
            }
            ch.force(true);
        }
        try {
            Files.move(temp, target,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            Files.deleteIfExists(temp);
            throw ex;
        }
    }

    public Optional<SegmentStatistics> read(final Path segmentFile)
            throws IOException {
        final Path target = sidecar(segmentFile);
        if (!Files.exists(target)) {
            return Optional.empty();
        }
        final byte[] bytes = Files.readAllBytes(target);
        return Optional.of(parseBytes(bytes));
    }

    public static Path sidecar(final Path segmentFile) {
        return segmentFile.resolveSibling(
                segmentFile.getFileName().toString() + ".stats.json");
    }

    private byte[] toBytes(final SegmentStatistics stats) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("segmentId", stats.segmentId().toString());
        out.put("computedAt", stats.computedAt().toString());
        out.put("rowCount", stats.rowCount());
        final Map<String, Object> cols = new LinkedHashMap<>();
        for (final Map.Entry<String, ColumnStatistics> e
                : stats.columns().entrySet()) {
            cols.put(e.getKey(), columnJson(e.getValue()));
        }
        out.put("columns", cols);
        try {
            return json.writerWithDefaultPrettyPrinter()
                    .writeValueAsBytes(out);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException(
                    "stats serialise failed", ex);
        }
    }

    private static Map<String, Object> columnJson(
            final ColumnStatistics c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", c.type().name());
        m.put("rowCount", c.rowCount());
        m.put("nullCount", c.nullCount());
        m.put("distinctEstimate", c.distinctEstimate());
        m.put("distinctSampleExhaustive", c.distinctSampleExhaustive());
        m.put("distinctSample", c.distinctSample());
        m.put("min", c.minValue());
        m.put("max", c.maxValue());
        return m;
    }

    private SegmentStatistics parseBytes(final byte[] bytes)
            throws IOException {
        final JsonNode root = json.readTree(bytes);
        final UUID segmentId = UUID.fromString(
                root.path("segmentId").asText());
        final Instant computedAt = Instant.parse(
                root.path("computedAt").asText());
        final int rowCount = root.path("rowCount").asInt();
        final Map<String, ColumnStatistics> cols = new LinkedHashMap<>();
        final JsonNode colsNode = root.get("columns");
        if (colsNode != null && colsNode.isObject()) {
            colsNode.fields().forEachRemaining(e -> {
                final String name = e.getKey();
                final JsonNode cn = e.getValue();
                final ColumnType type = ColumnType.valueOf(
                        cn.path("type").asText());
                final List<Object> sample = new ArrayList<>();
                final JsonNode sn = cn.get("distinctSample");
                if (sn != null && sn.isArray()) {
                    for (final JsonNode item : sn) {
                        sample.add(decode(item, type));
                    }
                }
                cols.put(name, new ColumnStatistics(name, type,
                        cn.path("rowCount").asInt(),
                        cn.path("nullCount").asInt(),
                        cn.path("distinctEstimate").asInt(),
                        cn.path("distinctSampleExhaustive").asBoolean(true),
                        sample,
                        decode(cn.get("min"), type),
                        decode(cn.get("max"), type)));
            });
        }
        return new SegmentStatistics(segmentId, computedAt, rowCount, cols);
    }

    private static Object decode(final JsonNode v, final ColumnType type) {
        if (v == null || v.isNull()) {
            return null;
        }
        return switch (type) {
            case INT64, DATE -> v.asLong();
            case STRING -> v.asText();
            case BOOL -> v.asBoolean();
            case DECIMAL -> new BigDecimal(v.asText());
        };
    }
}
