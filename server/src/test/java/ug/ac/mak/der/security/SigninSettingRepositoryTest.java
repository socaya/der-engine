package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
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
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** Unit coverage for {@link SigninSettingRepository}. */
class SigninSettingRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-11-06T00:00:00Z");

    @Test
    void readProjectsRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("layout")).thenReturn("sidebar");
        when(rs.getString("app_title")).thenReturn("DER");
        when(rs.getString("app_intro")).thenReturn("intro");
        when(rs.getString("submit_label")).thenReturn("Sign in");
        when(rs.getString("footer_html")).thenReturn("<p>&copy;</p>");
        when(rs.getString("bg_mime")).thenReturn("image/png");
        when(rs.getString("bg_etag")).thenReturn("deadbeef");
        final UUID uid = UUID.randomUUID();
        when(rs.getObject("updated_by", UUID.class)).thenReturn(uid);
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(NOW));

        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var s = new SigninSettingRepository(jdbc).read();
        assertThat(s.layout()).isEqualTo("sidebar");
        assertThat(s.appTitle()).isEqualTo("DER");
        assertThat(s.bgMime()).isEqualTo("image/png");
        assertThat(s.bgEtag()).isEqualTo("deadbeef");
        assertThat(s.updatedBy()).isEqualTo(uid);
        assertThat(s.updatedAt()).isEqualTo(NOW);
    }

    @Test
    void readHandlesNullTimestamp() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("layout")).thenReturn(null);
        when(rs.getString("app_title")).thenReturn(null);
        when(rs.getString("app_intro")).thenReturn(null);
        when(rs.getString("submit_label")).thenReturn(null);
        when(rs.getString("footer_html")).thenReturn(null);
        when(rs.getString("bg_mime")).thenReturn(null);
        when(rs.getString("bg_etag")).thenReturn(null);
        when(rs.getObject("updated_by", UUID.class)).thenReturn(null);
        when(rs.getTimestamp("updated_at")).thenReturn(null);

        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var s = new SigninSettingRepository(jdbc).read();
        assertThat(s.updatedAt()).isNull();
        assertThat(s.layout()).isNull();
    }

    @Test
    void readBackgroundReturnsBytes() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final byte[] payload = "PNG".getBytes();
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getBytes("bg_image")).thenReturn(payload);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThat(new SigninSettingRepository(jdbc).readBackground()).isEqualTo(payload);
    }

    @Test
    void readBackgroundReturnsEmptyWhenNull() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getBytes("bg_image")).thenReturn(null);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThat(new SigninSettingRepository(jdbc).readBackground()).isEmpty();
    }

    @Test
    void updateTextTargetsSingletonRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.update(contains("UPDATE der.signin_setting"),
                eq("hero"), eq("T"), eq("I"), eq("Go"), eq("<p/>"), eq(uid)))
                .thenReturn(1);
        final int rows = new SigninSettingRepository(jdbc)
                .updateText("hero", "T", "I", "Go", "<p/>", uid);
        assertThat(rows).isEqualTo(1);
        verify(jdbc).update(contains("WHERE id = 1"),
                eq("hero"), eq("T"), eq("I"), eq("Go"), eq("<p/>"), eq(uid));
    }

    @Test
    void updateTextAcceptsNulls() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        assertThat(new SigninSettingRepository(jdbc)
                .updateText(null, null, null, null, null, null)).isEqualTo(1);
    }

    @Test
    void updateBackgroundWritesAllThreeColumns() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final byte[] bytes = new byte[]{1, 2, 3};
        final UUID uid = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(bytes), eq("image/png"), eq("etag1"), eq(uid)))
                .thenReturn(1);
        assertThat(new SigninSettingRepository(jdbc)
                .updateBackground(bytes, "image/png", "etag1", uid)).isEqualTo(1);
        verify(jdbc).update(contains("bg_image = ?"), eq(bytes), eq("image/png"),
                eq("etag1"), eq(uid));
    }

    @Test
    void clearBackgroundNullsAllThreeColumns() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(uid))).thenReturn(1);
        assertThat(new SigninSettingRepository(jdbc).clearBackground(uid)).isEqualTo(1);
        verify(jdbc).update(contains("bg_image = NULL"), eq(uid));
        verify(jdbc).update(contains("bg_mime = NULL"), eq(uid));
        verify(jdbc).update(contains("bg_etag = NULL"), eq(uid));
    }

    @Test
    void settingsRecordRoundTrip() {
        final UUID uid = UUID.randomUUID();
        final var s = new SigninSettingRepository.Settings(
                "standard", "T", "I", "Go", "<p/>", "image/svg+xml", "etag", uid, NOW);
        assertThat(s.layout()).isEqualTo("standard");
        assertThat(s.appTitle()).isEqualTo("T");
        assertThat(s.appIntro()).isEqualTo("I");
        assertThat(s.submitLabel()).isEqualTo("Go");
        assertThat(s.footerHtml()).isEqualTo("<p/>");
        assertThat(s.bgMime()).isEqualTo("image/svg+xml");
        assertThat(s.bgEtag()).isEqualTo("etag");
        assertThat(s.updatedBy()).isEqualTo(uid);
        assertThat(s.updatedAt()).isEqualTo(NOW);
    }
}
