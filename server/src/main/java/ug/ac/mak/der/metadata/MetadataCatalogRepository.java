package ug.ac.mak.der.metadata;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writer and counter for {@code der.metadata_catalog_item} (V030).
 *
 * <p>Every DHIS2 metadata collection that doesn't have a dedicated
 * mirror table (optionSets, indicators, validationRules, etc.) lands
 * here with its full JSONB payload. One upsert per row so the capture
 * surface can serve the exact DHIS2 shape offline.</p>
 */
@Repository
public class MetadataCatalogRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public MetadataCatalogRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public record CatalogItem(String uid, String displayName, JsonNode payload) {
    }

    @Transactional
    public int upsert(final String resource, final List<CatalogItem> rows, final long snapshotId) {
        for (final CatalogItem r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_catalog_item "
                            + "(resource, dhis2_uid, display_name, payload, snapshot_id, "
                            + " imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (resource, dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, "
                            + "payload = EXCLUDED.payload, "
                            + "snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    resource, r.uid(), r.displayName(), writeJson(r.payload()), snapshotId);
        }
        return rows.size();
    }

    public Map<String, Integer> counts() {
        final java.util.LinkedHashMap<String, Integer> out = new java.util.LinkedHashMap<>();
        jdbc.query(
                "SELECT resource, count(*) AS n FROM der.metadata_catalog_item "
                        + "GROUP BY resource ORDER BY resource",
                (rs) -> {
                    out.put(rs.getString("resource"), rs.getInt("n"));
                });
        return out;
    }

    private String writeJson(final JsonNode n) {
        try {
            return json.writeValueAsString(n == null ? json.createObjectNode() : n);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("could not serialise metadata catalog payload", ex);
        }
    }
}
