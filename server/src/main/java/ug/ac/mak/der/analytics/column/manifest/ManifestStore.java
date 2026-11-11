package ug.ac.mak.der.analytics.column.manifest;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Operate on a {@code <root>/manifests/} directory. Readers call
 * {@link #currentGeneration} to find the highest valid manifest
 * (SRS FR-STO-006 "atomic publication/rollback"). Publishers call
 * {@link #publish} to commit a new generation.
 *
 * <p>If the highest-numbered file fails validation (corrupt
 * trailer or CRC), the store logs + falls back to the next-highest
 * that validates. This is the "rollback" half of the contract:
 * a partially-visible new generation never gets mistaken for
 * current state.</p>
 */
public final class ManifestStore {

    private static final Logger LOG =
            LoggerFactory.getLogger(ManifestStore.class);

    private final Path root;
    private final ManifestReader reader;
    private final ManifestWriter writer;

    public ManifestStore(final Path root,
                            final ManifestReader reader,
                            final ManifestWriter writer) {
        this.root = Objects.requireNonNull(root, "root");
        this.reader = Objects.requireNonNull(reader, "reader");
        this.writer = Objects.requireNonNull(writer, "writer");
    }

    /** Publish a new generation. Caller is responsible for
     *  ensuring generation is strictly greater than the current
     *  highest; the store does not auto-increment because the
     *  caller likely needs the id before the segments are written. */
    public void publish(final Manifest manifest) throws IOException {
        writer.writeAtomically(manifest, root);
    }

    /** Return the highest-generation manifest that validates. */
    public Optional<Manifest> currentGeneration() throws IOException {
        final Path dir = root.resolve(ManifestFormat.MANIFESTS_DIR);
        if (!Files.isDirectory(dir)) {
            return Optional.empty();
        }
        final List<Long> generations = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir,
                p -> {
                    final String name = p.getFileName().toString();
                    return ManifestFormat.parseGeneration(name) != null;
                })) {
            for (final Path p : stream) {
                final Long g = ManifestFormat.parseGeneration(
                        p.getFileName().toString());
                if (g != null) {
                    generations.add(g);
                }
            }
        }
        if (generations.isEmpty()) {
            return Optional.empty();
        }
        Collections.sort(generations, Collections.reverseOrder());
        for (final Long g : generations) {
            final Path file = dir.resolve(ManifestFormat.fileName(g));
            try {
                return Optional.of(reader.parseFile(file));
            } catch (RuntimeException ex) {
                LOG.warn("manifest {} failed validation, trying "
                        + "previous generation: {}",
                        file, ex.getMessage());
            }
        }
        return Optional.empty();
    }

    /** List every generation present on disk, highest-first. For
     *  the admin "manifest history" surface. */
    public List<Long> generations() throws IOException {
        final Path dir = root.resolve(ManifestFormat.MANIFESTS_DIR);
        final List<Long> out = new ArrayList<>();
        if (!Files.isDirectory(dir)) {
            return out;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (final Path p : stream) {
                final Long g = ManifestFormat.parseGeneration(
                        p.getFileName().toString());
                if (g != null) {
                    out.add(g);
                }
            }
        }
        Collections.sort(out, Collections.reverseOrder());
        return out;
    }
}
