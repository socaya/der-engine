package ug.ac.mak.der.device;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.edge_device_dependency}. ADR-0019. */
public record EdgeDeviceDependency(
        UUID deviceId,
        UUID dependsOnDeviceId,
        Kind kind,
        Instant createdAt
) {

    public EdgeDeviceDependency {
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(dependsOnDeviceId, "dependsOnDeviceId");
        if (deviceId.equals(dependsOnDeviceId)) {
            throw new IllegalArgumentException("device cannot depend on itself");
        }
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    public enum Kind { APPROVES, FORWARDS, SUPERVISES }
}
