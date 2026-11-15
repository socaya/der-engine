package ug.ac.mak.der.apps.central;

import java.util.Objects;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2emulator.SystemSettingsRepository;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-004 — read/write the central-sync policy
 * through the existing {@code system_setting} store.
 *
 * <p>Reads treat any corrupted payload as {@link CentralSyncPolicy#allowAll()}
 * rather than throwing — a bad admin edit shouldn't wedge the scheduled
 * sync job, and the service's log-warn surfaces the malformed value for
 * operator attention.</p>
 */
@Service
public class CentralSyncPolicyService {

    private static final Logger LOG = LoggerFactory.getLogger(CentralSyncPolicyService.class);

    private final SystemSettingsRepository settings;
    private final ObjectMapper json;

    public CentralSyncPolicyService(final SystemSettingsRepository settings,
                                      final ObjectMapper json) {
        this.settings = Objects.requireNonNull(settings, "settings");
        this.json = Objects.requireNonNull(json, "json");
    }

    public CentralSyncPolicy read() {
        final String raw = settings.read(CentralSyncPolicy.SETTING_KEY);
        if (raw == null || raw.isBlank()) {
            return CentralSyncPolicy.allowAll();
        }
        try {
            final CentralSyncPolicy p = json.readValue(raw, CentralSyncPolicy.class);
            return p == null ? CentralSyncPolicy.allowAll() : p;
        } catch (JsonProcessingException ex) {
            LOG.warn("corrupt {} setting — falling back to ALLOW_ALL: {}",
                    CentralSyncPolicy.SETTING_KEY, ex.getMessage());
            return CentralSyncPolicy.allowAll();
        }
    }

    public void write(final CentralSyncPolicy policy, final java.util.UUID actor) {
        Objects.requireNonNull(policy, "policy");
        try {
            settings.upsert(CentralSyncPolicy.SETTING_KEY,
                    json.writeValueAsString(policy), actor);
        } catch (JsonProcessingException ex) {
            // Serialising a record never fails; unreachable.
            throw new IllegalStateException("could not serialise policy", ex);
        }
    }
}
