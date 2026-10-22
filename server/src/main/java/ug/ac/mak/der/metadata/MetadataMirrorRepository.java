package ug.ac.mak.der.metadata;

import java.io.IOException;
import java.sql.ResultSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reader and bulk-upsert writer for the five {@code metadata_*} mirror tables.
 *
 * <p>Writes happen only via {@link MetadataSyncService}. Reads are consumed by
 * the DHIS2-emulator controllers under {@code /api/*}. All list queries
 * stable-sort by {@code display_name} to give deterministic responses.</p>
 */
@Repository
public class MetadataMirrorRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public MetadataMirrorRepository(final JdbcTemplate jdbc, final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    // ------- Organisation units -------

    @Transactional
    public int upsertOrganisationUnits(final List<MirroredOrganisationUnit> rows, final long snapshotId) {
        for (final MirroredOrganisationUnit r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_organisation_unit "
                            + "(dhis2_uid, display_name, path, level, parent_uid, payload, snapshot_id, "
                            + " imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, path = EXCLUDED.path, "
                            + "level = EXCLUDED.level, parent_uid = EXCLUDED.parent_uid, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.path(), r.level(), r.parentUid(),
                    writeJson(r.payload()), snapshotId
            );
        }
        return rows.size();
    }

    public List<MirroredOrganisationUnit> findAllOrganisationUnits() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, path, level, parent_uid, payload "
                        + "FROM der.metadata_organisation_unit ORDER BY display_name",
                organisationUnitMapper()
        );
    }

    public Optional<MirroredOrganisationUnit> findOrganisationUnit(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, path, level, parent_uid, payload "
                        + "FROM der.metadata_organisation_unit WHERE dhis2_uid = ?",
                organisationUnitMapper(), uid));
    }

    // ------- Data elements -------

    @Transactional
    public int upsertDataElements(final List<MirroredDataElement> rows, final long snapshotId) {
        for (final MirroredDataElement r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_data_element "
                            + "(dhis2_uid, display_name, value_type, domain_type, payload, snapshot_id, "
                            + " imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, value_type = EXCLUDED.value_type, "
                            + "domain_type = EXCLUDED.domain_type, payload = EXCLUDED.payload, "
                            + "snapshot_id = EXCLUDED.snapshot_id, last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.valueType(), r.domainType(),
                    writeJson(r.payload()), snapshotId
            );
        }
        return rows.size();
    }

    public List<MirroredDataElement> findAllDataElements() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, value_type, domain_type, payload "
                        + "FROM der.metadata_data_element ORDER BY display_name",
                dataElementMapper()
        );
    }

    public Optional<MirroredDataElement> findDataElement(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, value_type, domain_type, payload "
                        + "FROM der.metadata_data_element WHERE dhis2_uid = ?",
                dataElementMapper(), uid));
    }

    // ------- Data sets -------

    @Transactional
    public int upsertDataSets(final List<MirroredDataSet> rows, final long snapshotId) {
        for (final MirroredDataSet r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_data_set "
                            + "(dhis2_uid, display_name, period_type, payload, snapshot_id, "
                            + " imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, period_type = EXCLUDED.period_type, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.periodType(),
                    writeJson(r.payload()), snapshotId
            );
        }
        return rows.size();
    }

    public List<MirroredDataSet> findAllDataSets() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, period_type, payload "
                        + "FROM der.metadata_data_set ORDER BY display_name",
                dataSetMapper()
        );
    }

    public Optional<MirroredDataSet> findDataSet(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, period_type, payload "
                        + "FROM der.metadata_data_set WHERE dhis2_uid = ?",
                dataSetMapper(), uid));
    }

    // ------- Programs -------

    @Transactional
    public int upsertPrograms(final List<MirroredProgram> rows, final long snapshotId) {
        for (final MirroredProgram r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_program "
                            + "(dhis2_uid, display_name, program_type, tracked_entity_type_uid, "
                            + " payload, snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, program_type = EXCLUDED.program_type, "
                            + "tracked_entity_type_uid = EXCLUDED.tracked_entity_type_uid, "
                            + "payload = EXCLUDED.payload, snapshot_id = EXCLUDED.snapshot_id, "
                            + "last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), r.programType(), r.trackedEntityTypeUid(),
                    writeJson(r.payload()), snapshotId
            );
        }
        return rows.size();
    }

    public List<MirroredProgram> findAllPrograms() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, program_type, tracked_entity_type_uid, payload "
                        + "FROM der.metadata_program ORDER BY display_name",
                programMapper()
        );
    }

    public Optional<MirroredProgram> findProgram(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, program_type, tracked_entity_type_uid, payload "
                        + "FROM der.metadata_program WHERE dhis2_uid = ?",
                programMapper(), uid));
    }

    // ------- Tracked entity types -------

    @Transactional
    public int upsertTrackedEntityTypes(final List<MirroredTrackedEntityType> rows, final long snapshotId) {
        for (final MirroredTrackedEntityType r : rows) {
            jdbc.update(
                    "INSERT INTO der.metadata_tracked_entity_type "
                            + "(dhis2_uid, display_name, payload, snapshot_id, imported_at, last_seen_at) "
                            + "VALUES (?, ?, CAST(? AS jsonb), ?, now(), now()) "
                            + "ON CONFLICT (dhis2_uid) DO UPDATE SET "
                            + "display_name = EXCLUDED.display_name, payload = EXCLUDED.payload, "
                            + "snapshot_id = EXCLUDED.snapshot_id, last_seen_at = now()",
                    r.dhis2Uid(), r.displayName(), writeJson(r.payload()), snapshotId
            );
        }
        return rows.size();
    }

    public List<MirroredTrackedEntityType> findAllTrackedEntityTypes() {
        return jdbc.query(
                "SELECT dhis2_uid, display_name, payload "
                        + "FROM der.metadata_tracked_entity_type ORDER BY display_name",
                trackedEntityTypeMapper()
        );
    }

    public Optional<MirroredTrackedEntityType> findTrackedEntityType(final String uid) {
        return single(() -> jdbc.queryForObject(
                "SELECT dhis2_uid, display_name, payload "
                        + "FROM der.metadata_tracked_entity_type WHERE dhis2_uid = ?",
                trackedEntityTypeMapper(), uid));
    }

    // ------- helpers -------

    private String writeJson(final JsonNode node) {
        try {
            return json.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialise mirrored payload", ex);
        }
    }

    private JsonNode readJson(final String raw) {
        try {
            return json.readTree(raw);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to parse mirrored payload", ex);
        }
    }

    private <T> Optional<T> single(final SingleFetcher<T> fetcher) {
        try {
            return Optional.ofNullable(fetcher.get());
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    @FunctionalInterface
    private interface SingleFetcher<T> {
        T get();
    }

    private RowMapper<MirroredOrganisationUnit> organisationUnitMapper() {
        return (ResultSet rs, int rowNum) -> new MirroredOrganisationUnit(
                rs.getString("dhis2_uid"),
                rs.getString("display_name"),
                rs.getString("path"),
                (Integer) rs.getObject("level"),
                rs.getString("parent_uid"),
                readJson(rs.getString("payload"))
        );
    }

    private RowMapper<MirroredDataElement> dataElementMapper() {
        return (ResultSet rs, int rowNum) -> new MirroredDataElement(
                rs.getString("dhis2_uid"),
                rs.getString("display_name"),
                rs.getString("value_type"),
                rs.getString("domain_type"),
                readJson(rs.getString("payload"))
        );
    }

    private RowMapper<MirroredDataSet> dataSetMapper() {
        return (ResultSet rs, int rowNum) -> new MirroredDataSet(
                rs.getString("dhis2_uid"),
                rs.getString("display_name"),
                rs.getString("period_type"),
                readJson(rs.getString("payload"))
        );
    }

    private RowMapper<MirroredProgram> programMapper() {
        return (ResultSet rs, int rowNum) -> new MirroredProgram(
                rs.getString("dhis2_uid"),
                rs.getString("display_name"),
                rs.getString("program_type"),
                rs.getString("tracked_entity_type_uid"),
                readJson(rs.getString("payload"))
        );
    }

    private RowMapper<MirroredTrackedEntityType> trackedEntityTypeMapper() {
        return (ResultSet rs, int rowNum) -> new MirroredTrackedEntityType(
                rs.getString("dhis2_uid"),
                rs.getString("display_name"),
                readJson(rs.getString("payload"))
        );
    }
}
