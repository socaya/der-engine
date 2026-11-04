package ug.ac.mak.der.web;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

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
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * FR-01-07: Site configuration — connectivity policies, limits, local
 * URL and time-zone settings.
 *
 * <p>Persisted to {@code der.admin_setting} under the {@code site.config}
 * key as a single JSON object so the whole block upserts atomically.
 * The GET endpoint always returns every documented key with its default
 * — so operators see the live schema even on a fresh install — and
 * overlays any stored values on top. The POST endpoint rejects
 * unknown keys to prevent schema drift.</p>
 *
 * <p>Every successful save is logged to the security audit as
 * {@code SITE_CONFIG_CHANGED}.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/site/config",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SiteConfigController {

    static final String STORAGE_KEY = "site.config";

    /** Whitelist with default values. Missing keys fall back to these. */
    static final Map<String, String> DEFAULTS;
    static {
        final Map<String, String> m = new LinkedHashMap<>();
        m.put("site.displayName", "DER edge");
        m.put("site.localBaseUrl", "https://der.local");
        m.put("site.timeZone", ZoneId.systemDefault().getId());
        m.put("site.connectivity.maxConcurrentSessions", "20");
        m.put("site.connectivity.maxOfflineHours", "72");
        m.put("site.connectivity.onlineWindowCron", "");
        m.put("site.connectivity.requireVpn", "false");
        DEFAULTS = Map.copyOf(m);
    }

    private final AdminSettingRepository repo;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;

    public SiteConfigController(final AdminSettingRepository repo,
                                  final SecurityAuditRepository audit,
                                  final ObjectMapper mapper,
                                  final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> read(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, String> merged = new LinkedHashMap<>(DEFAULTS);
        final Optional<AdminSettingRepository.Entry> stored = repo.read(STORAGE_KEY);
        if (stored.isPresent()) {
            try {
                @SuppressWarnings("unchecked")
                final Map<String, Object> raw = mapper.readValue(stored.get().value(), Map.class);
                for (final Map.Entry<String, Object> e : raw.entrySet()) {
                    if (DEFAULTS.containsKey(e.getKey()) && e.getValue() != null) {
                        merged.put(e.getKey(), String.valueOf(e.getValue()));
                    }
                }
            } catch (IOException ignored) {
                // Malformed stored row — defaults win so the screen never blanks.
            }
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("values", merged);
        body.put("defaults", DEFAULTS);
        body.put("updatedBy", stored.map(AdminSettingRepository.Entry::updatedBy)
                                       .map(Objects::toString).orElse(null));
        body.put("updatedAt", stored.map(AdminSettingRepository.Entry::updatedAt)
                                       .map(Instant::toString).orElse(null));
        return ResponseEntity.ok(body);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> save(final Authentication authentication,
                                                       @RequestBody final SaveRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.values() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SITE_CONFIG_INVALID",
                    "message", "values object required"));
        }
        for (final String key : body.values().keySet()) {
            if (!DEFAULTS.containsKey(key)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "SITE_CONFIG_KEY_UNKNOWN",
                        "message", "key not in site-config schema: " + key));
            }
        }
        final Map<String, String> merged = new LinkedHashMap<>(DEFAULTS);
        final Optional<AdminSettingRepository.Entry> prev = repo.read(STORAGE_KEY);
        if (prev.isPresent()) {
            try {
                @SuppressWarnings("unchecked")
                final Map<String, Object> raw = mapper.readValue(prev.get().value(), Map.class);
                for (final Map.Entry<String, Object> e : raw.entrySet()) {
                    if (DEFAULTS.containsKey(e.getKey()) && e.getValue() != null) {
                        merged.put(e.getKey(), String.valueOf(e.getValue()));
                    }
                }
            } catch (IOException ignored) { /* defaults win */ }
        }
        for (final Map.Entry<String, Object> e : body.values().entrySet()) {
            merged.put(e.getKey(), e.getValue() == null ? "" : String.valueOf(e.getValue()));
        }
        try {
            repo.upsert(STORAGE_KEY,
                    mapper.writeValueAsString(merged), principal.userId());
        } catch (IOException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SITE_CONFIG_SERIALIZE",
                    "message", ex.getMessage()));
        }
        final Map<String, Object> auditDetail = new LinkedHashMap<>();
        for (final Map.Entry<String, Object> e : body.values().entrySet()) {
            auditDetail.put(e.getKey(), e.getValue() == null ? "" : String.valueOf(e.getValue()));
        }
        audit.append(new AuditEvent("SITE_CONFIG_CHANGED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                auditDetail),
                Instant.now(clock));
        return read(authentication);
    }

    public record SaveRequest(
            @JsonProperty("values") Map<String, Object> values) { }
}
