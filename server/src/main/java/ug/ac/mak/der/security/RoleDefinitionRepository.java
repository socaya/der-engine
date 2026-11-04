package ug.ac.mak.der.security;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * JDBC repository for {@code role_definition} + {@code role_authority} and
 * {@code edge_user_role_custom}.  Role definitions are the canonical source
 * of truth for authorities granted to each named role; the Phase 02
 * {@code edge_role} table continues to carry the four built-in enum grants
 * so legacy {@code hasRole('ADMIN')} enforcement keeps working.
 */
@Repository
public class RoleDefinitionRepository {

    private final JdbcTemplate jdbc;

    public RoleDefinitionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<RoleDefinition> findAll() {
        final List<RoleDefinition> plain = jdbc.query(
                "SELECT role_id, name, description, is_builtin, builtin_key, created_at, updated_at "
                        + "FROM der.role_definition ORDER BY is_builtin DESC, lower(name)",
                rowMapper());
        final List<RoleDefinition> enriched = new ArrayList<>(plain.size());
        for (final RoleDefinition r : plain) {
            enriched.add(withAuthorities(r));
        }
        return List.copyOf(enriched);
    }

    public Optional<RoleDefinition> findById(final UUID roleId) {
        try {
            final RoleDefinition r = jdbc.queryForObject(
                    "SELECT role_id, name, description, is_builtin, builtin_key, created_at, updated_at "
                            + "FROM der.role_definition WHERE role_id = ?",
                    rowMapper(), roleId);
            return Optional.ofNullable(r).map(this::withAuthorities);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<RoleDefinition> findByName(final String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        try {
            final RoleDefinition r = jdbc.queryForObject(
                    "SELECT role_id, name, description, is_builtin, builtin_key, created_at, updated_at "
                            + "FROM der.role_definition WHERE lower(name) = lower(?)",
                    rowMapper(), name);
            return Optional.ofNullable(r).map(this::withAuthorities);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<RoleDefinition> findByBuiltinKey(final String builtinKey) {
        if (builtinKey == null) {
            return Optional.empty();
        }
        try {
            final RoleDefinition r = jdbc.queryForObject(
                    "SELECT role_id, name, description, is_builtin, builtin_key, created_at, updated_at "
                            + "FROM der.role_definition WHERE builtin_key = ?",
                    rowMapper(), builtinKey);
            return Optional.ofNullable(r).map(this::withAuthorities);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    @Transactional
    public RoleDefinition create(final String name, final String description, final Set<String> authorities) {
        Objects.requireNonNull(name, "name");
        final Set<String> valid = AuthorityCatalog.validAuthorityStrings();
        for (final String a : authorities == null ? Set.<String>of() : authorities) {
            if (!valid.contains(a)) {
                throw new IllegalArgumentException("unknown authority: " + a);
            }
        }
        final UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO der.role_definition (role_id, name, description, is_builtin, builtin_key, created_at, updated_at) "
                        + "VALUES (?, ?, ?, FALSE, NULL, now(), now())",
                id, name.trim(), description);
        replaceAuthorities(id, authorities == null ? Set.of() : authorities);
        return findById(id).orElseThrow();
    }

    @Transactional
    public RoleDefinition update(final UUID roleId,
                                 final String name,
                                 final String description,
                                 final Set<String> authorities) {
        final RoleDefinition existing = findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("unknown role: " + roleId));
        final Set<String> valid = AuthorityCatalog.validAuthorityStrings();
        for (final String a : authorities == null ? Set.<String>of() : authorities) {
            if (!valid.contains(a)) {
                throw new IllegalArgumentException("unknown authority: " + a);
            }
        }
        if (existing.builtin()) {
            // Built-ins: keep name immutable; only description + authorities may change.
            jdbc.update(
                    "UPDATE der.role_definition SET description = ?, updated_at = now() WHERE role_id = ?",
                    description, roleId);
        } else {
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("name must not be blank");
            }
            jdbc.update(
                    "UPDATE der.role_definition SET name = ?, description = ?, updated_at = now() WHERE role_id = ?",
                    name.trim(), description, roleId);
        }
        replaceAuthorities(roleId, authorities == null ? Set.of() : authorities);
        return findById(roleId).orElseThrow();
    }

    @Transactional
    public void delete(final UUID roleId) {
        final RoleDefinition existing = findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("unknown role: " + roleId));
        if (existing.builtin()) {
            throw new IllegalStateException("built-in roles cannot be deleted");
        }
        jdbc.update("DELETE FROM der.role_definition WHERE role_id = ?", roleId);
    }

    public int countUsersWithRole(final UUID roleId) {
        final RoleDefinition rd = findById(roleId).orElse(null);
        if (rd == null) {
            return 0;
        }
        if (rd.builtin()) {
            final Integer c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM der.edge_role WHERE role = ?",
                    Integer.class, rd.builtinKey());
            return c == null ? 0 : c;
        }
        final Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.edge_user_role_custom WHERE role_id = ?",
                Integer.class, roleId);
        return c == null ? 0 : c;
    }

    /** Authorities granted to a user via BOTH the Phase-02 built-in roles and custom role grants. */
    public Set<String> findAuthoritiesForUser(final UUID userId) {
        final List<String> rows = jdbc.queryForList(
                "SELECT DISTINCT ra.authority "
                        + "FROM der.role_authority ra "
                        + "WHERE ra.role_id IN ( "
                        + "  SELECT rd.role_id FROM der.role_definition rd "
                        + "    JOIN der.edge_role er ON er.role = rd.builtin_key "
                        + "    WHERE er.user_id = ? "
                        + "  UNION "
                        + "  SELECT role_id FROM der.edge_user_role_custom WHERE user_id = ? "
                        + ")",
                String.class, userId, userId);
        return Set.copyOf(rows);
    }

    private void replaceAuthorities(final UUID roleId, final Set<String> authorities) {
        jdbc.update("DELETE FROM der.role_authority WHERE role_id = ?", roleId);
        for (final String a : authorities) {
            jdbc.update(
                    "INSERT INTO der.role_authority (role_id, authority) VALUES (?, ?)",
                    roleId, a);
        }
    }

    private RoleDefinition withAuthorities(final RoleDefinition r) {
        final List<String> rows = jdbc.queryForList(
                "SELECT authority FROM der.role_authority WHERE role_id = ? ORDER BY authority",
                String.class, r.roleId());
        final Set<String> auth = new LinkedHashSet<>(rows);
        return new RoleDefinition(
                r.roleId(), r.name(), r.description(), r.builtin(), r.builtinKey(),
                auth, r.createdAt(), r.updatedAt());
    }

    private static RowMapper<RoleDefinition> rowMapper() {
        return (ResultSet rs, int rowNum) -> new RoleDefinition(
                rs.getObject("role_id", UUID.class),
                rs.getString("name"),
                rs.getString("description"),
                rs.getBoolean("is_builtin"),
                rs.getString("builtin_key"),
                Set.of(),
                ts(rs.getTimestamp("created_at")),
                ts(rs.getTimestamp("updated_at")));
    }

    private static java.time.Instant ts(final Timestamp t) {
        return t == null ? java.time.Instant.EPOCH : t.toInstant();
    }
}
