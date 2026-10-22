package ug.ac.mak.der.dhis2;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

import ug.ac.mak.der.dhis2.compatibility.CapabilitySnapshotRepository;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CapabilityProbe;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2ProfileRegistry;

/**
 * Spring glue for the DHIS2 adapter + ADR-0006 compatibility engine.
 *
 * <p>Phase 01 wired a fail-closed {@link Dhis2CompatibilityGuard}; ADR-0006
 * replaces admission with the probe-driven {@link Dhis2CompatibilityEngine}.
 * The guard bean is retained for one release as a deprecated delegate so
 * existing diagnostics continue to answer.</p>
 */
@Configuration
@EnableConfigurationProperties(Dhis2Properties.class)
public class Dhis2Config {

    @Bean
    public HttpClient dhis2HttpClient(final Dhis2Properties properties) {
        final int timeoutMs = Math.max(1_000, properties.central().connectTimeoutMillis());
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Bean
    public Dhis2ReferenceClient dhis2ReferenceClient(final HttpClient http,
                                                     final ObjectMapper mapper,
                                                     final Dhis2Properties properties) {
        return new Dhis2ReferenceClient(http, mapper, properties.central());
    }

    @Bean
    public Dhis2CompatibilityGuard dhis2CompatibilityGuard(final Dhis2ReferenceClient client,
                                                           final Dhis2Properties properties) {
        return new Dhis2CompatibilityGuard(client, properties);
    }

    @Bean
    public Dhis2CapabilityProbe dhis2CapabilityProbe(final HttpClient http,
                                                     final Dhis2Properties properties) {
        return new Dhis2CapabilityProbe(http, properties.central());
    }

    @Bean
    public Dhis2ProfileRegistry dhis2ProfileRegistry() {
        return Dhis2ProfileRegistry.defaultRegistry();
    }

    @Bean
    public Dhis2CompatibilityEngine dhis2CompatibilityEngine(
            final Dhis2ReferenceClient referenceClient,
            final Dhis2CapabilityProbe probe,
            final Dhis2ProfileRegistry registry,
            @Lazy final CapabilitySnapshotRepository snapshots,
            final Dhis2Properties properties,
            final Clock clock) {
        return new Dhis2CompatibilityEngine(referenceClient, probe, registry,
                snapshots, properties, clock);
    }
}
