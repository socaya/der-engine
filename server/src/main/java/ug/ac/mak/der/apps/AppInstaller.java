package ug.ac.mak.der.apps;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Installs a DHIS2 custom-app .zip bundle under
 * {@code ~/.der/apps/<app-key>/<version>/}.
 *
 * <p>ADR-0005: strict manifest validation + path-traversal rejection + bundle
 * size cap. The caller is expected to have ADMIN role (enforced by the
 * controller).</p>
 */
@Service
public class AppInstaller {

    private static final Logger LOG = LoggerFactory.getLogger(AppInstaller.class);
    private static final long DEFAULT_MAX_BUNDLE_BYTES = 50L * 1024L * 1024L;

    private final Path appsRoot;
    private final long maxBundleBytes;
    private final InstalledAppRepository repository;
    private final ObjectMapper mapper;

    public AppInstaller(final InstalledAppRepository repository,
                         final ObjectMapper mapper,
                         @Value("${der.apps.root:${user.home}/.der/apps}") final String rootPath,
                         @Value("${der.apps.max-bundle-bytes:52428800}") final long maxBundleBytes) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.appsRoot = Paths.get(rootPath).toAbsolutePath().normalize();
        this.maxBundleBytes = maxBundleBytes <= 0 ? DEFAULT_MAX_BUNDLE_BYTES : maxBundleBytes;
    }

    public Path appsRoot() {
        return appsRoot;
    }

    public InstalledApp install(final byte[] zipBytes, final UUID installedBy) throws IOException {
        if (zipBytes == null || zipBytes.length == 0) {
            throw new AppInstallException("zip bundle is empty");
        }
        if (zipBytes.length > maxBundleBytes) {
            throw new AppInstallException("bundle exceeds max size "
                    + maxBundleBytes + " bytes");
        }
        final Path staging = Files.createTempDirectory("der-app-");
        try (InputStream in = new BufferedInputStream(new ByteArrayInputStream(zipBytes));
             ZipInputStream zip = new ZipInputStream(in)) {
            extractInto(zip, staging);
        }
        final Path manifestFile = staging.resolve("manifest.webapp");
        if (!Files.isRegularFile(manifestFile)) {
            cleanup(staging);
            throw new AppInstallException("bundle missing manifest.webapp at root");
        }
        final JsonNode manifest = mapper.readTree(Files.readAllBytes(manifestFile));
        if (!manifest.has("name") || !manifest.has("version")) {
            cleanup(staging);
            throw new AppInstallException("manifest.webapp missing required name/version");
        }
        final String name = manifest.get("name").asText();
        final String version = manifest.get("version").asText();
        final String appKey = toAppKey(name);
        final Path target = appsRoot.resolve(appKey).resolve(version);
        Files.createDirectories(target.getParent());
        if (Files.exists(target)) {
            cleanup(staging);
            throw new AppInstallException(
                    "app " + appKey + " version " + version + " already installed");
        }
        Files.move(staging, target);
        final InstalledApp app = new InstalledApp(UUID.randomUUID(), appKey, version,
                manifest.has("displayName") ? manifest.get("displayName").asText() : name,
                mapper.writeValueAsString(manifest),
                target.toString(), installedBy, Instant.now(), true);
        return repository.insert(app);
    }

    public void uninstall(final InstalledApp app) throws IOException {
        if (app == null) {
            return;
        }
        final Path path = Paths.get(app.installPath());
        if (!path.toAbsolutePath().normalize().startsWith(appsRoot)) {
            throw new AppInstallException("install path escapes apps root");
        }
        if (Files.exists(path)) {
            deleteRecursive(path);
        }
        repository.delete(app.appId());
    }

    private void extractInto(final ZipInputStream zip, final Path root) throws IOException {
        ZipEntry entry;
        while ((entry = zip.getNextEntry()) != null) {
            final Path dest = root.resolve(entry.getName()).toAbsolutePath().normalize();
            if (!dest.startsWith(root.toAbsolutePath().normalize())) {
                throw new AppInstallException("zip entry escapes bundle root: " + entry.getName());
            }
            if (entry.isDirectory()) {
                Files.createDirectories(dest);
            } else {
                Files.createDirectories(dest.getParent());
                Files.copy(zip, dest);
            }
            zip.closeEntry();
        }
    }

    private static String toAppKey(final String name) {
        return name.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "").replaceAll("-+$", "");
    }

    private static void cleanup(final Path path) {
        try {
            if (Files.exists(path)) {
                deleteRecursive(path);
            }
        } catch (IOException ex) {
            LOG.warn("cleanup failed for {}: {}", path, ex.getMessage());
        }
    }

    private static void deleteRecursive(final Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (java.util.stream.Stream<Path> walk = Files.walk(path)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ex) {
                    LOG.warn("deleteIfExists failed for {}: {}", p, ex.getMessage());
                }
            });
        }
    }

    public static final class AppInstallException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public AppInstallException(final String message) {
            super(message);
        }
    }
}
