package ug.ac.mak.der.web;

import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.attribution.EdgeUserDhis2MappingRepository;
import ug.ac.mak.der.build.BuildInfo;
import ug.ac.mak.der.build.BuildInfoProvider;
import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.compatibility.CapabilitySnapshot;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.ops.StorageHealthProbe;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Rich operator-facing system-info endpoint. The companion
 * {@code /edge-api/v1/system/health} stays minimal for anonymous
 * readiness probes; this one is admin-only and lists runtime,
 * database, scheduler, journal, storage, apps, and attribution
 * state in one call. Alpha.3 of 2.0.2.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/system", produces = MediaType.APPLICATION_JSON_VALUE)
public class EdgeSystemInfoController {

    private final BuildInfoProvider build;
    private final Clock clock;
    private final Dhis2Properties props;
    private final ObjectProvider<Dhis2CompatibilityEngine> compat;
    private final ObjectProvider<JdbcTemplate> jdbc;
    private final ObjectProvider<Scheduler> scheduler;
    private final ObjectProvider<OperationJournalRepository> journal;
    private final ObjectProvider<StorageHealthProbe> storage;
    private final ObjectProvider<InstalledAppRepository> apps;
    private final ObjectProvider<EdgeUserDhis2MappingRepository> mappings;
    private final long startedAtMillis = System.currentTimeMillis();

    public EdgeSystemInfoController(final BuildInfoProvider build,
                                   final Clock clock,
                                   final Dhis2Properties props,
                                   final ObjectProvider<Dhis2CompatibilityEngine> compat,
                                   final ObjectProvider<JdbcTemplate> jdbc,
                                   final ObjectProvider<Scheduler> scheduler,
                                   final ObjectProvider<OperationJournalRepository> journal,
                                   final ObjectProvider<StorageHealthProbe> storage,
                                   final ObjectProvider<InstalledAppRepository> apps,
                                   final ObjectProvider<EdgeUserDhis2MappingRepository> mappings) {
        this.build = Objects.requireNonNull(build, "build");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.props = Objects.requireNonNull(props, "props");
        this.compat = compat;
        this.jdbc = jdbc;
        this.scheduler = scheduler;
        this.journal = journal;
        this.storage = storage;
        this.apps = apps;
        this.mappings = mappings;
    }

    @GetMapping("/info")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> info(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Instant now = Instant.now(clock);
        final BuildInfo info = build.buildInfo();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "der-server");
        body.put("timestamp", now.toString());

        final Map<String, Object> buildMap = new LinkedHashMap<>();
        buildMap.put("version", info.release());
        buildMap.put("commit", info.commit());
        buildMap.put("branch", info.branch());
        buildMap.put("dirty", info.dirty());
        buildMap.put("buildTime", info.buildTime().toString());
        body.put("build", buildMap);

        body.put("runtime", runtimeMap(now));
        body.put("dhis2", dhis2Map());
        body.put("database", databaseMap());
        body.put("scheduler", schedulerMap());
        body.put("journal", journalMap());
        body.put("storage", storageMap());
        body.put("apps", appsMap());
        body.put("attribution", attributionMap());
        return ResponseEntity.ok(body);
    }

    private Map<String, Object> runtimeMap(final Instant now) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("javaVersion", System.getProperty("java.version"));
        m.put("javaVendor", System.getProperty("java.vendor"));
        m.put("osName", System.getProperty("os.name"));
        m.put("osArch", System.getProperty("os.arch"));
        try {
            m.put("hostname", InetAddress.getLocalHost().getHostName());
        } catch (UnknownHostException ex) {
            m.put("hostname", "unknown");
        }
        m.put("uptimeMillis", now.toEpochMilli() - startedAtMillis);
        final Runtime r = Runtime.getRuntime();
        m.put("heapMaxBytes", r.maxMemory());
        m.put("heapUsedBytes", r.totalMemory() - r.freeMemory());
        m.put("heapFreeBytes", r.freeMemory());
        m.put("availableProcessors", r.availableProcessors());
        m.put("jvmStartTimeMillis", ManagementFactory.getRuntimeMXBean().getStartTime());
        return m;
    }

    private Map<String, Object> dhis2Map() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("centralBaseUrl", props.central().baseUrl());
        m.put("pinnedVersion", props.compatibility().pinnedVersion());
        m.put("allowMismatch", props.compatibility().allowMismatch());
        final Dhis2CompatibilityEngine engine = compat.getIfAvailable();
        if (engine != null) {
            try {
                final CapabilitySnapshot snap = engine.current();
                m.put("probeReachable", snap.probeReachable());
                m.put("centralVersion", snap.centralVersion());
                m.put("profileName", snap.profileName());
                m.put("probeDurationMs", snap.probeDurationMs());
                m.put("capturedAt", snap.capturedAt().toString());
            } catch (Dhis2CompatibilityUnavailableException ex) {
                m.put("probeReachable", false);
                m.put("reason", ex.getMessage());
            }
        } else {
            m.put("probeReachable", null);
        }
        return m;
    }

    private Map<String, Object> databaseMap() {
        final JdbcTemplate t = jdbc.getIfAvailable();
        if (t == null) {
            return Map.of("configured", false);
        }
        final Map<String, Object> m = new LinkedHashMap<>();
        try {
            m.put("product", t.queryForObject("SELECT version()", String.class));
            m.put("flywayVersion", t.queryForObject(
                    "SELECT version FROM der.flyway_schema_history "
                            + "WHERE success = TRUE ORDER BY installed_rank DESC LIMIT 1",
                    String.class));
            m.put("migrationCount", t.queryForObject(
                    "SELECT COUNT(*) FROM der.flyway_schema_history WHERE success = TRUE",
                    Integer.class));
            m.put("userCount", t.queryForObject(
                    "SELECT COUNT(*) FROM der.edge_user", Integer.class));
            m.put("sessionCount", t.queryForObject(
                    "SELECT COUNT(*) FROM der.edge_session "
                            + "WHERE expires_at > now() AND revoked_at IS NULL",
                    Integer.class));
        } catch (RuntimeException ex) {
            m.put("probeError", ex.getMessage());
        }
        return m;
    }

    private Map<String, Object> schedulerMap() {
        final Scheduler s = scheduler.getIfAvailable();
        if (s == null) {
            return Map.of("configured", false);
        }
        final Map<String, Object> m = new LinkedHashMap<>();
        try {
            m.put("name", s.getSchedulerName());
            m.put("started", s.isStarted());
            m.put("standbyMode", s.isInStandbyMode());
            m.put("executingJobs", s.getCurrentlyExecutingJobs().size());
            final List<String> groups = s.getJobGroupNames();
            int total = 0;
            for (final String g : groups) {
                total += s.getJobKeys(org.quartz.impl.matchers.GroupMatcher.jobGroupEquals(g)).size();
            }
            m.put("totalJobs", total);
        } catch (SchedulerException ex) {
            m.put("probeError", ex.getMessage());
        }
        return m;
    }

    private Map<String, Object> journalMap() {
        final OperationJournalRepository r = journal.getIfAvailable();
        if (r == null) {
            return Map.of("configured", false);
        }
        final Map<String, Object> m = new LinkedHashMap<>();
        for (final OperationJournalEntry.State state : OperationJournalEntry.State.values()) {
            m.put(state.name().toLowerCase(Locale.ROOT), r.countByState(state));
        }
        return m;
    }

    private Map<String, Object> storageMap() {
        final StorageHealthProbe p = storage.getIfAvailable();
        if (p == null) {
            return Map.of("configured", false);
        }
        final StorageHealthProbe.Snapshot s = p.sample();
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("root", s.root());
        m.put("status", s.status().name());
        m.put("usableBytes", s.usableBytes());
        m.put("totalBytes", s.totalBytes());
        m.put("warnBytes", s.warnBytes());
        m.put("rejectBytes", s.rejectBytes());
        return m;
    }

    private Map<String, Object> appsMap() {
        final InstalledAppRepository r = apps.getIfAvailable();
        if (r == null) {
            return Map.of("configured", false);
        }
        final List<ug.ac.mak.der.apps.InstalledApp> all = r.findAll();
        final long enabled = all.stream().filter(ug.ac.mak.der.apps.InstalledApp::enabled).count();
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("installed", all.size());
        m.put("enabled", enabled);
        m.put("items", all.stream().map(a -> Map.of(
                "key", a.appKey(),
                "name", a.displayName(),
                "version", a.version(),
                "enabled", a.enabled(),
                "launchUrl", "/dhis-web-" + a.appKey() + "/index.html"
        )).toList());
        return m;
    }

    private Map<String, Object> attributionMap() {
        final EdgeUserDhis2MappingRepository r = mappings.getIfAvailable();
        if (r == null) {
            return Map.of("configured", false);
        }
        return Map.of("mappedUsers", r.findAll().size());
    }
}
