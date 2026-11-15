package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over {@code der.user_setting} (V122). Thin — the DHIS2
 * {@code /api/userSettings} surface is a plain key/value store per
 * user, so there's no projection or filter logic worth hiding behind
 * a service.
 */
@Repository
public class UserSettingsRepository {

    private final JdbcTemplate jdbc;

    public UserSettingsRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** All settings for a user, keyed for direct JSON serialisation. */
    public Map<String, String> readAll(final UUID userId) {
        Objects.requireNonNull(userId, "userId");
        final Map<String, String> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT setting_key, setting_value FROM der.user_setting "
                        + "WHERE user_id = ? ORDER BY setting_key",
                (rs, n) -> {
                    out.put(rs.getString(1), rs.getString(2));
                    return null;
                }, userId);
        return out;
    }

    public String read(final UUID userId, final String key) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(key, "key");
        final var rows = jdbc.query(
                "SELECT setting_value FROM der.user_setting "
                        + "WHERE user_id = ? AND setting_key = ?",
                (rs, n) -> rs.getString(1), userId, key);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void upsert(final UUID userId, final String key, final String value) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        jdbc.update(
                "INSERT INTO der.user_setting "
                        + "(user_id, setting_key, setting_value, updated_at) "
                        + "VALUES (?, ?, ?, now()) "
                        + "ON CONFLICT (user_id, setting_key) DO UPDATE SET "
                        + "  setting_value = EXCLUDED.setting_value, "
                        + "  updated_at = now()",
                userId, key, value);
    }

    public int delete(final UUID userId, final String key) {
        if (userId == null || key == null) {
            return 0;
        }
        return jdbc.update(
                "DELETE FROM der.user_setting "
                        + "WHERE user_id = ? AND setting_key = ?",
                userId, key);
    }
}
