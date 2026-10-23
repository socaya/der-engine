package ug.ac.mak.der.workflows.journal;

import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

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

    public ReferralPayloadEncoder(final ObjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
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
        final String nextHop = entry.nextHopOrgUnitUid();
        if (nextHop == null || nextHop.isBlank()) {
            return entry.payload().toString();
        }
        try {
            final JsonNode root = entry.payload().deepCopy();
            final String marker = MARKER_PREFIX + nextHop.trim() + MARKER_SUFFIX;
            switch (entry.entityType()) {
                case AGGREGATE_DATA_VALUE -> {
                    appendToComment((ObjectNode) root, marker);
                    // ADR-0027 alpha.6: rewrite orgUnit so central stores the
                    // dataValue under the destination OU. Receiving edge finds
                    // it via its normal bound-OU scan.
                    ((ObjectNode) root).put("orgUnit", nextHop.trim());
                }
                case EVENT, PROGRAM_STAGE_EVENT,
                     ENROLLMENT, TRACKED_ENTITY -> pushNote((ObjectNode) root, marker);
                default -> {
                    // all enum constants handled; defensive.
                }
            }
            return root.toString();
        } catch (RuntimeException ex) {
            LOG.warn("referral marker injection failed for {}: {}; publishing raw payload",
                    entry.operationId(), ex.getMessage());
            return entry.payload().toString();
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
