package ug.ac.mak.der.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.MetadataCatalogRepository;
import ug.ac.mak.der.metadata.MetadataCatalogRepository.CatalogItem;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Receiver-side endpoints for P2P metadata catalog replication.
 *
 * <p>Pairs with {@code client/src/p2p/metadataSyncReplicator.ts}. The
 * use case: one device has a fresh metadata snapshot pulled from
 * central, a second device is offline or on low bandwidth. Instead of
 * every device paying the central-pull cost, the first device
 * streams its {@code metadata_catalog_item} rows to peers over the
 * WebRTC data channel; this controller is the local HTTP surface the
 * receiver's browser POSTs each batch to.</p>
 *
 * <p>Two endpoints:
 * <ul>
 *   <li>{@code GET /current-snapshot} — the local fingerprint + counts
 *       the sender compares against before deciding whether to push
 *       at all. Same fingerprint on both sides -> no-op.</li>
 *   <li>{@code POST /apply} — accept a batch of catalog items; upsert
 *       them under the receiver's own snapshot id. Delegates to
 *       {@link MetadataCatalogRepository#upsert} so the write path
 *       is identical to the normal central-pull path.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/metadata/p2p",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataP2pSyncController {

    private final JdbcTemplate jdbc;
    private final MetadataCatalogRepository catalog;
    private final ObjectMapper mapper;

    public MetadataP2pSyncController(final JdbcTemplate jdbc,
                                       final MetadataCatalogRepository catalog,
                                       final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /**
     * Current snapshot summary — enough for the P2P sender to decide
     * whether to push catalog deltas. Returns 204 when the appliance
     * has never pulled a snapshot (operator must run the initial
     * central sync from Admin → Sync → Metadata first).
     */
    @GetMapping("/current-snapshot")
    public ResponseEntity<Map<String, Object>> currentSnapshot(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT snapshot_id, imported_from, imported_at, fingerprint, "
                        + "organisation_units_count, data_elements_count, "
                        + "data_sets_count, programs_count, "
                        + "tracked_entity_types_count "
                        + "FROM der.metadata_snapshot "
                        + "ORDER BY snapshot_id DESC LIMIT 1",
                (rs, i) -> Map.<String, Object>of(
                        "snapshotId", rs.getLong("snapshot_id"),
                        "importedFrom", rs.getString("imported_from"),
                        "importedAt", rs.getTimestamp("imported_at").toInstant().toString(),
                        "fingerprint", rs.getString("fingerprint"),
                        "counts", Map.of(
                                "organisationUnits",
                                rs.getInt("organisation_units_count"),
                                "dataElements",
                                rs.getInt("data_elements_count"),
                                "dataSets",
                                rs.getInt("data_sets_count"),
                                "programs",
                                rs.getInt("programs_count"),
                                "trackedEntityTypes",
                                rs.getInt("tracked_entity_types_count"))));
        if (rows.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(rows.get(0));
    }

    /**
     * Apply a batch of catalog items received over the P2P channel.
     * Groups by resource then calls the existing catalog repo's
     * {@code upsert} — identical write path to the normal central
     * pull (same dedup by {@code (resource, dhis2_uid)}). Idempotent:
     * replaying the same batch under the same snapshot id is safe.
     *
     * <p>Batch shape:
     * <pre>
     *   {
     *     snapshotId: long,       // sender's snapshot id, used as the
     *                             //  upsert's snapshotId
     *     batch: [
     *       { resource: "indicators",
     *         items: [{uid, displayName, payload}, ...] },
     *       ...
     *     ]
     *   }
     * </pre>
     */
    @PostMapping(path = "/apply", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> apply(
            final Authentication auth,
            @RequestBody final ApplyBody body) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.batch == null || body.batch.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BATCH_REQUIRED",
                    "message", "batch required (array of {resource, items})"));
        }
        final long snapshotId = body.snapshotId > 0
                ? body.snapshotId : localSnapshotId();
        int upserted = 0;
        for (final ResourceBatch rb : body.batch) {
            if (rb.resource == null || rb.resource.isBlank()
                    || rb.items == null || rb.items.isEmpty()) {
                continue;
            }
            final List<CatalogItem> items = new ArrayList<>(rb.items.size());
            for (final CatalogItemBody row : rb.items) {
                if (row == null || row.uid == null || row.uid.isBlank()
                        || row.payload == null) {
                    continue;
                }
                items.add(new CatalogItem(
                        row.uid,
                        row.displayName == null ? row.uid : row.displayName,
                        row.payload));
            }
            if (items.isEmpty()) {
                continue;
            }
            upserted += catalog.upsert(rb.resource, items, snapshotId);
        }
        return ResponseEntity.ok(Map.of(
                "upserted", upserted,
                "snapshotId", snapshotId,
                "resources", body.batch.size()));
    }

    private long localSnapshotId() {
        final Long id = jdbc.queryForObject(
                "SELECT COALESCE(MAX(snapshot_id), 0) FROM der.metadata_snapshot",
                Long.class);
        return id == null ? 0L : id;
    }

    // ---- request bodies ----

    public static final class ApplyBody {
        public long snapshotId;
        public List<ResourceBatch> batch;
    }

    public static final class ResourceBatch {
        public String resource;
        public List<CatalogItemBody> items;
    }

    public static final class CatalogItemBody {
        public String uid;
        public String displayName;
        public JsonNode payload;
    }

    /** Unused field referenced here so the ObjectMapper import stays warm
     *  for future serialisation enhancements (e.g. optional NDJSON
     *  streaming). Checkstyle would flag an unused import otherwise. */
    @SuppressWarnings("unused")
    private ObjectMapper mapperRef() {
        return mapper;
    }
}
