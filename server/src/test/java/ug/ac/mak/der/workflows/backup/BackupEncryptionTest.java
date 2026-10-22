package ug.ac.mak.der.workflows.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupEncryptionTest {

    @Test
    void disabledIsNotConfigured() {
        assertThat(new BackupEncryption(false, "openssl", "", 60).isConfigured()).isFalse();
    }

    @Test
    void enabledWithoutKeyFileIsNotConfigured() {
        assertThat(new BackupEncryption(true, "openssl", "", 60).isConfigured()).isFalse();
    }

    @Test
    void enabledWithKeyFileIsConfigured(@TempDir final Path dir) throws IOException {
        final Path key = dir.resolve("backup.key");
        Files.writeString(key, "mykey");
        assertThat(new BackupEncryption(true, "openssl", key.toString(), 60).isConfigured()).isTrue();
    }

    @Test
    void encryptNoOpWhenDisabled(@TempDir final Path dir) throws IOException {
        final Path f = dir.resolve("a.dump");
        Files.writeString(f, "x");
        final Path out = new BackupEncryption(false, "openssl", "", 60).encrypt(f);
        assertThat(out).isEqualTo(f);
    }

    @Test
    void decryptPassThroughForUnencryptedPath(@TempDir final Path dir) throws IOException {
        final Path f = dir.resolve("plain.dump");
        Files.writeString(f, "x");
        final Path out = new BackupEncryption(false, "openssl", "", 60).decrypt(f);
        assertThat(out).isEqualTo(f);
    }

    @Test
    void verifyRejectsEnabledWithoutKey() {
        assertThatThrownBy(() -> new BackupEncryption(true, "openssl", "", 60).verifyKeyAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("key-file is unset");
    }

    @Test
    void verifyRejectsMissingKeyFile(@TempDir final Path dir) {
        final Path missing = dir.resolve("absent.key");
        assertThatThrownBy(() ->
                new BackupEncryption(true, "openssl", missing.toString(), 60).verifyKeyAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("missing or unreadable");
    }

    @Test
    void verifyRejectsOversizedKeyFile(@TempDir final Path dir) throws IOException {
        final Path big = dir.resolve("big.key");
        Files.write(big, new byte[8192]);
        assertThatThrownBy(() ->
                new BackupEncryption(true, "openssl", big.toString(), 60).verifyKeyAvailable())
                .isInstanceOf(IOException.class).hasMessageContaining("larger than");
    }

    @Test
    void disabledVerifyIsNoOp() throws IOException {
        new BackupEncryption(false, "openssl", "", 60).verifyKeyAvailable();
        // no throw
    }

    @Test
    void encryptAndDecryptRoundTripWithFakeOpenssl(@TempDir final Path dir) throws IOException {
        // Fake openssl: when encrypting (no -d flag), copies -in to -out. When
        // decrypting (-d), does the same thing. Lets us verify the pipeline
        // mechanics without doing real crypto.
        final Path binDir = dir.resolve("bin");
        Files.createDirectories(binDir);
        final Path binary = binDir.resolve("fake-openssl.sh");
        Files.writeString(binary, "#!/bin/sh\n"
                + "while [ \"$#\" -gt 0 ]; do\n"
                + "  case \"$1\" in\n"
                + "    -in) IN=\"$2\"; shift 2 ;;\n"
                + "    -out) OUT=\"$2\"; shift 2 ;;\n"
                + "    *) shift ;;\n"
                + "  esac\n"
                + "done\n"
                + "cp \"$IN\" \"$OUT\"\n");
        binary.toFile().setExecutable(true);
        final Path key = dir.resolve("backup.key");
        Files.writeString(key, "k");
        final BackupEncryption enc = new BackupEncryption(true,
                binary.toString(), key.toString(), 60);

        final Path plain = dir.resolve("x.dump");
        Files.writeString(plain, "payload");
        final Path cipher = enc.encrypt(plain);
        assertThat(cipher.getFileName().toString()).isEqualTo("x.dump.enc");
        assertThat(Files.exists(plain)).isFalse();

        final Path recovered = enc.decrypt(cipher);
        assertThat(recovered.getFileName().toString()).isEqualTo("x.dump");
        assertThat(Files.readString(recovered)).isEqualTo("payload");
    }

    @Test
    void decryptFailsWhenEnabledButNoKey(@TempDir final Path dir) throws IOException {
        final Path f = dir.resolve("x.dump.enc");
        Files.writeString(f, "x");
        assertThatThrownBy(() ->
                new BackupEncryption(true, "openssl", "", 60).decrypt(f))
                .isInstanceOf(IOException.class);
    }

    @Test
    void opensslFailureWraps(@TempDir final Path dir) throws IOException {
        final Path binDir = dir.resolve("bin");
        Files.createDirectories(binDir);
        final Path binary = binDir.resolve("fail-openssl.sh");
        Files.writeString(binary, "#!/bin/sh\necho boom >&2\nexit 2\n");
        binary.toFile().setExecutable(true);
        final Path key = dir.resolve("backup.key");
        Files.writeString(key, "k");
        final BackupEncryption enc = new BackupEncryption(true,
                binary.toString(), key.toString(), 60);
        final Path plain = dir.resolve("x.dump");
        Files.writeString(plain, "payload");
        assertThatThrownBy(() -> enc.encrypt(plain))
                .isInstanceOf(IOException.class).hasMessageContaining("openssl exit");
    }
}
