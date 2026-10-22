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
 * ADR-0021 D-BAK-1. Wraps the archive in a CMS envelope keyed to a
 * recipient certificate before S3 upload. Decryption happens off-box
 * with the matching private key — the server never holds it.
 *
 * <p>Command: {@code openssl smime -encrypt -binary -aes-256-cbc
 * -outform DER -in <archive> -out <archive>.p7 <recipient-cert>}.</p>
 */
@Component
public class RemoteArchiveEncryption {

    private static final Logger LOG = LoggerFactory.getLogger(RemoteArchiveEncryption.class);
    public static final String REMOTE_SUFFIX = ".p7";
    private static final long MAX_CERT_BYTES = 32_768L;

    private final boolean enabled;
    private final String opensslBinary;
    private final Path recipientCert;
    private final long timeoutSeconds;

    public RemoteArchiveEncryption(
            @Value("${der.backup.remote.encrypt:false}") final boolean enabled,
            @Value("${der.backup.remote.encrypt.openssl:openssl}") final String opensslBinary,
            @Value("${der.backup.remote.encrypt.recipient:}") final String recipientCert,
            @Value("${der.backup.remote.encrypt.timeout-seconds:300}") final long timeoutSeconds) {
        this.enabled = enabled;
        this.opensslBinary = opensslBinary;
        this.recipientCert = recipientCert == null || recipientCert.isBlank()
                ? null : Paths.get(recipientCert).toAbsolutePath().normalize();
        this.timeoutSeconds = Math.max(10, timeoutSeconds);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isConfigured() {
        return enabled && recipientCert != null;
    }

    /**
     * Validates the recipient certificate is present + bounded. Throws
     * IOException with a precise message so the Quartz job can log
     * actionable text and the backup run fail cleanly.
     */
    public void verifyRecipientAvailable() throws IOException {
        if (!enabled) {
            return;
        }
        if (recipientCert == null) {
            throw new IOException(
                    "der.backup.remote.encrypt=true but der.backup.remote.encrypt.recipient is unset");
        }
        if (!Files.isReadable(recipientCert)) {
            throw new IOException("remote-wrap recipient cert missing or unreadable: " + recipientCert);
        }
        if (Files.size(recipientCert) > MAX_CERT_BYTES) {
            throw new IOException("remote-wrap recipient cert is larger than "
                    + MAX_CERT_BYTES + " bytes (" + recipientCert + ")");
        }
    }

    /**
     * Encrypts {@code plaintext} to a sibling {@code *.p7} file and
     * deletes the plaintext. Returns the ciphertext path. When
     * encryption is disabled, returns {@code plaintext} unchanged.
     */
    public Path wrapForRemote(final Path plaintext) throws IOException {
        Objects.requireNonNull(plaintext, "plaintext");
        if (!enabled) {
            return plaintext;
        }
        verifyRecipientAvailable();
        final Path ciphertext = plaintext.resolveSibling(
                plaintext.getFileName().toString() + REMOTE_SUFFIX);
        runOpenssl(new String[] {
                opensslBinary, "smime", "-encrypt", "-binary", "-aes-256-cbc",
                "-outform", "DER",
                "-in", plaintext.toString(),
                "-out", ciphertext.toString(),
                recipientCert.toString(),
        });
        Files.deleteIfExists(plaintext);
        LOG.info("remote-wrapped archive {} -> {}",
                plaintext.getFileName(), ciphertext.getFileName());
        return ciphertext;
    }

    private void runOpenssl(final String[] cmd) throws IOException {
        try {
            final Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new IOException("openssl smime timed out after " + timeoutSeconds + "s");
            }
            if (p.exitValue() != 0) {
                final String out = new String(p.getInputStream().readAllBytes(),
                        java.nio.charset.StandardCharsets.UTF_8);
                throw new IOException("openssl smime exit " + p.exitValue() + ": " + out.strip());
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted during openssl smime", ex);
        }
    }
}
