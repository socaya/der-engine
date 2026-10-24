package ug.ac.mak.der.web;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * ADMIN-only edge lifecycle controls. Exposes the operations an on-site
 * administrator typically needs without opening a terminal on the host:
 *
 * <ul>
 *   <li>{@code POST .../shutdown}         graceful JVM exit.</li>
 *   <li>{@code POST .../restart}          graceful exit + sentinel file so
 *       a wrapper (systemd, launchd, Docker restart-policy) respawns the
 *       process.</li>
 *   <li>{@code POST .../clear-sessions}   revoke every active DER session;
 *       forces every operator to sign in again.</li>
 *   <li>{@code POST .../reload-dhis2-config} fire-and-forget signal; DER
 *       already reads the editable config on every outbound call, so this
 *       is a nice-to-have "no-op" that returns the resolved state.</li>
 *   <li>{@code GET  .../logs}             tail the DER server log file so
 *       admins can inspect recent output without SSH.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/lifecycle",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class LifecycleController {

    private static final Logger LOG = LoggerFactory.getLogger(LifecycleController.class);

    private final ApplicationContext ctx;
    private final JdbcTemplate jdbc;
    private final Path logPath;
    private final Path restartFlag;

    public LifecycleController(final ApplicationContext ctx,
                                final JdbcTemplate jdbc,
                                @Value("${der.lifecycle.log-path:/tmp/der.log}") final String logPath,
                                @Value("${der.lifecycle.restart-flag:/tmp/der-restart.flag}") final String restartFlag) {
        this.ctx = Objects.requireNonNull(ctx, "ctx");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.logPath = Path.of(logPath);
        this.restartFlag = Path.of(restartFlag);
    }

    @PostMapping("/shutdown")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> shutdown(final Authentication auth) {
        final String who = who(auth);
        LOG.warn("ADMIN shutdown requested by {}", who);
        scheduleExit();
        return ResponseEntity.ok(Map.of(
                "status", "SHUTTING_DOWN",
                "requestedBy", who,
                "requestedAt", Instant.now().toString()));
    }

    @PostMapping("/restart")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> restart(final Authentication auth) {
        final String who = who(auth);
        LOG.warn("ADMIN restart requested by {}", who);
        try {
            Files.writeString(restartFlag,
                    "requestedAt=" + Instant.now()
                            + "\nrequestedBy=" + who + "\n",
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException ex) {
            LOG.warn("could not write restart flag {}: {}", restartFlag, ex.toString());
        }
        scheduleExit();
        return ResponseEntity.ok(Map.of(
                "status", "RESTARTING",
                "flagFile", restartFlag.toString(),
                "requestedBy", who,
                "requestedAt", Instant.now().toString(),
                "note", "DER will exit; the host supervisor (systemd / "
                        + "Docker / launchd) must respawn the process."));
    }

    @PostMapping("/clear-sessions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> clearSessions(final Authentication auth) {
        final String who = who(auth);
        final int revoked = jdbc.update(
                "UPDATE der.edge_session SET revoked_at = ? WHERE revoked_at IS NULL",
                java.sql.Timestamp.from(Instant.now()));
        LOG.warn("ADMIN clear-sessions by {} revoked {} session(s)", who, revoked);
        return ResponseEntity.ok(Map.of(
                "status", "OK",
                "sessionsRevoked", revoked,
                "requestedBy", who,
                "requestedAt", Instant.now().toString()));
    }

    @PostMapping("/reload-dhis2-config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> reloadDhis2Config(final Authentication auth) {
        LOG.info("ADMIN reload-dhis2-config by {}", who(auth));
        return ResponseEntity.ok(Map.of(
                "status", "OK",
                "note", "DER reads /edge-api/v1/admin/dhis2-connection on each "
                        + "outbound call; no in-process cache to invalidate."));
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> logs(
            @RequestParam(name = "lines", defaultValue = "200") final int linesParam) {
        final int lines = Math.max(1, Math.min(2000, linesParam));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("path", logPath.toString());
        body.put("linesRequested", lines);
        if (!Files.isRegularFile(logPath)) {
            body.put("status", "NO_LOG_FILE");
            body.put("entries", List.of());
            return ResponseEntity.ok(body);
        }
        try {
            final List<String> all = Files.readAllLines(logPath);
            final List<String> tail = all.size() <= lines ? all
                    : all.subList(all.size() - lines, all.size());
            body.put("status", "OK");
            body.put("totalLines", all.size());
            body.put("entries", tail);
        } catch (IOException ex) {
            body.put("status", "READ_FAILED");
            body.put("error", ex.toString());
            body.put("entries", List.of());
        }
        return ResponseEntity.ok(body);
    }

    private String who(final Authentication auth) {
        if (auth instanceof EdgeUserPrincipal p) {
            final UUID id = p.userId();
            return id == null ? "unknown" : id.toString();
        }
        return "unknown";
    }

    private void scheduleExit() {
        final Thread t = new Thread(() -> {
            try {
                Thread.sleep(500L);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            // SpringApplication.exit is the cleanest way to tear down the
            // ApplicationContext before process exit.
            final int code = SpringApplication.exit(ctx, () -> 0);
            Runtime.getRuntime().halt(Math.max(0, code));
        }, "der-lifecycle-exit");
        t.setDaemon(false);
        t.start();
        // Silence unused warning if the compiler flags the array.
        if (Arrays.asList(t).isEmpty()) {
            // unreachable
            return;
        }
    }
}
