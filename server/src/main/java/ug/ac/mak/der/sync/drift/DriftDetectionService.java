package ug.ac.mak.der.sync.drift;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.metadata.MetadataSnapshot;
import ug.ac.mak.der.metadata.MetadataSnapshotRepository;

/**
 * Computes drift between the two most recent {@code metadata_snapshot} rows.
 * Writes a {@link DriftSnapshot} per invocation. ADR-0008 §Drift detection.
 */
@Service
public class DriftDetectionService {

    private static final Logger LOG = LoggerFactory.getLogger(DriftDetectionService.class);

    private static final Map<String, String> MIRROR_TABLES = new LinkedHashMap<>();

    static {
        MIRROR_TABLES.put("ORGANISATION_UNIT", "der.metadata_organisation_unit");
        MIRROR_TABLES.put("DATA_ELEMENT", "der.metadata_data_element");
        MIRROR_TABLES.put("DATA_SET", "der.metadata_data_set");
        MIRROR_TABLES.put("PROGRAM", "der.metadata_program");
        MIRROR_TABLES.put("TRACKED_ENTITY_TYPE", "der.metadata_tracked_entity_type");
        MIRROR_TABLES.put("CATEGORY_OPTION_COMBO", "der.metadata_category_option_combo");
        MIRROR_TABLES.put("PROGRAM_STAGE", "der.metadata_program_stage");
        MIRROR_TABLES.put("TRACKED_ENTITY_ATTRIBUTE", "der.metadata_tracked_entity_attribute");
        MIRROR_TABLES.put("PROGRAM_RULE", "der.metadata_program_rule");
    }

    private final MetadataSnapshotRepository snapshots;
    private final DriftSnapshotRepository drifts;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public DriftDetectionService(final MetadataSnapshotRepository snapshots,
                                  final DriftSnapshotRepository drifts,
                                  final JdbcTemplate jdbc,
                                  final ObjectMapper mapper) {
        this.snapshots = Objects.requireNonNull(snapshots, "snapshots");
        this.drifts = Objects.requireNonNull(drifts, "drifts");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /** Compute drift between the two most recent snapshots and persist. */
    public DriftReport recordLatestDelta(final String triggeredBy) {
        final List<MetadataSnapshot> recent = snapshots.findRecent(2);
        if (recent.size() < 2) {
            LOG.info("Drift: fewer than two snapshots available; nothing to compare");
            return DriftReport.empty();
        }
        final MetadataSnapshot to = recent.get(0);
        final MetadataSnapshot from = recent.get(1);
        return compute(from, to, triggeredBy);
    }

    public DriftReport compute(final MetadataSnapshot from, final MetadataSnapshot to,
                                final String triggeredBy) {
        final Map<String, EntityDelta> deltas = new LinkedHashMap<>();
        for (final Map.Entry<String, String> entry : MIRROR_TABLES.entrySet()) {
            deltas.put(entry.getKey(), computeDelta(entry.getValue(),
                    from.snapshotId(), to.snapshotId()));
        }
        final DriftReport report = new DriftReport(from.snapshotId(), to.snapshotId(),
                from.fingerprint(), to.fingerprint(), deltas);
        try {
            drifts.insert(new DriftSnapshot(null, java.time.Instant.now(),
                    from.snapshotId(), to.snapshotId(), from.fingerprint(), to.fingerprint(),
                    mapper.writeValueAsString(report), triggeredBy));
        } catch (JsonProcessingException ex) {
            LOG.warn("drift serialisation failed: {}", ex.getMessage());
        }
        return report;
    }

    public Optional<DriftSnapshot> latest() {
        return drifts.findLatest();
    }

    private EntityDelta computeDelta(final String table, final long fromId, final long toId) {
        final List<String> fromUids = jdbc.queryForList(
                "SELECT dhis2_uid FROM " + table + " WHERE snapshot_id = ?",
                String.class, fromId);
        final List<String> toUids = jdbc.queryForList(
                "SELECT dhis2_uid FROM " + table + " WHERE snapshot_id = ?",
                String.class, toId);
        final Set<String> fromSet = new TreeSet<>(fromUids);
        final Set<String> toSet = new TreeSet<>(toUids);
        final List<String> added = new ArrayList<>();
        for (final String uid : toSet) {
            if (!fromSet.contains(uid)) {
                added.add(uid);
            }
        }
        final List<String> removed = new ArrayList<>();
        for (final String uid : fromSet) {
            if (!toSet.contains(uid)) {
                removed.add(uid);
            }
        }
        // "changed" would require payload-hash comparison; alpha.5 reports
        // added/removed only. Full payload-hash diff is Phase 06 UI concern.
        return new EntityDelta(added, removed, Collections.emptyList());
    }

    public record DriftReport(
            long snapshotFrom,
            long snapshotTo,
            String fingerprintFrom,
            String fingerprintTo,
            Map<String, EntityDelta> perEntity
    ) {
        static DriftReport empty() {
            return new DriftReport(0, 0, null, null, Collections.emptyMap());
        }
    }

    public record EntityDelta(List<String> added, List<String> removed, List<String> changed) {
        public EntityDelta {
            added = List.copyOf(added);
            removed = List.copyOf(removed);
            changed = List.copyOf(changed);
        }
    }
}
