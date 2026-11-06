package ug.ac.mak.der.apps;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/** Unit coverage for {@link AppBundleManifest}. */
class AppBundleManifestTest {

    @Test
    void parsesFullManifest() throws Exception {
        final String json = "{\n"
                + "  \"name\": \"data-entry\",\n"
                + "  \"displayName\": \"Data entry\",\n"
                + "  \"version\": \"0.1.0\",\n"
                + "  \"description\": \"d\",\n"
                + "  \"developer\": { \"name\": \"X\", \"email\": \"x@y\" },\n"
                + "  \"icons\": { \"128\": \"icon.svg\" },\n"
                + "  \"module\": \"Data\",\n"
                + "  \"requires_der_api\": \"1.0.0\",\n"
                + "  \"unknown\": true\n"
                + "}";
        final AppBundleManifest m = new ObjectMapper().readValue(json, AppBundleManifest.class);
        assertThat(m.name).isEqualTo("data-entry");
        assertThat(m.displayName).isEqualTo("Data entry");
        assertThat(m.version).isEqualTo("0.1.0");
        assertThat(m.description).isEqualTo("d");
        assertThat(m.developer).isNotNull();
        assertThat(m.developer.name).isEqualTo("X");
        assertThat(m.developer.email).isEqualTo("x@y");
        assertThat(m.iconsSafe()).containsEntry("128", "icon.svg");
        assertThat(m.module).isEqualTo("Data");
        assertThat(m.requiresDerApi).isEqualTo("1.0.0");
    }

    @Test
    void iconsSafeIsEmptyWhenAbsent() {
        final AppBundleManifest m = new AppBundleManifest();
        assertThat(m.iconsSafe()).isEmpty();
    }
}
