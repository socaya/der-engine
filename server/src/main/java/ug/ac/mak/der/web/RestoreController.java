package ug.ac.mak.der.web;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.backup.RestoreRepository;
import ug.ac.mak.der.workflows.backup.RestoreRun;

/** Phase 07 restore surface. ADR-0012. */
@RestController
@RequestMapping(path = "/edge-api/v1/restore", produces = MediaType.APPLICATION_JSON_VALUE)
public class RestoreController {

    private final RestoreRepository repo;
    private final Path uploadRoot;

    public RestoreController(final RestoreRepository repo,
                              @Value("${der.backup.upload.root:${user.home}/.der/uploads}")
                              final String uploadRoot) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.uploadRoot = Paths.get(uploadRoot).toAbsolutePath().normalize();
    }

    @PostMapping(path = "/request", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> request(final Authentication authentication,
                                                         @RequestBody final RestoreRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.kind() == null || body.source() == null
                || body.source().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "kind + source required"));
        }
        final RestoreRun.Kind kind;
        try {
            kind = RestoreRun.Kind.valueOf(body.kind().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "kind must be LOCAL|REMOTE|UPLOAD"));
        }
        final RestoreRun created = repo.insert(new RestoreRun(null, Instant.now(),
                principal.userId(), body.source(), RestoreRun.Status.REQUESTED,
                null, null, null, null, kind));
        return ResponseEntity.accepted().body(toJson(created));
    }

    @PostMapping(path = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(final Authentication authentication,
                                                        @RequestParam("archive")
                                                        final MultipartFile file) throws IOException {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "archive multipart required"));
        }
        Files.createDirectories(uploadRoot);
        final String safe = "upload-" + UUID.randomUUID() + ".dump";
        final Path target = uploadRoot.resolve(safe);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return ResponseEntity.ok(Map.of("uploadKey", safe, "size", Files.size(target)));
    }

    @GetMapping("/runs")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(name = "limit", defaultValue = "50") final int limit) {
        final List<RestoreRun> rows = repo.findRecent(limit);
        return ResponseEntity.ok(Map.of("runs", rows.stream().map(RestoreController::toJson).toList()));
    }

    @GetMapping("/runs/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final long id) {
        return repo.findById(id)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(toJson(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static Map<String, Object> toJson(final RestoreRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId());
        m.put("requestedAt", r.requestedAt().toString());
        m.put("requestedBy", r.requestedBy().toString());
        m.put("kind", r.kind() == null ? null : r.kind().name());
        m.put("source", r.source());
        m.put("status", r.status().name());
        m.put("message", r.message());
        m.put("archivePath", r.archivePath());
        m.put("startedAt", r.startedAt() == null ? null : r.startedAt().toString());
        m.put("finishedAt", r.finishedAt() == null ? null : r.finishedAt().toString());
        return m;
    }

    public record RestoreRequest(
            @JsonProperty("kind") String kind,
            @JsonProperty("source") String source) { }
}
