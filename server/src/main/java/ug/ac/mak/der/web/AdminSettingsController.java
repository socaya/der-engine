package ug.ac.mak.der.web;

import java.io.IOException;
import java.util.LinkedHashMap;
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
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.ops.AdminSettingRepository;
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

    public AdminSettingsController(final AdminSettingRepository repo,
                                     final ObjectMapper mapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
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
        return read(authentication);
    }

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
