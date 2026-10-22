package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class EdgeUserRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");

    private EdgeUser buildUser() {
        return new EdgeUser(UUID.randomUUID(), "alice", "Alice", EdgeUser.Origin.BOOTSTRAP, "x1", false,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
    }

    @Test
    void upsertWritesUserRolesAndVerifier() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeUser u = buildUser();
        new EdgeUserRepository(jdbc).upsert(u, "verifier");
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.edge_user"),
                eq(u.userId()), eq(u.username()), eq(u.displayName()), eq("BOOTSTRAP"), eq("x1"), eq(false),
                any(Timestamp.class), any(Timestamp.class));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("DELETE FROM der.edge_role"), eq(u.userId()));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.edge_role"), eq(u.userId()), eq("ADMIN"));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.edge_credential"),
                eq(u.userId()), eq("verifier"));
    }

    @Test
    void upsertSkipsCredentialWhenVerifierNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeUser u = buildUser();
        new EdgeUserRepository(jdbc).upsert(u, null);
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("edge_credential"),
                any(Object[].class));
    }

    @Test
    void findByUsernameEmptyForNullBlank() {
        final EdgeUserRepository repo = new EdgeUserRepository(mock(JdbcTemplate.class));
        assertThat(repo.findByUsername(null)).isEmpty();
        assertThat(repo.findByUsername("  ")).isEmpty();
    }

    @Test
    void findByUsernameEmptyWhenJdbcMissed() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("alice")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeUserRepository(jdbc).findByUsername("alice")).isEmpty();
    }

    @Test
    void findByUsernameEnrichesWithRoles() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeUser plain = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP,
                null, false, Set.of(), NOW, NOW);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("alice"))).thenReturn(plain);
        when(jdbc.queryForList(anyString(), eq(String.class), eq(plain.userId())))
                .thenReturn(List.of("ADMIN", "OPERATOR"));
        assertThat(new EdgeUserRepository(jdbc).findByUsername("alice").orElseThrow().roles())
                .containsExactlyInAnyOrder(EdgeRole.ADMIN, EdgeRole.OPERATOR);
    }

    @Test
    void findByIdEmptyWhenNotFound() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeUserRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHydratesRoles() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeUser plain = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null,
                false, Set.of(), NOW, NOW);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(plain.userId()))).thenReturn(plain);
        when(jdbc.queryForList(anyString(), eq(String.class), eq(plain.userId()))).thenReturn(List.of());
        assertThat(new EdgeUserRepository(jdbc).findById(plain.userId())).isPresent();
    }

    @Test
    void findAllReturnsOrderedEnrichedList() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeUser plain = new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null,
                false, Set.of(), NOW, NOW);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of(plain));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(plain.userId()))).thenReturn(List.of("REVIEWER"));
        final var list = new EdgeUserRepository(jdbc).findAll();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).roles()).containsExactly(EdgeRole.REVIEWER);
    }

    @Test
    void findVerifierPresentAndEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(String.class), eq(uid))).thenReturn("v");
        assertThat(new EdgeUserRepository(jdbc).findVerifier(uid)).contains("v");

        when(jdbc.queryForObject(anyString(), eq(String.class), eq(uid)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeUserRepository(jdbc).findVerifier(uid)).isEmpty();
    }

    @Test
    void anyUserHasRoleHandlesZeroAndMore() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("ADMIN"))).thenReturn(0, 3);
        assertThat(new EdgeUserRepository(jdbc).anyUserHasRole(EdgeRole.ADMIN)).isFalse();
        assertThat(new EdgeUserRepository(jdbc).anyUserHasRole(EdgeRole.ADMIN)).isTrue();
    }

    @Test
    void anyUserHasRoleFalseWhenCountIsNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("ADMIN"))).thenReturn(null);
        assertThat(new EdgeUserRepository(jdbc).anyUserHasRole(EdgeRole.ADMIN)).isFalse();
    }

    @Test
    void rowMapperReadsStandardShape() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new EdgeUserRepository(jdbc); // ensures ctor succeeds
        // Reflectively grab the private RowMapper via a public helper call that
        // forces the mapper to run. We arrange a ResultSet that returns the
        // fields; RowMapper is used by queryForObject when findByUsername runs
        // against a non-null result below.
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("user_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("username")).thenReturn("alice");
        when(rs.getString("display_name")).thenReturn("A");
        when(rs.getString("origin")).thenReturn("DHIS2");
        when(rs.getObject("external_uid", String.class)).thenReturn("x1");
        when(rs.getBoolean("disabled")).thenReturn(true);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));

        final EdgeUserRepository repo = new EdgeUserRepository(jdbc);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(Object.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        when(jdbc.queryForList(anyString(), eq(String.class), any(UUID.class))).thenReturn(List.of());
        final var user = repo.findByUsername("alice").orElseThrow();
        assertThat(user.origin()).isEqualTo(EdgeUser.Origin.DHIS2);
        assertThat(user.disabled()).isTrue();
        assertThat(user.externalUid()).isEqualTo("x1");
    }
}
