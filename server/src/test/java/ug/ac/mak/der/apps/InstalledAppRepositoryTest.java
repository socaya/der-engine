package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class InstalledAppRepositoryTest {

    private InstalledApp sample() {
        return new InstalledApp(UUID.randomUUID(), "key", "1.0", "name",
                "{}", "/tmp/apps/key/1.0", UUID.randomUUID(), Instant.now(), true);
    }

    @Test
    void insertDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new InstalledAppRepository(jdbc).insert(sample());
    }

    @Test
    void findAll() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        assertThat(new InstalledAppRepository(jdbc).findAll()).isEmpty();
    }

    @Test
    void findByIdMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new InstalledAppRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("app_id")).thenReturn(UUID.randomUUID());
        when(rs.getString("app_key")).thenReturn("key");
        when(rs.getString("version")).thenReturn("1.0");
        when(rs.getString("display_name")).thenReturn("name");
        when(rs.getString("manifest_json")).thenReturn("{}");
        when(rs.getString("install_path")).thenReturn("/tmp");
        when(rs.getObject("installed_by")).thenReturn(UUID.randomUUID());
        when(rs.getTimestamp("installed_at")).thenReturn(Timestamp.from(Instant.now()));
        when(rs.getBoolean("enabled")).thenReturn(true);
        final ArgumentCaptor<RowMapper<InstalledApp>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), any(UUID.class)))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new InstalledAppRepository(jdbc).findById(UUID.randomUUID())).isPresent();
    }

    @Test
    void findByKeyMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("key")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new InstalledAppRepository(jdbc).findByKey("key")).isEmpty();
    }

    @Test
    void findByKeyHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("app_id")).thenReturn(UUID.randomUUID());
        when(rs.getString("app_key")).thenReturn("key");
        when(rs.getString("version")).thenReturn("1.0");
        when(rs.getString("display_name")).thenReturn("name");
        when(rs.getString("manifest_json")).thenReturn("{}");
        when(rs.getString("install_path")).thenReturn("/tmp");
        when(rs.getObject("installed_by")).thenReturn(UUID.randomUUID());
        when(rs.getTimestamp("installed_at")).thenReturn(Timestamp.from(Instant.now()));
        when(rs.getBoolean("enabled")).thenReturn(true);
        final ArgumentCaptor<RowMapper<InstalledApp>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq("key")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new InstalledAppRepository(jdbc).findByKey("key")).isPresent();
    }

    @Test
    void setEnabledAndDelete() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), anyBoolean(), any(UUID.class))).thenReturn(1);
        when(jdbc.update(anyString(), any(UUID.class))).thenReturn(1);
        assertThat(new InstalledAppRepository(jdbc).setEnabled(UUID.randomUUID(), true)).isEqualTo(1);
        assertThat(new InstalledAppRepository(jdbc).delete(UUID.randomUUID())).isEqualTo(1);
    }

    @Test
    void installedAppRecordRejectsNulls() {
        assertThatThrownBy(() -> new InstalledApp(null, "k", "v", "n", "{}", "/p",
                UUID.randomUUID(), Instant.now(), true))
                .isInstanceOf(NullPointerException.class);
    }
}
