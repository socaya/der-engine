package ug.ac.mak.der.analytics.column.sink;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Operational policy for verified columnar generations. */
@ConfigurationProperties(prefix = "der.analytics.columnar.lifecycle")
public record AnalyticsColumnarLifecycleProperties(
        boolean enabled,
        int retainGenerations) {

    public AnalyticsColumnarLifecycleProperties {
        if (retainGenerations < 2) {
            retainGenerations = 2;
        }
    }
}
