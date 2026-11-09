package ug.ac.mak.der.web;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;

    public RelationshipTypeController(final ExtendedMirrorRepository mirror,
                                        final JdbcTemplate jdbc) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
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
        // REL-C-017: pull admin alias overrides for all types in
        // one shot so the per-type toJson can coalesce them in
        // without N+1. Overrides live outside the MirroredRelationshipType
        // record because they're DER-side state that shouldn't
        // round-trip through metadata sync.
        final Map<String, AdminAliases> aliases = loadAliases();
        final List<Map<String, Object>> list = new ArrayList<>();
        for (final MirroredRelationshipType r : rows) {
            list.add(toJson(r, aliases.get(r.dhis2Uid())));
        }
        return ResponseEntity.ok(Map.of("relationshipTypes", list));
    }

      /** Admin alias overrides keyed by relationship-type UID.
     *  Either field is nullable (unset override falls back to the
     *  payload-derived name). customActions is a raw JSON string
     *  mirroring admin_custom_actions JSONB — forwarded to the
     *  client verbatim. */
    private record AdminAliases(String fromToName, String toFromName,
                                  String customActions) { }

    private Map<String, AdminAliases> loadAliases() {
        final Map<String, AdminAliases> out = new HashMap<>();
        jdbc.query(
                "SELECT dhis2_uid, admin_from_to_name, admin_to_from_name, "
                    + "admin_custom_actions::text "
                    + "FROM der.metadata_relationship_type "
                    + "WHERE admin_from_to_name IS NOT NULL "
                    + "   OR admin_to_from_name IS NOT NULL "
                    + "   OR admin_custom_actions IS NOT NULL",
                rs -> {
                    out.put(rs.getString(1),
                        new AdminAliases(rs.getString(2), rs.getString(3),
                            rs.getString(4)));
                });
        return out;
    }

    private static Map<String, Object> toJson(
            final MirroredRelationshipType r,
            final AdminAliases override) {
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
        //
        // REL-C-017: admin alias override takes precedence when
        // set. Emits adminFromToName / adminToFromName alongside
        // the effective field so the admin UI can distinguish
        // "no override" from "override matches central".
        final String payloadFromTo = optionalString(r.payload(), "fromToName");
        final String payloadToFrom = optionalString(r.payload(), "toFromName");
        final String effFromTo = override != null
                && override.fromToName() != null
                ? override.fromToName() : payloadFromTo;
        final String effToFrom = override != null
                && override.toFromName() != null
                ? override.toFromName() : payloadToFrom;
        if (effFromTo != null) {
            out.put("fromToName", effFromTo);
        }
        if (effToFrom != null) {
            out.put("toFromName", effToFrom);
        }
        if (payloadFromTo != null) {
            out.put("centralFromToName", payloadFromTo);
        }
        if (payloadToFrom != null) {
            out.put("centralToFromName", payloadToFrom);
        }
        if (override != null) {
            if (override.fromToName() != null) {
                out.put("adminFromToName", override.fromToName());
            }
            if (override.toFromName() != null) {
                out.put("adminToFromName", override.toFromName());
            }
            if (override.customActions() != null
                    && !override.customActions().isBlank()) {
                // Emit the raw JSON array parsed into a tree so
                // Jackson serialises it as an array / object, not
                // a double-escaped string.
                try {
                    out.put("customActions", new ObjectMapper()
                        .readTree(override.customActions()));
                } catch (Exception ex) {
                    // Malformed JSON stored in the catalogue —
                    // swallow and skip rather than 500ing the
                    // whole list endpoint.
                    out.put("customActions", null);
                }
            }
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
