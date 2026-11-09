package ug.ac.mak.der.workflows.composites;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Persistence for composite DER_DOMAIN entities (spec §4). */
@Repository
public class DomainCompositeRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public DomainCompositeRepository(final JdbcTemplate jdbc,
                                       final ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    // ---------------------------------------------------------
    // Kind catalogue
    // ---------------------------------------------------------

    public record KindRow(String kindCode, String displayName,
                            String description,
                            String headProgramStageUid,
                            String itemProgramStageUid,
                            String syncPolicy,
                            JsonNode allowedStatuses) { }

    public List<KindRow> listKinds() {
        return jdbc.query(
                "SELECT kind_code, display_name, description, "
                    + "head_program_stage_uid, item_program_stage_uid, "
                    + "sync_policy, allowed_statuses "
                    + "FROM der.der_domain_composite_kind "
                    + "WHERE deleted_at IS NULL "
                    + "ORDER BY display_name",
                (rs, n) -> toKindRow(rs));
    }

    public Optional<KindRow> findKind(final String code) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT kind_code, display_name, description, "
                        + "head_program_stage_uid, "
                        + "item_program_stage_uid, "
                        + "sync_policy, allowed_statuses "
                        + "FROM der.der_domain_composite_kind "
                        + "WHERE kind_code = ? AND deleted_at IS NULL",
                    (rs, n) -> toKindRow(rs), code));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public void upsertKind(final KindRow k) {
        jdbc.update(
                "INSERT INTO der.der_domain_composite_kind "
                    + "(kind_code, display_name, description, "
                    + " head_program_stage_uid, item_program_stage_uid, "
                    + " sync_policy, allowed_statuses, "
                    + " created_at, updated_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, "
                    + "        now(), now()) "
                    + "ON CONFLICT (kind_code) DO UPDATE SET "
                    + "display_name = EXCLUDED.display_name, "
                    + "description = EXCLUDED.description, "
                    + "head_program_stage_uid "
                    + "  = EXCLUDED.head_program_stage_uid, "
                    + "item_program_stage_uid "
                    + "  = EXCLUDED.item_program_stage_uid, "
                    + "sync_policy = EXCLUDED.sync_policy, "
                    + "allowed_statuses = EXCLUDED.allowed_statuses, "
                    + "updated_at = now()",
                k.kindCode(), k.displayName(), k.description(),
                k.headProgramStageUid(), k.itemProgramStageUid(),
                k.syncPolicy() == null ? "EDGE_ONLY" : k.syncPolicy(),
                writeJson(k.allowedStatuses()));
    }

    public int softDeleteKind(final String code) {
        return jdbc.update(
                "UPDATE der.der_domain_composite_kind "
                    + "SET deleted_at = now() "
                    + "WHERE kind_code = ? AND deleted_at IS NULL",
                code);
    }

    // ---------------------------------------------------------
    // Composites + items
    // ---------------------------------------------------------

    @Transactional
    public DomainComposite insert(final DomainComposite c) {
        jdbc.update(
                "INSERT INTO der.der_domain_composite "
                    + "(composite_uid, kind_code, anchor_event_uid, "
                    + " anchor_enrollment_uid, anchor_tei_uid, "
                    + " org_unit_uid, status, head_payload, "
                    + " created_by, created_at, updated_at, "
                    + " composite_version) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, "
                    + "        ?, ?, ?, ?)",
                c.compositeUid(), c.kindCode(), c.anchorEventUid(),
                c.anchorEnrollmentUid(), c.anchorTeiUid(),
                c.orgUnitUid(), c.status(),
                writeJson(c.headPayload()),
                c.createdBy(),
                Timestamp.from(c.createdAt()),
                Timestamp.from(c.updatedAt()),
                c.version());
        for (final DomainCompositeItem it : c.items()) {
            jdbc.update(
                    "INSERT INTO der.der_domain_composite_item "
                        + "(item_uid, composite_uid, line_no, "
                        + " item_payload, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?::jsonb, ?, ?)",
                    it.itemUid(), c.compositeUid(), it.lineNo(),
                    writeJson(it.itemPayload()),
                    Timestamp.from(it.createdAt()),
                    Timestamp.from(it.updatedAt()));
        }
        return c;
    }

    public Optional<DomainComposite> findById(final String uid) {
        try {
            final DomainComposite head = jdbc.queryForObject(
                    "SELECT * FROM der.der_domain_composite "
                        + "WHERE composite_uid = ? "
                        + "  AND deleted_at IS NULL",
                    headMapper(), uid);
            if (head == null) {
                return Optional.empty();
            }
            final List<DomainCompositeItem> items = findItems(uid);
            return Optional.of(new DomainComposite(
                    head.compositeUid(), head.kindCode(),
                    head.anchorEventUid(), head.anchorEnrollmentUid(),
                    head.anchorTeiUid(), head.orgUnitUid(),
                    head.status(), head.headPayload(), items,
                    head.createdBy(), head.createdAt(),
                    head.updatedAt(), head.deletedAt(),
                    head.version()));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<DomainComposite> findByAnchorEvent(final String eventUid) {
        final List<DomainComposite> heads = jdbc.query(
                "SELECT * FROM der.der_domain_composite "
                    + "WHERE anchor_event_uid = ? "
                    + "  AND deleted_at IS NULL "
                    + "ORDER BY created_at DESC",
                headMapper(), eventUid);
        if (heads.isEmpty()) {
            return heads;
        }
        final Map<String, List<DomainCompositeItem>> itemsByHead =
                findItemsForComposites(heads.stream()
                    .map(DomainComposite::compositeUid).toList());
        final List<DomainComposite> out = new ArrayList<>(heads.size());
        for (final DomainComposite h : heads) {
            out.add(new DomainComposite(h.compositeUid(), h.kindCode(),
                    h.anchorEventUid(), h.anchorEnrollmentUid(),
                    h.anchorTeiUid(), h.orgUnitUid(),
                    h.status(), h.headPayload(),
                    itemsByHead.getOrDefault(h.compositeUid(), List.of()),
                    h.createdBy(), h.createdAt(), h.updatedAt(),
                    h.deletedAt(), h.version()));
        }
        return out;
    }

    public List<DomainCompositeItem> findItems(final String compositeUid) {
        return jdbc.query(
                "SELECT item_uid, composite_uid, line_no, item_payload, "
                    + " created_at, updated_at "
                    + "FROM der.der_domain_composite_item "
                    + "WHERE composite_uid = ? ORDER BY line_no",
                itemMapper(), compositeUid);
    }

    private Map<String, List<DomainCompositeItem>> findItemsForComposites(
            final List<String> uids) {
        if (uids.isEmpty()) {
            return Map.of();
        }
        final String placeholders = String.join(",",
                uids.stream().map(u -> "?").toList());
        final List<DomainCompositeItem> items = jdbc.query(
                "SELECT item_uid, composite_uid, line_no, item_payload, "
                    + " created_at, updated_at "
                    + "FROM der.der_domain_composite_item "
                    + "WHERE composite_uid IN (" + placeholders + ") "
                    + "ORDER BY composite_uid, line_no",
                itemMapper(), uids.toArray());
        final Map<String, List<DomainCompositeItem>> out = new HashMap<>();
        for (final DomainCompositeItem it : items) {
            out.computeIfAbsent(it.compositeUid(),
                    k -> new ArrayList<>()).add(it);
        }
        return out;
    }

    /** Replace the item collection atomically — the API is PUT-
     *  with-full-list semantics so a client that sends an item list
     *  with 3 rows ends up with exactly 3 rows (anything previously
     *  present but not in the new list is removed). Simpler than
     *  diff-based patches and matches typical "edit the order
     *  sheet" interactions. */
    @Transactional
    public void replaceItems(final String compositeUid,
                              final List<DomainCompositeItem> items,
                              final Instant at) {
        jdbc.update("DELETE FROM der.der_domain_composite_item "
                + "WHERE composite_uid = ?", compositeUid);
        for (final DomainCompositeItem it : items) {
            jdbc.update(
                    "INSERT INTO der.der_domain_composite_item "
                        + "(item_uid, composite_uid, line_no, "
                        + " item_payload, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?::jsonb, ?, ?)",
                    it.itemUid(), compositeUid, it.lineNo(),
                    writeJson(it.itemPayload()),
                    Timestamp.from(it.createdAt()),
                    Timestamp.from(it.updatedAt()));
        }
        jdbc.update("UPDATE der.der_domain_composite "
                + "SET updated_at = ?, "
                + "    composite_version = composite_version + 1 "
                + "WHERE composite_uid = ?",
                Timestamp.from(at), compositeUid);
    }

    public int updateHead(final String compositeUid,
                           final String status,
                           final JsonNode headPayload,
                           final Instant at) {
        return jdbc.update(
                "UPDATE der.der_domain_composite "
                    + "SET status = ?, head_payload = ?::jsonb, "
                    + "    updated_at = ?, "
                    + "    composite_version = composite_version + 1 "
                    + "WHERE composite_uid = ? "
                    + "  AND deleted_at IS NULL",
                status, writeJson(headPayload),
                Timestamp.from(at), compositeUid);
    }

    public int softDelete(final String compositeUid, final Instant at) {
        return jdbc.update(
                "UPDATE der.der_domain_composite "
                    + "SET deleted_at = ?, updated_at = ?, "
                    + "    composite_version = composite_version + 1 "
                    + "WHERE composite_uid = ? "
                    + "  AND deleted_at IS NULL",
                Timestamp.from(at), Timestamp.from(at), compositeUid);
    }

    // ---------------------------------------------------------
    // Mappers
    // ---------------------------------------------------------

    private KindRow toKindRow(final ResultSet rs)
            throws java.sql.SQLException {
        return new KindRow(
                rs.getString("kind_code"),
                rs.getString("display_name"),
                rs.getString("description"),
                rs.getString("head_program_stage_uid"),
                rs.getString("item_program_stage_uid"),
                rs.getString("sync_policy"),
                readJson(rs.getString("allowed_statuses")));
    }

    private org.springframework.jdbc.core.RowMapper<DomainComposite>
            headMapper() {
        return (ResultSet rs, int n) -> new DomainComposite(
                rs.getString("composite_uid"),
                rs.getString("kind_code"),
                rs.getString("anchor_event_uid"),
                rs.getString("anchor_enrollment_uid"),
                rs.getString("anchor_tei_uid"),
                rs.getString("org_unit_uid"),
                rs.getString("status"),
                readJsonNonNull(rs.getString("head_payload")),
                List.of(),
                (UUID) rs.getObject("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getTimestamp("deleted_at") == null ? null
                    : rs.getTimestamp("deleted_at").toInstant(),
                rs.getInt("composite_version"));
    }

    private org.springframework.jdbc.core.RowMapper<DomainCompositeItem>
            itemMapper() {
        return (ResultSet rs, int n) -> new DomainCompositeItem(
                rs.getString("item_uid"),
                rs.getString("composite_uid"),
                rs.getInt("line_no"),
                readJsonNonNull(rs.getString("item_payload")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    /** Writes a JsonNode as a String so JDBC passes it through the
     *  SQL ::jsonb cast in the surrounding INSERT/UPDATE
     *  statements. Pattern matches ExtendedMirrorRepository.
     *  writeJson — PGobject isn't on the classpath and using the
     *  text cast keeps the driver pluggable. */
    private String writeJson(final JsonNode node) {
        if (node == null) {
            return null;
        }
        try {
            return json.writeValueAsString(node);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(
                    "failed to serialise JSONB", ex);
        }
    }

    private JsonNode readJson(final String s) {
        if (s == null) {
            return null;
        }
        try {
            return json.readTree(s);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private JsonNode readJsonNonNull(final String s) {
        if (s == null) {
            return json.createObjectNode();
        }
        try {
            return json.readTree(s);
        } catch (JsonProcessingException ex) {
            return json.createObjectNode();
        }
    }

}
