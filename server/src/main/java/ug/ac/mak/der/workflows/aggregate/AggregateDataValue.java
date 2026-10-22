package ug.ac.mak.der.workflows.aggregate;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Local DER row for an aggregate data value. One row per DHIS2 compound key
 * (dataElement + orgUnit + period + categoryOptionCombo + attributeOptionCombo).
 *
 * {@link #valueVersion} starts at 1 on insert and increments on every update
 * so Phase 04 can tell "central saw version 2" from "central saw version 1,
 * local has 2" at outbound time (FR-09-06 optimistic concurrency).
 */
public record AggregateDataValue(
        UUID valueId,
        String dataElementUid,
        String orgUnitUid,
        String periodIso,
        String categoryOptionComboUid,
        String attributeOptionComboUid,
        String valueText,
        String comment,
        UUID submittedBy,
        Instant submittedAt,
        int valueVersion
) {

    public static final String DEFAULT_COC = "HllvX50cXC0";

    public AggregateDataValue {
        Objects.requireNonNull(valueId, "valueId");
        Objects.requireNonNull(dataElementUid, "dataElementUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(periodIso, "periodIso");
        Objects.requireNonNull(valueText, "valueText");
        Objects.requireNonNull(submittedBy, "submittedBy");
        Objects.requireNonNull(submittedAt, "submittedAt");
        if (categoryOptionComboUid == null || categoryOptionComboUid.isBlank()) {
            categoryOptionComboUid = DEFAULT_COC;
        }
        if (attributeOptionComboUid == null || attributeOptionComboUid.isBlank()) {
            attributeOptionComboUid = DEFAULT_COC;
        }
        if (valueText.isBlank()) {
            throw new IllegalArgumentException("valueText must not be blank");
        }
        if (periodIso.isBlank()) {
            throw new IllegalArgumentException("periodIso must not be blank");
        }
        if (valueVersion < 1) {
            throw new IllegalArgumentException("valueVersion must be >= 1");
        }
    }

    /** DHIS2-style compound-key string, used for audit + sync-status lookups. */
    public String compoundKey() {
        return dataElementUid + '|' + orgUnitUid + '|' + periodIso
                + '|' + categoryOptionComboUid + '|' + attributeOptionComboUid;
    }
}
