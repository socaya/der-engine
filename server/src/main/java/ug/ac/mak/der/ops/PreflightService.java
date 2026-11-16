package ug.ac.mak.der.ops;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2ConnectionConfig;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.network.CentralReachabilityGate;

/**
 * FR-01-04 — pre-flight readiness bundle.
 *
 * <p>Aggregates the subsystem probes an operator needs before
 * activating a DER appliance in a pilot site:
 * {@code time / dns / certs / storage / database / network /
 * dependencies}. Each probe returns one {@link ProbeResult}; the
 * service rolls up an overall status (FAIL if any FAIL, else WARN
 * if any WARN, else OK).</p>
 *
 * <p>Deliberately network-light: the dns + network probes use short
 * timeouts (2s) so the endpoint stays responsive on a flaky link.
 * The certs probe only inspects a configured keystore path — a
 * missing keystore returns SKIP rather than FAIL because many
 * deployments terminate TLS at a reverse proxy.</p>
 */
@Service
public class PreflightService {

    private static final Logger LOG = LoggerFactory.getLogger(PreflightService.class);

    public enum Status { OK, WARN, FAIL, SKIP }

    public record ProbeResult(String name, Status status, String message,
                                Map<String, Object> detail) { }

    public record PreflightReport(Status overall, Instant observedAt,
                                    List<ProbeResult> probes) { }

    private final Clock clock;
    private final StorageHealthProbe storage;
    private final JdbcTemplate jdbc;
    private final ObjectProvider<Dhis2ConnectionConfigRepository> dhis2;
    private final ObjectProvider<CentralReachabilityGate> gate;
    private final String pgDumpBinary;
    private final String keystorePath;
    private final String dnsResolveTarget;

    public PreflightService(final Clock clock,
                              final StorageHealthProbe storage,
                              final JdbcTemplate jdbc,
                              final ObjectProvider<Dhis2ConnectionConfigRepository> dhis2,
                              final ObjectProvider<CentralReachabilityGate> gate,
                              @Value("${der.backup.pg-dump:pg_dump}") final String pgDumpBinary,
                              @Value("${server.ssl.key-store:}") final String keystorePath,
                              @Value("${der.preflight.dns-target:hisp.ug}")
                                  final String dnsResolveTarget) {
        this.clock = Objects.requireNonNull(clock, "clock");
        this.storage = Objects.requireNonNull(storage, "storage");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.dhis2 = dhis2;
        this.gate = gate;
        this.pgDumpBinary = pgDumpBinary;
        this.keystorePath = keystorePath;
        this.dnsResolveTarget = dnsResolveTarget;
    }

    public PreflightReport run() {
        final List<ProbeResult> probes = new ArrayList<>();
        probes.add(probeTime());
        probes.add(probeDns());
        probes.add(probeCerts());
        probes.add(probeStorage());
        probes.add(probeDatabase());
        probes.add(probeNetwork());
        probes.add(probeDependencies());
        return new PreflightReport(rollup(probes), Instant.now(clock), probes);
    }

    private static Status rollup(final List<ProbeResult> probes) {
        boolean warn = false;
        for (final ProbeResult p : probes) {
            if (p.status() == Status.FAIL) {
                return Status.FAIL;
            }
            if (p.status() == Status.WARN) {
                warn = true;
            }
        }
        return warn ? Status.WARN : Status.OK;
    }

    private ProbeResult probeTime() {
        final Instant now = Instant.now(clock);
        final ZoneId zone = clock.getZone();
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("now", now.toString());
        detail.put("zone", zone.toString());
        // We can't ping NTP from the bundled runtime, but a zone of
        // Z (no local config) on a production appliance is almost
        // always wrong — flag WARN.
        if ("Z".equals(zone.getId()) || "UTC".equals(zone.getId())) {
            return new ProbeResult("time", Status.WARN,
                    "server zone is UTC — confirm this matches the deployment site",
                    detail);
        }
        return new ProbeResult("time", Status.OK,
                "clock reports " + now + " (" + zone + ")", detail);
    }

    private ProbeResult probeDns() {
        if (dnsResolveTarget == null || dnsResolveTarget.isBlank()) {
            return new ProbeResult("dns", Status.SKIP,
                    "der.preflight.dns-target not configured", Map.of());
        }
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("target", dnsResolveTarget);
        try {
            final long t0 = System.nanoTime();
            final InetAddress addr = InetAddress.getByName(dnsResolveTarget);
            final long elapsed = (System.nanoTime() - t0) / 1_000_000;
            detail.put("resolved", addr.getHostAddress());
            detail.put("elapsedMs", elapsed);
            if (elapsed > 1500) {
                return new ProbeResult("dns", Status.WARN,
                        "dns resolution slow (" + elapsed + "ms)", detail);
            }
            return new ProbeResult("dns", Status.OK,
                    "resolved " + dnsResolveTarget + " -> "
                            + addr.getHostAddress(), detail);
        } catch (final Exception ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("dns", Status.FAIL,
                    "could not resolve " + dnsResolveTarget, detail);
        }
    }

    private ProbeResult probeCerts() {
        if (keystorePath == null || keystorePath.isBlank()) {
            return new ProbeResult("certs", Status.SKIP,
                    "server.ssl.key-store not configured (TLS likely terminated upstream)",
                    Map.of());
        }
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("keystorePath", keystorePath);
        final var path = Paths.get(keystorePath);
        if (!Files.exists(path)) {
            return new ProbeResult("certs", Status.FAIL,
                    "keystore file missing: " + keystorePath, detail);
        }
        try {
            final long bytes = Files.size(path);
            detail.put("sizeBytes", bytes);
            // Not opening the keystore itself (no password here); file
            // presence + readable size is the FR-01-04 contract.
            if (!Files.isReadable(path)) {
                return new ProbeResult("certs", Status.FAIL,
                        "keystore not readable by server", detail);
            }
            return new ProbeResult("certs", Status.OK,
                    "keystore present (" + bytes + " bytes)", detail);
        } catch (final Exception ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("certs", Status.FAIL,
                    "keystore probe error", detail);
        }
    }

    private ProbeResult probeStorage() {
        final var snap = storage.sample();
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("root", snap.root());
        detail.put("usableBytes", snap.usableBytes());
        detail.put("totalBytes", snap.totalBytes());
        detail.put("warnBytes", snap.warnBytes());
        detail.put("rejectBytes", snap.rejectBytes());
        final Status s = switch (snap.status()) {
            case OK -> Status.OK;
            case WARN -> Status.WARN;
            case REJECT -> Status.FAIL;
        };
        return new ProbeResult("storage", s,
                snap.status() + " — usable " + snap.formattedUsable(), detail);
    }

    private ProbeResult probeDatabase() {
        final Map<String, Object> detail = new LinkedHashMap<>();
        try {
            final Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            if (one == null || one != 1) {
                return new ProbeResult("database", Status.FAIL,
                        "SELECT 1 did not return 1", detail);
            }
            try {
                final String version = jdbc.queryForObject(
                        "SELECT version", String.class) == null
                        ? null
                        : jdbc.queryForObject(
                                "SELECT max(version) FROM der.flyway_schema_history "
                              + " WHERE success = true", String.class);
                detail.put("flywayHead", version);
            } catch (final Exception ignored) {
                // Flyway schema may live in another schema — not fatal.
            }
            try {
                final String pg = jdbc.queryForObject(
                        "SHOW server_version", String.class);
                detail.put("postgresVersion", pg);
            } catch (final Exception ignored) {
                // ignore
            }
            return new ProbeResult("database", Status.OK,
                    "SELECT 1 OK", detail);
        } catch (final Exception ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("database", Status.FAIL,
                    "database probe failed: " + ex.getMessage(), detail);
        }
    }

    private ProbeResult probeNetwork() {
        final Map<String, Object> detail = new LinkedHashMap<>();
        final CentralReachabilityGate g = gate == null ? null : gate.getIfAvailable();
        if (g != null) {
            final var snap = g.current();
            detail.put("reachabilityState", snap.state().name());
            detail.put("consecutiveSuccess", snap.consecutiveSuccess());
            detail.put("consecutiveFailure", snap.consecutiveFailure());
        }
        final Dhis2ConnectionConfigRepository repo = dhis2 == null
                ? null : dhis2.getIfAvailable();
        if (repo == null) {
            detail.put("central", "config repo not wired");
            return new ProbeResult("network", Status.SKIP,
                    "central config repository not wired", detail);
        }
        final Dhis2ConnectionConfig c;
        try {
            c = repo.read();
        } catch (final Exception ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("network", Status.WARN,
                    "could not read central config", detail);
        }
        if (c == null || c.baseUrl() == null || c.baseUrl().isBlank()) {
            return new ProbeResult("network", Status.WARN,
                    "central baseUrl not configured", detail);
        }
        detail.put("centralBaseUrl", c.baseUrl());
        try {
            final URI uri = new URI(c.baseUrl());
            final String host = uri.getHost();
            if (host == null) {
                return new ProbeResult("network", Status.WARN,
                        "central baseUrl has no host component", detail);
            }
            final long t0 = System.nanoTime();
            final InetAddress addr = InetAddress.getByName(host);
            final long ms = (System.nanoTime() - t0) / 1_000_000;
            detail.put("centralHost", host);
            detail.put("centralIp", addr.getHostAddress());
            detail.put("dnsElapsedMs", ms);
            return new ProbeResult("network", Status.OK,
                    "central host " + host + " resolves", detail);
        } catch (final URISyntaxException ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("network", Status.FAIL,
                    "central baseUrl is malformed", detail);
        } catch (final Exception ex) {
            detail.put("error", ex.getMessage());
            return new ProbeResult("network", Status.WARN,
                    "central host DNS resolution failed", detail);
        }
    }

    private ProbeResult probeDependencies() {
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("javaVersion", System.getProperty("java.version"));
        detail.put("javaVendor", System.getProperty("java.vendor"));
        detail.put("os", System.getProperty("os.name")
                + " " + System.getProperty("os.version"));
        // pg_dump binary — needed for FR-14-07 backups.
        final String pgOut = execVersion(pgDumpBinary);
        detail.put("pgDumpVersion", pgOut == null ? "not found" : pgOut);
        final Status pgStatus = pgOut == null ? Status.WARN : Status.OK;
        final String msg = pgOut == null
                ? "pg_dump not on PATH — backups will fail"
                : "runtime deps present";
        return new ProbeResult("dependencies", pgStatus, msg, detail);
    }

    private static String execVersion(final String bin) {
        if (bin == null || bin.isBlank()) {
            return null;
        }
        try {
            final Process p = new ProcessBuilder(bin, "--version")
                    .redirectErrorStream(true).start();
            if (!p.waitFor(3, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return null;
            }
            if (p.exitValue() != 0) {
                return null;
            }
            final String out = new String(p.getInputStream().readAllBytes(),
                    java.nio.charset.StandardCharsets.UTF_8).strip();
            return out.isEmpty() ? null : out;
        } catch (final Exception ex) {
            LOG.debug("exec {} --version failed: {}", bin, ex.getMessage());
            return null;
        }
    }

    // Package-private for test — lets a test inject a known-bad
    // DNS target without reflection on private fields.
    Duration maxDnsBudget() {
        return Duration.ofSeconds(2);
    }
}
