package ug.ac.mak.der.ops;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StorageHealthProbeTest {

    @Test
    void okWhenRoomy(@TempDir final Path tmp) {
        final StorageHealthProbe probe = new StorageHealthProbe(tmp.toString(), 1L, 1L);
        final StorageHealthProbe.Snapshot s = probe.sample();
        assertThat(s.status()).isEqualTo(StorageHealthProbe.Status.OK);
        assertThat(probe.admitWrites()).isTrue();
        assertThat(s.root()).isEqualTo(tmp.toAbsolutePath().normalize().toString());
        assertThat(s.formattedUsable()).matches(".*[BKMGT]B?");
    }

    @Test
    void rejectsWhenBelowThreshold(@TempDir final Path tmp) {
        final StorageHealthProbe probe = new StorageHealthProbe(
                tmp.toString(), Long.MAX_VALUE, Long.MAX_VALUE);
        final StorageHealthProbe.Snapshot s = probe.sample();
        assertThat(s.status()).isEqualTo(StorageHealthProbe.Status.REJECT);
        assertThat(probe.admitWrites()).isFalse();
    }

    @Test
    void warnBetweenThresholds(@TempDir final Path tmp) {
        final long warn = Long.MAX_VALUE - 1;
        final StorageHealthProbe probe = new StorageHealthProbe(
                tmp.toString(), warn, 1L);
        final StorageHealthProbe.Snapshot s = probe.sample();
        assertThat(s.status()).isEqualTo(StorageHealthProbe.Status.WARN);
        assertThat(probe.admitWrites()).isTrue();
    }

    @Test
    void resolvesExistingAncestorWhenRootMissing(@TempDir final Path tmp) {
        final Path missing = tmp.resolve("a/b/c/missing");
        final StorageHealthProbe probe = new StorageHealthProbe(missing.toString(), 1L, 1L);
        assertThat(probe.sample().status()).isEqualTo(StorageHealthProbe.Status.OK);
    }

    @Test
    void formatsBytesHumanReadable(@TempDir final Path tmp) {
        final StorageHealthProbe probe = new StorageHealthProbe(tmp.toString(), 1L, 1L);
        final StorageHealthProbe.Snapshot small = new StorageHealthProbe.Snapshot(
                "/x", 42L, 1024L, 1L, 1L, StorageHealthProbe.Status.OK);
        assertThat(small.formattedUsable()).isEqualTo("42B");
    }
}
