package ug.ac.mak.der.analytics.engine;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Resolves OptionSet option codes to their display names using the
 * {@code der.metadata_catalog_item} mirror (V030, resource =
 * {@code optionSets}).
 *
 * <p>Phase 4b — DHIS2 OptionSets become dimension labels. Codes
 * like {@code "F"} stay on disk (deterministic PK); the query path
 * uses this service to surface {@code "Female"} on the response so
 * the admin UI pivots render human labels without a second trip.</p>
 *
 * <p>The payload shape honoured here is the DHIS2 export
 * contract: {@code { "id": …, "name": …, "options": [ { "code":
 * "F", "displayName": "Female" }, … ] } }. Options missing a
 * {@code code} are skipped — a {@code name}-only option can't be
 * joined against a stored dimension value.</p>
 */
@Service
public class OptionSetLookup {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public OptionSetLookup(final JdbcTemplate jdbc,
                             final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    /** code → displayName for one OptionSet. Returns an empty map
     *  when the OptionSet isn't mirrored (metadata not synced yet). */
    public Map<String, String> labelsFor(final String optionSetUid) {
        if (optionSetUid == null || optionSetUid.isBlank()) {
            return Map.of();
        }
        try {
            final String raw = jdbc.queryForObject(
                    "SELECT payload::text "
                  + "  FROM der.metadata_catalog_item "
                  + " WHERE resource = 'optionSets' AND dhis2_uid = ?",
                    String.class, optionSetUid);
            if (raw == null) {
                return Map.of();
            }
            return parseOptions(raw);
        } catch (EmptyResultDataAccessException ex) {
            return Map.of();
        }
    }

    /** Resolve many OptionSets in one call (admin UI pivot panel).
     *  Returns a nested map {@code optionSetUid → code → displayName}. */
    public Map<String, Map<String, String>> labelsFor(
            final Set<String> optionSetUids) {
        if (optionSetUids == null || optionSetUids.isEmpty()) {
            return Map.of();
        }
        final Map<String, Map<String, String>> out = new LinkedHashMap<>();
        for (final String uid : optionSetUids) {
            final Map<String, String> m = labelsFor(uid);
            if (!m.isEmpty()) {
                out.put(uid, m);
            }
        }
        return out;
    }

    /** Build a per-request cache so a batch of cells all drawing on
     *  the same OptionSets only hits the DB once. */
    public Cache cache() {
        return new Cache();
    }

    public final class Cache {
        private final Map<String, Map<String, String>> byUid = new HashMap<>();

        public Map<String, String> labelsFor(final String optionSetUid) {
            if (optionSetUid == null || optionSetUid.isBlank()) {
                return Map.of();
            }
            Map<String, String> m = byUid.get(optionSetUid);
            if (m == null) {
                m = OptionSetLookup.this.labelsFor(optionSetUid);
                byUid.put(optionSetUid, m);
            }
            return m;
        }

        /** Resolve one (code, optionSetUid) pair. Returns the raw
         *  code when the OptionSet isn't mirrored or the code isn't
         *  found — keeps the UI deterministic rather than hiding
         *  values. */
        public String label(final String optionSetUid, final String code) {
            if (code == null) {
                return null;
            }
            final Map<String, String> m = labelsFor(optionSetUid);
            final String label = m.get(code);
            return label == null ? code : label;
        }
    }

    private Map<String, String> parseOptions(final String payloadJson) {
        try {
            final JsonNode root = json.readTree(payloadJson);
            final JsonNode opts = root.get("options");
            if (opts == null || !opts.isArray()) {
                return Map.of();
            }
            final Map<String, String> out = new LinkedHashMap<>();
            for (final JsonNode o : opts) {
                final String code = text(o, "code");
                if (code == null || code.isBlank()) {
                    continue;
                }
                final String label = firstNonBlank(
                        text(o, "displayName"), text(o, "name"), code);
                out.put(code, label);
            }
            return out;
        } catch (RuntimeException | java.io.IOException ex) {
            return Map.of();
        }
    }

    private static String text(final JsonNode n, final String key) {
        final JsonNode v = n.get(key);
        return v == null || v.isNull() ? null : v.asText(null);
    }

    private static String firstNonBlank(final String a, final String b,
                                          final String fallback) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return fallback;
    }
}
