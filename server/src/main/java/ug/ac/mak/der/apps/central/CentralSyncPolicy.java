package ug.ac.mak.der.apps.central;

import java.util.List;
import java.util.Objects;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-004 — per-tenant allow/deny-list for
 * central app auto-sync.
 *
 * <p>Stored as a JSON blob in {@code system_setting} under the key
 * {@code apps.central-sync.policy}. Default when absent: ALLOW_ALL
 * so operators who haven't configured the policy aren't surprised by
 * sync silently filtering their apps.</p>
 *
 * <p>The three modes have well-defined semantics:
 * <ul>
 *   <li>{@code ALLOW_ALL} — no filtering; every discovered central
 *       app is a candidate.</li>
 *   <li>{@code ALLOW_LIST} — only {@code keys} are candidates. Apps
 *       discovered but not in the list land in detail with action
 *       {@code SKIP} and reason {@code not in allow-list}.</li>
 *   <li>{@code DENY_LIST} — all discovered apps are candidates
 *       except those in {@code keys}. Blocked apps report
 *       {@code SKIP} with reason {@code on deny-list}.</li>
 * </ul>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CentralSyncPolicy(Mode mode, List<String> keys, Source source) {

    public static final String SETTING_KEY = "apps.central-sync.policy";

    public enum Mode {
        ALLOW_ALL,
        ALLOW_LIST,
        DENY_LIST
    }

    /** Upstream source for auto-sync. Grew with the Phase 5 App Hub
     *  bridge: {@code CENTRAL} hits the paired DHIS2 instance's
     *  {@code /api/apps} (default; existing behaviour preserved);
     *  {@code APP_HUB} hits apps.dhis2.org and picks DHIS2-version
     *  compatible bundles. */
    public enum Source {
        CENTRAL,
        APP_HUB
    }

    public CentralSyncPolicy {
        mode = mode == null ? Mode.ALLOW_ALL : mode;
        keys = keys == null ? List.of() : List.copyOf(keys);
        source = source == null ? Source.CENTRAL : source;
    }

    /** Back-compat ctor for callers that don't carry a source. */
    public CentralSyncPolicy(final Mode mode, final List<String> keys) {
        this(mode, keys, Source.CENTRAL);
    }

    public static CentralSyncPolicy allowAll() {
        return new CentralSyncPolicy(Mode.ALLOW_ALL, List.of(), Source.CENTRAL);
    }

    /** @return true iff the candidate key passes the policy filter. */
    public boolean admits(final String centralKey) {
        if (centralKey == null) {
            return false;
        }
        final Set<String> set = Set.copyOf(keys);
        return switch (mode) {
            case ALLOW_ALL -> true;
            case ALLOW_LIST -> set.contains(centralKey);
            case DENY_LIST -> !set.contains(centralKey);
        };
    }

    /** Human-readable reason for a blocked candidate. */
    public String rejectionReason() {
        Objects.requireNonNull(mode, "mode");
        return switch (mode) {
            case ALLOW_ALL -> "";
            case ALLOW_LIST -> "not in allow-list";
            case DENY_LIST -> "on deny-list";
        };
    }
}
