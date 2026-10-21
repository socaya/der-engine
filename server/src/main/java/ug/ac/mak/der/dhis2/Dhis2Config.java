package ug.ac.mak.der.dhis2;

import java.net.http.HttpClient;
import java.time.Duration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring glue for the Phase 01 DHIS2 adapter.
 *
 * <p>Beans:</p>
 * <ul>
 *   <li>{@link HttpClient} — JDK 11+ client, shared across the service. Default
 *       connect timeout matches {@code der.dhis2.central.connect-timeout-millis}.</li>
 *   <li>{@link Dhis2ReferenceClient} — the Phase 01 {@code /api/system/info} probe.</li>
 *   <li>{@link Dhis2CompatibilityGuard} — the fail-closed version admission check.</li>
 * </ul>
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
}
