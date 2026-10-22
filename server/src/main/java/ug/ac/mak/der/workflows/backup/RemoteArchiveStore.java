package ug.ac.mak.der.workflows.backup;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * S3-compatible archive push/pull.
 *
 * <p>Rather than pull the full AWS SDK as a mandatory dependency, this
 * implementation uses plain HTTP PUT / GET so any S3-compatible endpoint
 * answered via a pre-signed URL or basic HTTP works. Operators who want full
 * SDK signing can override this bean in a profile. ADR-0012.</p>
 */
@Component
public class RemoteArchiveStore {

    private static final Logger LOG = LoggerFactory.getLogger(RemoteArchiveStore.class);

    private final HttpClient http;
    private final String remoteBaseUrl;
    private final String remoteBearer;
    private final long timeoutSeconds;

    public RemoteArchiveStore(
            @Value("${der.backup.remote.url:}") final String remoteBaseUrl,
            @Value("${der.backup.remote.bearer:}") final String remoteBearer,
            @Value("${der.backup.remote.timeout-seconds:300}") final long timeoutSeconds) {
        this.remoteBaseUrl = remoteBaseUrl == null ? "" : remoteBaseUrl;
        this.remoteBearer = remoteBearer == null ? "" : remoteBearer;
        this.timeoutSeconds = Math.max(10, timeoutSeconds);
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isConfigured() {
        return !remoteBaseUrl.isBlank();
    }

    /** Uploads the archive. Returns the remote key (filename) or null when
     *  no remote endpoint is configured. */
    public String upload(final Path archive) throws IOException {
        if (!isConfigured()) {
            return null;
        }
        final String key = archive.getFileName().toString();
        final URI uri = URI.create(remoteBaseUrl.endsWith("/")
                ? remoteBaseUrl + key : remoteBaseUrl + "/" + key);
        final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/octet-stream")
                .PUT(HttpRequest.BodyPublishers.ofFile(archive));
        if (!remoteBearer.isBlank()) {
            req.header("Authorization", "Bearer " + remoteBearer);
        }
        try {
            final HttpResponse<Void> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.discarding());
            if (resp.statusCode() / 100 != 2) {
                throw new IOException("remote upload returned HTTP " + resp.statusCode());
            }
            LOG.info("remote upload {} ok ({} bytes)", key, Files.size(archive));
            return key;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted uploading " + key, ex);
        }
    }

    /** Downloads the key into the target path. */
    public void download(final String key, final Path target) throws IOException {
        if (!isConfigured()) {
            throw new IOException("der.backup.remote.url is not configured");
        }
        final URI uri = URI.create(remoteBaseUrl.endsWith("/")
                ? remoteBaseUrl + key : remoteBaseUrl + "/" + key);
        final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .GET();
        if (!remoteBearer.isBlank()) {
            req.header("Authorization", "Bearer " + remoteBearer);
        }
        try {
            final HttpResponse<Path> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofFile(target));
            if (resp.statusCode() / 100 != 2) {
                throw new IOException("remote download returned HTTP " + resp.statusCode());
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted downloading " + key, ex);
        }
    }
}
