package ug.ac.mak.der.workflows.referral;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.referral_inbox}. ADR-0027 alpha.4+. */
public record ReferralInboxEntry(
        UUID inboxId,
        Kind kind,
        String sourceRef,
        String boundOrgUnit,
        String payloadJson,
        Instant discoveredAt,
        Status status,
        UUID resolvedBy,
        Instant resolvedAt
) {

    public ReferralInboxEntry {
        Objects.requireNonNull(inboxId, "inboxId");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(sourceRef, "sourceRef");
        Objects.requireNonNull(boundOrgUnit, "boundOrgUnit");
        Objects.requireNonNull(payloadJson, "payloadJson");
        Objects.requireNonNull(discoveredAt, "discoveredAt");
        Objects.requireNonNull(status, "status");
    }

    public enum Kind { AGGREGATE_DATA_VALUE, EVENT, ENROLLMENT, TRACKED_ENTITY }

    public enum Status { PENDING, ACCEPTED, DISMISSED }
}
