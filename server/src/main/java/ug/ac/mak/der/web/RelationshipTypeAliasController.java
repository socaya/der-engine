package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Admin alias overrides for relationship types
 *  (spec §REL-C-017). Writes the admin_from_to_name /
 *  admin_to_from_name columns on metadata_relationship_type
 *  (V101). RelationshipTypeController.list coalesces these over
 *  the payload-derived names so the capture app transparently
 *  sees the overridden labels.
 *
 *  Nullable payload fields clear the override individually —
 *  POST {"fromToName":"Baby","toFromName":null} sets the from-
 *  to-name but leaves the to-from-name whatever it was (if the
 *  admin had previously set it). DELETE on the whole row clears
 *  both overrides at once. */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/relationship-types",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class RelationshipTypeAliasController {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public RelationshipTypeAliasController(final JdbcTemplate jdbc,
                                             final Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PutMapping(path = "/{uid}/aliases",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> putAliases(
            final Authentication authentication,
            @PathVariable("uid") final String uid,
            @RequestBody final AliasRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BODY_REQUIRED",
                    "message", "request body is required"));
        }
        // Verify the type exists before writing — a 404 on an
        // unknown UID beats quietly inserting an orphan override.
        final Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.metadata_relationship_type "
                    + "WHERE dhis2_uid = ?", Integer.class, uid);
        if (exists == null || exists == 0) {
            return ResponseEntity.notFound().build();
        }
        final Instant now = Instant.now(clock);
        // Only write non-null fields so an operator can set one
        // label without unsetting the other. Empty-string also
        // clears — treat "" same as null for ergonomics.
        final String fromTo = normalise(body.fromToName());
        final String toFrom = normalise(body.toFromName());
        if (fromTo == null && toFrom == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "NO_FIELDS",
                    "message", "at least one of fromToName / "
                        + "toFromName must be supplied (or use "
                        + "DELETE to clear)"));
        }
        if (fromTo != null && toFrom != null) {
            jdbc.update(
                    "UPDATE der.metadata_relationship_type "
                        + "SET admin_from_to_name = ?, "
                        + "    admin_to_from_name = ?, "
                        + "    admin_alias_updated_at = ?, "
                        + "    admin_alias_updated_by = ? "
                        + "WHERE dhis2_uid = ?",
                    emptyToNull(fromTo), emptyToNull(toFrom),
                    java.sql.Timestamp.from(now),
                    principal.userId(), uid);
        } else if (fromTo != null) {
            jdbc.update(
                    "UPDATE der.metadata_relationship_type "
                        + "SET admin_from_to_name = ?, "
                        + "    admin_alias_updated_at = ?, "
                        + "    admin_alias_updated_by = ? "
                        + "WHERE dhis2_uid = ?",
                    emptyToNull(fromTo),
                    java.sql.Timestamp.from(now),
                    principal.userId(), uid);
        } else {
            jdbc.update(
                    "UPDATE der.metadata_relationship_type "
                        + "SET admin_to_from_name = ?, "
                        + "    admin_alias_updated_at = ?, "
                        + "    admin_alias_updated_by = ? "
                        + "WHERE dhis2_uid = ?",
                    emptyToNull(toFrom),
                    java.sql.Timestamp.from(now),
                    principal.userId(), uid);
        }
        return readAliases(uid);
    }

    @DeleteMapping("/{uid}/aliases")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> clearAliases(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = jdbc.update(
                "UPDATE der.metadata_relationship_type "
                    + "SET admin_from_to_name = NULL, "
                    + "    admin_to_from_name = NULL, "
                    + "    admin_alias_updated_at = ?, "
                    + "    admin_alias_updated_by = ? "
                    + "WHERE dhis2_uid = ?",
                java.sql.Timestamp.from(Instant.now(clock)),
                principal.userId(), uid);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return readAliases(uid);
    }

    private ResponseEntity<Map<String, Object>> readAliases(final String uid) {
        final Map<String, Object> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT dhis2_uid, display_name, "
                    + "admin_from_to_name, admin_to_from_name "
                    + "FROM der.metadata_relationship_type "
                    + "WHERE dhis2_uid = ?",
                rs -> {
                    out.put("relationshipTypeUid", rs.getString(1));
                    out.put("displayName", rs.getString(2));
                    out.put("adminFromToName", rs.getString(3));
                    out.put("adminToFromName", rs.getString(4));
                }, uid);
        return ResponseEntity.ok(out);
    }

    private static String normalise(final String s) {
        if (s == null) {
            return null;
        }
        return s.trim();
    }

    private static String emptyToNull(final String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s;
    }

    public record AliasRequest(
            @JsonProperty("fromToName") String fromToName,
            @JsonProperty("toFromName") String toFromName) { }
}
