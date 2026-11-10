package ug.ac.mak.der.web;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * Batch journal-state lookup for per-row sync chips in the Capture
 * lists (UX deferred task from the Nov-10 UX audit §5 P1).
 *
 * <p>The Capture tracker + event list pages read DHIS2-shaped rows
 * ({@code /api/events}, {@code /api/trackedEntityInstances}) which
 * carry no operation-journal state. Without a join operators can't
 * tell which rows are still edge-local vs centrally accepted.</p>
 *
 * <p>This controller provides a single batch endpoint callable after
 * the list loads: send up to 500 entity refs, receive the latest
 * state per ref. Keeping it a separate call (rather than modifying
 * the DHIS2-shaped payload) preserves DHIS2 wire compatibility and
 * lets the client hydrate the chip asynchronously.</p>
 *
 * <p>Semantics: the latest journal row per {@code (entity_type,
 * entity_ref)} wins. Refs with no journal row are omitted from the
 * response — the client treats their absence as "edge-only, never
 * attempted" which is the correct truth for a brand-new row.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/state",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalStateController {

    /** Hard cap on refs per request. Protects the IN-list query. */
    private static final int MAX_REFS = 500;

    private final JdbcTemplate jdbc;

    public JournalStateController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> state(
            @RequestParam("entityType") final String entityType,
            @RequestParam("refs") final String refsCsv,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalEntry.EntityType et;
        try {
            et = OperationJournalEntry.EntityType.valueOf(entityType);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ENTITY_TYPE_INVALID",
                    "message", "unknown entityType: " + entityType));
        }
        final List<String> refs = new ArrayList<>();
        for (final String raw : Arrays.asList(refsCsv.split(","))) {
            final String r = raw.trim();
            if (!r.isEmpty()) {
                refs.add(r);
            }
        }
        if (refs.isEmpty()) {
            return ResponseEntity.ok(Map.of("refs", Map.of()));
        }
        if (refs.size() > MAX_REFS) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "REFS_TOO_MANY",
                    "message", "refs capped at " + MAX_REFS));
        }

        // SELECT DISTINCT ON picks the newest journal row per entity_ref.
        // `created_at DESC` matches the admin DataModuleController's
        // sync_state subselect — single source of truth for "latest
        // state wins".
        final String in = "?,".repeat(refs.size());
        final String sql =
                "SELECT DISTINCT ON (entity_ref) entity_ref, operation_id, "
              + "       state, attempt_count, updated_at, last_error "
              + "  FROM der.operation_journal "
              + " WHERE entity_type = ? "
              + "   AND entity_ref IN (" + in.substring(0, in.length() - 1) + ") "
              + " ORDER BY entity_ref, created_at DESC";
        final Object[] args = new Object[1 + refs.size()];
        args[0] = et.name();
        for (int i = 0; i < refs.size(); i++) {
            args[i + 1] = refs.get(i);
        }

        final Map<String, Object> byRef = new LinkedHashMap<>();
        jdbc.query(sql, args, (rs, i) -> {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("operationId", rs.getString("operation_id"));
            row.put("state", rs.getString("state"));
            row.put("attemptCount", rs.getInt("attempt_count"));
            final Timestamp t = rs.getTimestamp("updated_at");
            row.put("updatedAt", t == null ? null : t.toInstant().toString());
            final String lastError = rs.getString("last_error");
            if (lastError != null) {
                row.put("lastError", lastError);
            }
            byRef.put(rs.getString("entity_ref"), row);
            return null;
        });

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("entityType", et.name());
        body.put("refs", byRef);
        return ResponseEntity.ok(body);
    }
}
