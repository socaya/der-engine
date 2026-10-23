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
        if ((nextHop == null || nextHop.isBlank()) && storedBy == null) {
            return entry.payload().toString();
        }
        try {
            final JsonNode root = entry.payload().deepCopy();
            if (root instanceof ObjectNode object) {
                if (nextHop != null && !nextHop.isBlank()) {
                    applyNextHop(object, entry, nextHop.trim());
                }
                if (storedBy != null) {
                    stampStoredBy(object, storedBy, entry);
                }
                return object.toString();
            }
            return root.toString();
        } catch (RuntimeException ex) {
            LOG.warn("payload rewrite failed for {}: {}; publishing raw payload",
                    entry.operationId(), ex.getMessage());
            return entry.payload().toString();
        }
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
            case AGGREGATE_DATA_VALUE -> appendToComment(root, marker);
            case EVENT, PROGRAM_STAGE_EVENT,
                 ENROLLMENT, TRACKED_ENTITY -> pushNote(root, marker);
            default -> { /* defensive */ }
        }
        root.put("orgUnit", nextHop);
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
            case EVENT, PROGRAM_STAGE_EVENT -> root.put("storedBy", storedBy);
            case ENROLLMENT -> root.put("storedBy", storedBy);
            case TRACKED_ENTITY -> {
                // DHIS2 tracked entities themselves have no storedBy; their
                // enrollments and events (nested) do. Stamp those when present.
                stampTrackedEntityChildren(root, storedBy);
            }
            default -> { /* defensive */ }
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
