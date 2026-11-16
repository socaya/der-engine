package ug.ac.mak.der.dhis2emulator;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over V128 {@code der.app_data_store}. Namespace-scoped
 * JSON blob store that mirrors the DHIS2
 * {@code /api/dataStore/<ns>/<key>} surface.
 */
@Repository
public class AppDataStoreRepository {

    private final JdbcTemplate jdbc;

    public AppDataStoreRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<String> listNamespaces() {
        return jdbc.queryForList(
                "SELECT DISTINCT namespace FROM der.app_data_store ORDER BY namespace",
                String.class);
    }

    public List<String> listKeys(final String namespace) {
        return jdbc.queryForList(
                "SELECT data_key FROM der.app_data_store WHERE namespace = ? "
              + "ORDER BY data_key",
                String.class, namespace);
    }

    public Optional<String> findValue(final String namespace, final String key) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT value_json::text FROM der.app_data_store "
                  + "WHERE namespace = ? AND data_key = ?",
                    String.class, namespace, key));
        } catch (final EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public boolean exists(final String namespace, final String key) {
        final Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM der.app_data_store "
              + "WHERE namespace = ? AND data_key = ?",
                Integer.class, namespace, key);
        return n != null && n > 0;
    }

    /**
     * UPSERT the JSON value at ({@code namespace}, {@code key}).
     * Updates {@code updated_at} + {@code updated_by} on every
     * call; creates an audit-ready row on first insert.
     */
    public int upsert(final String namespace, final String key,
                          final String valueJson, final UUID actor) {
        return jdbc.update(
                "INSERT INTO der.app_data_store "
              + "(namespace, data_key, value_json, created_by, updated_by) "
              + "VALUES (?, ?, ?::jsonb, ?, ?) "
              + "ON CONFLICT (namespace, data_key) DO UPDATE SET "
              + "value_json = EXCLUDED.value_json, "
              + "updated_by = EXCLUDED.updated_by, "
              + "updated_at = now()",
                namespace, key, valueJson, actor, actor);
    }

    public int delete(final String namespace, final String key) {
        return jdbc.update(
                "DELETE FROM der.app_data_store "
              + "WHERE namespace = ? AND data_key = ?",
                namespace, key);
    }

    public int deleteNamespace(final String namespace) {
        return jdbc.update(
                "DELETE FROM der.app_data_store WHERE namespace = ?",
                namespace);
    }
}
