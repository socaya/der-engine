package ug.ac.mak.der.apps.central;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-002 — one app as enumerated by the
 * central DHIS2 {@code GET /api/apps} endpoint.
 *
 * <p>Central's native response is richer than this (icon URLs,
 * manifest URL, appType, pluginLaunchUrl, …) — we keep only the
 * fields the sync loop actually needs so the diff + install stays
 * mechanical. Unknown properties are tolerated so the DTO survives
 * central-side schema drift.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CentralApp(
        String key,
        String displayName,
        String version,
        String downloadUrl,
        String sha256) { }
