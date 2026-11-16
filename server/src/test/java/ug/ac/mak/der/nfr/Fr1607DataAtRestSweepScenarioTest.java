package ug.ac.mak.der.nfr;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * FR-16-07 — "Protect data at rest." PostgreSQL CE doesn't ship
 * TDE; filesystem/volume-level encryption (LUKS or equivalent) is
 * a pilot-ops configuration, not a DER-code artefact. What DER
 * owns is the <em>column-level</em> protection surface — every
 * sensitive-shaped column is either hashed (one-way) or sealed
 * (AES-256-GCM via {@link ug.ac.mak.der.security.SecretEnvelope}
 * or the peer-crypto facility). Adding a new plaintext column
 * that looks like a secret would be a silent data-at-rest
 * regression; this test catches it before merge.
 *
 * <p>The pinned inventory below lives in one place so a reviewer
 * can audit "what does DER consider sensitive, and what protection
 * does each column get?" at a glance. A refactor that introduces
 * a new matching column name without landing a row here fails the
 * {@code newSensitiveColumnsLandWithoutExemption} assertion.</p>
 *
 * <p>Works by scanning every migration under
 * {@code database/migrations/} for column definitions whose name
 * matches the PII-shape regex, then verifying each is in the
 * inventory with a declared protection class. Companion to
 * {@code Nfr06ConfidentialitySurfaceScenarioTest} (which pins the
 * runtime {@code SecretEnvelope} seal/open contract); together
 * they cover FR-16-07 end-to-end at the schema + runtime layers.</p>
 *
 * <p>LUKS / Postgres pg_crypto configuration lives in
 * {@code docs/runbooks/data-at-rest.md} and is tested by the
 * pilot evidence script, not here.</p>
 */
class Fr1607DataAtRestSweepScenarioTest {

    /**
     * Classes of at-rest protection DER applies to sensitive
     * columns. Reviewer-facing taxonomy.
     */
    private enum Protection {
        /** One-way bcrypt/argon2/SHA-256 — the plaintext can't
         *  be recovered, only compared. Used for session + enrol
         *  tokens that only need equality checks. */
        HASHED,
        /** AES-256-GCM via {@code SecretEnvelope}, keyed by
         *  {@code der.security.secret-key}. Used for DHIS2
         *  connection passwords + PATs + TOTP seeds +
         *  credential-cipher + signing keys. */
        SEALED,
        /** AES-256-GCM via peer-crypto (keyed by
         *  {@code DER_PEER_SECRET_KEY}). Used for
         *  {@code workflow_peer.auth_password}. */
        PEER_ENCRYPTED,
        /** Not a secret — the column name looks sensitive but
         *  the value is timestamps / metadata. Documented
         *  exemption. */
        METADATA_NOT_SECRET
    }

    /**
     * Pinned sensitive-column inventory. Any new column whose
     * name matches the PII-shape regex below must land here
     * with its protection class, or the sweep test fails.
     */
    private static final Map<String, Protection> INVENTORY =
            new LinkedHashMap<>();

    static {
        // Hashed — one-way, equality-checked at auth time.
        INVENTORY.put("edge_device.enrolment_token_hash", Protection.HASHED);
        INVENTORY.put("edge_session.token_hash", Protection.HASHED);
        INVENTORY.put("network_enrol_token.token_hash", Protection.HASHED);
        INVENTORY.put("peer_invite_token.token_hash", Protection.HASHED);

        // SecretEnvelope-sealed — reversible via the appliance's
        // operator-provided AES key (ADR-0017).
        INVENTORY.put("dhis2_connection_config.password_sealed", Protection.SEALED);
        INVENTORY.put("dhis2_connection_config.pat_token_sealed", Protection.SEALED);
        INVENTORY.put("edge_configuration.secret_envelope", Protection.SEALED);
        INVENTORY.put("edge_user.totp_secret", Protection.SEALED);
        INVENTORY.put("edge_user_dhis2_mapping.credential_cipher", Protection.SEALED);
        INVENTORY.put("signing_key.sealed_secret", Protection.SEALED);
        INVENTORY.put("tpm_sealed_secret.secret_id", Protection.SEALED);

        // Peer-crypto AES — separate key material + lifecycle
        // from SecretEnvelope so a peer-network compromise doesn't
        // leak user credentials.
        INVENTORY.put("workflow_peer.auth_password", Protection.PEER_ENCRYPTED);

        // Documented metadata-only exemptions. These columns
        // carry timestamps / UUIDs / usernames of the actor who
        // SET the secret — not the secret itself.
        INVENTORY.put("edge_user.totp_enrolled_at", Protection.METADATA_NOT_SECRET);
        INVENTORY.put("edge_user_dhis2_mapping.credential_set_at", Protection.METADATA_NOT_SECRET);
        INVENTORY.put("edge_user_dhis2_mapping.credential_set_by", Protection.METADATA_NOT_SECRET);
    }

    /**
     * Column name shape that counts as "sensitive-looking." If
     * a new column landing in a migration matches this regex and
     * isn't in the inventory, the sweep fails.
     */
    private static final Pattern SENSITIVE_NAME = Pattern.compile(
            "(?i)(secret|password|token|credential|totp)");

    /**
     * Column-definition regex inside a Postgres CREATE TABLE.
     * Captures the column name — a line like
     * {@code "    password_sealed    TEXT NOT NULL,"} yields
     * {@code password_sealed}. Deliberately lenient on the type
     * and trailing text so we don't false-negative on a new
     * column with an unusual type (BYTEA, JSONB, …).
     */
    private static final Pattern COLUMN_LINE = Pattern.compile(
            "^\\s{4,}([a-z_][a-z0-9_]*)\\s+[A-Z]");

    @Test
    void fr1607EveryColumnInInventoryHasAProtectionClass() {
        for (final var e : INVENTORY.entrySet()) {
            assertThat(e.getValue())
                    .as("protection class for %s", e.getKey())
                    .isNotNull();
        }
    }

    @Test
    void fr1607EveryProtectionClassIsExercisedByAtLeastOneColumn() {
        // Pin the reviewer-facing taxonomy — a dead Protection
        // value is dead code that inflates the inventory without
        // telling a reviewer anything. Remove it or add a column.
        final java.util.EnumSet<Protection> seen = java.util.EnumSet.noneOf(Protection.class);
        INVENTORY.values().forEach(seen::add);
        assertThat(seen)
                .as("every Protection value backed by >= 1 column")
                .containsExactlyInAnyOrder(Protection.values());
    }

    @Test
    void fr1607NewSensitiveColumnsLandWithExemption() throws IOException {
        // Scan every migration for column lines whose name
        // matches SENSITIVE_NAME and confirm each is in the
        // inventory. A new sensitive-shaped column landing
        // without a row here fails explicitly.
        final Path migrationDir = Paths.get(System.getProperty("user.dir"))
                .resolve("../database/migrations").normalize();
        assertThat(Files.isDirectory(migrationDir))
                .as("migrations present on disk at %s", migrationDir)
                .isTrue();
        final List<String> unknown = new ArrayList<>();
        try (Stream<Path> files = Files.list(migrationDir)) {
            for (final Path f : files.sorted()
                    .filter(p -> p.toString().endsWith(".sql"))
                    .toList()) {
                scan(f, unknown);
            }
        }
        assertThat(unknown)
                .as("unlisted sensitive-shaped columns — add to INVENTORY "
                        + "with a Protection class or rename the column")
                .isEmpty();
    }

    @Test
    void fr1607InventoryShapeIsWriteableAsEvidence() {
        // Pin a reviewer-friendly shape the pilot-evidence script
        // can lift directly into its FR-16-07 artefact.
        final Map<Protection, List<String>> grouped = new LinkedHashMap<>();
        for (final Protection p : Protection.values()) {
            grouped.put(p, new ArrayList<>());
        }
        INVENTORY.forEach((col, prot) -> grouped.get(prot).add(col));
        assertThat(grouped.get(Protection.HASHED)).hasSize(4);
        assertThat(grouped.get(Protection.SEALED))
                .as("SEALED columns count — new SecretEnvelope callers "
                        + "land here")
                .hasSizeGreaterThanOrEqualTo(7);
        assertThat(grouped.get(Protection.PEER_ENCRYPTED)).hasSize(1);
        assertThat(grouped.get(Protection.METADATA_NOT_SECRET))
                .hasSizeGreaterThanOrEqualTo(3);
    }

    private static void scan(final Path file, final List<String> unknown) throws IOException {
        // Rough state machine: track the current CREATE TABLE
        // target and collect every column definition inside it.
        // DROP TABLE / ALTER TABLE ... DROP COLUMN implicitly
        // remove a prior row — we rely on the inventory check
        // being the latest state from a fresh clone, not a diff.
        final String text = Files.readString(file);
        String currentTable = null;
        for (final String rawLine : text.split("\n")) {
            final String line = rawLine.strip();
            if (line.toUpperCase().startsWith("CREATE TABLE")) {
                // "CREATE TABLE IF NOT EXISTS der.<name> ("
                //  or  "CREATE TABLE <name> ("
                final String[] parts = line.split("\\s+");
                for (int i = 2; i < parts.length; i++) {
                    final String tok = parts[i];
                    if (tok.equalsIgnoreCase("IF") || tok.equalsIgnoreCase("NOT")
                            || tok.equalsIgnoreCase("EXISTS")) {
                        continue;
                    }
                    currentTable = tok.replaceFirst("^der\\.", "")
                            .replaceAll("[(,]", "");
                    break;
                }
                continue;
            }
            if (line.startsWith(");") || line.startsWith(")")) {
                currentTable = null;
                continue;
            }
            if (currentTable == null) {
                continue;
            }
            final Matcher m = COLUMN_LINE.matcher(rawLine);
            if (!m.find()) {
                continue;
            }
            final String col = m.group(1);
            if (!SENSITIVE_NAME.matcher(col).find()) {
                continue;
            }
            // Skip FK + CHECK fragments and index/constraint lines
            // that happen to contain the word (rare but possible
            // with a column named {@code *_check}).
            final String upper = line.toUpperCase();
            if (upper.startsWith("CONSTRAINT") || upper.startsWith("CHECK")
                    || upper.startsWith("FOREIGN") || upper.startsWith("UNIQUE")
                    || upper.startsWith("PRIMARY")) {
                continue;
            }
            final String key = currentTable + "." + col;
            if (!INVENTORY.containsKey(key)) {
                unknown.add(key + " @ " + file.getFileName());
            }
        }
    }
}
