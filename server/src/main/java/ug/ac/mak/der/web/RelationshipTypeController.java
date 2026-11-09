package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredRelationshipType;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Relationships slice 4 — edge-local list of mirrored relationship
 * types. The Capture app's relationship picker reads from here so
 * it works offline (slice 1 populated the mirror table on every
 * metadata sync). Optionally filters by tracked-entity type UID so
 * the picker only shows types valid for the current TEI side.
 *
 * <p>Writes go through {@link TrackerRelationshipController}; this
 * controller is read-only.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/relationship-types",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class RelationshipTypeController {

    private final ExtendedMirrorRepository mirror;

    public RelationshipTypeController(final ExtendedMirrorRepository mirror) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication,
            @RequestParam(value = "trackedEntityType", required = false)
            final String tetUid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<MirroredRelationshipType> rows =
                tetUid == null || tetUid.isBlank()
                        ? mirror.findAllRelationshipTypes()
                        : mirror.findRelationshipTypesForTrackedEntityType(tetUid);
        return ResponseEntity.ok(Map.of("relationshipTypes",
                rows.stream().map(RelationshipTypeController::toJson).toList()));
    }

    private static Map<String, Object> toJson(final MirroredRelationshipType r) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("relationshipTypeUid", r.dhis2Uid());
        out.put("displayName", r.displayName());
        out.put("bidirectional", r.bidirectional());
        out.put("fromConstraintKind", r.fromConstraintKind());
        out.put("fromConstraintUid", r.fromConstraintUid());
        out.put("toConstraintKind", r.toConstraintKind());
        out.put("toConstraintUid", r.toConstraintUid());
        // Directional labels — these live only in the raw payload
        // JSON on the mirror so the capture UI can render operator-
        // friendly labels ("Baby" / "Mother") instead of the
        // compound displayName. Null-tolerant: types that haven't
        // configured either name fall back to displayName client-
        // side.
        final String fromToName = optionalString(r.payload(), "fromToName");
        final String toFromName = optionalString(r.payload(), "toFromName");
        if (fromToName != null) {
            out.put("fromToName", fromToName);
        }
        if (toFromName != null) {
            out.put("toFromName", toFromName);
        }
        return out;
    }

    private static String optionalString(
            final com.fasterxml.jackson.databind.JsonNode payload,
            final String field) {
        if (payload == null || !payload.hasNonNull(field)) {
            return null;
        }
        final String v = payload.get(field).asText(null);
        return v == null || v.isBlank() ? null : v;
    }
}
