package ug.ac.mak.der.workflows.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Drains REQUESTED {@link RestoreRun} rows by running pg_restore. ADR-0012. */
@Service
public class RestoreWorker {

    private static final Logger LOG = LoggerFactory.getLogger(RestoreWorker.class);

    private final RestoreRepository repo;
    private final RemoteArchiveStore remote;
    private final Path localRoot;
    private final Path uploadRoot;
    private final String pgRestoreBinary;
    private final String databaseUrl;
    private final String databaseUser;
    private final String databasePassword;
    private final long perRunTimeoutSeconds;
    private final boolean enabled;

    public RestoreWorker(final RestoreRepository repo,
                          final RemoteArchiveStore remote,
                          @Value("${der.backup.local.root:${user.home}/.der/backups}")
                          final String rootPath,
                          @Value("${der.backup.upload.root:${user.home}/.der/uploads}")
                          final String uploadPath,
                          @Value("${der.backup.pg-restore:pg_restore}")
                          final String pgRestoreBinary,
                          @Value("${spring.datasource.url}") final String databaseUrl,
                          @Value("${spring.datasource.username}") final String databaseUser,
                          @Value("${spring.datasource.password}") final String databasePassword,
                          @Value("${der.backup.timeout-seconds:900}")
                          final long perRunTimeoutSeconds,
                          @Value("${der.backup.enabled:true}") final boolean enabled) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.remote = Objects.requireNonNull(remote, "remote");
        this.localRoot = Paths.get(rootPath).toAbsolutePath().normalize();
        this.uploadRoot = Paths.get(uploadPath).toAbsolutePath().normalize();
        this.pgRestoreBinary = pgRestoreBinary;
        this.databaseUrl = databaseUrl;
        this.databaseUser = databaseUser;
        this.databasePassword = databasePassword == null ? "" : databasePassword;
        this.perRunTimeoutSeconds = Math.max(60, perRunTimeoutSeconds);
        this.enabled = enabled;
    }

    public Path uploadRoot() {
        return uploadRoot;
    }

    public int drain() {
        if (!enabled) {
            return 0;
        }
        final List<RestoreRun> pending = repo.findByStatus(RestoreRun.Status.REQUESTED, 10);
        int done = 0;
        for (final RestoreRun run : pending) {
            runOne(run);
            done++;
        }
        return done;
    }

    private void runOne(final RestoreRun run) {
        final Path archive;
        try {
            archive = materialise(run);
            repo.markStarted(run.runId(), archive.toString());
        } catch (IOException ex) {
            repo.markFailed(run.runId(), ex.getMessage());
            LOG.warn("restore {} failed during materialise: {}", run.runId(), ex.getMessage());
            return;
        }
        try {
            final ProcessBuilder pb = new ProcessBuilder(
                    pgRestoreBinary, "--clean", "--if-exists", "--no-owner",
                    "--no-privileges", "--dbname=" + jdbcToPgArg(), archive.toString())
                    .redirectErrorStream(true);
            if (databaseUser != null && !databaseUser.isBlank()) {
                pb.environment().put("PGUSER", databaseUser);
                pb.environment().put("PGPASSWORD", databasePassword);
            }
            final Process process = pb.start();
            if (!process.waitFor(perRunTimeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IOException("pg_restore timed out after "
                        + perRunTimeoutSeconds + "s");
            }
            if (process.exitValue() != 0) {
                final String out = new String(process.getInputStream().readAllBytes(),
                        java.nio.charset.StandardCharsets.UTF_8);
                throw new IOException("pg_restore exit "
                        + process.exitValue() + ": " + out.strip());
            }
            repo.markSuccess(run.runId());
            LOG.info("restore {} completed from {}", run.runId(), archive);
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            repo.markFailed(run.runId(), ex.getMessage());
            LOG.warn("restore {} failed: {}", run.runId(), ex.getMessage());
        }
    }

    private Path materialise(final RestoreRun run) throws IOException {
        final RestoreRun.Kind kind = run.kind() == null ? RestoreRun.Kind.LOCAL : run.kind();
        return switch (kind) {
            case LOCAL -> resolveLocal(run.source());
            case REMOTE -> {
                final Path target = localRoot.resolve("restore-" + run.runId() + ".dump");
                Files.createDirectories(localRoot);
                remote.download(run.source(), target);
                yield target;
            }
            case UPLOAD -> resolveUpload(run.source());
        };
    }

    private Path resolveLocal(final String source) throws IOException {
        final Path p = Paths.get(source).toAbsolutePath().normalize();
        if (!p.startsWith(localRoot)) {
            throw new IOException("local source escapes der.backup.local.root");
        }
        if (!Files.isRegularFile(p)) {
            throw new IOException("local source does not exist: " + p);
        }
        return p;
    }

    private Path resolveUpload(final String source) throws IOException {
        final Path p = uploadRoot.resolve(source).toAbsolutePath().normalize();
        if (!p.startsWith(uploadRoot)) {
            throw new IOException("upload path escapes der.backup.upload.root");
        }
        if (!Files.isRegularFile(p)) {
            throw new IOException("uploaded archive not found: " + p);
        }
        return p;
    }

    private String jdbcToPgArg() {
        if (databaseUrl == null || !databaseUrl.startsWith("jdbc:postgresql://")) {
            return databaseUrl == null ? "" : databaseUrl;
        }
        return databaseUrl.substring("jdbc:".length());
    }
}
