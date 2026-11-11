package ug.ac.mak.der.analytics.column.sink;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the columnar sink. The sink is optional — set
 * {@code der.analytics.columnar.enabled=true} in the pilot to
 * enable it. Default off so Gate 1 deployments keep working
 * unchanged.
 */
@ConfigurationProperties(prefix = "der.analytics.columnar")
public record AnalyticsColumnarProperties(
        boolean enabled,
        String rootPath,
        int rowsPerSegmentCap) {

    public AnalyticsColumnarProperties {
        if (rootPath == null || rootPath.isBlank()) {
            rootPath = "analytics-store";
        }
        if (rowsPerSegmentCap <= 0) {
            rowsPerSegmentCap = 100_000;
        }
    }

    public Path rootPathResolved() {
        return Paths.get(rootPath);
    }
}
