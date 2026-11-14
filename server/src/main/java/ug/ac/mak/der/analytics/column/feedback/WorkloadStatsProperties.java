package ug.ac.mak.der.analytics.column.feedback;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Shape-cardinality cap for {@link WorkloadStatsStore}. */
@ConfigurationProperties(prefix = "der.analytics.workload")
public record WorkloadStatsProperties(int shapeCapacity) {

    public WorkloadStatsProperties {
        if (shapeCapacity <= 0) {
            shapeCapacity = 1024;
        }
    }
}
