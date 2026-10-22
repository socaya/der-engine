package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AppInstallerTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private byte[] goodZip(final String name, final String version) throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(baos)) {
            zip.putNextEntry(new ZipEntry("manifest.webapp"));
            zip.write(("{\"name\":\"" + name + "\",\"version\":\"" + version + "\","
                    + "\"displayName\":\"Sample\"}").getBytes());
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("index.html"));
            zip.write("<!doctype html><html></html>".getBytes());
            zip.closeEntry();
            zip.finish();
            return baos.toByteArray();
        }
    }

    private byte[] zipWithTraversal() throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(baos)) {
            zip.putNextEntry(new ZipEntry("../evil.html"));
            zip.write("x".getBytes());
            zip.closeEntry();
            zip.finish();
            return baos.toByteArray();
        }
    }

    private byte[] zipMissingManifest() throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(baos)) {
            zip.putNextEntry(new ZipEntry("index.html"));
            zip.write("x".getBytes());
            zip.closeEntry();
            zip.finish();
            return baos.toByteArray();
        }
    }

    private byte[] zipBadManifest() throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(baos)) {
            zip.putNextEntry(new ZipEntry("manifest.webapp"));
            zip.write("{\"displayName\":\"Sample\"}".getBytes());
            zip.closeEntry();
            zip.finish();
            return baos.toByteArray();
        }
    }

    private AppInstaller newInstaller(final Path root, final long maxBytes,
                                        final InstalledAppRepository repo) {
        return new AppInstaller(repo, mapper, root.toString(), maxBytes);
    }

    @Test
    void installsValidZip(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L, repo);
        final InstalledApp app = installer.install(goodZip("eRegister", "1.0.0"), UUID.randomUUID());
        assertThat(app.appKey()).isEqualTo("eregister");
        assertThat(app.version()).isEqualTo("1.0.0");
        assertThat(app.displayName()).isEqualTo("Sample");
        assertThat(Files.exists(Path.of(app.installPath(), "manifest.webapp"))).isTrue();
    }

    @Test
    void rejectsEmptyBundle(@org.junit.jupiter.api.io.TempDir final Path tmp) {
        final AppInstaller installer = newInstaller(tmp, 100L, mock(InstalledAppRepository.class));
        assertThatThrownBy(() -> installer.install(new byte[0], UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
        assertThatThrownBy(() -> installer.install(null, UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void rejectsOversize(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final AppInstaller installer = newInstaller(tmp, 10L, mock(InstalledAppRepository.class));
        assertThatThrownBy(() -> installer.install(goodZip("X", "1"), UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class)
                .hasMessageContaining("max size");
    }

    @Test
    void rejectsPathTraversal(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L,
                mock(InstalledAppRepository.class));
        assertThatThrownBy(() -> installer.install(zipWithTraversal(), UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void rejectsMissingManifest(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L,
                mock(InstalledAppRepository.class));
        assertThatThrownBy(() -> installer.install(zipMissingManifest(), UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void rejectsManifestMissingNameOrVersion(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L,
                mock(InstalledAppRepository.class));
        assertThatThrownBy(() -> installer.install(zipBadManifest(), UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void rejectsDuplicateInstall(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L, repo);
        installer.install(goodZip("E", "1"), UUID.randomUUID());
        assertThatThrownBy(() -> installer.install(goodZip("E", "1"), UUID.randomUUID()))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void uninstallRemovesFiles(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        final InstalledAppRepository repo = mock(InstalledAppRepository.class);
        when(repo.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        final AppInstaller installer = newInstaller(tmp, 50 * 1024 * 1024L, repo);
        final InstalledApp app = installer.install(goodZip("E", "1"), UUID.randomUUID());
        installer.uninstall(app);
        assertThat(Files.exists(Path.of(app.installPath()))).isFalse();
    }

    @Test
    void uninstallNullIsNoop(@org.junit.jupiter.api.io.TempDir final Path tmp) throws Exception {
        new AppInstaller(mock(InstalledAppRepository.class), mapper, tmp.toString(), 100L)
                .uninstall(null);
    }

    @Test
    void uninstallRejectsPathEscape(@org.junit.jupiter.api.io.TempDir final Path tmp) {
        final AppInstaller installer = newInstaller(tmp, 100L, mock(InstalledAppRepository.class));
        final InstalledApp bogus = new InstalledApp(UUID.randomUUID(), "x", "1", "x",
                "{}", "/etc/passwd", UUID.randomUUID(), java.time.Instant.now(), true);
        assertThatThrownBy(() -> installer.uninstall(bogus))
                .isInstanceOf(AppInstaller.AppInstallException.class);
    }

    @Test
    void defaultMaxBundleWhenZero(@org.junit.jupiter.api.io.TempDir final Path tmp) {
        final AppInstaller installer = newInstaller(tmp, 0L, mock(InstalledAppRepository.class));
        assertThat(installer.appsRoot()).isEqualTo(tmp.toAbsolutePath().normalize());
    }

    @Test
    void installException() {
        final var ex = new AppInstaller.AppInstallException("x");
        assertThat(ex.getMessage()).isEqualTo("x");
    }
}
