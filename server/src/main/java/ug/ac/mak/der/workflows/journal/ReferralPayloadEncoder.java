package ug.ac.mak.der.workflows.journal;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.attribution.CapturedByResolver;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * ADR-0027 D-RHO-7. Attaches a {@code [DER-next-hop:&lt;ou&gt;]} marker
 * to the DHIS2-shaped payload before publish, so the receiving edge
 * (alpha.4+ inbound poll) can detect referrals from central.
 *
 * <p>Encoding by entity type:
 * <ul>
 *   <li>AGGREGATE_DATA_VALUE &rarr; append to {@code comment} string</li>
 *   <li>EVENT, PROGRAM_STAGE_EVENT &rarr; push a note into {@code notes[]}</li>
 *   <li>ENROLLMENT, TRACKED_ENTITY &rarr; push a note into {@code notes[]}</li>
 * </ul>
 * The source of truth remains the {@code next_hop_org_unit_uid} column
 * on the journal entry; the marker is a transport-layer carrier.</p>
 */
@Component
public class ReferralPayloadEncoder {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralPayloadEncoder.class);
    static final String MARKER_PREFIX = "[DER-next-hop:";
    static final String MARKER_SUFFIX = "]";

    private final ObjectMapper mapper;
    private final ObjectProvider<CapturedByResolver> capturedBy;

    @Autowired
    public ReferralPayloadEncoder(final ObjectMapper mapper,
                                    final ObjectProvider<CapturedByResolver> capturedBy) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.capturedBy = Objects.requireNonNull(capturedBy, "capturedBy");
    }

    /** Legacy constructor for pre-ADR-0032 call-sites and tests. */
    public ReferralPayloadEncoder(final ObjectMapper mapper) {
        this(mapper, new EmptyProvider<>());
    }

    private static final class EmptyProvider<T> implements ObjectProvider<T> {
        @Override
        public T getObject() {
            throw new UnsupportedOperationException();
        }
        @Override
        public T getObject(final Object... args) {
            throw new UnsupportedOperationException();
        }
        @Override
        public T getIfAvailable() {
            return null;
        }
        @Override
        public T getIfUnique() {
            return null;
        }
    }

    /**
     * @return the body to POST, with the referral marker attached when
     *     {@code entry.nextHopOrgUnitUid()} is set; otherwise the raw
     *     payload text unchanged.
     */
    public String body(final OperationJournalEntry entry) {
        Objects.requireNonNull(entry, "entry");
        if (entry.payload() == null) {
            return "{}";
        }
        final String storedBy = resolveStoredBy(entry);
        final String nextHop = entry.nextHopOrgUnitUid();
        try {
            final JsonNode base = entry.payload().deepCopy();
            // §2.3.95 R-D/sync-worker-tracker — reshape flat tracker
            // payloads (TEI / enrollment / stage event) into DHIS2's
            // /api/tracker envelope. Aggregate and single events are
            // already written in DHIS2 shape by their services.
            final JsonNode shaped = shapeForCentral(entry, base);
            if ((nextHop == null || nextHop.isBlank()) && storedBy == null) {
                return shaped.toString();
            }
            if (shaped instanceof ObjectNode object) {
                if (nextHop != null && !nextHop.isBlank()) {
                    applyNextHop(object, entry, nextHop.trim());
                }
                if (storedBy != null) {
                    stampStoredBy(object, storedBy, entry);
                }
                return object.toString();
            }
            return shaped.toString();
        } catch (RuntimeException ex) {
            LOG.warn("payload rewrite failed for {}: {}; publishing raw payload",
                    entry.operationId(), ex.getMessage());
            return entry.payload().toString();
        }
    }

    /**
     * §2.3.95 R-D/sync-worker-tracker — convert DER's flat tracker
     * payload shape (one TEI / one enrollment / one stage event)
     * into the DHIS2 2.44 {@code /api/tracker} envelope. For non-
     * tracker entity types the raw payload is returned unchanged;
     * aggregate and single events already match the DHIS2 wire
     * shape that their services write.
     */
    private JsonNode shapeForCentral(final OperationJournalEntry entry,
                                        final JsonNode raw) {
        if (!(raw instanceof ObjectNode src)) {
            return raw;
        }
        return switch (entry.entityType()) {
            case TRACKED_ENTITY -> wrapTei(src);
            case ENROLLMENT     -> wrapEnrollment(src);
            case PROGRAM_STAGE_EVENT -> wrapTrackerEvent(src);
            default -> raw;
        };
    }

    /** Convert {teiUid, trackedEntityType, orgUnit, attributes} →
     *  {"trackedEntities":[{"trackedEntity":"...", "trackedEntityType":"...",
     *                       "orgUnit":"...", "attributes":[{"attribute":"X","value":"Y"},...]}]} */
    private JsonNode wrapTei(final ObjectNode src) {
        final ObjectNode tei = mapper.createObjectNode();
        copyIfPresent(src, tei, "teiUid", "trackedEntity");
        copyIfPresent(src, tei, "trackedEntityType", "trackedEntityType");
        copyIfPresent(src, tei, "orgUnit", "orgUnit");
        tei.set("attributes", attrMapToArray(src.get("attributes")));
        final ObjectNode root = mapper.createObjectNode();
        final ArrayNode arr = root.putArray("trackedEntities");
        arr.add(tei);
        return root;
    }

    /** Convert {enrollmentUid, teiUid, program, orgUnit, status,
     *   enrollmentDate, incidentDate?} → {"enrollments":[{...}]} */
    private JsonNode wrapEnrollment(final ObjectNode src) {
        final ObjectNode en = mapper.createObjectNode();
        copyIfPresent(src, en, "enrollmentUid", "enrollment");
        copyIfPresent(src, en, "teiUid", "trackedEntity");
        copyIfPresent(src, en, "program", "program");
        copyIfPresent(src, en, "orgUnit", "orgUnit");
        copyIfPresent(src, en, "status", "status");
        copyIfPresent(src, en, "enrollmentDate", "enrolledAt");
        copyIfPresent(src, en, "incidentDate", "occurredAt");
        // Attributes are optional on the ENROLLMENT journal entry
        // — CREATE/UPDATE enrolments don't carry them, but attribute-
        // sync entries enqueued by TrackerService.upsertTei do. When
        // present, convert the map shape {uid: value} to DHIS2's
        // [{attribute, value}] array so the enrolment write lands
        // program-scoped TEA values that only surface on the GET
        // via the enrolment context.
        final JsonNode attrs = src.get("attributes");
        if (attrs != null && !attrs.isNull() && attrs.isObject()
                && attrs.size() > 0) {
            en.set("attributes", attrMapToArray(attrs));
        }
        final ObjectNode root = mapper.createObjectNode();
        final ArrayNode arr = root.putArray("enrollments");
        arr.add(en);
        return root;
    }

    /** Convert {eventUid, enrollmentUid, program, programStage,
     *   orgUnit, status, occurredDate, dataValues}
     *   → {"events":[{"event":"...", ..., "dataValues":[{"dataElement":"X","value":"Y"}]}]} */
    private JsonNode wrapTrackerEvent(final ObjectNode src) {
        final ObjectNode ev = mapper.createObjectNode();
        copyIfPresent(src, ev, "eventUid", "event");
        copyIfPresent(src, ev, "enrollmentUid", "enrollment");
        copyIfPresent(src, ev, "program", "program");
        copyIfPresent(src, ev, "programStage", "programStage");
        copyIfPresent(src, ev, "orgUnit", "orgUnit");
        copyIfPresent(src, ev, "status", "status");
        copyIfPresent(src, ev, "occurredDate", "occurredAt");
        ev.set("dataValues", dvMapToArray(src.get("dataValues")));
        final ObjectNode root = mapper.createObjectNode();
        final ArrayNode arr = root.putArray("events");
        arr.add(ev);
        return root;
    }

    private static void copyIfPresent(final ObjectNode src, final ObjectNode dst,
                                         final String srcField, final String dstField) {
        final JsonNode v = src.get(srcField);
        if (v != null && !v.isNull()) {
            dst.set(dstField, v);
        }
    }

    /** {"abc":"val", ...} → [{"attribute":"abc","value":"val"},...] */
    private ArrayNode attrMapToArray(final JsonNode node) {
        final ArrayNode arr = mapper.createArrayNode();
        if (node instanceof ObjectNode m) {
            m.fields().forEachRemaining(e -> {
                final ObjectNode a = mapper.createObjectNode();
                a.put("attribute", e.getKey());
                a.set("value", e.getValue());
                arr.add(a);
            });
        }
        return arr;
    }

    /** Same shape as attrMapToArray but with (dataElement, value). */
    private ArrayNode dvMapToArray(final JsonNode node) {
        final ArrayNode arr = mapper.createArrayNode();
        if (node instanceof ObjectNode m) {
            m.fields().forEachRemaining(e -> {
                final ObjectNode d = mapper.createObjectNode();
                d.put("dataElement", e.getKey());
                d.set("value", e.getValue());
                arr.add(d);
            });
        }
        return arr;
    }

    private String resolveStoredBy(final OperationJournalEntry entry) {
        final CapturedByResolver resolver = capturedBy.getIfAvailable();
        if (resolver == null || entry.submittedBy() == null) {
            return null;
        }
        return resolver.storedByFor(entry.submittedBy()).orElse(null);
    }

    private void applyNextHop(final ObjectNode root,
                                final OperationJournalEntry entry,
                                final String nextHop) {
        final String marker = MARKER_PREFIX + nextHop + MARKER_SUFFIX;
        switch (entry.entityType()) {
            case AGGREGATE_DATA_VALUE -> {
                // §2.3.124 — payload is a DHIS2 dataValueSets envelope with
                // orgUnit at the top and a dataValues[] array. Swap the
                // envelope orgUnit and append the referral marker to each
                // row's comment so the marker survives per-value audit.
                root.put("orgUnit", nextHop);
                final JsonNode arr = root.get("dataValues");
                if (arr instanceof ArrayNode rows) {
                    for (final JsonNode row : rows) {
                        if (row instanceof ObjectNode dv) {
                            appendToComment(dv, marker);
                        }
                    }
                } else {
                    // Defensive: legacy single-row payloads before
                    // §2.3.124 — append at top-level.
                    appendToComment(root, marker);
                }
            }
            case EVENT -> {
                pushNote(root, marker);
                root.put("orgUnit", nextHop);
            }
            case PROGRAM_STAGE_EVENT ->
                markWrappedArray(root, "events", marker, nextHop);
            case ENROLLMENT ->
                markWrappedArray(root, "enrollments", marker, nextHop);
            case TRACKED_ENTITY ->
                markWrappedArray(root, "trackedEntities", marker, nextHop);
            default -> { /* defensive */ }
        }
    }

    /** §2.3.95 — push the referral note + swap orgUnit on each element
     *  of a wrapped tracker envelope. */
    private void markWrappedArray(final ObjectNode root, final String arrayField,
                                     final String marker, final String nextHop) {
        final JsonNode arr = root.get(arrayField);
        if (arr instanceof ArrayNode a) {
            for (final JsonNode el : a) {
                if (el instanceof ObjectNode o) {
                    pushNote(o, marker);
                    o.put("orgUnit", nextHop);
                }
            }
        }
    }

    /**
     * ADR-0032: stamp the DHIS2 {@code storedBy} field so the captor
     * identity propagates to central. Top-level value is set for the
     * dataValueSet / event / enrollment envelope; nested
     * {@code dataValues[]} get the same stamp when present.
     */
    private void stampStoredBy(final ObjectNode root, final String storedBy,
                                 final OperationJournalEntry entry) {
        switch (entry.entityType()) {
            case AGGREGATE_DATA_VALUE -> {
                root.put("storedBy", storedBy);
                final JsonNode values = root.get("dataValues");
                if (values instanceof ArrayNode arr) {
                    for (final JsonNode dv : arr) {
                        if (dv instanceof ObjectNode dvObj) {
                            dvObj.put("storedBy", storedBy);
                        }
                    }
                }
            }
            case EVENT -> root.put("storedBy", storedBy);
            case PROGRAM_STAGE_EVENT -> stampInsideArray(root, "events", storedBy);
            case ENROLLMENT -> stampInsideArray(root, "enrollments", storedBy);
            case TRACKED_ENTITY -> {
                // Wrapped TEI envelope — tei itself has no storedBy; stamp any
                // nested enrollments / events that happen to ride along.
                final JsonNode arr = root.get("trackedEntities");
                if (arr instanceof ArrayNode teiArr) {
                    for (final JsonNode t : teiArr) {
                        if (t instanceof ObjectNode teiObj) {
                            stampTrackedEntityChildren(teiObj, storedBy);
                        }
                    }
                } else {
                    stampTrackedEntityChildren(root, storedBy);
                }
            }
            default -> { /* defensive */ }
        }
    }

    /** §2.3.95 — helper for the wrapped tracker envelopes: stamp
     *  {@code storedBy} on each element of the named top-level array. */
    private void stampInsideArray(final ObjectNode root, final String arrayField,
                                     final String storedBy) {
        final JsonNode arr = root.get(arrayField);
        if (arr instanceof ArrayNode a) {
            for (final JsonNode el : a) {
                if (el instanceof ObjectNode o) {
                    o.put("storedBy", storedBy);
                }
            }
        }
    }

    private void stampTrackedEntityChildren(final ObjectNode root, final String storedBy) {
        final JsonNode enrollments = root.get("enrollments");
        if (enrollments instanceof ArrayNode arr) {
            for (final JsonNode en : arr) {
                if (en instanceof ObjectNode enObj) {
                    enObj.put("storedBy", storedBy);
                    final JsonNode events = enObj.get("events");
                    if (events instanceof ArrayNode evArr) {
                        for (final JsonNode ev : evArr) {
                            if (ev instanceof ObjectNode evObj) {
                                evObj.put("storedBy", storedBy);
                            }
                        }
                    }
                }
            }
        }
    }

    public static String marker(final String orgUnitUid) {
        return MARKER_PREFIX + Objects.requireNonNull(orgUnitUid, "orgUnitUid") + MARKER_SUFFIX;
    }

    private void appendToComment(final ObjectNode root, final String marker) {
        final JsonNode existing = root.get("comment");
        if (existing == null || existing.isNull() || existing.asText().isBlank()) {
            root.put("comment", marker);
            return;
        }
        root.put("comment", existing.asText() + " " + marker);
    }

    private void pushNote(final ObjectNode root, final String marker) {
        final JsonNode notes = root.get("notes");
        final ArrayNode arr;
        if (notes instanceof ArrayNode existing) {
            arr = existing;
        } else {
            arr = mapper.createArrayNode();
            root.set("notes", arr);
        }
        final ObjectNode note = mapper.createObjectNode();
        note.put("value", marker);
        arr.add(note);
    }
}
