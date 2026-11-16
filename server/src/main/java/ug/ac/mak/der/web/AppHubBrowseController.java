package ug.ac.mak.der.web;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.apps.central.AppHubClient;
import ug.ac.mak.der.apps.central.CentralApp;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * ADR-0005 companion to {@link AppsController}: lets the admin UI
 * browse the public DHIS2 App Hub
 * ({@code https://apps.dhis2.org/api/v1}) and compare it against the
 * currently-installed DHIS2 custom apps. The actual install is
 * performed by {@code POST /edge-api/v1/apps/install-from-hub} on
 * {@link AppsController} — this controller is read-only.
 *
 * <p>Independent from the ADR-0037 signed central-sync surface at
 * {@code /admin/apps/central-sync/*}, which gates installs behind an
 * Ed25519-signed catalogue. Operators who want a raw App Hub picker
 * (the DHIS2 ecosystem norm) use this endpoint; operators who want
 * policy-gated auto-sync use the central-sync surface.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/apps/hub",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AppHubBrowseController {

    private final AppHubClient hub;
    private final InstalledAppRepository installed;

    public AppHubBrowseController(final AppHubClient hub,
                                     final InstalledAppRepository installed) {
        this.hub = Objects.requireNonNull(hub, "hub");
        this.installed = Objects.requireNonNull(installed, "installed");
    }

    /**
     * {@code GET /edge-api/v1/admin/apps/hub} — the current App Hub
     * catalogue, filtered to versions compatible with the DER-pinned
     * DHIS2 max-tested version. Each row carries an
     * {@code installedVersion} so the UI can render an "Install" vs
     * "Upgrade to X" button appropriately.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        final List<CentralApp> hubApps;
        try {
            hubApps = hub.listApps();
        } catch (final IOException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "code", "APP_HUB_UNAVAILABLE",
                    "message", ex.getMessage()));
        }
        final Map<String, String> installedVersions = new LinkedHashMap<>();
        installed.findAll().forEach(a ->
                installedVersions.put(a.appKey(), a.version()));
        final List<Map<String, Object>> rows = hubApps.stream()
                .map(a -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("appKey", a.key());
                    m.put("displayName", a.displayName());
                    m.put("version", a.version());
                    m.put("downloadUrl", a.downloadUrl());
                    m.put("installedVersion", installedVersions.get(a.key()));
                    return m;
                })
                .toList();
        return ResponseEntity.ok(Map.of(
                "apps", rows,
                "hubCount", rows.size(),
                "installedCount", installedVersions.size()));
    }
}
