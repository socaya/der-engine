package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class FileResourceControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.DHIS2, "x", false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void uploadPersistsBytesAndReturnsDhis2Shape() throws Exception {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), anyString(), anyString(), anyString(),
                anyLong(), anyString(), anyString(), any(byte[].class), any()))
                .thenReturn(1);
        final var file = new MockMultipartFile("file", "photo.png",
                "image/png", new byte[]{0x01, 0x02, 0x03});
        final var r = new FileResourceController(jdbc).upload(
                principal(), file, "DATA_VALUE");
        assertThat(r.getStatusCode().value()).isEqualTo(202);
        final var body = r.getBody();
        assertThat(body).isNotNull();
        final Map<?, ?> resp = (Map<?, ?>) ((Map<?, ?>) body.get("response"))
                .get("fileResource");
        assertThat(resp.get("contentLength")).isEqualTo(3);
        assertThat(resp.get("contentType")).isEqualTo("image/png");
        // DHIS2 UIDs are 11-char [a-zA-Z0-9].
        assertThat(String.valueOf(resp.get("id")))
                .matches("[a-zA-Z][a-zA-Z0-9]{10}");
        assertThat(resp.get("storageStatus")).isEqualTo("STORED");
        // Side-effect: INSERT fired against the real table.
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains("INSERT INTO der.app_file_resource"),
                anyString(), anyString(), anyString(), anyLong(),
                anyString(), anyString(), any(byte[].class), any());
    }

    @Test
    void uploadEmptyFileReturns400() throws Exception {
        final var jdbc = mock(JdbcTemplate.class);
        final var file = new MockMultipartFile("file", "", "", new byte[0]);
        final var r = new FileResourceController(jdbc).upload(
                principal(), file, "DATA_VALUE");
        assertThat(r.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void metadataReadReturnsDhis2ShapedBody() {
        final var jdbc = mock(JdbcTemplate.class);
        final Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", "FRabcdef1234");
        row.put("name", "photo.png");
        row.put("displayName", "photo.png");
        row.put("contentType", "image/png");
        row.put("contentLength", 3L);
        row.put("contentMd5", "abc");
        row.put("domain", "DATA_VALUE");
        row.put("storageStatus", "STORED");
        row.put("created", Instant.now().toString());
        when(jdbc.queryForObject(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                eq("FRabcdef1234"))).thenReturn(row);
        final var r = new FileResourceController(jdbc).readMetadata(
                principal(), "FRabcdef1234");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody()).isEqualTo(row);
    }

    @Test
    void metadataReadMissingReturns404Shaped() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                anyString()))
                .thenThrow(new EmptyResultDataAccessException(1));
        final var r = new FileResourceController(jdbc).readMetadata(
                principal(), "FRmissing00");
        assertThat(r.getStatusCode().value()).isEqualTo(404);
        assertThat(String.valueOf(r.getBody()))
                .contains("fileResource FRmissing00");
    }

    @Test
    void anonymousRejected() throws Exception {
        final var ctrl = new FileResourceController(mock(JdbcTemplate.class));
        assertThat(ctrl.upload(null,
                new MockMultipartFile("file", new byte[]{0}), "DATA_VALUE")
                .getStatusCode().value()).isEqualTo(401);
        assertThat(ctrl.readMetadata(null, "x").getStatusCode().value())
                .isEqualTo(401);
        assertThat(ctrl.readBytes(null, "x").getStatusCode().value())
                .isEqualTo(401);
    }
}
