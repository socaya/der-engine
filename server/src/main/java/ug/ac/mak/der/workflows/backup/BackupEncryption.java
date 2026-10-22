package ug.ac.mak.der.workflows.backup;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * ADR-0017 D12: wraps / unwraps backup archives with
 * {@code openssl enc -aes-256-cbc -pbkdf2}. Key material lives in a
 * 0400 keyfile on disk — the server never generates or rotates it.
 */
@Component
public class BackupEncryption {

    private static final Logger LOG = LoggerFactory.getLogger(BackupEncryption.class);
    private static final long MAX_KEY_BYTES = 4096L;
    public static final String ENCRYPTED_SUFFIX = ".enc";

    private final boolean enabled;
    private final String opensslBinary;
    private final Path keyFile;
    private final long timeoutSeconds;

    public BackupEncryption(
            @Value("${der.backup.encryption.enabled:false}") final boolean enabled,
            @Value("${der.backup.encryption.openssl:openssl}") final String opensslBinary,
            @Value("${der.backup.encryption.key-file:}") final String keyFile,
            @Value("${der.backup.encryption.timeout-seconds:300}") final long timeoutSeconds) {
        this.enabled = enabled;
        this.opensslBinary = opensslBinary;
        this.keyFile = keyFile == null || keyFile.isBlank()
                ? null : Paths.get(keyFile).toAbsolutePath().normalize();
        this.timeoutSeconds = Math.max(10, timeoutSeconds);
    }

    public boolean isConfigured() {
        return enabled && keyFile != null;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * @throws IOException when enabled but the keyfile is missing /
     *     unreadable / too large.
     */
    public void verifyKeyAvailable() throws IOException {
        if (!enabled) {
            return;
        }
        if (keyFile == null) {
            throw new IOException(
                    "der.backup.encryption.enabled=true but der.backup.encryption.key-file is unset");
        }
        if (!Files.isReadable(keyFile)) {
            throw new IOException("backup encryption key file is missing or unreadable: " + keyFile);
        }
        if (Files.size(keyFile) > MAX_KEY_BYTES) {
            throw new IOException("backup encryption key file is larger than "
                    + MAX_KEY_BYTES + " bytes (" + keyFile + ")");
        }
    }

    /**
     * Encrypts {@code plaintext} in place: writes {@code plaintext + .enc},
     * deletes the plaintext file, and returns the ciphertext path.
     * Returns {@code plaintext} unchanged when encryption is disabled.
     */
    public Path encrypt(final Path plaintext) throws IOException {
        Objects.requireNonNull(plaintext, "plaintext");
        if (!enabled) {
            return plaintext;
        }
        verifyKeyAvailable();
        final Path ciphertext = plaintext.resolveSibling(
                plaintext.getFileName().toString() + ENCRYPTED_SUFFIX);
        runOpenssl(new String[] {
                opensslBinary, "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
                "-in", plaintext.toString(),
                "-out", ciphertext.toString(),
                "-pass", "file:" + keyFile.toString(),
        });
        Files.deleteIfExists(plaintext);
        LOG.info("encrypted archive {} -> {}", plaintext.getFileName(), ciphertext.getFileName());
        return ciphertext;
    }

    /**
     * Decrypts {@code ciphertext} to a sibling file (stripping the
     * {@code .enc} suffix). Returns the plaintext path. Returns
     * {@code ciphertext} unchanged when it does not end in {@code .enc}.
     */
    public Path decrypt(final Path ciphertext) throws IOException {
        Objects.requireNonNull(ciphertext, "ciphertext");
        final String name = ciphertext.getFileName().toString();
        if (!name.endsWith(ENCRYPTED_SUFFIX)) {
            return ciphertext;
        }
        verifyKeyAvailable();
        if (keyFile == null) {
            throw new IOException(
                    "cannot decrypt " + name + ": der.backup.encryption.key-file is unset");
        }
        final Path plaintext = ciphertext.resolveSibling(
                name.substring(0, name.length() - ENCRYPTED_SUFFIX.length()));
        runOpenssl(new String[] {
                opensslBinary, "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                "-in", ciphertext.toString(),
                "-out", plaintext.toString(),
                "-pass", "file:" + keyFile.toString(),
        });
        LOG.info("decrypted archive {} -> {}", name, plaintext.getFileName());
        return plaintext;
    }

    private void runOpenssl(final String[] cmd) throws IOException {
        try {
            final Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new IOException("openssl timed out after " + timeoutSeconds + "s");
            }
            if (p.exitValue() != 0) {
                final String out = new String(p.getInputStream().readAllBytes(),
                        java.nio.charset.StandardCharsets.UTF_8);
                throw new IOException("openssl exit " + p.exitValue() + ": " + out.strip());
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted during openssl invocation", ex);
        }
    }
}
