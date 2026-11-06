package ug.ac.mak.der.security;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * JDBC over {@code der.signin_setting} (V090).
 *
 * <p>Singleton table — the row is created in the migration, so callers
 * can assume {@link #read()} always returns a {@link Settings}. Updates
 * leave non-mutated columns untouched.</p>
 */
@Repository
public class SigninSettingRepository {

    private final JdbcTemplate jdbc;

    public SigninSettingRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Load the text fields and background metadata. The image bytes are
     * excluded on purpose — reading the row for a dashboard shouldn't
     * drag the image blob along.
     */
    public Settings read() {
        return jdbc.queryForObject(
                "SELECT layout, app_title, app_intro, submit_label, footer_html, "
                        + "bg_mime, bg_etag, updated_by, updated_at "
                        + "FROM der.signin_setting WHERE id = 1",
                rowMapper());
    }

    /** Stream the background image bytes, or an empty array if NULL. */
    public byte[] readBackground() {
        final byte[] bytes = jdbc.queryForObject(
                "SELECT bg_image FROM der.signin_setting WHERE id = 1",
                (ResultSet rs, int n) -> rs.getBytes("bg_image"));
        return bytes == null ? new byte[0] : bytes;
    }

    /**
     * Update the non-image fields. Any argument may be {@code null},
     * which clears that field.
     */
    public int updateText(final String layout,
                          final String appTitle,
                          final String appIntro,
                          final String submitLabel,
                          final String footerHtml,
                          final UUID updatedBy) {
        return jdbc.update(
                "UPDATE der.signin_setting SET "
                        + "layout = ?, app_title = ?, app_intro = ?, "
                        + "submit_label = ?, footer_html = ?, "
                        + "updated_by = ?, updated_at = now() "
                        + "WHERE id = 1",
                layout, appTitle, appIntro, submitLabel, footerHtml, updatedBy);
    }

    /** Set the background bytes along with their MIME type and etag. */
    public int updateBackground(final byte[] bytes,
                                 final String mime,
                                 final String etag,
                                 final UUID updatedBy) {
        return jdbc.update(
                "UPDATE der.signin_setting SET "
                        + "bg_image = ?, bg_mime = ?, bg_etag = ?, "
                        + "updated_by = ?, updated_at = now() "
                        + "WHERE id = 1",
                bytes, mime, etag, updatedBy);
    }

    /** NULL the three bg_* columns atomically. */
    public int clearBackground(final UUID updatedBy) {
        return jdbc.update(
                "UPDATE der.signin_setting SET "
                        + "bg_image = NULL, bg_mime = NULL, bg_etag = NULL, "
                        + "updated_by = ?, updated_at = now() "
                        + "WHERE id = 1",
                updatedBy);
    }

    private static RowMapper<Settings> rowMapper() {
        return (ResultSet rs, int n) -> new Settings(
                rs.getString("layout"),
                rs.getString("app_title"),
                rs.getString("app_intro"),
                rs.getString("submit_label"),
                rs.getString("footer_html"),
                rs.getString("bg_mime"),
                rs.getString("bg_etag"),
                rs.getObject("updated_by", UUID.class),
                rs.getTimestamp("updated_at") == null ? null
                        : rs.getTimestamp("updated_at").toInstant());
    }

    /** Projection returned by {@link #read()}; bg bytes excluded by design. */
    public record Settings(String layout,
                            String appTitle,
                            String appIntro,
                            String submitLabel,
                            String footerHtml,
                            String bgMime,
                            String bgEtag,
                            UUID updatedBy,
                            Instant updatedAt) { }
}
