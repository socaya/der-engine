package ug.ac.mak.der.fleet;

import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** §8 — Per-operator preferences (onboarding tour dismissed, theme,
 *  default page size). Simple KV. */
@Service
public class UserPreferenceService {

    private final JdbcTemplate jdbc;

    public UserPreferenceService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Map<String, String> readAll(final UUID userId) {
        final Map<String, String> m = new LinkedHashMap<>();
        jdbc.query(
            "SELECT pref_key, pref_value FROM der.user_preference WHERE user_id = ?",
            (ResultSet rs) -> {
                m.put(rs.getString("pref_key"), rs.getString("pref_value"));
            }, userId);
        return m;
    }

    public Optional<String> read(final UUID userId, final String key) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                "SELECT pref_value FROM der.user_preference "
              + " WHERE user_id = ? AND pref_key = ?",
                String.class, userId, key));
        } catch (final org.springframework.dao.EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void write(final UUID userId, final String key, final String value) {
        jdbc.update(
            "INSERT INTO der.user_preference (user_id, pref_key, pref_value) "
          + "VALUES (?, ?, ?) "
          + "ON CONFLICT (user_id, pref_key) DO UPDATE SET "
          + "  pref_value = EXCLUDED.pref_value, updated_at = now()",
            userId, key, value);
    }

    public int delete(final UUID userId, final String key) {
        return jdbc.update(
            "DELETE FROM der.user_preference WHERE user_id = ? AND pref_key = ?",
            userId, key);
    }
}
