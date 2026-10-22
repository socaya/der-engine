package ug.ac.mak.der.device;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeDeviceRecordsTest {

    @Test
    void edgeDeviceRejectsMissing() {
        assertThatThrownBy(() -> new EdgeDevice(null, null, null, Instant.now(),
                null, null, null, null, null, EdgeDevice.Status.PENDING))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EdgeDevice(UUID.randomUUID(), null, null, null,
                null, null, null, null, null, EdgeDevice.Status.PENDING))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new EdgeDevice(UUID.randomUUID(), null, null, Instant.now(),
                null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void edgeDeviceAccepts() {
        final UUID id = UUID.randomUUID();
        final EdgeDevice d = new EdgeDevice(id, null, null, Instant.now(),
                null, null, null, "chrome", null, EdgeDevice.Status.PENDING);
        assertThat(d.deviceId()).isEqualTo(id);
        assertThat(d.status()).isEqualTo(EdgeDevice.Status.PENDING);
    }

    @Test
    void dependencyRejectsSelfLoop() {
        final UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> new EdgeDeviceDependency(id, id,
                EdgeDeviceDependency.Kind.APPROVES, Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void dependencyAccepts() {
        final EdgeDeviceDependency d = new EdgeDeviceDependency(
                UUID.randomUUID(), UUID.randomUUID(),
                EdgeDeviceDependency.Kind.FORWARDS, Instant.now());
        assertThat(d.kind()).isEqualTo(EdgeDeviceDependency.Kind.FORWARDS);
    }

    @Test
    void enumValuesSurface() {
        assertThat(EdgeDevice.Status.values()).hasSize(4);
        assertThat(EdgeDeviceDependency.Kind.values()).hasSize(3);
    }
}
