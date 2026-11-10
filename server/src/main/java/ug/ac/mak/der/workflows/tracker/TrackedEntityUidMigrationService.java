package ug.ac.mak.der.workflows.tracker;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SM-3a — migrate a legacy UUID-shaped TEI UID to a DHIS2-compliant
 * 11-char UID.
 *
 * <p>Pre-fix TEIs were created with {@code java.util.UUID.toString()}
 * (36 chars, hyphenated) which central rejects on every sync tick
 * with {@code UID must be an alphanumeric string of 11 characters
 * starting with a letter}. The journal row sits CENTRAL_REJECTED
 * forever. This service rewrites the UID across every table that
 * references it + resets any rejected rows to PENDING so the
 * worker retries with the valid shape.</p>
 */
@Service
public class TrackedEntityUidMigrationService {

    private static final Logger LOG = LoggerFactory.getLogger(
            TrackedEntityUidMigrationService.class);
    private static final Pattern DHIS2_UID =
            Pattern.compile("^[A-Za-z][A-Za-z0-9]{10}$");
    private static final String ALPHA =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final String ALNUM =
            ALPHA + "0123456789";

    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public TrackedEntityUidMigrationService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Migrate the TEI identified by {@code oldUid} to {@code newUid}
     *  (server-minted when null). Transactional across all affected
     *  tables; throws {@link IllegalArgumentException} for bad
     *  inputs, {@link IllegalStateException} when the source row
     *  doesn't exist or the target UID is already in use.
     *
     *  @return summary row counts for the admin UI. */
    @Transactional
    public MigrationResult migrate(final String oldUid, final String requestedNewUid) {
        if (oldUid == null || oldUid.isBlank()) {
            throw new IllegalArgumentException("oldUid is required");
        }
        if (DHIS2_UID.matcher(oldUid).matches()) {
            throw new IllegalArgumentException(
                    "oldUid '" + oldUid + "' already matches DHIS2 UID shape "
                  + "— nothing to migrate");
        }
        final String newUid = requestedNewUid == null || requestedNewUid.isBlank()
                ? mintUid() : requestedNewUid;
        if (!DHIS2_UID.matcher(newUid).matches()) {
            throw new IllegalArgumentException(
                    "newUid must match ^[A-Za-z][A-Za-z0-9]{10}$ (got "
                  + newUid.length() + " chars)");
        }
        // Source must exist.
        final Integer src = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.tracked_entity WHERE tei_uid = ?",
                Integer.class, oldUid);
        if (src == null || src == 0) {
            throw new IllegalStateException(
                    "no tracked_entity row with tei_uid = " + oldUid);
        }
        // Target must not collide.
        final Integer dst = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.tracked_entity WHERE tei_uid = ?",
                Integer.class, newUid);
        if (dst == null || dst > 0) {
            throw new IllegalStateException(
                    "target tei_uid " + newUid + " is already in use");
        }

        final Map<String, Integer> affected = new LinkedHashMap<>();

        // 1. tracked_entity — the PK update cascades to
        // edge_enrollment via the ON UPDATE CASCADE FK added in V107.
        affected.put("tracked_entity", jdbc.update(
                "UPDATE der.tracked_entity SET tei_uid = ?, updated_at = now() "
              + "WHERE tei_uid = ?", newUid, oldUid));

        // 2. Relationships are polymorphic (no FK), so update any row
        // whose from/to side names the old TEI.
        affected.put("edge_tracker_relationship.from", jdbc.update(
                "UPDATE der.edge_tracker_relationship "
              + "SET from_entity_uid = ?, updated_at = now() "
              + "WHERE from_entity_uid = ? "
              + "  AND from_entity_type = 'TRACKED_ENTITY'",
                newUid, oldUid));
        affected.put("edge_tracker_relationship.to", jdbc.update(
                "UPDATE der.edge_tracker_relationship "
              + "SET to_entity_uid = ?, updated_at = now() "
              + "WHERE to_entity_uid = ? "
              + "  AND to_entity_type = 'TRACKED_ENTITY'",
                newUid, oldUid));

        // 3. Domain composite anchor.
        affected.put("der_domain_composite", jdbc.update(
                "UPDATE der.der_domain_composite "
              + "SET anchor_tei_uid = ? WHERE anchor_tei_uid = ?",
                newUid, oldUid));

        // 4. Operation journal — update entity_ref for TEI rows AND
        // rewrite UID occurrences inside the JSON payload for both
        // TRACKED_ENTITY and ENROLLMENT rows (enrollments carry
        // teiUid in their payload, which central also rejects when
        // it's a UUID).
        affected.put("operation_journal.entity_ref", jdbc.update(
                "UPDATE der.operation_journal SET entity_ref = ? "
              + "WHERE entity_ref = ? AND entity_type = 'TRACKED_ENTITY'",
                newUid, oldUid));
        affected.put("operation_journal.payload_json", jdbc.update(
                "UPDATE der.operation_journal "
              + "SET payload_json = REPLACE(payload_json::text, ?, ?)::jsonb, "
              + "    updated_at = now() "
              + "WHERE payload_json::text LIKE ?",
                "\"" + oldUid + "\"",
                "\"" + newUid + "\"",
                "%" + oldUid + "%"));

        // 5. Reset any CENTRAL_REJECTED rows that referenced the old
        // UID to PENDING. The next drain tick will retry with the
        // valid shape. Scope is TEI + its ENROLLMENT/PROGRAM_STAGE_EVENT
        // children that got rejected because their parent's UID was
        // invalid.
        affected.put("operation_journal.requeued", jdbc.update(
                "UPDATE der.operation_journal "
              + "SET state = 'PENDING', "
              + "    attempt_count = 0, "
              + "    last_error = 'auto-requeued after UID migration', "
              + "    next_attempt_at = NULL, "
              + "    updated_at = now() "
              + "WHERE state = 'CENTRAL_REJECTED' "
              + "  AND payload_json::text LIKE ?",
                "%" + newUid + "%"));

        LOG.info("migrated TEI UID {} -> {}: {}", oldUid, newUid, affected);
        return new MigrationResult(oldUid, newUid, affected);
    }

    /** Generate a DHIS2-shaped 11-char UID using {@link SecureRandom}. */
    private String mintUid() {
        final StringBuilder sb = new StringBuilder(11);
        sb.append(ALPHA.charAt(random.nextInt(ALPHA.length())));
        for (int i = 0; i < 10; i++) {
            sb.append(ALNUM.charAt(random.nextInt(ALNUM.length())));
        }
        return sb.toString();
    }

    public record MigrationResult(String oldUid, String newUid,
                                    Map<String, Integer> affected) { }
}
