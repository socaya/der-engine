package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;

class AppShellStubsControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.DHIS2, "x", false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static AppShellStubsController newController(
            final JdbcTemplate jdbc,
            final AggregateDataValueRepository aggregates) {
        return new AppShellStubsController(jdbc, aggregates);
    }

    @Test
    void pingProbesDbAndReturnsPongOnHealthyRead() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1"), eq(Integer.class))).thenReturn(1);
        final var r = newController(jdbc, mock(AggregateDataValueRepository.class))
                .ping();
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody()).isEqualTo("pong");
    }

    @Test
    void pingReturns503WhenDbFails() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class)))
                .thenThrow(new RuntimeException("conn-refused"));
        final var r = newController(jdbc, mock(AggregateDataValueRepository.class))
                .ping();
        assertThat(r.getStatusCode().value()).isEqualTo(503);
        assertThat(r.getBody()).contains("db-error");
    }

    @Test
    void loginConfigReadsLiveFromSignInSettingAndSystemSetting() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.contains("system_setting"),
                eq(String.class), eq("applicationTitle")))
                .thenReturn("Facility A - DER");
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.contains("system_setting"),
                eq(String.class), eq("keyUiLocale")))
                .thenReturn("sw");
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.contains("signin_setting"),
                any(org.springframework.jdbc.core.RowMapper.class)))
                .thenReturn(null);
        final var r = newController(jdbc,
                mock(AggregateDataValueRepository.class)).loginConfig();
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        final var body = r.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("applicationTitle")).isEqualTo("Facility A - DER");
        assertThat(body.get("uiLocale")).isEqualTo("sw");
        assertThat(body.get("loginPageLayout")).isEqualTo("DEFAULT");
        assertThat(body.get("useCustomLogoBanner")).isEqualTo(false);
    }

    @Test
    void loginConfigDegradesGracefullyWhenDbFails() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(String.class), anyString()))
                .thenThrow(new RuntimeException("timeout"));
        when(jdbc.queryForObject(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class)))
                .thenThrow(new RuntimeException("timeout"));
        final var r = newController(jdbc,
                mock(AggregateDataValueRepository.class)).loginConfig();
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(String.valueOf(r.getBody().get("applicationTitle")))
                .contains("DER");
    }

    @Test
    void staticLogoBannerServesBytesWhenPresent() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForMap(anyString())).thenReturn(Map.of(
                "bg_image", new byte[]{0x01, 0x02, 0x03},
                "bg_mime", "image/png"));
        final var r = newController(jdbc,
                mock(AggregateDataValueRepository.class)).staticLogoBanner();
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody()).containsExactly((byte) 0x01,
                (byte) 0x02, (byte) 0x03);
    }

    @Test
    void staticLogoBannerReturns204WhenAbsent() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForMap(anyString()))
                .thenReturn(new java.util.HashMap<>());
        assertThat(newController(jdbc,
                mock(AggregateDataValueRepository.class))
                .staticLogoBanner().getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void dataSetCompletionReadsFromDatasetCompletionTable() {
        final var jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                any(Object[].class)))
                .thenReturn(List.of(Map.of(
                        "dataSet", "DS_A",
                        "organisationUnit", "OU_1",
                        "period", "2026W46",
                        "completed", true)));
        final var r = newController(jdbc,
                mock(AggregateDataValueRepository.class))
                .dataSetCompletion(principal(), "DS_A", null, null);
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody().get("dataSetCompletion"))
                .asList().hasSize(1);
    }

    @Test
    void dataSetCompletionAnonymousRejected() {
        final var r = newController(mock(JdbcTemplate.class),
                mock(AggregateDataValueRepository.class))
                .dataSetCompletion(null, null, null, null);
        assertThat(r.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void dataEntryDataValuesRequiresOuAndPe() {
        final var r = newController(mock(JdbcTemplate.class),
                mock(AggregateDataValueRepository.class))
                .dataEntryDataValues(principal(), null, null);
        assertThat(r.getStatusCode().value()).isEqualTo(400);
        assertThat(String.valueOf(r.getBody().get("message")))
                .contains("ou and pe");
    }

    @Test
    void dataEntryDataValuesReadsFromRealRepo() {
        final var repo = mock(AggregateDataValueRepository.class);
        when(repo.findByFilter(eq("OU_1"), eq("2026W46"), anyInt()))
                .thenReturn(List.of(new AggregateDataValue(
                        UUID.randomUUID(), "DE_A", "OU_1", "2026W46",
                        "COC_A", "AOC_A", "42", null,
                        UUID.randomUUID(), Instant.now(), 1, "DS_A")));
        final var r = newController(mock(JdbcTemplate.class), repo)
                .dataEntryDataValues(principal(), "OU_1", "2026W46");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        final List<?> values = (List<?>) r.getBody().get("dataValues");
        assertThat(values).hasSize(1);
        assertThat(((Map<?, ?>) values.get(0)).get("value")).isEqualTo("42");
    }
}
