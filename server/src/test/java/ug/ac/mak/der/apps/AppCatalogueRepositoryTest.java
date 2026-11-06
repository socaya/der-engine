package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** Unit coverage for {@link AppCatalogueRepository}. */
class AppCatalogueRepositoryTest {

    // ---- signing_key ---------------------------------------------------

    @Test
    void readSigningKeyMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new AppCatalogueRepository(jdbc).readSigningKey()).isEmpty();
    }

    @Test
    void readSigningKeyHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("algorithm")).thenReturn("Ed25519");
        when(rs.getString("public_key_b64")).thenReturn("pub");
        when(rs.getString("sealed_secret")).thenReturn("sealed");
        final ArgumentCaptor<RowMapper<AppCatalogueRepository.SigningKey>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture()))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final var out = new AppCatalogueRepository(jdbc).readSigningKey();
        assertThat(out).isPresent();
        assertThat(out.get().algorithm()).isEqualTo("Ed25519");
        assertThat(out.get().publicKeyB64()).isEqualTo("pub");
        assertThat(out.get().sealedSecret()).isEqualTo("sealed");
    }

    @Test
    void insertSigningKeyPassesArgumentsThrough() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID uid = UUID.randomUUID();
        when(jdbc.update(anyString(), eq("Ed25519"), eq("pub"), eq("sealed"), eq(uid)))
                .thenReturn(1);
        assertThat(new AppCatalogueRepository(jdbc)
                .insertSigningKey("Ed25519", "pub", "sealed", uid)).isEqualTo(1);
        verify(jdbc).update(contains("ON CONFLICT (id) DO NOTHING"),
                eq("Ed25519"), eq("pub"), eq("sealed"), eq(uid));
    }

    // ---- catalogue -----------------------------------------------------

    @Test
    void catalogueProjectsJoinedRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final UUID appId = UUID.randomUUID();
        when(rs.getObject("app_id")).thenReturn(appId);
        when(rs.getString("app_key")).thenReturn("data-entry");
        when(rs.getString("display_name")).thenReturn("Data Entry");
        when(rs.getString("manifest_json")).thenReturn("{\"module\":\"Data\"}");
        when(rs.getString("version")).thenReturn("1.4.0");
        when(rs.getString("bundle_sha256")).thenReturn("sha");
        when(rs.getString("signature_b64")).thenReturn("sig");
        when(rs.getString("requires_der_api")).thenReturn("1.0.0");
        when(rs.getString("icon_etag")).thenReturn("abc123");
        final ArgumentCaptor<RowMapper<AppCatalogueRepository.CatalogueEntry>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.query(anyString(), cap.capture()))
                .thenAnswer(inv -> List.of(cap.getValue().mapRow(rs, 1)));
        final List<AppCatalogueRepository.CatalogueEntry> out =
                new AppCatalogueRepository(jdbc).catalogue();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).appId()).isEqualTo(appId);
        assertThat(out.get(0).appKey()).isEqualTo("data-entry");
        assertThat(out.get(0).displayName()).isEqualTo("Data Entry");
        assertThat(out.get(0).manifestJson()).isEqualTo("{\"module\":\"Data\"}");
        assertThat(out.get(0).version()).isEqualTo("1.4.0");
        assertThat(out.get(0).bundleSha256()).isEqualTo("sha");
        assertThat(out.get(0).signatureB64()).isEqualTo("sig");
        assertThat(out.get(0).requiresDerApi()).isEqualTo("1.0.0");
        assertThat(out.get(0).iconEtag()).isEqualTo("abc123");
        verify(jdbc).query(contains("enabled = TRUE AND iav.superseded_at IS NULL"),
                any(RowMapper.class));
    }

    // ---- readBundle ----------------------------------------------------

    @Test
    void readBundleMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class),
                any(UUID.class), eq("1.0.0")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new AppCatalogueRepository(jdbc)
                .readBundle(UUID.randomUUID(), "1.0.0")).isEmpty();
    }

    @Test
    void readBundleHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final byte[] bytes = "JS".getBytes();
        when(rs.getBytes("bundle_bytes")).thenReturn(bytes);
        when(rs.getString("bundle_sha256")).thenReturn("sha");
        when(rs.getString("signature_b64")).thenReturn("sig");
        when(rs.getString("requires_der_api")).thenReturn("1.0.0");
        final ArgumentCaptor<RowMapper<AppCatalogueRepository.BundleRow>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(),
                any(UUID.class), eq("1.0.0")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final var out = new AppCatalogueRepository(jdbc)
                .readBundle(UUID.randomUUID(), "1.0.0");
        assertThat(out).isPresent();
        assertThat(out.get().bytes()).isEqualTo(bytes);
        assertThat(out.get().sha256()).isEqualTo("sha");
        assertThat(out.get().signatureB64()).isEqualTo("sig");
        assertThat(out.get().requiresDerApi()).isEqualTo("1.0.0");
    }

    @Test
    void bundleRowDefensivelyCopiesBytes() {
        final byte[] source = "orig".getBytes();
        final var row = new AppCatalogueRepository.BundleRow(source, "sha", "sig", "1.0.0");
        source[0] = 'X';
        assertThat(row.bytes()).isEqualTo("orig".getBytes());
        // Returned reference is also a copy — mutating it won't affect future reads.
        final byte[] first = row.bytes();
        first[0] = 'Y';
        assertThat(row.bytes()).isEqualTo("orig".getBytes());
    }

    // ---- installVersion ------------------------------------------------

    @Test
    void installVersionSupersedesPriorAndInserts() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID appId = UUID.randomUUID();
        final UUID userId = UUID.randomUUID();
        final byte[] bytes = "JS".getBytes();
        final UUID vid = new AppCatalogueRepository(jdbc).installVersion(
                appId, "1.0.0", bytes, "sha", "sig", "1.0.0", userId);
        assertThat(vid).isNotNull();
        verify(jdbc).update(contains("SET superseded_at = now()"), eq(appId));
        // The 7-arg overload delegates to the 11-arg form with null
        // manifest/icon columns — INSERT carries 12 bind values.
        verify(jdbc).update(contains("INSERT INTO der.installed_app_version"),
                eq(vid), eq(appId), eq("1.0.0"), eq(bytes), eq("sha"), eq("sig"),
                eq("1.0.0"), eq(userId),
                (Object) org.mockito.ArgumentMatchers.isNull(),
                (Object) org.mockito.ArgumentMatchers.isNull(),
                (Object) org.mockito.ArgumentMatchers.isNull(),
                (Object) org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void installVersionPersistsManifestAndIcon() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID appId = UUID.randomUUID();
        final UUID userId = UUID.randomUUID();
        final byte[] bundle = "JS".getBytes();
        final byte[] icon = "<svg/>".getBytes();
        final UUID vid = new AppCatalogueRepository(jdbc).installVersion(
                appId, "1.0.0", bundle, "sha", "sig", "1.0.0", userId,
                "{\"name\":\"k\"}", icon, "image/svg+xml", "etag16");
        assertThat(vid).isNotNull();
        verify(jdbc).update(contains("SET superseded_at = now()"), eq(appId));
        verify(jdbc).update(contains("CAST(? AS jsonb)"),
                eq(vid), eq(appId), eq("1.0.0"), eq(bundle), eq("sha"), eq("sig"),
                eq("1.0.0"), eq(userId), eq("{\"name\":\"k\"}"), eq(icon),
                eq("image/svg+xml"), eq("etag16"));
    }

    // ---- readIcon ------------------------------------------------------

    @Test
    void readIconMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class),
                any(UUID.class), eq("1.0.0")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new AppCatalogueRepository(jdbc)
                .readIcon(UUID.randomUUID(), "1.0.0")).isEmpty();
    }

    @Test
    void readIconHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final byte[] bytes = "<svg/>".getBytes();
        when(rs.getBytes("icon_bytes")).thenReturn(bytes);
        when(rs.getString("icon_mime")).thenReturn("image/svg+xml");
        when(rs.getString("icon_etag")).thenReturn("etag16");
        final ArgumentCaptor<RowMapper<AppCatalogueRepository.IconRow>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(),
                any(UUID.class), eq("1.0.0")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        final var out = new AppCatalogueRepository(jdbc)
                .readIcon(UUID.randomUUID(), "1.0.0");
        assertThat(out).isPresent();
        assertThat(out.get().bytes()).isEqualTo(bytes);
        assertThat(out.get().mime()).isEqualTo("image/svg+xml");
        assertThat(out.get().etag()).isEqualTo("etag16");
    }

    @Test
    void iconRowDefensivelyCopiesBytes() {
        final byte[] source = "orig".getBytes();
        final var row = new AppCatalogueRepository.IconRow(source, "image/svg+xml", "e");
        source[0] = 'X';
        assertThat(row.bytes()).isEqualTo("orig".getBytes());
        final byte[] first = row.bytes();
        first[0] = 'Y';
        assertThat(row.bytes()).isEqualTo("orig".getBytes());
    }

    // ---- setEnabled / deleteApp ---------------------------------------

    @Test
    void setEnabledWritesEnabledAndActor() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID appId = UUID.randomUUID();
        final UUID actor = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(true), eq(actor), eq(appId))).thenReturn(1);
        assertThat(new AppCatalogueRepository(jdbc).setEnabled(appId, true, actor))
                .isEqualTo(1);
        verify(jdbc).update(contains("UPDATE der.installed_app SET enabled = ?"),
                eq(true), eq(actor), eq(appId));
    }

    @Test
    void deleteAppDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID appId = UUID.randomUUID();
        when(jdbc.update(anyString(), eq(appId))).thenReturn(1);
        assertThat(new AppCatalogueRepository(jdbc).deleteApp(appId)).isEqualTo(1);
        verify(jdbc).update(contains("DELETE FROM der.installed_app"), eq(appId));
        verify(jdbc, never()).update(contains("installed_app_version"), any(UUID.class));
    }

    // ---- record shapes -------------------------------------------------

    @Test
    void signingKeyRecordExposesFields() {
        final var sk = new AppCatalogueRepository.SigningKey("Ed25519", "pub", "sealed");
        assertThat(sk.algorithm()).isEqualTo("Ed25519");
        assertThat(sk.publicKeyB64()).isEqualTo("pub");
        assertThat(sk.sealedSecret()).isEqualTo("sealed");
    }

    @Test
    void catalogueEntryRecordExposesFields() {
        final UUID id = UUID.randomUUID();
        final var e = new AppCatalogueRepository.CatalogueEntry(
                id, "k", "Name", "{}", "1.0", "sha", "sig", "1.0.0", "etag16");
        assertThat(e.appId()).isEqualTo(id);
        assertThat(e.appKey()).isEqualTo("k");
        assertThat(e.displayName()).isEqualTo("Name");
        assertThat(e.manifestJson()).isEqualTo("{}");
        assertThat(e.version()).isEqualTo("1.0");
        assertThat(e.bundleSha256()).isEqualTo("sha");
        assertThat(e.signatureB64()).isEqualTo("sig");
        assertThat(e.requiresDerApi()).isEqualTo("1.0.0");
        assertThat(e.iconEtag()).isEqualTo("etag16");
    }
}
