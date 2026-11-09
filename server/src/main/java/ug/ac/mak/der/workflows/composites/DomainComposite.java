package ug.ac.mak.der.workflows.composites;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/** Head of a composite DER_DOMAIN entity (spec §4). Carries
 *  kind-specific fields in {@code headPayload} (JSONB) and a
 *  list of line items. {@code kindCode} is a free-form stable
 *  identifier from the der_domain_composite_kind catalogue —
 *  the spec names examples (LAB_REQUEST, PRESCRIPTION,
 *  CARE_EPISODE, RESULT_AMENDMENT) but the schema does not
 *  constrain them: admins register whatever kinds the facility
 *  needs.
 *
 *  Composites are DER-only — they do NOT round-trip to central.
 *  No sync_status column: these never leave the edge. */
public record DomainComposite(
        String compositeUid,
        String kindCode,
        String anchorEventUid,
        String anchorEnrollmentUid,
        String anchorTeiUid,
        String orgUnitUid,
        String status,
        JsonNode headPayload,
        List<DomainCompositeItem> items,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant deletedAt,
        int version) {

    public DomainComposite {
        Objects.requireNonNull(compositeUid, "compositeUid");
        Objects.requireNonNull(kindCode, "kindCode");
        Objects.requireNonNull(anchorEventUid, "anchorEventUid");
        Objects.requireNonNull(anchorEnrollmentUid, "anchorEnrollmentUid");
        Objects.requireNonNull(anchorTeiUid, "anchorTeiUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(headPayload, "headPayload");
        Objects.requireNonNull(createdBy, "createdBy");
        Objects.requireNonNull(createdAt, "createdAt");
        if (!compositeUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException(
                    "compositeUid must be 11-char DHIS2 UID");
        }
        if (!kindCode.matches("^[A-Z][A-Z0-9_]{0,63}$")) {
            throw new IllegalArgumentException(
                    "kindCode must be uppercase A-Z/0-9/_ (<=64 chars)");
        }
        if (version < 1) {
            throw new IllegalArgumentException("version must be >= 1");
        }
        items = items == null ? List.of() : List.copyOf(items);
    }
}
