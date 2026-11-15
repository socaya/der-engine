package ug.ac.mak.der.apps;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Row in {@code der.installed_app}. */
public record InstalledApp(
        UUID appId,
        String appKey,
        String version,
        String displayName,
        String manifestJson,
        String installPath,
        UUID installedBy,
        Instant installedAt,
        boolean enabled,
        HostKind hostKind,
        Source source,
        TrustLevel trustLevel,
        Instant lastOpenedAt,
        String centralAppId
) {

    public InstalledApp {
        Objects.requireNonNull(appId, "appId");
        Objects.requireNonNull(appKey, "appKey");
        Objects.requireNonNull(version, "version");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(manifestJson, "manifestJson");
        Objects.requireNonNull(installPath, "installPath");
        Objects.requireNonNull(installedBy, "installedBy");
        Objects.requireNonNull(installedAt, "installedAt");
        hostKind = hostKind == null ? HostKind.DER_ESM : hostKind;
        source = source == null ? Source.MANUAL_UPLOAD : source;
        trustLevel = trustLevel == null ? TrustLevel.SIGNED : trustLevel;
    }

    /** Back-compat constructor for test fixtures that predate the Phase 2a
     *  hybrid-dispatcher columns. Defaults to the legacy posture
     *  (DER_ESM / MANUAL_UPLOAD / SIGNED). Production code constructs the
     *  full record so provenance is explicit. */
    public static InstalledApp legacy(final UUID appId, final String appKey,
                                         final String version, final String displayName,
                                         final String manifestJson, final String installPath,
                                         final UUID installedBy, final Instant installedAt,
                                         final boolean enabled) {
        return new InstalledApp(appId, appKey, version, displayName,
                manifestJson, installPath, installedBy, installedAt, enabled,
                HostKind.DER_ESM, Source.MANUAL_UPLOAD, TrustLevel.SIGNED,
                null, null);
    }

    /** DER-APPS-DHIS2-001 FR-APP-001 — which client-side host mounts this
     *  app. DER_ESM is the signed React ESM default export; DHIS2_IFRAME
     *  is the sandboxed iframe serving {@code /dhis-web-<appKey>/}. */
    public enum HostKind { DER_ESM, DHIS2_IFRAME }

    /** Provenance (D1). DER_BUILTIN ships with the server release;
     *  MANUAL_UPLOAD is an admin push; CENTRAL_SYNC is the Phase 4
     *  scheduled pull from DHIS2 central. */
    public enum Source { DER_BUILTIN, MANUAL_UPLOAD, CENTRAL_SYNC }

    /** Signing posture (D2). DHIS2_IFRAME apps may be UNSIGNED when
     *  the appliance's {@code apps.allow-unsigned-central} setting
     *  permits; DER_ESM apps must always be SIGNED. */
    public enum TrustLevel { SIGNED, UNSIGNED }
}
