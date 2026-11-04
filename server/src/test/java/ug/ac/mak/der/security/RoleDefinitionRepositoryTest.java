package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class RoleDefinitionRepositoryTest {

    @Test
    void createRejectsUnknownAuthority() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.create("Custom", null, Set.of("der.nonsense.read")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown authority");
    }

    @Test
    void createAcceptsCatalogAuthoritiesAndWritesRows() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        // findById after insert must return a row so create() can return it
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(inv -> stubRow((UUID) ((Object[]) inv.getArgument(2))[0], "Custom", false));
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(inv.getArgument(2, UUID.class), "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of("der.users.read"));

        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        final RoleDefinition created = repo.create("Custom", "d", Set.of("der.users.read"));
        assertThat(created.name()).isEqualTo("Custom");
        verify(jdbc).update(contains("INSERT INTO der.role_definition"),
                any(UUID.class), eq("Custom"), eq("d"));
        verify(jdbc).update(contains("DELETE FROM der.role_authority"), any(UUID.class));
        verify(jdbc).update(contains("INSERT INTO der.role_authority"),
                any(UUID.class), eq("der.users.read"));
    }

    @Test
    void deleteRefusesBuiltin() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Administrator", true));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.delete(id))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("built-in");
    }

    @Test
    void updateOfBuiltinKeepsName() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Administrator", true));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        new RoleDefinitionRepository(jdbc).update(id, "ATTEMPT RENAME", "d", Set.of());
        verify(jdbc).update(contains("SET description"), eq("d"), eq(id));
    }

    @Test
    void findAuthoritiesForUserUsesUnionQuery() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.queryForList(contains("UNION"), eq(String.class), eq(uid), eq(uid)))
                .thenReturn(List.of("der.users.read", "der.audit.read"));
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThat(repo.findAuthoritiesForUser(uid))
                .containsExactlyInAnyOrder("der.users.read", "der.audit.read");
    }

    @Test
    void updateCustomRejectsBlankName() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.update(id, "  ", "d", Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void findByNameEmptyForNullOrBlank() {
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(mock(JdbcTemplate.class));
        assertThat(repo.findByName(null)).isEmpty();
        assertThat(repo.findByName("  ")).isEmpty();
    }

    @Test
    void findByBuiltinKeyEmptyForNull() {
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(mock(JdbcTemplate.class));
        assertThat(repo.findByBuiltinKey(null)).isEmpty();
    }

    @Test
    void findByNameReturnsEmptyWhenNoRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(String.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThat(new RoleDefinitionRepository(jdbc).findByName("missing")).isEmpty();
    }

    @Test
    void findByIdReturnsEmptyWhenNoRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThat(new RoleDefinitionRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByBuiltinKeyReturnsEmptyWhenNoRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(String.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThat(new RoleDefinitionRepository(jdbc).findByBuiltinKey("ADMIN")).isEmpty();
    }

    @Test
    void findAllEnrichesAuthorities() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.query(contains("FROM der.role_definition"), any(RowMapper.class)))
                .thenReturn(List.of(new RoleDefinition(id, "Admin", null, true, "ADMIN",
                        Set.of(), java.time.Instant.EPOCH, java.time.Instant.EPOCH)));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), eq(id)))
                .thenReturn(List.of("der.users.read"));
        final List<RoleDefinition> all = new RoleDefinitionRepository(jdbc).findAll();
        assertThat(all).hasSize(1);
        assertThat(all.get(0).authorities()).containsExactly("der.users.read");
    }

    @Test
    void deleteHappyPathForCustom() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        new RoleDefinitionRepository(jdbc).delete(id);
        verify(jdbc).update(contains("DELETE FROM der.role_definition"), eq(id));
    }

    @Test
    void deleteUnknownIdThrowsIllegalArgument() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.delete(UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown role");
    }

    @Test
    void updateRejectsUnknownAuthority() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.update(id, "renamed", "d", Set.of("der.nope")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown authority");
    }

    @Test
    void updateCustomWritesNameAndAuthorities() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of("der.users.read"));
        new RoleDefinitionRepository(jdbc).update(id, "Renamed", "d", Set.of("der.users.read"));
        verify(jdbc).update(contains("SET name = ?"), eq("Renamed"), eq("d"), eq(id));
        verify(jdbc).update(contains("INSERT INTO der.role_authority"),
                eq(id), eq("der.users.read"));
    }

    @Test
    void countUsersWithRoleForBuiltinReadsEdgeRole() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Administrator", true));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        when(jdbc.queryForObject(contains("FROM der.edge_role WHERE role = ?"), eq(Integer.class), eq("ADMIN")))
                .thenReturn(4);
        assertThat(new RoleDefinitionRepository(jdbc).countUsersWithRole(id)).isEqualTo(4);
    }

    @Test
    void countUsersWithRoleForCustomReadsCustomTable() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        when(jdbc.queryForObject(contains("FROM der.edge_user_role_custom"), eq(Integer.class), eq(id)))
                .thenReturn(2);
        assertThat(new RoleDefinitionRepository(jdbc).countUsersWithRole(id)).isEqualTo(2);
    }

    @Test
    void countUsersWithRoleUnknownReturnsZero() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThat(new RoleDefinitionRepository(jdbc).countUsersWithRole(UUID.randomUUID())).isZero();
    }

    @Test
    void countUsersWithRoleNullCountReturnsZero() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(contains("WHERE role_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> stubRow(id, "Custom", false));
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), any(UUID.class)))
                .thenReturn(List.of());
        when(jdbc.queryForObject(contains("FROM der.edge_user_role_custom"), eq(Integer.class), eq(id)))
                .thenReturn(null);
        assertThat(new RoleDefinitionRepository(jdbc).countUsersWithRole(id)).isZero();
    }

    @Test
    void findByNameReturnsEmptyWhenQueryReturnsNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(String.class)))
                .thenReturn(null);
        assertThat(new RoleDefinitionRepository(jdbc).findByName("x")).isEmpty();
    }

    @Test
    void findByBuiltinKeyReturnsEmptyWhenQueryReturnsNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(String.class)))
                .thenReturn(null);
        assertThat(new RoleDefinitionRepository(jdbc).findByBuiltinKey("ADMIN")).isEmpty();
    }

    @Test
    void rowMapperConvertsResultSetIncludingNullTimestamps() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(String.class)))
                .thenAnswer(inv -> {
                    final RowMapper<RoleDefinition> mapper = inv.getArgument(1);
                    final ResultSet rs = mock(ResultSet.class);
                    when(rs.getObject("role_id", UUID.class)).thenReturn(id);
                    when(rs.getString("name")).thenReturn("Admin");
                    when(rs.getString("description")).thenReturn("d");
                    when(rs.getBoolean("is_builtin")).thenReturn(true);
                    when(rs.getString("builtin_key")).thenReturn("ADMIN");
                    // Exercise the null-timestamp branch in the private ts(...) helper.
                    when(rs.getTimestamp("created_at")).thenReturn(null);
                    when(rs.getTimestamp("updated_at")).thenReturn(null);
                    return mapper.mapRow(rs, 0);
                });
        when(jdbc.queryForList(contains("SELECT authority"), eq(String.class), eq(id)))
                .thenReturn(List.of());
        final Optional<RoleDefinition> out = new RoleDefinitionRepository(jdbc).findByName("Admin");
        assertThat(out).isPresent();
        assertThat(out.get().createdAt()).isEqualTo(Instant.EPOCH);
    }

    @Test
    void updateRejectsUnknownRoleId() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        final RoleDefinitionRepository repo = new RoleDefinitionRepository(jdbc);
        assertThatThrownBy(() -> repo.update(UUID.randomUUID(), "n", "d", Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @SuppressWarnings("unchecked")
    private static RoleDefinition stubRow(final UUID id, final String name, final boolean builtin) throws Exception {
        // Mock a ResultSet then run the real RowMapper against it to exercise the row-mapping code.
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("role_id", UUID.class)).thenReturn(id);
        when(rs.getString("name")).thenReturn(name);
        when(rs.getString("description")).thenReturn(builtin ? "built-in" : "custom");
        when(rs.getBoolean("is_builtin")).thenReturn(builtin);
        when(rs.getString("builtin_key")).thenReturn(builtin ? "ADMIN" : null);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(Instant.EPOCH));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(Instant.EPOCH));
        // Re-use the repo's private mapper via reflection isn't needed: just build the record directly.
        return new RoleDefinition(id, name, builtin ? "built-in" : "custom", builtin,
                builtin ? "ADMIN" : null, Set.of(), Instant.EPOCH, Instant.EPOCH);
    }
}
