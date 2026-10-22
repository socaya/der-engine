package ug.ac.mak.der.workflows.aggregate;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

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

    public AggregateDataValueService(final AggregateDataValueRepository values,
                                      final OperationJournalRepository journal,
                                      final MetadataMirrorRepository metadata,
                                      final SecurityAuditRepository audit,
                                      final ObjectMapper mapper,
                                      final Clock clock,
                                      final ApprovalRequirements approvals) {
        this.values = Objects.requireNonNull(values, "values");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.metadata = Objects.requireNonNull(metadata, "metadata");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.approvals = Objects.requireNonNull(approvals, "approvals");
    }

    @Transactional
    public ImportSummary submit(final List<DataValueInput> inputs, final UUID actingUser,
                                 final String clientIp, final String userAgent) {
        final Instant now = Instant.now(clock);
        int imported = 0;
        int ignored = 0;
        final List<Conflict> conflicts = new ArrayList<>();

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
                    1
            );
            final AggregateDataValue stored = values.upsert(toStore);
            final OperationJournalEntry entry = new OperationJournalEntry(
                    UUID.randomUUID(),
                    OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                    stored.compoundKey(),
                    mapper.valueToTree(Map.of(
                            "valueId", stored.valueId().toString(),
                            "dataElement", stored.dataElementUid(),
                            "orgUnit", stored.orgUnitUid(),
                            "period", stored.periodIso(),
                            "categoryOptionCombo", stored.categoryOptionComboUid(),
                            "attributeOptionCombo", stored.attributeOptionComboUid(),
                            "value", stored.valueText(),
                            "comment", stored.comment() == null ? "" : stored.comment(),
                            "valueVersion", stored.valueVersion()
                    )),
                    OperationJournalEntry.State.PENDING,
                    0,
                    null,
                    actingUser,
                    now,
                    now
            );
            journal.insert(entry);
            if (approvals.requiresApproval(OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE)) {
                journal.markRequiresApproval(entry.operationId());
            }
            audit.append(new AuditEvent(
                    "AGGREGATE_WRITE_SUCCESS",
                    AuditEvent.Outcome.SUCCESS,
                    actingUser, null, clientIp, userAgent,
                    Map.of("key", stored.compoundKey(), "valueVersion", stored.valueVersion())
            ), now);
            imported++;
        }

        LOG.info("aggregate submission: imported={}, ignored={}", imported, ignored);
        return new ImportSummary(imported, ignored, List.copyOf(conflicts));
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
            String comment
    ) {
        public String compoundKey() {
            return dataElementUid + '|' + orgUnitUid + '|' + periodIso
                    + '|' + (categoryOptionComboUid == null ? AggregateDataValue.DEFAULT_COC : categoryOptionComboUid)
                    + '|' + (attributeOptionComboUid == null ? AggregateDataValue.DEFAULT_COC : attributeOptionComboUid);
        }
    }

    public record ImportSummary(int imported, int ignored, List<Conflict> conflicts) { }

    public record Conflict(String key, String reason) { }
}
