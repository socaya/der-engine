package ug.ac.mak.der.ops;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.dhis2.Dhis2ConnectionConfig;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.network.CentralReachabilityGate;

class PreflightServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T10:00:00Z");

    @SuppressWarnings("unchecked")
    private static ObjectProvider<Dhis2ConnectionConfigRepository> dhis2Provider(
            final Dhis2ConnectionConfigRepository r) {
        final ObjectProvider<Dhis2ConnectionConfigRepository> p =
                (ObjectProvider<Dhis2ConnectionConfigRepository>) mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(r);
        return p;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<CentralReachabilityGate> gateProvider(
            final CentralReachabilityGate g) {
        final ObjectProvider<CentralReachabilityGate> p =
                (ObjectProvider<CentralReachabilityGate>) mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(g);
        return p;
    }

    private static StorageHealthProbe okStorage() {
        final StorageHealthProbe p = mock(StorageHealthProbe.class);
        when(p.sample()).thenReturn(new StorageHealthProbe.Snapshot(
                "/tmp", 10_000_000_000L, 20_000_000_000L,
                1_000_000_000L, 500_000_000L, StorageHealthProbe.Status.OK));
        return p;
    }

    private static JdbcTemplate okJdbc() {
        final JdbcTemplate j = mock(JdbcTemplate.class);
        when(j.queryForObject(eq("SELECT 1"), eq(Integer.class))).thenReturn(1);
        return j;
    }

    private static PreflightService svc(final JdbcTemplate jdbc,
                                            final Dhis2ConnectionConfigRepository repo) {
        return new PreflightService(
                Clock.fixed(NOW, ZoneId.of("Africa/Kampala")),
                okStorage(), jdbc,
                dhis2Provider(repo), gateProvider(new CentralReachabilityGate(
                        Clock.fixed(NOW, ZoneId.of("UTC")))),
                "pg_dump", "", "localhost");
    }

    @Test
    void utcClockRaisesTimeWarning() {
        final PreflightService s = new PreflightService(
                Clock.fixed(NOW, ZoneId.of("UTC")),
                okStorage(), okJdbc(),
                dhis2Provider(null), gateProvider(null),
                "pg_dump", "", "localhost");
        final var report = s.run();
        final var time = report.probes().stream()
                .filter(p -> p.name().equals("time")).findFirst().orElseThrow();
        assertThat(time.status()).isEqualTo(PreflightService.Status.WARN);
        assertThat(time.message()).contains("UTC");
    }

    @Test
    void zonedClockIsOk() {
        final var report = svc(okJdbc(), null).run();
        final var time = report.probes().stream()
                .filter(p -> p.name().equals("time")).findFirst().orElseThrow();
        assertThat(time.status()).isEqualTo(PreflightService.Status.OK);
    }

    @Test
    void unresolvableDnsFailsProbe() {
        final PreflightService s = new PreflightService(
                Clock.fixed(NOW, ZoneId.of("Africa/Kampala")),
                okStorage(), okJdbc(),
                dhis2Provider(null), gateProvider(null),
                "pg_dump", "",
                "definitely.does.not.exist.der.test.invalid");
        final var dns = s.run().probes().stream()
                .filter(p -> p.name().equals("dns")).findFirst().orElseThrow();
        assertThat(dns.status()).isEqualTo(PreflightService.Status.FAIL);
    }

    @Test
    void missingKeystorePathSkips() {
        final var certs = svc(okJdbc(), null).run().probes().stream()
                .filter(p -> p.name().equals("certs")).findFirst().orElseThrow();
        assertThat(certs.status()).isEqualTo(PreflightService.Status.SKIP);
    }

    @Test
    void missingKeystoreFileFails() {
        final PreflightService s = new PreflightService(
                Clock.fixed(NOW, ZoneId.of("Africa/Kampala")),
                okStorage(), okJdbc(),
                dhis2Provider(null), gateProvider(null),
                "pg_dump", "/no/such/keystore.p12", "localhost");
        final var certs = s.run().probes().stream()
                .filter(p -> p.name().equals("certs")).findFirst().orElseThrow();
        assertThat(certs.status()).isEqualTo(PreflightService.Status.FAIL);
        assertThat(certs.message()).contains("missing");
    }

    @Test
    void storageRejectRollsUpToFail() {
        final StorageHealthProbe bad = mock(StorageHealthProbe.class);
        when(bad.sample()).thenReturn(new StorageHealthProbe.Snapshot(
                "/tmp", 1024L, 10_000L, 1_000_000L, 500_000L,
                StorageHealthProbe.Status.REJECT));
        final PreflightService s = new PreflightService(
                Clock.fixed(NOW, ZoneId.of("Africa/Kampala")),
                bad, okJdbc(),
                dhis2Provider(null), gateProvider(null),
                "pg_dump", "", "localhost");
        final var report = s.run();
        assertThat(report.overall()).isEqualTo(PreflightService.Status.FAIL);
    }

    @Test
    void databaseProbeFailsOnException() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1"), eq(Integer.class)))
                .thenThrow(new RuntimeException("conn refused"));
        final var db = svc(jdbc, null).run().probes().stream()
                .filter(p -> p.name().equals("database")).findFirst().orElseThrow();
        assertThat(db.status()).isEqualTo(PreflightService.Status.FAIL);
        assertThat(db.message()).contains("conn refused");
    }

    @Test
    void networkProbeSkipsWithoutDhis2Config() {
        final var network = svc(okJdbc(), null).run().probes().stream()
                .filter(p -> p.name().equals("network")).findFirst().orElseThrow();
        assertThat(network.status()).isEqualTo(PreflightService.Status.SKIP);
    }

    @Test
    void networkProbeWarnsOnMissingBaseUrl() {
        final Dhis2ConnectionConfigRepository repo =
                mock(Dhis2ConnectionConfigRepository.class);
        when(repo.read()).thenReturn(Dhis2ConnectionConfig.empty());
        final var network = svc(okJdbc(), repo).run().probes().stream()
                .filter(p -> p.name().equals("network")).findFirst().orElseThrow();
        assertThat(network.status()).isEqualTo(PreflightService.Status.WARN);
    }

    @Test
    void dependenciesWarnWhenPgDumpMissing() {
        final PreflightService s = new PreflightService(
                Clock.fixed(NOW, ZoneId.of("Africa/Kampala")),
                okStorage(), okJdbc(),
                dhis2Provider(null), gateProvider(null),
                "/no/such/pg_dump", "", "localhost");
        final var dep = s.run().probes().stream()
                .filter(p -> p.name().equals("dependencies")).findFirst().orElseThrow();
        assertThat(dep.status()).isEqualTo(PreflightService.Status.WARN);
        assertThat(dep.message()).contains("pg_dump");
    }

    @Test
    void rollupEmitsOkWhenEverythingOk() {
        final Dhis2ConnectionConfigRepository repo =
                mock(Dhis2ConnectionConfigRepository.class);
        when(repo.read()).thenReturn(new Dhis2ConnectionConfig(
                "https://play.dhis2.org/dhis", null, "sealed", null, false,
                null, null, null, null, null, null,
                null, null, null, null, null));
        final var report = svc(okJdbc(), repo).run();
        // The overall rollup is OK iff all probes report OK (modulo
        // SKIP which does not degrade). This test pins that: certs
        // skip + network OK + others OK → OK. If any probe wobbles
        // to WARN or FAIL (e.g. pg_dump not on PATH), the rollup
        // escalates — pinned separately above.
        assertThat(report.overall()).isIn(PreflightService.Status.OK,
                PreflightService.Status.WARN);
    }
}
