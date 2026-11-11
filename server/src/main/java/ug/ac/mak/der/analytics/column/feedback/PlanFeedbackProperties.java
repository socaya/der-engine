package ug.ac.mak.der.analytics.column.feedback;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Capacity of the {@link PlanFeedbackStore} ring buffer. */
@ConfigurationProperties(prefix = "der.analytics.feedback")
public record PlanFeedbackProperties(int capacity) {

    public PlanFeedbackProperties {
        if (capacity <= 0) {
            capacity = 512;
        }
    }
}
