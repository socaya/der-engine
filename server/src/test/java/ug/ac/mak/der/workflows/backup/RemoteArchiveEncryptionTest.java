package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RemoteArchiveEncryptionTest {

    @Test
    void disabledIsNotConfigured() {
        assertThat(new RemoteArchiveEncryption(false, "openssl", "", 60).isConfigured()).isFalse();
    }

    @Test
    void enabledWithoutRecipientIsNotConfigured() {
        assertThat(new RemoteArchiveEncryption(true, "openssl", "", 60).isConfigured()).isFalse();
    }

    @Test
    void enabledWithRecipientIsConfigured(@TempDir final Path dir) throws IOException {
        final Path cert = dir.resolve("recipient.pem");
        Files.writeString(cert, "-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n");
        assertThat(new RemoteArchiveEncryption(true, "openssl", cert.toString(), 60).isConfigured())
                .isTrue();
    }

    @Test
    void wrapNoOpWhenDisabled(@TempDir final Path dir) throws IOException {
        final Path f = dir.resolve("archive.dump");
        Files.writeString(f, "data");
        final Path out = new RemoteArchiveEncryption(false, "openssl", "", 60).wrapForRemote(f);
        assertThat(out).isEqualTo(f);
    }

    @Test
    void verifyRejectsEnabledWithoutRecipient() {
        assertThatThrownBy(() ->
                new RemoteArchiveEncryption(true, "openssl", "", 60).verifyRecipientAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("recipient is unset");
    }

    @Test
    void verifyRejectsMissingRecipient(@TempDir final Path dir) {
        final Path missing = dir.resolve("absent.pem");
        assertThatThrownBy(() ->
                new RemoteArchiveEncryption(true, "openssl", missing.toString(), 60)
                        .verifyRecipientAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("missing or unreadable");
    }

    @Test
    void verifyRejectsOversizeRecipient(@TempDir final Path dir) throws IOException {
        final Path cert = dir.resolve("huge.pem");
        Files.writeString(cert, "x".repeat(40_000));
        assertThatThrownBy(() ->
                new RemoteArchiveEncryption(true, "openssl", cert.toString(), 60)
                        .verifyRecipientAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("larger than");
    }

    @Test
    void wrapRunsOpensslSuccessfully(@TempDir final Path dir) throws IOException {
        // Install a fake openssl shim that just writes a sentinel to the output
        // path and exits 0 — matches the BackupEncryption test fixture pattern.
        final Path openssl = dir.resolve("fake-openssl.sh");
        Files.writeString(openssl,
                "#!/bin/sh\nfor a in \"$@\"; do case \"$a\" in -out) OUT=1; continue;; esac;"
                        + " if [ \"${OUT:-0}\" = \"1\" ]; then echo CMS > \"$a\"; OUT=0; fi; done\n");
        openssl.toFile().setExecutable(true);
        final Path cert = dir.resolve("recipient.pem");
        Files.writeString(cert, "cert");
        final Path archive = dir.resolve("archive.dump");
        Files.writeString(archive, "plain");
        final Path out = new RemoteArchiveEncryption(true, openssl.toString(),
                cert.toString(), 60).wrapForRemote(archive);
        assertThat(out.getFileName().toString()).endsWith(".p7");
        assertThat(Files.readString(out)).startsWith("CMS");
        assertThat(Files.exists(archive)).isFalse();
    }

    @Test
    void wrapFailsWhenOpensslExitsNonZero(@TempDir final Path dir) throws IOException {
        final Path openssl = dir.resolve("fail-openssl.sh");
        Files.writeString(openssl, "#!/bin/sh\necho err >&2\nexit 2\n");
        openssl.toFile().setExecutable(true);
        final Path cert = dir.resolve("recipient.pem");
        Files.writeString(cert, "cert");
        final Path archive = dir.resolve("archive.dump");
        Files.writeString(archive, "plain");
        assertThatThrownBy(() ->
                new RemoteArchiveEncryption(true, openssl.toString(), cert.toString(), 60)
                        .wrapForRemote(archive))
                .isInstanceOf(IOException.class).hasMessageContaining("exit 2");
    }
}
