package ug.ac.mak.der.dhis2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class Dhis2CompatibilityGuardTest {

    @Test
    void okWhenVersionMatchesPinnedPrefix() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", "abc", "2026"));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", "u", "p", 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        final Dhis2CompatibilityGuard.Result result = new Dhis2CompatibilityGuard(client, props).check();
        assertThat(result.status()).isEqualTo(Dhis2CompatibilityGuard.Status.OK);
        assertThat(result.observed().version()).isEqualTo("2.44-SNAPSHOT");
        assertThat(result.pin()).isEqualTo("2.44-SNAPSHOT");
    }

    @Test
    void okWhenVersionStartsWithPrefix() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenReturn(Dhis2Version.of("2.44-SNAPSHOT-build-xyz"));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        final Dhis2CompatibilityGuard.Result result = new Dhis2CompatibilityGuard(client, props).check();
        assertThat(result.status()).isEqualTo(Dhis2CompatibilityGuard.Status.OK);
    }

    @Test
    void mismatchFailsClosedByDefault() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenReturn(Dhis2Version.of("2.43.1"));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        assertThatThrownBy(() -> new Dhis2CompatibilityGuard(client, props).check())
                .isInstanceOf(Dhis2CompatibilityGuard.Dhis2VersionMismatchException.class)
                .hasMessageContaining("2.43.1")
                .hasMessageContaining("2.44-SNAPSHOT");
    }

    @Test
    void mismatchAllowedWhenOverrideSet() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenReturn(Dhis2Version.of("2.43.1"));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", true));
        final Dhis2CompatibilityGuard.Result result = new Dhis2CompatibilityGuard(client, props).check();
        assertThat(result.status()).isEqualTo(Dhis2CompatibilityGuard.Status.MISMATCH_ALLOWED);
        assertThat(result.observed().version()).isEqualTo("2.43.1");
        assertThat(result.pin()).isEqualTo("2.44-SNAPSHOT");
    }

    @Test
    void notConfiguredWhenBaseUrlBlank() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        final Dhis2CompatibilityGuard.Result result = new Dhis2CompatibilityGuard(client, props).check();
        assertThat(result.status()).isEqualTo(Dhis2CompatibilityGuard.Status.NOT_CONFIGURED);
        assertThat(result.observed()).isNull();
    }

    @Test
    void notConfiguredWhenBaseUrlNull() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central(null, null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        final Dhis2CompatibilityGuard.Result result = new Dhis2CompatibilityGuard(client, props).check();
        assertThat(result.status()).isEqualTo(Dhis2CompatibilityGuard.Status.NOT_CONFIGURED);
    }

    @Test
    void unreachablePropagates() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("down", null));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        assertThatThrownBy(() -> new Dhis2CompatibilityGuard(client, props).check())
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class);
    }

    @Test
    void badResponsePropagates() throws Exception {
        final Dhis2ReferenceClient client = mock(Dhis2ReferenceClient.class);
        when(client.fetchVersion()).thenThrow(new Dhis2ReferenceClient.Dhis2ResponseException("bad", null));
        final Dhis2Properties props = new Dhis2Properties(
                new Dhis2Properties.Central("http://h", null, null, 5000),
                new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        assertThatThrownBy(() -> new Dhis2CompatibilityGuard(client, props).check())
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class);
    }

    @Test
    void mismatchExceptionCarriesObservedAndPin() {
        final Dhis2CompatibilityGuard.Dhis2VersionMismatchException ex =
                new Dhis2CompatibilityGuard.Dhis2VersionMismatchException("2.43.1", "2.44-SNAPSHOT");
        assertThat(ex.observed()).isEqualTo("2.43.1");
        assertThat(ex.pin()).isEqualTo("2.44-SNAPSHOT");
    }
}
