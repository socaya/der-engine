package ug.ac.mak.der;

import java.time.Clock;
import java.time.ZoneOffset;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Supply a UTC {@link Clock} bean so every timestamp emitted by the service is
 * generated from a single, test-overridable source. Phase 00 uses the system UTC
 * clock; Phase 06 may introduce a monotonic clock for backlog metrics.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock systemUtcClock() {
        return Clock.system(ZoneOffset.UTC);
    }
}
