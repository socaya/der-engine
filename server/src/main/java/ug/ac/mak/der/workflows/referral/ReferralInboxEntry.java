package ug.ac.mak.der.workflows.referral;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.referral_inbox}. ADR-0027 alpha.4+.
 *
 *  §2.3.110 R-AE — {@code ingestRunId} added so the admin UI can
 *  drill from a referral into the system workflow run that produced
 *  the local record(s). NULL for PENDING / DISMISSED rows and for
 *  historical ACCEPTED rows that pre-date V081. */
public record ReferralInboxEntry(
        UUID inboxId,
        Kind kind,
        String sourceRef,
        String boundOrgUnit,
        String payloadJson,
        Instant discoveredAt,
        Status status,
        UUID resolvedBy,
        Instant resolvedAt,
        UUID ingestRunId
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
