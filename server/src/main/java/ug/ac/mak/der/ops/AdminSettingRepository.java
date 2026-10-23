package ug.ac.mak.der.ops;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC over {@code der.admin_setting} (V028). */
@Repository
public class AdminSettingRepository {

    private final JdbcTemplate jdbc;

    public AdminSettingRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Map<String, String> readAll() {
        final List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT key, value::text AS value FROM der.admin_setting");
        final Map<String, String> out = new LinkedHashMap<>();
        for (final Map<String, Object> r : rows) {
            out.put((String) r.get("key"), (String) r.get("value"));
        }
        return out;
    }

    public Optional<Entry> read(final String key) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT key, value::text AS value, updated_by, updated_at "
                            + "FROM der.admin_setting WHERE key = ?",
                    rowMapper(), key));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public int upsert(final String key, final String jsonValue, final UUID updatedBy) {
        return jdbc.update(
                "INSERT INTO der.admin_setting (key, value, updated_by, updated_at) "
                        + "VALUES (?, CAST(? AS jsonb), ?, now()) "
                        + "ON CONFLICT (key) DO UPDATE SET "
                        + "value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, "
                        + "updated_at = now()",
                key, jsonValue, updatedBy);
    }

    public int delete(final String key) {
        return jdbc.update("DELETE FROM der.admin_setting WHERE key = ?", key);
    }

    private static RowMapper<Entry> rowMapper() {
        return (ResultSet rs, int n) -> new Entry(
                rs.getString("key"),
                rs.getString("value"),
                rs.getObject("updated_by", UUID.class),
                rs.getTimestamp("updated_at") == null ? null
                        : rs.getTimestamp("updated_at").toInstant());
    }

    public record Entry(String key, String value, UUID updatedBy, Instant updatedAt) { }
}
