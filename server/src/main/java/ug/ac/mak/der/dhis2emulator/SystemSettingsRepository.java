package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over {@code der.system_setting} (V122). Appliance-wide
 * key/value store — same shape as {@link UserSettingsRepository} but
 * scoped to the whole DER rather than a user.
 */
@Repository
public class SystemSettingsRepository {

    private final JdbcTemplate jdbc;

    public SystemSettingsRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Map<String, String> readAll() {
        final Map<String, String> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT setting_key, setting_value FROM der.system_setting "
                        + "ORDER BY setting_key",
                (rs, n) -> {
                    out.put(rs.getString(1), rs.getString(2));
                    return null;
                });
        return out;
    }

    public String read(final String key) {
        Objects.requireNonNull(key, "key");
        final var rows = jdbc.query(
                "SELECT setting_value FROM der.system_setting "
                        + "WHERE setting_key = ?",
                (rs, n) -> rs.getString(1), key);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void upsert(final String key, final String value, final UUID updatedBy) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        jdbc.update(
                "INSERT INTO der.system_setting "
                        + "(setting_key, setting_value, updated_by, updated_at) "
                        + "VALUES (?, ?, ?, now()) "
                        + "ON CONFLICT (setting_key) DO UPDATE SET "
                        + "  setting_value = EXCLUDED.setting_value, "
                        + "  updated_by = EXCLUDED.updated_by, "
                        + "  updated_at = now()",
                key, value, updatedBy);
    }

    public int delete(final String key) {
        if (key == null) {
            return 0;
        }
        return jdbc.update(
                "DELETE FROM der.system_setting WHERE setting_key = ?", key);
    }
}
