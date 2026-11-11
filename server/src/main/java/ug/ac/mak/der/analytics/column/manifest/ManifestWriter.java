package ug.ac.mak.der.analytics.column.manifest;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.zip.CRC32;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Serialise a {@link Manifest} to bytes and write it atomically
 * into {@code <root>/manifests/<generation>.json} (SRS FR-STO-006
 * atomic publication/rollback).
 */
public final class ManifestWriter {

    private final ObjectMapper json;

    public ManifestWriter(final ObjectMapper json) {
        this.json = Objects.requireNonNull(json, "json");
    }

    public byte[] toBytes(final Manifest manifest) {
        Objects.requireNonNull(manifest, "manifest");
        final byte[] body = bodyBytes(manifest);
        final CRC32 crc = new CRC32();
        crc.update(body);
        final int checksum = (int) crc.getValue();
        final ByteBuffer buf = ByteBuffer.allocate(
                body.length + ManifestFormat.TRAILER_BYTES);
        buf.put(body);
        buf.put(ManifestFormat.TRAILER_MAGIC);
        buf.putInt(checksum);
        return buf.array();
    }

    /** Write the manifest for {@code manifest.generation()} under
     *  {@code root/manifests/}. Same-directory temp + fsync +
     *  atomic rename so readers never see a half-written file. */
    public void writeAtomically(final Manifest manifest,
                                  final Path root) throws IOException {
        Objects.requireNonNull(root, "root");
        final Path dir = root.resolve(ManifestFormat.MANIFESTS_DIR);
        Files.createDirectories(dir);
        final Path target = dir.resolve(
                ManifestFormat.fileName(manifest.generation()));
        final byte[] bytes = toBytes(manifest);
        final Path temp = dir.resolve(
                "." + target.getFileName().toString()
              + ".tmp-" + System.nanoTime());
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

    private byte[] bodyBytes(final Manifest m) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("generation", m.generation());
        out.put("createdAt", m.createdAt().toString());
        if (m.metadataRevision() != null) {
            out.put("metadataRevision", m.metadataRevision());
        }
        if (!m.sourceCheckpoint().isEmpty()) {
            // Sorted so byte output is deterministic for CRC stability.
            out.put("sourceCheckpoint", new TreeMap<>(m.sourceCheckpoint()));
        }
        out.put("engineVersion", m.engineVersion());
        final List<Map<String, Object>> segs =
                new ArrayList<>(m.segments().size());
        for (final SegmentRef r : m.segments()) {
            final Map<String, Object> s = new LinkedHashMap<>();
            s.put("segmentId", r.segmentId().toString());
            s.put("file", r.file());
            s.put("metricId", r.metricId().toString());
            s.put("definitionVersion", r.definitionVersion());
            s.put("periodKey", r.periodKey());
            s.put("orgUnitUid", r.orgUnitUid());
            s.put("dimensionKey", r.dimensionKey());
            s.put("rowCount", r.rowCount());
            segs.add(s);
        }
        out.put("segments", segs);
        try {
            return json.writerWithDefaultPrettyPrinter()
                    .writeValueAsBytes(out);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(
                    "manifest serialisation failed", ex);
        }
    }

    /** Minimal access to the body bytes; used by the reader to
     *  validate the CRC32 against the trailer. Returns a UTF-8
     *  string so the reader can hand it straight to Jackson. */
    static String bodyFromFileBytes(final byte[] fileBytes) {
        final int trailerStart = fileBytes.length
                - ManifestFormat.TRAILER_BYTES;
        return new String(fileBytes, 0, trailerStart,
                StandardCharsets.UTF_8);
    }
}
