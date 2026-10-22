package ug.ac.mak.der.workflows.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Runs `pg_dump` for pending {@link BackupRun} rows and optionally uploads
 * the archive to an S3-compatible endpoint. ADR-0012.
 */
@Service
public class BackupWorker {

    private static final Logger LOG = LoggerFactory.getLogger(BackupWorker.class);
    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    private final BackupRepository repo;
    private final Path localRoot;
    private final String pgDumpBinary;
    private final String databaseUrl;
    private final String databaseUser;
    private final String databasePassword;
    private final RemoteArchiveStore remote;
    private final BackupEncryption encryption;
    private final boolean enabled;
    private final int maxArchives;
    private final long perRunTimeoutSeconds;

    public BackupWorker(final BackupRepository repo,
                         final RemoteArchiveStore remote,
                         final BackupEncryption encryption,
                         @Value("${der.backup.local.root:${user.home}/.der/backups}")
                         final String rootPath,
                         @Value("${der.backup.pg-dump:pg_dump}") final String pgDumpBinary,
                         @Value("${spring.datasource.url}") final String databaseUrl,
                         @Value("${spring.datasource.username}") final String databaseUser,
                         @Value("${spring.datasource.password}") final String databasePassword,
                         @Value("${der.backup.enabled:true}") final boolean enabled,
                         @Value("${der.backup.local.max-archives:50}") final int maxArchives,
                         @Value("${der.backup.timeout-seconds:900}")
                         final long perRunTimeoutSeconds) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.remote = Objects.requireNonNull(remote, "remote");
        this.encryption = Objects.requireNonNull(encryption, "encryption");
        this.localRoot = Paths.get(rootPath).toAbsolutePath().normalize();
        this.pgDumpBinary = pgDumpBinary;
        this.databaseUrl = databaseUrl;
        this.databaseUser = databaseUser;
        this.databasePassword = databasePassword == null ? "" : databasePassword;
        this.enabled = enabled;
        this.maxArchives = Math.max(1, maxArchives);
        this.perRunTimeoutSeconds = Math.max(60, perRunTimeoutSeconds);
    }

    public Path localRoot() {
        return localRoot;
    }

    /** Picks all REQUESTED rows and runs them. Invoked by the Quartz BackupJob. */
    public int drain() {
        if (!enabled) {
            LOG.debug("backup worker disabled; skipping drain");
            return 0;
        }
        final List<BackupRun> pending = repo.findByStatus(BackupRun.Status.REQUESTED, 10);
        int done = 0;
        for (final BackupRun run : pending) {
            runOne(run);
            done++;
        }
        pruneLocal();
        return done;
    }

    private void runOne(final BackupRun run) {
        final String version = detectVersion();
        repo.markStarted(run.runId(), version);
        try {
            Files.createDirectories(localRoot);
            final String fileName = TIMESTAMP.format(Instant.now().atOffset(java.time.ZoneOffset.UTC))
                    + "-" + run.kind().name().toLowerCase(java.util.Locale.ROOT) + ".dump";
            final Path archive = localRoot.resolve(fileName);
            final ProcessBuilder pb = new ProcessBuilder(
                    pgDumpBinary, "--format=custom", "--no-owner", "--no-privileges",
                    "--file=" + archive.toString(), jdbcToPgArg())
                    .redirectErrorStream(true);
            if (databaseUser != null && !databaseUser.isBlank()) {
                pb.environment().put("PGUSER", databaseUser);
                pb.environment().put("PGPASSWORD", databasePassword);
            }
            final Process process = pb.start();
            if (!process.waitFor(perRunTimeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IOException("pg_dump timed out after "
                        + perRunTimeoutSeconds + "s");
            }
            if (process.exitValue() != 0) {
                final String out = new String(process.getInputStream().readAllBytes(),
                        java.nio.charset.StandardCharsets.UTF_8);
                throw new IOException("pg_dump exit "
                        + process.exitValue() + ": " + out.strip());
            }
            final Path finalArchive = encryption.encrypt(archive);
            final long bytes = Files.size(finalArchive);
            final String remoteKey = remote.upload(finalArchive);
            repo.markSuccess(run.runId(), finalArchive.toString(), bytes, remoteKey);
            LOG.info("backup run {} completed, {} bytes, encrypted={}, remote={}",
                    run.runId(), bytes, encryption.isEnabled(),
                    remoteKey == null ? "n/a" : remoteKey);
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            LOG.warn("backup run {} failed: {}", run.runId(), ex.getMessage());
            repo.markFailed(run.runId(), ex.getMessage());
        }
    }

    String jdbcToPgArg() {
        if (databaseUrl == null || !databaseUrl.startsWith("jdbc:postgresql://")) {
            return databaseUrl == null ? "" : databaseUrl;
        }
        return databaseUrl.substring("jdbc:".length());
    }

    private String detectVersion() {
        try {
            final Process p = new ProcessBuilder(pgDumpBinary, "--version").start();
            if (!p.waitFor(10, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return "unknown";
            }
            return new String(p.getInputStream().readAllBytes(),
                    java.nio.charset.StandardCharsets.UTF_8).strip();
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return "unknown";
        }
    }

    private void pruneLocal() {
        try (java.util.stream.Stream<Path> walk = Files.list(localRoot)) {
            final List<Path> archives = walk
                    .filter(p -> p.getFileName().toString().endsWith(".dump"))
                    .sorted(java.util.Comparator.comparing(p -> p.getFileName().toString()))
                    .toList();
            final int excess = archives.size() - maxArchives;
            for (int i = 0; i < excess; i++) {
                try {
                    Files.deleteIfExists(archives.get(i));
                } catch (IOException ex) {
                    LOG.warn("could not prune {}: {}", archives.get(i), ex.getMessage());
                }
            }
        } catch (IOException ex) {
            LOG.warn("prune list failed: {}", ex.getMessage());
        }
    }
}
