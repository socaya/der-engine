package ug.ac.mak.der.apps;

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

@Repository
public class InstalledAppRepository {

    /** Column list shared by every SELECT so adding a column only means
     *  updating this constant + the row mapper. */
    private static final String COLS =
            "app_id, app_key, version, display_name, "
          + "manifest_json::text AS manifest_json, install_path, "
          + "installed_by, installed_at, enabled, "
          + "host_kind, source, trust_level, last_opened_at, central_app_id";

    private final JdbcTemplate jdbc;

    public InstalledAppRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public InstalledApp insert(final InstalledApp in) {
        jdbc.update(
                "INSERT INTO der.installed_app (app_id, app_key, version, display_name, "
                        + "manifest_json, install_path, installed_by, installed_at, enabled, "
                        + "host_kind, source, trust_level, central_app_id) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?, ?, ?, ?)",
                in.appId(), in.appKey(), in.version(), in.displayName(),
                in.manifestJson(), in.installPath(), in.installedBy(),
                java.sql.Timestamp.from(in.installedAt()), in.enabled(),
                in.hostKind().name(), in.source().name(), in.trustLevel().name(),
                in.centralAppId());
        return in;
    }

    public List<InstalledApp> findAll() {
        return jdbc.query(
                "SELECT " + COLS + " FROM der.installed_app "
                        + "ORDER BY app_key, version DESC",
                rowMapper());
    }

    public Optional<InstalledApp> findById(final UUID appId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT " + COLS + " FROM der.installed_app WHERE app_id = ?",
                    rowMapper(), appId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<InstalledApp> findByKey(final String appKey) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT " + COLS + " FROM der.installed_app "
                            + "WHERE app_key = ? AND enabled = TRUE "
                            + "ORDER BY installed_at DESC LIMIT 1",
                    rowMapper(), appKey));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int setEnabled(final UUID appId, final boolean enabled) {
        return jdbc.update("UPDATE der.installed_app SET enabled = ? WHERE app_id = ?",
                enabled, appId);
    }

    public int updateDisplayName(final UUID appId, final String displayName) {
        return jdbc.update(
                "UPDATE der.installed_app SET display_name = ? WHERE app_id = ?",
                displayName, appId);
    }

    /** FR-DIAG-001 — stamp last-opened so the admin diagnostic screen
     *  can show abandoned installs. Idempotent, no-op when the row is
     *  gone. Called on bundle fetch + iframe-root serve. */
    public int touchLastOpened(final UUID appId, final java.time.Instant when) {
        return jdbc.update(
                "UPDATE der.installed_app SET last_opened_at = ? "
                        + "WHERE app_id = ?",
                Timestamp.from(when), appId);
    }

    public int delete(final UUID appId) {
        return jdbc.update("DELETE FROM der.installed_app WHERE app_id = ?", appId);
    }

    private static RowMapper<InstalledApp> rowMapper() {
        return (ResultSet rs, int row) -> new InstalledApp(
                (UUID) rs.getObject("app_id"),
                rs.getString("app_key"),
                rs.getString("version"),
                rs.getString("display_name"),
                rs.getString("manifest_json"),
                rs.getString("install_path"),
                (UUID) rs.getObject("installed_by"),
                rs.getTimestamp("installed_at").toInstant(),
                rs.getBoolean("enabled"),
                enumOrDefault(rs.getString("host_kind"),
                        InstalledApp.HostKind.DER_ESM,
                        InstalledApp.HostKind.class),
                enumOrDefault(rs.getString("source"),
                        InstalledApp.Source.MANUAL_UPLOAD,
                        InstalledApp.Source.class),
                enumOrDefault(rs.getString("trust_level"),
                        InstalledApp.TrustLevel.SIGNED,
                        InstalledApp.TrustLevel.class),
                rs.getTimestamp("last_opened_at") == null ? null
                        : rs.getTimestamp("last_opened_at").toInstant(),
                rs.getString("central_app_id"));
    }

    private static <E extends Enum<E>> E enumOrDefault(final String raw,
                                                         final E fallback,
                                                         final Class<E> type) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, raw);
        } catch (IllegalArgumentException ex) {
            return fallback;
        }
    }
}
