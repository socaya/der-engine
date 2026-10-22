package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RemoteArchiveStoreTest {

    @Test
    void unconfiguredReturnsNullOnUpload(@TempDir final Path dir) throws IOException {
        final Path archive = dir.resolve("a.dump");
        Files.writeString(archive, "x");
        final RemoteArchiveStore store = new RemoteArchiveStore("", "", 10);
        assertThat(store.isConfigured()).isFalse();
        assertThat(store.upload(archive)).isNull();
    }

    @Test
    void unconfiguredDownloadThrows(@TempDir final Path dir) {
        final RemoteArchiveStore store = new RemoteArchiveStore("", "", 10);
        assertThatThrownBy(() -> store.download("k", dir.resolve("t.dump")))
                .isInstanceOf(IOException.class);
    }

    @Test
    void uploadAndDownloadRoundTrip(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        final AtomicReference<String> body = new AtomicReference<>();
        final AtomicReference<String> auth = new AtomicReference<>();
        server.createContext("/", exchange -> {
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            if ("PUT".equals(exchange.getRequestMethod())) {
                body.set(new String(exchange.getRequestBody().readAllBytes(),
                        StandardCharsets.UTF_8));
                exchange.sendResponseHeaders(204, -1);
            } else {
                final byte[] out = "payload".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, out.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(out);
                }
            }
        });
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort();
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "secret", 10);
            final Path src = dir.resolve("a.dump");
            Files.writeString(src, "hello");
            assertThat(store.upload(src)).isEqualTo("a.dump");
            assertThat(body.get()).isEqualTo("hello");
            assertThat(auth.get()).isEqualTo("Bearer secret");

            final Path target = dir.resolve("got.dump");
            store.download("a.dump", target);
            assertThat(Files.readString(target)).isEqualTo("payload");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void uploadNon2xxThrows(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> exchange.sendResponseHeaders(500, -1));
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            final Path src = dir.resolve("a.dump");
            Files.writeString(src, "x");
            assertThatThrownBy(() -> store.upload(src)).isInstanceOf(IOException.class);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void uploadWithTrailingSlashBaseUrl(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(204, -1);
        });
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            final Path src = dir.resolve("a.dump");
            Files.writeString(src, "x");
            // Trailing-slash branch: endsWith('/') true path.
            assertThat(store.upload(src)).isEqualTo("a.dump");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void uploadWrapsInterruption(@TempDir final Path dir) throws IOException {
        // Use a server that never responds; then interrupt the current thread so
        // HttpClient.send bails with InterruptedException. The store wraps it as IOException.
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try { Thread.sleep(5000); } catch (InterruptedException ignored) { /* exit */ }
            exchange.sendResponseHeaders(204, -1);
        });
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort();
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            final Path src = dir.resolve("a.dump");
            Files.writeString(src, "x");
            Thread.currentThread().interrupt();
            try {
                assertThatThrownBy(() -> store.upload(src))
                        .isInstanceOf(IOException.class)
                        .hasMessageContaining("interrupted");
            } finally {
                Thread.interrupted();  // clear the flag
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void downloadWrapsInterruption(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try { Thread.sleep(5000); } catch (InterruptedException ignored) { /* exit */ }
            exchange.sendResponseHeaders(200, -1);
        });
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort();
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            Thread.currentThread().interrupt();
            try {
                assertThatThrownBy(() -> store.download("x.dump", dir.resolve("t.dump")))
                        .isInstanceOf(IOException.class)
                        .hasMessageContaining("interrupted");
            } finally {
                Thread.interrupted();
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void downloadWithTrailingSlashBaseUrl(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            final byte[] out = "DATA".getBytes();
            exchange.sendResponseHeaders(200, out.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(out); }
        });
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            store.download("k.dump", dir.resolve("got.dump"));
            assertThat(Files.readString(dir.resolve("got.dump"))).isEqualTo("DATA");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void nullBaseUrlAndBearerDefaultEmpty(@TempDir final Path dir) throws IOException {
        // Explicit null values exercise the two ternary branches in the constructor.
        final RemoteArchiveStore store = new RemoteArchiveStore(null, null, 10);
        assertThat(store.isConfigured()).isFalse();
        final Path src = dir.resolve("a.dump");
        Files.writeString(src, "x");
        assertThat(store.upload(src)).isNull();
    }

    @Test
    void downloadNon2xxThrows(@TempDir final Path dir) throws IOException {
        final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> exchange.sendResponseHeaders(404, -1));
        server.start();
        try {
            final String base = "http://127.0.0.1:" + server.getAddress().getPort();
            final RemoteArchiveStore store = new RemoteArchiveStore(base, "", 10);
            assertThatThrownBy(() -> store.download("x.dump", dir.resolve("t.dump")))
                    .isInstanceOf(IOException.class);
        } finally {
            server.stop(0);
        }
    }
}
