package ug.ac.mak.der.web;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.scheduler.SchedulerAdminService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * G1: admin UI settings endpoint. GET returns the current cron
 * overrides + feature flags; POST persists them. Secrets stay
 * environment-only (database password, DHIS2 service account);
 * only cron strings and flag names land in {@code der.admin_setting}.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/settings",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminSettingsController {

    private static final String CRON_KEY = "sync.cron";
    private static final String FLAGS_KEY = "feature.flags";

    private final AdminSettingRepository repo;
    private final ObjectMapper mapper;
    /** SM-3b — null in @WebMvcTest contexts that don't boot the
     *  scheduler (`der.sync.enabled=false`). */
    private final SchedulerAdminService schedulerAdmin;

    public AdminSettingsController(final AdminSettingRepository repo,
                                     final ObjectMapper mapper,
                                     @org.springframework.beans.factory.annotation.Autowired(required = false)
                                     final SchedulerAdminService schedulerAdmin) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.schedulerAdmin = schedulerAdmin;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> read(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("cron", readJson(CRON_KEY));
        body.put("flags", readJson(FLAGS_KEY));
        return ResponseEntity.ok(body);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> save(final Authentication authentication,
                                                      @RequestBody final SaveRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SETTINGS_INVALID",
                    "message", "cron and flags objects required"));
        }
        try {
            if (body.cron() != null) {
                repo.upsert(CRON_KEY, mapper.writeValueAsString(body.cron()),
                        principal.userId());
            }
            if (body.flags() != null) {
                repo.upsert(FLAGS_KEY, mapper.writeValueAsString(body.flags()),
                        principal.userId());
            }
        } catch (IOException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SETTINGS_SERIALIZE", "message", ex.getMessage()));
        }
        // SM-3b — hot-reload Quartz for each known cron key the admin
        // just changed. Operators no longer need a server restart for
        // schedule changes to take effect.
        final Map<String, List<Instant>> rescheduled = new LinkedHashMap<>();
        if (schedulerAdmin != null && body.cron() != null) {
            for (Map.Entry<String, Object> e : body.cron().entrySet()) {
                final String jobName = JOB_FOR_KEY.get(e.getKey());
                final Object v = e.getValue();
                if (jobName == null || !(v instanceof String s) || s.isBlank()) {
                    continue;
                }
                try {
                    rescheduled.put(e.getKey(),
                            schedulerAdmin.reschedule(jobName, s));
                } catch (RuntimeException reschedEx) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "CRON_INVALID",
                            "key", e.getKey(),
                            "message", reschedEx.getMessage()));
                }
            }
        }
        final ResponseEntity<Map<String, Object>> readBack = read(authentication);
        if (!rescheduled.isEmpty() && readBack.getBody() != null) {
            final Map<String, Object> enriched =
                    new LinkedHashMap<>(readBack.getBody());
            enriched.put("rescheduled", rescheduled);
            return ResponseEntity.ok(enriched);
        }
        return readBack;
    }

    /** SM-3b — admin can preview the next N fire times for a cron
     *  string before committing it via POST. Non-destructive: no
     *  scheduler side-effect. */
    @GetMapping("/cron-preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> cronPreview(
            final Authentication authentication,
            @RequestParam("cron") final String cron,
            @RequestParam(name = "count", defaultValue = "3") final int count) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (schedulerAdmin == null) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "SCHEDULER_DISABLED",
                    "message", "scheduler is disabled in this build"));
        }
        try {
            final List<Instant> fires = schedulerAdmin.preview(cron, count);
            final List<String> iso = new ArrayList<>(fires.size());
            for (Instant i : fires) {
                iso.add(i.toString());
            }
            return ResponseEntity.ok(Map.of("cron", cron, "next", iso));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CRON_INVALID", "message", ex.getMessage()));
        }
    }

    /** Fixed mapping from admin-setting cron keys to Quartz job
     *  identities. Only these keys trigger a hot-reload — unknown
     *  keys persist silently without rescheduling anything. */
    private static final Map<String, String> JOB_FOR_KEY = Map.of(
            "sync.metadata",          "METADATA_SYNC_FULL",
            "sync.compat",            "COMPAT_PROBE_REFRESH",
            "sync.drift",             "DRIFT_SNAPSHOT",
            "journal.drain",          "JOURNAL_WORKER_DRAIN",
            "journal.inflight-reaper", "STUCK_INFLIGHT_REAP",
            "data.pull",              "DATA_PULL",
            "analytics.refresh",      "ANALYTICS_REFRESH",
            "backup.drain",           "BACKUP_RESTORE_DRAIN",
            "referral.inbox",         "REFERRAL_INBOX_POLL",
            "referral.escalation",    "REFERRAL_ESCALATION"
    );

    private Map<String, Object> readJson(final String key) {
        return repo.read(key).map(e -> {
            try {
                return mapper.readValue(e.value(), Map.class);
            } catch (IOException ex) {
                return (Map<String, Object>) Map.<String, Object>of();
            }
        }).orElseGet(LinkedHashMap::new);
    }

    public record SaveRequest(
            @JsonProperty("cron") Map<String, Object> cron,
            @JsonProperty("flags") Map<String, Object> flags) { }
}
