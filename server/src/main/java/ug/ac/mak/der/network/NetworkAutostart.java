package ug.ac.mak.der.network;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** When {@code der.network.ap.autoStart=true} (pilot default on Ubuntu
 *  edges) DER starts the Access Point as soon as the service is ready.
 *  Nearby devices then see the configured SSID in their Wi-Fi list
 *  without any operator click on the admin UI.
 *
 *  <p>Idempotent — if the AP is already running (NoopNetworkAgent will
 *  cheerfully report that, or operators previously clicked Start)
 *  the second call is a no-op. */
@Component
@ConditionalOnProperty(prefix = "der.network.ap", name = "autoStart",
                       havingValue = "true", matchIfMissing = false)
public class NetworkAutostart {

    private static final Logger LOG = LoggerFactory.getLogger(NetworkAutostart.class);

    private final NetworkService svc;

    public NetworkAutostart(final NetworkService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void autostartAccessPoint() {
        try {
            final boolean ok = svc.startAp("autostart");
            LOG.info("AP autostart requested — agent {} the request",
                     ok ? "accepted" : "rejected");
        } catch (final Exception ex) {
            LOG.warn("AP autostart failed", ex);
        }
    }
}
