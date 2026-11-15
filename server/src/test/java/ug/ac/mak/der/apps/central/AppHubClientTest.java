package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;

class AppHubClientTest {

    private static Dhis2Properties props(final String maxTested) {
        return new Dhis2Properties(
                new Dhis2Properties.Central("", "", "", 1000),
                new Dhis2Properties.Compatibility(
                        "2.41", maxTested, "warn", true, 24, false, null, false));
    }

    // ---- compareSemver + compatible ---------------------------------

    @Test
    void compareSemverTreatsDottedMajorMinor() {
        assertThat(AppHubClient.compareSemver("2.44", "2.41")).isGreaterThan(0);
        assertThat(AppHubClient.compareSemver("2.41", "2.44")).isLessThan(0);
        assertThat(AppHubClient.compareSemver("2.44", "2.44")).isZero();
        assertThat(AppHubClient.compareSemver("2.44.1", "2.44")).isZero();
        // Non-numeric segments fall through to lexical compare.
        assertThat(AppHubClient.compareSemver("2.44", "2.44-SNAPSHOT")).isLessThan(0);
    }

    @Test
    void compatibleRespectsLowerAndUpperBounds() {
        final var v = new AppHubClient.HubVersion();
        v.version = "100.1.0";
        v.downloadUrl = "https://x";
        v.minDhisVersion = "2.41";
        v.maxDhisVersion = "2.44";
        assertThat(AppHubClient.compatible(v, "2.44")).isTrue();
        assertThat(AppHubClient.compatible(v, "2.41")).isTrue();
        assertThat(AppHubClient.compatible(v, "2.40")).isFalse();
        assertThat(AppHubClient.compatible(v, "2.45")).isFalse();
    }

    @Test
    void compatibleTreatsEmptyMaxAsUnbounded() {
        final var v = new AppHubClient.HubVersion();
        v.minDhisVersion = "2.41";
        v.maxDhisVersion = "";  // open-ended upper bound
        assertThat(AppHubClient.compatible(v, "2.99")).isTrue();
    }

    @Test
    void compatibleTreatsNullMinAsNoFloor() {
        final var v = new AppHubClient.HubVersion();
        v.minDhisVersion = null;
        v.maxDhisVersion = "2.44";
        assertThat(AppHubClient.compatible(v, "2.0")).isTrue();
    }

    // ---- pickVersion ------------------------------------------------

    @Test
    void pickVersionPicksHighestInRange() {
        final var client = new AppHubClient(mock(HttpClient.class),
                new ObjectMapper(), props("2.44"), "https://apps.dhis2.org/api/v1");
        final var app = new AppHubClient.HubApp();
        app.name = "Capture";
        app.versions = List.of(
                version("100.1.0", "2.41", "2.43"),  // out of range (max=2.43)
                version("100.5.0", "2.41", "2.44"),  // in range, lower
                version("100.18.0", "2.41", "2.44"),  // in range, highest
                version("200.0.0", "2.45", ""));     // out of range (min too new)
        final var v = client.pickVersion(app);
        assertThat(v).isNotNull();
        assertThat(v.version).isEqualTo("100.18.0");
    }

    @Test
    void pickVersionReturnsNullWhenNothingInRange() {
        final var client = new AppHubClient(mock(HttpClient.class),
                new ObjectMapper(), props("2.44"), "https://apps.dhis2.org/api/v1");
        final var app = new AppHubClient.HubApp();
        app.name = "TooNew";
        app.versions = List.of(
                version("3.0.0", "2.45", ""),
                version("3.1.0", "2.46", ""));
        assertThat(client.pickVersion(app)).isNull();
    }

    @Test
    void pickVersionSkipsMalformedEntries() {
        final var client = new AppHubClient(mock(HttpClient.class),
                new ObjectMapper(), props("2.44"), "https://apps.dhis2.org/api/v1");
        final var app = new AppHubClient.HubApp();
        app.name = "Partial";
        app.versions = java.util.Arrays.asList(
                null,
                version(null, "2.41", "2.44"),          // no version
                versionNoDownload("1.0.0", "2.41", "2.44"),  // no url
                version("1.1.0", "2.41", "2.44"));
        final var v = client.pickVersion(app);
        assertThat(v).isNotNull();
        assertThat(v.version).isEqualTo("1.1.0");
    }

    // ---- listApps (end-to-end wire format) --------------------------

    @Test
    @SuppressWarnings("unchecked")
    void listAppsMapsHubShapeToCentralApp() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> resp = mock(HttpResponse.class);
        final byte[] body = ("["
                + "{\"id\":\"a1\",\"key\":\"capture\",\"name\":\"Capture\","
                + " \"versions\":[{\"version\":\"100.18.0\",\"minDhisVersion\":\"2.41\","
                + " \"maxDhisVersion\":\"2.44\",\"downloadUrl\":\"https://x/capture.zip\"}]}"
                + "]").getBytes();
        when(resp.statusCode()).thenReturn(200);
        when(resp.body()).thenReturn(body);
        when(http.<byte[]>send(any(), any())).thenReturn(resp);
        final var client = new AppHubClient(http, new ObjectMapper(),
                props("2.44"), "https://apps.dhis2.org/api/v1");
        final List<CentralApp> apps = client.listApps();
        assertThat(apps).hasSize(1);
        assertThat(apps.get(0).key()).isEqualTo("capture");
        assertThat(apps.get(0).version()).isEqualTo("100.18.0");
        assertThat(apps.get(0).downloadUrl()).isEqualTo("https://x/capture.zip");
    }

    @Test
    @SuppressWarnings("unchecked")
    void listAppsReturnsEmptyOnNon2xx() throws Exception {
        final HttpClient http = mock(HttpClient.class);
        final HttpResponse<byte[]> resp = mock(HttpResponse.class);
        when(resp.statusCode()).thenReturn(503);
        when(resp.body()).thenReturn(new byte[0]);
        when(http.<byte[]>send(any(), any())).thenReturn(resp);
        final var client = new AppHubClient(http, new ObjectMapper(),
                props("2.44"), "https://apps.dhis2.org/api/v1");
        assertThat(client.listApps()).isEmpty();
    }

    @Test
    void fetchBundleRejectsRelativeUrls() {
        final var client = new AppHubClient(mock(HttpClient.class),
                new ObjectMapper(), props("2.44"), "https://apps.dhis2.org/api/v1");
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                client.fetchBundle("/relative/path.zip"))
                .hasMessageContaining("must be absolute");
    }

    // helpers

    private static AppHubClient.HubVersion version(final String ver,
                                                     final String min,
                                                     final String max) {
        final var v = new AppHubClient.HubVersion();
        v.version = ver;
        v.minDhisVersion = min;
        v.maxDhisVersion = max;
        v.downloadUrl = ver == null ? null : "https://x/" + ver + ".zip";
        return v;
    }

    private static AppHubClient.HubVersion versionNoDownload(final String ver,
                                                               final String min,
                                                               final String max) {
        final var v = new AppHubClient.HubVersion();
        v.version = ver;
        v.minDhisVersion = min;
        v.maxDhisVersion = max;
        v.downloadUrl = null;
        return v;
    }

}
