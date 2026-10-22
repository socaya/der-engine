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
        boolean enabled
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
    }
}
