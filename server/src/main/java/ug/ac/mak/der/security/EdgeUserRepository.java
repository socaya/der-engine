package ug.ac.mak.der.security;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
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
 * JDBC repository for {@code edge_user} + {@code edge_role} + {@code edge_credential}.
 * Deliberately hand-rolled; Phase 02 does not justify Spring Data JPA complexity.
 */
@Repository
public class EdgeUserRepository {

    private final JdbcTemplate jdbc;

    public EdgeUserRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Transactional
    public EdgeUser upsert(final EdgeUser user, final String verifier) {
        Objects.requireNonNull(user, "user");
        jdbc.update(
                "INSERT INTO der.edge_user "
                        + "(user_id, username, display_name, origin, external_uid, disabled, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (user_id) DO UPDATE SET "
                        + "username = EXCLUDED.username, display_name = EXCLUDED.display_name, "
                        + "origin = EXCLUDED.origin, external_uid = EXCLUDED.external_uid, "
                        + "disabled = EXCLUDED.disabled, updated_at = EXCLUDED.updated_at",
                user.userId(),
                user.username().toLowerCase(Locale.ROOT),
                user.displayName(),
                user.origin().name(),
                user.externalUid(),
                user.disabled(),
                Timestamp.from(user.createdAt()),
                Timestamp.from(user.updatedAt())
        );
        jdbc.update("DELETE FROM der.edge_role WHERE user_id = ?", user.userId());
        for (final EdgeRole role : user.roles()) {
            jdbc.update(
                    "INSERT INTO der.edge_role (user_id, role) VALUES (?, ?)",
                    user.userId(),
                    role.name()
            );
        }
        if (verifier != null) {
            jdbc.update(
                    "INSERT INTO der.edge_credential (user_id, algorithm, verifier, verifier_version, rotated_at) "
                            + "VALUES (?, 'ARGON2ID', ?, 1, now()) "
                            + "ON CONFLICT (user_id) DO UPDATE SET "
                            + "verifier = EXCLUDED.verifier, "
                            + "verifier_version = der.edge_credential.verifier_version + 1, "
                            + "rotated_at = now()",
                    user.userId(),
                    verifier
            );
        }
        return user;
    }

    public Optional<EdgeUser> findByUsername(final String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        final String lower = username.toLowerCase(Locale.ROOT);
        try {
            final EdgeUser user = jdbc.queryForObject(
                    "SELECT user_id, username, display_name, origin, external_uid, disabled, created_at, updated_at "
                            + "FROM der.edge_user WHERE username = ?",
                    userMapper(),
                    lower
            );
            return Optional.ofNullable(user).map(this::withRoles);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public Optional<EdgeUser> findById(final UUID userId) {
        try {
            final EdgeUser user = jdbc.queryForObject(
                    "SELECT user_id, username, display_name, origin, external_uid, disabled, created_at, updated_at "
                            + "FROM der.edge_user WHERE user_id = ?",
                    userMapper(),
                    userId
            );
            return Optional.ofNullable(user).map(this::withRoles);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<EdgeUser> findAll() {
        final List<EdgeUser> plain = jdbc.query(
                "SELECT user_id, username, display_name, origin, external_uid, disabled, created_at, updated_at "
                        + "FROM der.edge_user ORDER BY username",
                userMapper()
        );
        final List<EdgeUser> enriched = new ArrayList<>(plain.size());
        for (final EdgeUser u : plain) {
            enriched.add(withRoles(u));
        }
        return List.copyOf(enriched);
    }

    public Optional<String> findVerifier(final UUID userId) {
        try {
            final String verifier = jdbc.queryForObject(
                    "SELECT verifier FROM der.edge_credential WHERE user_id = ?",
                    String.class,
                    userId
            );
            return Optional.ofNullable(verifier);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public boolean anyUserHasRole(final EdgeRole role) {
        final Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.edge_role WHERE role = ?",
                Integer.class,
                role.name()
        );
        return count != null && count > 0;
    }

    private EdgeUser withRoles(final EdgeUser user) {
        final List<String> roleRows = jdbc.queryForList(
                "SELECT role FROM der.edge_role WHERE user_id = ?",
                String.class,
                user.userId()
        );
        final Set<EdgeRole> roles = roleRows.isEmpty()
                ? EnumSet.noneOf(EdgeRole.class)
                : EnumSet.copyOf(roleRows.stream().map(EdgeRole::valueOf).toList());
        return new EdgeUser(
                user.userId(),
                user.username(),
                user.displayName(),
                user.origin(),
                user.externalUid(),
                user.disabled(),
                roles,
                user.createdAt(),
                user.updatedAt()
        );
    }

    private static RowMapper<EdgeUser> userMapper() {
        return (ResultSet rs, int rowNum) -> new EdgeUser(
                rs.getObject("user_id", UUID.class),
                rs.getString("username"),
                rs.getString("display_name"),
                EdgeUser.Origin.valueOf(rs.getString("origin")),
                rs.getObject("external_uid", String.class),
                rs.getBoolean("disabled"),
                Set.of(),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }

}
