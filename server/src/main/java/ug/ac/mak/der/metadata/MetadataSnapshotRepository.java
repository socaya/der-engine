package ug.ac.mak.der.metadata;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Writer and reader for {@code der.metadata_snapshot}.
 *
 * <p>Phase 03b always writes a new row per sync; nothing updates in place.
 * The service layer stamps the returned {@code snapshotId} on every mirror
 * row it touches so drift detection in Phase 05 can tell "touched in this
 * batch" from "stale".</p>
 */
@Repository
public class MetadataSnapshotRepository {

    private final JdbcTemplate jdbc;

    public MetadataSnapshotRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public MetadataSnapshot insert(final MetadataSnapshot snapshot) {
        final Long id = jdbc.queryForObject(
                "INSERT INTO der.metadata_snapshot "
                        + "(imported_from, imported_by, imported_at, "
                        + " organisation_units_count, data_elements_count, data_sets_count, "
                        + " programs_count, tracked_entity_types_count, "
                        + " central_version, central_revision, fingerprint) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "RETURNING snapshot_id",
                Long.class,
                snapshot.importedFrom(),
                snapshot.importedBy(),
                Timestamp.from(snapshot.importedAt()),
                snapshot.counts().organisationUnits(),
                snapshot.counts().dataElements(),
                snapshot.counts().dataSets(),
                snapshot.counts().programs(),
                snapshot.counts().trackedEntityTypes(),
                snapshot.centralVersion(),
                snapshot.centralRevision(),
                snapshot.fingerprint()
        );
        return new MetadataSnapshot(
                id == null ? 0L : id,
                snapshot.importedFrom(),
                snapshot.importedBy(),
                snapshot.importedAt(),
                snapshot.counts(),
                snapshot.centralVersion(),
                snapshot.centralRevision(),
                snapshot.fingerprint()
        );
    }

    public Optional<MetadataSnapshot> findLatest() {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT snapshot_id, imported_from, imported_by, imported_at, organisation_units_count, "
                            + "data_elements_count, data_sets_count, programs_count, tracked_entity_types_count, "
                            + "central_version, central_revision, fingerprint "
                            + "FROM der.metadata_snapshot ORDER BY imported_at DESC LIMIT 1",
                    rowMapper()
            ));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<MetadataSnapshot> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(limit, 100));
        return jdbc.query(
                "SELECT snapshot_id, imported_from, imported_by, imported_at, organisation_units_count, "
                        + "data_elements_count, data_sets_count, programs_count, tracked_entity_types_count, "
                        + "central_version, central_revision, fingerprint "
                        + "FROM der.metadata_snapshot ORDER BY imported_at DESC LIMIT ?",
                rowMapper(),
                capped
        );
    }

    private static RowMapper<MetadataSnapshot> rowMapper() {
        return (ResultSet rs, int rowNum) -> new MetadataSnapshot(
                rs.getLong("snapshot_id"),
                rs.getString("imported_from"),
                rs.getObject("imported_by", UUID.class),
                rs.getTimestamp("imported_at").toInstant(),
                new MetadataSnapshot.Counts(
                        rs.getInt("organisation_units_count"),
                        rs.getInt("data_elements_count"),
                        rs.getInt("data_sets_count"),
                        rs.getInt("programs_count"),
                        rs.getInt("tracked_entity_types_count")
                ),
                rs.getString("central_version"),
                rs.getString("central_revision"),
                rs.getString("fingerprint")
        );
    }
}
