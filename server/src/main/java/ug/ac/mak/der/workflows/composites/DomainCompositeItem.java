package ug.ac.mak.der.workflows.composites;

import java.time.Instant;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;

/** Line item of a composite DER_DOMAIN entity. The item payload
 *  is kind-specific: for LAB_REQUEST the controller expects
 *  {testCode, result?, resultedAt?}; for PRESCRIPTION
 *  {medicationCode, dose, quantity, …}; etc. The DB holds the
 *  payload as opaque JSONB — kind-specific validation lives in
 *  the controller/service layer. */
public record DomainCompositeItem(
        String itemUid,
        String compositeUid,
        int lineNo,
        JsonNode itemPayload,
        Instant createdAt,
        Instant updatedAt) {

    public DomainCompositeItem {
        Objects.requireNonNull(itemUid, "itemUid");
        Objects.requireNonNull(compositeUid, "compositeUid");
        Objects.requireNonNull(itemPayload, "itemPayload");
        Objects.requireNonNull(createdAt, "createdAt");
        if (!itemUid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            throw new IllegalArgumentException(
                    "itemUid must be 11-char DHIS2 UID");
        }
        if (lineNo < 0) {
            throw new IllegalArgumentException("lineNo must be >= 0");
        }
    }
}
