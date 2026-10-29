package ug.ac.mak.der.network;

/** Pluggable OS-level network adapter. Phase N1-N5 orchestration
 *  (hostapd, dnsmasq, nftables, iproute2, WireGuard, …) sits behind
 *  this interface so the DER control plane can run on any dev host
 *  (Mac, Windows, container) while the real OS calls land only on
 *  provisioned edge boxes.
 *
 *  Default implementation {@link NoopNetworkAgent} returns success
 *  without touching the OS — the control-plane state in Postgres
 *  stays authoritative. */
public interface NetworkAgent {

    /** Called when the admin UI asks to start the Access Point.
     *  @return true if the agent believes the AP is now running. */
    boolean startAccessPoint(String ssid, String security);

    /** Called when the admin UI asks to stop the Access Point. */
    boolean stopAccessPoint();

    /** Restart = stop + start, implementation may optimise. */
    default boolean restartAccessPoint(final String ssid, final String security) {
        stopAccessPoint();
        return startAccessPoint(ssid, security);
    }

    /** Rotate the Wi-Fi PSK / SAE password. Returns the hashed form the
     *  control plane should persist. The clear-text key is NEVER stored. */
    String rotateApKey();

    /** Bring an interface up/down. */
    boolean setInterfaceState(String name, boolean up);

    /** Dial / disconnect a WireGuard peer. */
    boolean peerConnect(String endpoint, String publicKey);
    boolean peerDisconnect(String publicKey);

    /** Returned string is non-null and uniquely identifies this host —
     *  typically from <code>/etc/machine-id</code> or a stable hash. */
    String edgeId();
}
