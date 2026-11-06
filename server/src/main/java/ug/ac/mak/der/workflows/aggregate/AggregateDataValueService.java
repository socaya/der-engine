package ug.ac.mak.der.workflows.aggregate;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.approval.ApprovalRequirements;
import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredDataElement;
import ug.ac.mak.der.metadata.MirroredOrganisationUnit;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * Phase 03.5 write service for aggregate data values.
 *
 * <p>Per submission, {@link #submit} validates against the DER metadata
 * mirror then atomically ({@link Transactional}) writes:</p>
 *
 * <ol>
 *   <li>a row in {@code aggregate_data_value} (upsert, bumps version on conflict),</li>
 *   <li>a {@code PENDING} entry in {@code operation_journal} that Phase 04 drains.</li>
 * </ol>
 *
 * <p>Validation errors are returned to the caller row-by-row, not thrown —
 * DHIS2's dataValueSets endpoint accepts partial success; so does DER.</p>
 */
@Service
public class AggregateDataValueService {

    private static final Logger LOG = LoggerFactory.getLogger(AggregateDataValueService.class);

    private final AggregateDataValueRepository values;
    private final OperationJournalRepository journal;
    private final MetadataMirrorRepository metadata;
    private final SecurityAuditRepository audit;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final ApprovalRequirements approvals;
    private final org.springframework.beans.factory.ObjectProvider<
            ug.ac.mak.der.workflow.CaptureWorkflowRepository> workflows;

    public AggregateDataValueService(final AggregateDataValueRepository values,
                                      final OperationJournalRepository journal,
                                      final MetadataMirrorRepository metadata,
                                      final SecurityAuditRepository audit,
                                      final ObjectMapper mapper,
                                      final Clock clock,
                                      final ApprovalRequirements approvals,
                                      final org.springframework.beans.factory.ObjectProvider<
                                          ug.ac.mak.der.workflow.CaptureWorkflowRepository> workflows) {
        this.values = Objects.requireNonNull(values, "values");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.metadata = Objects.requireNonNull(metadata, "metadata");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.approvals = Objects.requireNonNull(approvals, "approvals");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
    }

    /** §2.3.126 — a bucket requires approval if the workflow run that
     *  produced it was captured through a workflow marked
     *  {@code requires_approval=true}. For ad-hoc submits without a
     *  workflow run (DHIS2 Data Entry passthrough, imports, …) fall
     *  back to the global {@link ApprovalRequirements} toggle so
     *  admins can still gate those if they want to. */
    private boolean bucketRequiresApproval(final UUID runId) {
        if (runId == null) {
            return approvals.requiresApproval(
                    OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE);
        }
        final ug.ac.mak.der.workflow.CaptureWorkflowRepository repo
                = workflows.getIfAvailable();
        if (repo == null) {
            return approvals.requiresApproval(
                    OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE);
        }
        return repo.findRun(runId)
                .flatMap(run -> repo.findById(run.workflowId()))
                .map(wf -> wf.requiresApproval())
                .orElse(false);
    }

    @Transactional
    public ImportSummary submit(final List<DataValueInput> inputs, final UUID actingUser,
                                 final String clientIp, final String userAgent) {
        return submit(inputs, actingUser, clientIp, userAgent, null, null);
    }

    /**
     * ADR-0027 D-RHO-4: write-time referral tag. Passing a non-null
     * {@code nextHopOrgUnitUid} stamps every journal entry produced by
     * this call with the referral destination. Blank/null means "not a
     * referral", matching alpha.1 semantics.
     */
    @Transactional
    public ImportSummary submit(final List<DataValueInput> inputs, final UUID actingUser,
                                 final String clientIp, final String userAgent,
                                 final String nextHopOrgUnitUid) {
        return submit(inputs, actingUser, clientIp, userAgent, nextHopOrgUnitUid, null);
    }

    /**
     * §2.3.124 — same as {@link #submit(List, UUID, String, String, String)}
     * but also carries the submitting device UUID (from the client's
     * {@code X-DER-Device-Id} header on {@code POST /api/dataValueSets}).
     * The device UUID + per-row workflow-run id are stamped onto every
     * {@code dataValues[]} row in the outbound DHIS2 envelope so the
     * distributed-workflow lineage survives the hop to central.
     */
    @Transactional
    public ImportSummary submit(final List<DataValueInput> inputs, final UUID actingUser,
                                 final String clientIp, final String userAgent,
                                 final String nextHopOrgUnitUid,
                                 final UUID submittingDeviceId) {
        final Instant now = Instant.now(clock);
        int imported = 0;
        int ignored = 0;
        final List<Conflict> conflicts = new ArrayList<>();

        // §2.3.124 Bulk-per-form coalescing. Group every accepted row by
        // its form key (dataSet, orgUnit, period, attributeOptionCombo)
        // so the journal publisher drains one POST per submission rather
        // than one per cell. Payload shape matches DHIS2's
        // /api/dataValueSets envelope so central actually imports.
        final Map<FormKey, List<AggregateDataValue>> buckets = new LinkedHashMap<>();
        final Map<FormKey, UUID> runKey = new LinkedHashMap<>();

        for (final DataValueInput input : inputs) {
            final Optional<String> rejection = validate(input);
            if (rejection.isPresent()) {
                ignored++;
                final String key = input == null ? "(null row)" : input.compoundKey();
                conflicts.add(new Conflict(key, rejection.get()));
                audit.append(new AuditEvent(
                        "AGGREGATE_WRITE_REJECTED",
                        AuditEvent.Outcome.DENIED,
                        actingUser, null, clientIp, userAgent,
                        Map.of("key", key, "reason", rejection.get())
                ), now);
                continue;
            }

            final AggregateDataValue toStore = new AggregateDataValue(
                    UUID.randomUUID(),
                    input.dataElementUid(),
                    input.orgUnitUid(),
                    input.periodIso(),
                    input.categoryOptionComboUid(),
                    input.attributeOptionComboUid(),
                    input.value(),
                    input.comment(),
                    actingUser,
                    now,
                    1,
                    input.dataSetUid(),
                    input.workflowRunId()
            );
            final AggregateDataValue stored = values.upsert(toStore);
            final FormKey fk = FormKey.of(stored);
            buckets.computeIfAbsent(fk, k -> new ArrayList<>()).add(stored);
            if (stored.workflowRunId() != null) {
                runKey.putIfAbsent(fk, stored.workflowRunId());
            }
            audit.append(new AuditEvent(
                    "AGGREGATE_WRITE_SUCCESS",
                    AuditEvent.Outcome.SUCCESS,
                    actingUser, null, clientIp, userAgent,
                    Map.of("key", stored.compoundKey(), "valueVersion", stored.valueVersion())
            ), now);
            imported++;
        }

        // Emit one journal entry per form bucket — DHIS2-shaped
        // dataValueSets envelope that central will actually import.
        for (final Map.Entry<FormKey, List<AggregateDataValue>> bucket : buckets.entrySet()) {
            final UUID runId = runKey.get(bucket.getKey());
            final OperationJournalEntry entry = buildAggregateEnvelopeEntry(
                    bucket.getKey(), bucket.getValue(),
                    actingUser, now,
                    nextHopOrgUnitUid, submittingDeviceId,
                    runId);
            journal.insert(entry);
            // §2.3.126 per-workflow approval gating — the bucket stays
            // in REQUIRES_APPROVAL (DRAFT) until an approver signs off
            // when it was produced by a workflow that opts in. Ad-hoc
            // submits (runId == null) fall back to the global toggle.
            if (bucketRequiresApproval(runId)) {
                journal.markRequiresApproval(entry.operationId());
            }
        }

        LOG.info("aggregate submission: imported={}, ignored={}, buckets={}",
                imported, ignored, buckets.size());
        return new ImportSummary(imported, ignored, List.copyOf(conflicts));
    }

    /**
     * §2.3.125 — administrative replay. Reads the current local rows
     * for (dataSet, orgUnit, period, aoc) and emits a brand-new
     * {@code PENDING} journal entry with the full DHIS2 envelope so
     * the drain worker publishes the form again. Used when an admin
     * notices a drain that reported SUCCESS but central importCount
     * was all zeros, or when a central-side rollback silently lost
     * the row set.
     *
     * @return the new journal operation id, or empty when the form
     *     has no local rows to replay.
     */
    @Transactional
    public Optional<UUID> replayForm(final String dataSetUid,
                                       final String orgUnitUid,
                                       final String periodIso,
                                       final String attributeOptionComboUid,
                                       final UUID actingUser,
                                       final String nextHopOrgUnitUid,
                                       final UUID submittingDeviceId) {
        Objects.requireNonNull(dataSetUid, "dataSetUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(periodIso, "periodIso");
        final String aoc = attributeOptionComboUid == null
                || attributeOptionComboUid.isBlank()
                ? AggregateDataValue.DEFAULT_COC
                : attributeOptionComboUid;
        final List<AggregateDataValue> rows =
                values.findByForm(dataSetUid, orgUnitUid, periodIso, aoc);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        final OperationJournalEntry entry = buildAggregateEnvelopeEntry(
                FormKey.of(rows.get(0)), rows,
                actingUser, Instant.now(clock),
                nextHopOrgUnitUid, submittingDeviceId,
                rows.get(0).workflowRunId());
        journal.insert(entry);
        if (bucketRequiresApproval(rows.get(0).workflowRunId())) {
            journal.markRequiresApproval(entry.operationId());
        }
        audit.append(new AuditEvent(
                "AGGREGATE_REPLAY",
                AuditEvent.Outcome.SUCCESS,
                actingUser, null, null, null,
                Map.of(
                        "formKey", FormKey.of(rows.get(0)).toCompoundKey(),
                        "rowCount", rows.size(),
                        "operationId", entry.operationId().toString()
                )
        ), Instant.now(clock));
        return Optional.of(entry.operationId());
    }

    /** Build the envelope payload + journal entry shared by submit() and replayForm(). */
    private OperationJournalEntry buildAggregateEnvelopeEntry(
            final FormKey fk,
            final List<AggregateDataValue> rows,
            final UUID actingUser,
            final Instant at,
            final String nextHopOrgUnitUid,
            final UUID submittingDeviceId,
            final UUID runId) {
        final ObjectNode envelope = mapper.createObjectNode();
        envelope.put("dataSet", fk.dataSet);
        envelope.put("orgUnit", fk.orgUnit);
        envelope.put("period", fk.period);
        envelope.put("attributeOptionCombo", fk.attributeOptionCombo);
        final ArrayNode arr = envelope.putArray("dataValues");
        for (final AggregateDataValue row : rows) {
            final ObjectNode dv = arr.addObject();
            dv.put("dataElement", row.dataElementUid());
            dv.put("categoryOptionCombo", row.categoryOptionComboUid());
            dv.put("value", row.valueText());
            if (row.comment() != null && !row.comment().isBlank()) {
                dv.put("comment", row.comment());
            }
            if (row.workflowRunId() != null) {
                dv.put("workflowRunId", row.workflowRunId().toString());
            }
            if (submittingDeviceId != null) {
                dv.put("deviceId", submittingDeviceId.toString());
            }
        }
        return new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                fk.toCompoundKey(),
                envelope,
                OperationJournalEntry.State.PENDING,
                0,
                null,
                actingUser,
                at,
                at,
                nextHopOrgUnitUid == null || nextHopOrgUnitUid.isBlank()
                        ? null : nextHopOrgUnitUid.trim(),
                runId
        );
    }

    /** Form key for journal coalescing — DHIS2 dataValueSets groups on
     *  (dataSet, orgUnit, period, attributeOptionCombo). All four
     *  fields are non-null non-blank: {@link AggregateDataValue}'s
     *  constructor rejects blank dataSet/orgUnit/period and defaults
     *  a blank AOC to {@code DEFAULT_COC}. */
    private record FormKey(String dataSet, String orgUnit, String period,
                             String attributeOptionCombo) {
        static FormKey of(final AggregateDataValue row) {
            return new FormKey(row.dataSetUid(), row.orgUnitUid(),
                    row.periodIso(), row.attributeOptionComboUid());
        }
        String toCompoundKey() {
            return dataSet + ":" + orgUnit + ":" + period + ":" + attributeOptionCombo;
        }
    }

    private Optional<String> validate(final DataValueInput input) {
        if (input == null) {
            return Optional.of("row is null");
        }
        if (input.dataElementUid() == null || input.dataElementUid().isBlank()) {
            return Optional.of("dataElement is required");
        }
        if (input.orgUnitUid() == null || input.orgUnitUid().isBlank()) {
            return Optional.of("orgUnit is required");
        }
        if (input.periodIso() == null || input.periodIso().isBlank()) {
            return Optional.of("period is required");
        }
        if (input.value() == null || input.value().isBlank()) {
            return Optional.of("value is required");
        }
        if (input.dataSetUid() == null || input.dataSetUid().isBlank()) {
            // §2.3.84 — DER policy: every aggregate value must declare
            // its originating dataSet so facility analytics can roll
            // up by dataset without re-deriving mirror metadata.
            return Optional.of("dataSet is required");
        }
        final Optional<MirroredDataElement> de = metadata.findDataElement(input.dataElementUid());
        if (de.isEmpty()) {
            return Optional.of("dataElement '" + input.dataElementUid()
                    + "' is not in the local mirror; run metadata sync");
        }
        final Optional<MirroredOrganisationUnit> ou = metadata.findOrganisationUnit(input.orgUnitUid());
        if (ou.isEmpty()) {
            return Optional.of("orgUnit '" + input.orgUnitUid()
                    + "' is not in the local mirror; run metadata sync");
        }
        final String err = typeCheck(de.get().valueType(), input.value());
        if (err != null) {
            return Optional.of(err);
        }
        return Optional.empty();
    }

    /** Minimal DHIS2 value-type coercion. Returns null when OK. */
    static String typeCheck(final String valueType, final String value) {
        if (valueType == null) {
            return null;
        }
        switch (valueType) {
            case "NUMBER":
            case "UNIT_INTERVAL":
            case "PERCENTAGE":
                try {
                    Double.parseDouble(value);
                    return null;
                } catch (NumberFormatException ex) {
                    return "value '" + value + "' is not numeric";
                }
            case "INTEGER":
            case "INTEGER_POSITIVE":
            case "INTEGER_ZERO_OR_POSITIVE":
            case "INTEGER_NEGATIVE":
                try {
                    final long n = Long.parseLong(value);
                    if ("INTEGER_POSITIVE".equals(valueType) && n <= 0) {
                        return "value must be a positive integer";
                    }
                    if ("INTEGER_ZERO_OR_POSITIVE".equals(valueType) && n < 0) {
                        return "value must be zero or positive";
                    }
                    if ("INTEGER_NEGATIVE".equals(valueType) && n >= 0) {
                        return "value must be a negative integer";
                    }
                    return null;
                } catch (NumberFormatException ex) {
                    return "value '" + value + "' is not an integer";
                }
            case "BOOLEAN":
                if ("true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value)
                        || "0".equals(value) || "1".equals(value)) {
                    return null;
                }
                return "value '" + value + "' is not a boolean";
            default:
                return null; // Phase 03.5 passes through unknown types
        }
    }

    /** Input shape — fields map directly to DHIS2 dataValueSets elements. */
    public record DataValueInput(
            String dataElementUid,
            String orgUnitUid,
            String periodIso,
            String categoryOptionComboUid,
            String attributeOptionComboUid,
            String value,
            String comment,
            /** §2.3.84 — dataSet UID from the dataValueSets envelope.
             *  Required: callers that don't name a dataset get a
             *  structured 400 at {@link #validate}. The DHIS2
             *  dataValueSets envelope always carries dataSet when
             *  posted by Capture apps; ad-hoc writes must name one. */
            String dataSetUid,
            /** §2.3.85 — Capture workflow run that produced this
             *  input, if any. Nullable: ad-hoc writes (direct
             *  dataValueSets POST without a run context) pass null.
             *  Set via {@link #submitForRun} to tag the lineage. */
            UUID workflowRunId
    ) {
        /** Convenience ctor — nulls {@link #workflowRunId}, used by
         *  the DHIS2-emulator write path which carries no workflow
         *  context today. */
        public DataValueInput(final String dataElementUid, final String orgUnitUid,
                               final String periodIso,
                               final String categoryOptionComboUid,
                               final String attributeOptionComboUid,
                               final String value, final String comment,
                               final String dataSetUid) {
            this(dataElementUid, orgUnitUid, periodIso,
                 categoryOptionComboUid, attributeOptionComboUid,
                 value, comment, dataSetUid, null);
        }
        public String compoundKey() {
            return dataElementUid + '|' + orgUnitUid + '|' + periodIso
                    + '|' + (categoryOptionComboUid == null ? AggregateDataValue.DEFAULT_COC : categoryOptionComboUid)
                    + '|' + (attributeOptionComboUid == null ? AggregateDataValue.DEFAULT_COC : attributeOptionComboUid);
        }
    }

    public record ImportSummary(int imported, int ignored, List<Conflict> conflicts) { }

    public record Conflict(String key, String reason) { }
}
