package ug.ac.mak.der.device;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.edge_device}. ADR-0019 + V043 profile fields. */
public record EdgeDevice(
        UUID deviceId,
        UUID assignedUserId,
        String enrolmentTokenHash,
        Instant enrolledAt,
        UUID approvedBy,
        Instant approvedAt,
        Instant lastSeenAt,
        String userAgent,
        String firmwareVersion,
        Status status,
        String displayName,
        FormFactor formFactor
) {

    public EdgeDevice {
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(enrolledAt, "enrolledAt");
        Objects.requireNonNull(status, "status");
        if (formFactor == null) {
            formFactor = FormFactor.UNKNOWN;
        }
    }

    public enum Status { PENDING, APPROVED, SUSPENDED, REVOKED }

    /** V043 — surfaced in the mesh topology view. */
    public enum FormFactor { WORKSTATION, LAPTOP, TABLET, MOBILE, UNKNOWN }
}
