package ug.ac.mak.der.web;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
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

import ug.ac.mak.der.scheduler.BackupDrainJob;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.backup.BackupRepository;
import ug.ac.mak.der.workflows.backup.BackupRun;

/** Phase 07 backup surface. ADR-0012. */
@RestController
@RequestMapping(path = "/edge-api/v1/backup", produces = MediaType.APPLICATION_JSON_VALUE)
public class BackupController {

    private static final Logger LOG = LoggerFactory.getLogger(BackupController.class);

    private final BackupRepository repo;
    private final Path localRoot;
    private final Scheduler scheduler;

    public BackupController(final BackupRepository repo,
                             final Scheduler scheduler,
                             @Value("${der.backup.local.root:${user.home}/.der/backups}")
                             final String localRoot) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.scheduler = scheduler;
        this.localRoot = Paths.get(localRoot).toAbsolutePath().normalize();
    }

    @PostMapping(path = "/request", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> request(final Authentication authentication,
                                                         @RequestBody(required = false)
                                                         final BackupRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final BackupRun.Kind kind = parseKind(body == null ? null : body.kind());
        final BackupRun created = repo.insert(new BackupRun(null, Instant.now(),
                principal.userId(), kind, BackupRun.Status.REQUESTED, null,
                null, null, null, null, null, null));
        kickDrain();
        return ResponseEntity.accepted().body(toJson(created));
    }

    private void kickDrain() {
        if (scheduler == null) {
            return;
        }
        try {
            scheduler.triggerJob(JobKey.jobKey(BackupDrainJob.JOB_NAME));
        } catch (SchedulerException ex) {
            LOG.warn("could not kick BackupDrainJob: {}", ex.getMessage());
        }
    }

    @GetMapping("/runs")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(name = "limit", defaultValue = "50") final int limit) {
        final List<BackupRun> rows = repo.findRecent(limit);
        return ResponseEntity.ok(Map.of("runs", rows.stream().map(BackupController::toJson).toList()));
    }

    @GetMapping("/runs/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final long id) {
        return repo.findById(id)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(toJson(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping(path = "/runs/{id}/archive", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Resource> download(@PathVariable("id") final long id) throws IOException {
        final Optional<BackupRun> row = repo.findById(id);
        if (row.isEmpty() || row.get().archivePath() == null) {
            return ResponseEntity.notFound().build();
        }
        final Path archive = Paths.get(row.get().archivePath()).toAbsolutePath().normalize();
        if (!archive.startsWith(localRoot) || !Files.isRegularFile(archive)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + archive.getFileName() + "\"")
                .contentLength(Files.size(archive))
                .body(new FileSystemResource(archive));
    }

    private static BackupRun.Kind parseKind(final String raw) {
        if (raw == null || raw.isBlank()) {
            return BackupRun.Kind.FULL;
        }
        try {
            return BackupRun.Kind.valueOf(raw.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return BackupRun.Kind.FULL;
        }
    }

    private static Map<String, Object> toJson(final BackupRun r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId());
        m.put("requestedAt", r.requestedAt().toString());
        m.put("requestedBy", r.requestedBy().toString());
        m.put("kind", r.kind().name());
        m.put("status", r.status().name());
        m.put("message", r.message());
        m.put("archivePath", r.archivePath());
        m.put("archiveBytes", r.archiveBytes());
        m.put("remoteKey", r.remoteKey());
        m.put("startedAt", r.startedAt() == null ? null : r.startedAt().toString());
        m.put("finishedAt", r.finishedAt() == null ? null : r.finishedAt().toString());
        m.put("pgDumpVersion", r.pgDumpVersion());
        return m;
    }

    public record BackupRequest(@JsonProperty("kind") String kind) { }
}
