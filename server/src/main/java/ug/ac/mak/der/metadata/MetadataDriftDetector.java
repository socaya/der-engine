package ug.ac.mak.der.metadata;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * FR-05-10/11/12: inspects a journal entry's payload for references to
 * metadata UIDs that no longer exist in the local mirror. Returns a
 * structured drift report so callers can quarantine the entry
 * ({@link OperationJournalEntry.State#CONFLICT_REVIEW}) instead of
 * draining it against stale definitions.
 *
 * <p>Checked fields per entity type:
 * <ul>
 *   <li>{@code AGGREGATE_DATA_VALUE}: dataSet, dataElement, orgUnit,
 *       categoryOptionCombo (nested or envelope).</li>
 *   <li>{@code EVENT}, {@code PROGRAM_STAGE_EVENT}: program,
 *       programStage, orgUnit.</li>
 *   <li>{@code ENROLLMENT}: program, orgUnit.</li>
 *   <li>{@code TRACKED_ENTITY}: trackedEntityType, orgUnit; nested
 *       enrollments' program also checked.</li>
 * </ul>
 */
@Service
public class MetadataDriftDetector {

    private final MetadataMirrorRepository mirror;

    public MetadataDriftDetector(final MetadataMirrorRepository mirror) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
    }

    public DriftReport evaluate(final OperationJournalEntry entry) {
        Objects.requireNonNull(entry, "entry");
        final JsonNode payload = entry.payload();
        final List<MissingRef> missing = new ArrayList<>();
        if (payload == null) {
            return new DriftReport(entry.operationId().toString(), List.of());
        }
        switch (entry.entityType()) {
            case AGGREGATE_DATA_VALUE -> checkAggregate(payload, missing);
            case EVENT, PROGRAM_STAGE_EVENT -> checkEvent(payload, missing);
            case ENROLLMENT -> checkEnrollment(payload, missing);
            case TRACKED_ENTITY -> checkTei(payload, missing);
            default -> { /* defensive */ }
        }
        return new DriftReport(entry.operationId().toString(), List.copyOf(missing));
    }

    private void checkAggregate(final JsonNode payload, final List<MissingRef> missing) {
        checkRef(payload, "dataSet", "DATA_SET", missing);
        checkRef(payload, "orgUnit", "ORG_UNIT", missing);
        checkRef(payload, "dataElement", "DATA_ELEMENT", missing);
        final JsonNode values = payload.get("dataValues");
        if (values != null && values.isArray()) {
            for (final JsonNode dv : values) {
                checkRef(dv, "dataElement", "DATA_ELEMENT", missing);
                checkRef(dv, "categoryOptionCombo", "CATEGORY_OPTION_COMBO", missing);
            }
        }
    }

    private void checkEvent(final JsonNode payload, final List<MissingRef> missing) {
        checkRef(payload, "program", "PROGRAM", missing);
        checkRef(payload, "programStage", "PROGRAM_STAGE", missing);
        checkRef(payload, "orgUnit", "ORG_UNIT", missing);
    }

    private void checkEnrollment(final JsonNode payload, final List<MissingRef> missing) {
        checkRef(payload, "program", "PROGRAM", missing);
        checkRef(payload, "orgUnit", "ORG_UNIT", missing);
    }

    private void checkTei(final JsonNode payload, final List<MissingRef> missing) {
        checkRef(payload, "trackedEntityType", "TRACKED_ENTITY_TYPE", missing);
        checkRef(payload, "orgUnit", "ORG_UNIT", missing);
        final JsonNode enrollments = payload.get("enrollments");
        if (enrollments != null && enrollments.isArray()) {
            for (final JsonNode en : enrollments) {
                checkRef(en, "program", "PROGRAM", missing);
            }
        }
    }

    private void checkRef(final JsonNode parent, final String field,
                            final String kind, final List<MissingRef> missing) {
        if (parent == null || !parent.hasNonNull(field)) {
            return;
        }
        final String uid = parent.get(field).asText();
        if (uid == null || uid.isBlank()) {
            return;
        }
        if (!exists(kind, uid)) {
            missing.add(new MissingRef(kind, field, uid));
        }
    }

    private boolean exists(final String kind, final String uid) {
        return switch (kind) {
            case "DATA_ELEMENT" -> mirror.findDataElement(uid).isPresent();
            case "DATA_SET" -> mirror.findDataSet(uid).isPresent();
            case "ORG_UNIT" -> mirror.findOrganisationUnit(uid).isPresent();
            case "PROGRAM" -> mirror.findProgram(uid).isPresent();
            case "TRACKED_ENTITY_TYPE" -> mirror.findTrackedEntityType(uid).isPresent();
            case "PROGRAM_STAGE", "CATEGORY_OPTION_COMBO" -> true;
            default -> true;
        };
    }

    public record DriftReport(String operationId, List<MissingRef> missing) {
        public boolean hasDrift() {
            return !missing.isEmpty();
        }

        public String summary() {
            if (missing.isEmpty()) {
                return "no-drift";
            }
            final Map<String, Integer> perKind = new LinkedHashMap<>();
            for (final MissingRef m : missing) {
                perKind.merge(m.kind(), 1, Integer::sum);
            }
            return "METADATA_DRIFT: " + perKind;
        }
    }

    public record MissingRef(String kind, String field, String uid) { }
}
