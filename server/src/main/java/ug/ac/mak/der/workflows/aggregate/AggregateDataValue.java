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
        int valueVersion,
        /** §2.3.84 — DHIS2 dataSet UID this value was captured through.
         *  Required: every DER aggregate value must declare its
         *  dataset so facility-local analytics can roll up / filter
         *  by dataset without re-deriving the mapping at read time.
         *  DHIS2 Central doesn't require this (a data element can be
         *  in several datasets); DER chooses to pin it. */
        String dataSetUid,
        /** §2.3.85 — Capture workflow run that produced this value,
         *  if any. Nullable: ad-hoc writes (Data Entry web app,
         *  dataValueSets POST without a run context) stay untagged.
         *  Workflow-driven writes carry the run id so admins can
         *  trace a value back to the run that captured it. */
        UUID workflowRunId
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
        Objects.requireNonNull(dataSetUid, "dataSetUid");
        if (categoryOptionComboUid == null || categoryOptionComboUid.isBlank()) {
            categoryOptionComboUid = DEFAULT_COC;
        }
        if (attributeOptionComboUid == null || attributeOptionComboUid.isBlank()) {
            attributeOptionComboUid = DEFAULT_COC;
        }
        if (dataSetUid.isBlank()) {
            throw new IllegalArgumentException("dataSetUid must not be blank");
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

    /** Backward-compat ctor — defaults {@link #workflowRunId} to null
     *  so ad-hoc writers that don't carry workflow context compile
     *  unchanged. */
    public AggregateDataValue(final UUID valueId,
                                final String dataElementUid, final String orgUnitUid,
                                final String periodIso,
                                final String categoryOptionComboUid,
                                final String attributeOptionComboUid,
                                final String valueText, final String comment,
                                final UUID submittedBy, final Instant submittedAt,
                                final int valueVersion, final String dataSetUid) {
        this(valueId, dataElementUid, orgUnitUid, periodIso,
             categoryOptionComboUid, attributeOptionComboUid, valueText,
             comment, submittedBy, submittedAt, valueVersion, dataSetUid, null);
    }

    /** DHIS2-style compound-key string, used for audit + sync-status lookups. */
    public String compoundKey() {
        return dataElementUid + '|' + orgUnitUid + '|' + periodIso
                + '|' + categoryOptionComboUid + '|' + attributeOptionComboUid;
    }
}
