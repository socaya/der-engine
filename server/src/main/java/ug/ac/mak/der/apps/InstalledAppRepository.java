package ug.ac.mak.der.apps;

import java.sql.ResultSet;
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

    private final JdbcTemplate jdbc;

    public InstalledAppRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public InstalledApp insert(final InstalledApp in) {
        jdbc.update(
                "INSERT INTO der.installed_app (app_id, app_key, version, display_name, "
                        + "manifest_json, install_path, installed_by, installed_at, enabled) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?)",
                in.appId(), in.appKey(), in.version(), in.displayName(),
                in.manifestJson(), in.installPath(), in.installedBy(),
                java.sql.Timestamp.from(in.installedAt()), in.enabled());
        return in;
    }

    public List<InstalledApp> findAll() {
        return jdbc.query(
                "SELECT app_id, app_key, version, display_name, manifest_json::text AS manifest_json, "
                        + "install_path, installed_by, installed_at, enabled "
                        + "FROM der.installed_app ORDER BY app_key, version DESC",
                rowMapper());
    }

    public Optional<InstalledApp> findById(final UUID appId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT app_id, app_key, version, display_name, manifest_json::text AS manifest_json, "
                            + "install_path, installed_by, installed_at, enabled "
                            + "FROM der.installed_app WHERE app_id = ?",
                    rowMapper(), appId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<InstalledApp> findByKey(final String appKey) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT app_id, app_key, version, display_name, manifest_json::text AS manifest_json, "
                            + "install_path, installed_by, installed_at, enabled "
                            + "FROM der.installed_app WHERE app_key = ? AND enabled = TRUE "
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
                rs.getBoolean("enabled"));
    }
}
