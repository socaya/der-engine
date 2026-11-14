package ug.ac.mak.der.security;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.ops.AdminSettingRepository;

/**
 * Runtime-mutable read model of the ADR-0019 slice B
 * "require approved device" policy. The underlying
 * {@link SecurityProperties#deviceApproval()} setting is a Spring
 * {@code @ConfigurationProperties} (immutable after bind) which gives
 * the compile-time baseline; admins override that at runtime through
 * {@link DeviceApprovalController}.
 *
 * <p>Persistence lives in {@code der.admin_setting} under the key
 * {@value #SETTING_KEY} so an admin's choice survives server
 * restarts.</p>
 */
@Service
public class DeviceApprovalPolicy {

    static final String SETTING_KEY = "security.device-approval-required";

    private final AdminSettingRepository repo;
    private final boolean fallback;
    private volatile boolean required;

    public DeviceApprovalPolicy(final AdminSettingRepository repo,
                                   final SecurityProperties props) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.fallback = Objects.requireNonNull(props, "props")
                .deviceApproval().required();
        this.required = this.fallback;
        reload();
    }

    /** Current effective requirement. Thread-safe — reads from a
     *  volatile field written only through {@link #set(boolean, UUID)}. */
    public boolean required() {
        return required;
    }

    public synchronized void set(final boolean next, final UUID actorId) {
        repo.upsert(SETTING_KEY, Boolean.toString(next), actorId);
        this.required = next;
    }

    /** Pull the latest value from the store; used on startup and
     *  from tests. Falls back to the configured baseline when the
     *  store has no override or the stored value can't be parsed. */
    public synchronized void reload() {
        final Optional<AdminSettingRepository.Entry> entry = repo.read(SETTING_KEY);
        if (entry.isEmpty()) {
            this.required = fallback;
            return;
        }
        final String raw = entry.get().value();
        if (raw == null) {
            this.required = fallback;
            return;
        }
        final String v = raw.trim().toLowerCase(java.util.Locale.ROOT);
        if ("true".equals(v)) {
            this.required = true;
        } else if ("false".equals(v)) {
            this.required = false;
        } else {
            this.required = fallback;
        }
    }
}
