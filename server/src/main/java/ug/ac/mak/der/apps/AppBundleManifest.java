package ug.ac.mak.der.apps;

import java.util.Collections;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DHIS2-style {@code manifest.webapp} parsed into a Jackson-friendly DTO.
 *
 * <p>DHIS2 webapp manifests carry {@code name}, {@code version}, optional
 * {@code description} + {@code developer} + {@code icons}. DER extends the
 * shape with a {@code module} tile-grouping field and the
 * {@code requires_der_api} semver gate (snake-case to stay compatible with
 * the broader DHIS2 habit of snake-case custom extensions).  The three
 * required fields — {@code name}, {@code displayName}, {@code version} —
 * map to {@link InstalledApp#appKey()}, {@link InstalledApp#displayName()}
 * and the version row respectively.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class AppBundleManifest {

    /** DHIS2 app key — used as {@code installed_app.app_key}. Required. */
    public String name;

    /** Human-visible label. Required. */
    public String displayName;

    /** Semver string. Required. */
    public String version;

    /** Free-form text, optional. */
    public String description;

    /** Developer card; both inner fields optional. */
    public Developer developer;

    /** DHIS2 icon map — size (px as string) → zip entry name. */
    public Map<String, String> icons;

    /** DER tile grouping. Optional. */
    public String module;

    /** DER minimum-api semver. Snake-case for DHIS2 manifest habit. */
    @JsonProperty("requires_der_api")
    public String requiresDerApi;

    /** Icon map accessor that never returns null — simplifies callers. */
    public Map<String, String> iconsSafe() {
        return icons == null ? Collections.emptyMap() : icons;
    }

    /** Developer sub-record — name + email are both optional. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static final class Developer {
        public String name;
        public String email;
    }
}
