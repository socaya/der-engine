package ug.ac.mak.der.analytics.column.governor;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the spill-to-disk store (SRS FR-QRY-013). Spill
 * is opt-in per query — operators ask the governor to allocate
 * a {@link SpillHandle} when they would otherwise exceed the
 * memory budget, write the intermediate blob to the handle, and
 * free the heap allocation.
 */
@ConfigurationProperties(prefix = "der.analytics.governor.spill")
public record SpillProperties(
        String rootPath,
        long perQueryByteLimit,
        long globalByteLimit) {

    public SpillProperties {
        if (rootPath == null || rootPath.isBlank()) {
            rootPath = "analytics-store/spill";
        }
        if (perQueryByteLimit <= 0L) {
            perQueryByteLimit = 1L * 1024L * 1024L * 1024L;
        }
        if (globalByteLimit <= 0L) {
            globalByteLimit = 10L * 1024L * 1024L * 1024L;
        }
    }

    public Path rootPathResolved() {
        return Paths.get(rootPath);
    }
}
