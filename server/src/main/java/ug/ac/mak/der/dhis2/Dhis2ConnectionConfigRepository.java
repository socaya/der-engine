package ug.ac.mak.der.dhis2;

import java.sql.Timestamp;
import java.util.Objects;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC store over the {@code der.dhis2_connection_config} singleton
 * added in V029. Backs {@link Dhis2ConnectionConfigService}.
 */
@Repository
public class Dhis2ConnectionConfigRepository {

    private final JdbcTemplate jdbc;

    public Dhis2ConnectionConfigRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Dhis2ConnectionConfig read() {
        try {
            return Objects.requireNonNull(jdbc.queryForObject(
                    "SELECT base_url, username, password_sealed, pat_token_sealed, "
                            + "allow_mismatch, pinned_version, min_supported_version, "
                            + "max_tested_version, compat_mode, snapshot_ttl_hours, "
                            + "connect_timeout_millis, proxy_enabled, proxy_allow_writes, "
                            + "proxy_allow_paths, updated_at, updated_by "
                            + "FROM der.dhis2_connection_config LIMIT 1",
                    (rs, row) -> {
                        final Timestamp u = rs.getTimestamp("updated_at");
                        return new Dhis2ConnectionConfig(
                                rs.getString("base_url"),
                                rs.getString("username"),
                                rs.getString("password_sealed"),
                                rs.getString("pat_token_sealed"),
                                rs.getBoolean("allow_mismatch"),
                                rs.getString("pinned_version"),
                                rs.getString("min_supported_version"),
                                rs.getString("max_tested_version"),
                                rs.getString("compat_mode"),
                                (Integer) rs.getObject("snapshot_ttl_hours"),
                                (Integer) rs.getObject("connect_timeout_millis"),
                                (Boolean) rs.getObject("proxy_enabled"),
                                (Boolean) rs.getObject("proxy_allow_writes"),
                                rs.getString("proxy_allow_paths"),
                                u == null ? null : u.toInstant(),
                                (UUID) rs.getObject("updated_by"));
                    }));
        } catch (EmptyResultDataAccessException ex) {
            return Dhis2ConnectionConfig.empty();
        }
    }

    public int write(final Dhis2ConnectionConfig cfg, final UUID actingUser) {
        final int rows = jdbc.update(
                "UPDATE der.dhis2_connection_config SET base_url = ?, username = ?, "
                        + "password_sealed = ?, pat_token_sealed = ?, allow_mismatch = ?, "
                        + "pinned_version = ?, min_supported_version = ?, "
                        + "max_tested_version = ?, compat_mode = ?, "
                        + "snapshot_ttl_hours = ?, connect_timeout_millis = ?, "
                        + "proxy_enabled = ?, proxy_allow_writes = ?, "
                        + "proxy_allow_paths = ?, updated_at = now(), updated_by = ?",
                cfg.baseUrl(), cfg.username(), cfg.passwordSealed(), cfg.patTokenSealed(),
                cfg.allowMismatch(), cfg.pinnedVersion(), cfg.minSupportedVersion(),
                cfg.maxTestedVersion(), cfg.compatMode(),
                cfg.snapshotTtlHours(), cfg.connectTimeoutMillis(),
                cfg.proxyEnabled(), cfg.proxyAllowWrites(),
                cfg.proxyAllowPaths(), actingUser);
        if (rows > 0) {
            return rows;
        }
        return jdbc.update(
                "INSERT INTO der.dhis2_connection_config "
                        + "(singleton, base_url, username, password_sealed, pat_token_sealed, "
                        + "allow_mismatch, pinned_version, min_supported_version, "
                        + "max_tested_version, compat_mode, snapshot_ttl_hours, "
                        + "connect_timeout_millis, proxy_enabled, proxy_allow_writes, "
                        + "proxy_allow_paths, updated_at, updated_by) "
                        + "VALUES (true, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), ?)",
                cfg.baseUrl(), cfg.username(), cfg.passwordSealed(), cfg.patTokenSealed(),
                cfg.allowMismatch(), cfg.pinnedVersion(), cfg.minSupportedVersion(),
                cfg.maxTestedVersion(), cfg.compatMode(),
                cfg.snapshotTtlHours(), cfg.connectTimeoutMillis(),
                cfg.proxyEnabled(), cfg.proxyAllowWrites(),
                cfg.proxyAllowPaths(), actingUser);
    }
}
