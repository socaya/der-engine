package ug.ac.mak.der.network;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceInfo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** User-space mDNS responder — broadcasts {@code _der._tcp.local.},
 *  {@code _derapi._tcp.local.} and {@code _http._tcp.local.} so
 *  Bonjour / Avahi clients can resolve the DER edge by name.
 *
 *  <p>On macOS the browser's name resolver uses Bonjour natively,
 *  so {@code https://der.local:8443} just works. On Linux desktops,
 *  install {@code nss-mdns} to get the same resolution. On Windows,
 *  install Bonjour Print Services.</p>
 *
 *  <p>Pilot Ubuntu edges use Avahi via the Linux agent instead;
 *  set {@code der.mdns.enabled=false} to disable this bean there
 *  so both responders don't fight. */
@Component
@ConditionalOnProperty(prefix = "der.mdns", name = "enabled",
                       havingValue = "true", matchIfMissing = true)
public class MdnsResponder {

    private static final Logger LOG = LoggerFactory.getLogger(MdnsResponder.class);

    @Value("${der.mdns.hostname:der}")
    private String hostname;

    @Value("${der.https.port:8443}")
    private int httpsPort;

    @Value("${server.port:8085}")
    private int httpPort;

    private final List<JmDNS> instances = new ArrayList<>();

    @PostConstruct
    public void start() {
        // Register on every usable IPv4 interface so clients on any
        // segment can see us. Loopback-only for localhost resolution,
        // plus any non-loopback real interface for LAN clients.
        for (final InetAddress addr : usableAddresses()) {
            try {
                final JmDNS mdns = JmDNS.create(addr, hostname);
                registerAll(mdns);
                instances.add(mdns);
                LOG.info("mDNS responder bound on {} as {}.local", addr.getHostAddress(), hostname);
            } catch (final Exception ex) {
                LOG.warn("mDNS bind failed on {}", addr, ex);
            }
        }
        if (instances.isEmpty()) {
            LOG.warn("mDNS responder started 0 instances — https://der.local won't resolve");
        }
    }

    @PreDestroy
    public void stop() {
        for (final JmDNS m : instances) {
            try {
                m.close();
            } catch (final Exception ignored) {
                // best-effort shutdown
            }
        }
        instances.clear();
    }

    private void registerAll(final JmDNS mdns) throws Exception {
        mdns.registerService(ServiceInfo.create(
            "_der._tcp.local.", "der", httpsPort,
            "DER HTTPS admin + capture"));
        mdns.registerService(ServiceInfo.create(
            "_derapi._tcp.local.", "der", httpsPort,
            "DER edge-api"));
        mdns.registerService(ServiceInfo.create(
            "_http._tcp.local.", "der", httpPort,
            "HTTP redirect to HTTPS"));
    }

    private static List<InetAddress> usableAddresses() {
        final List<InetAddress> out = new ArrayList<>();
        try {
            final Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                final NetworkInterface ni = ifaces.nextElement();
                if (!ni.isUp() || ni.isVirtual()) {
                    continue;
                }
                final Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    final InetAddress a = addrs.nextElement();
                    if (a instanceof Inet4Address) {
                        out.add(a);
                    }
                }
            }
        } catch (final Exception ex) {
            LOG.warn("could not enumerate network interfaces", ex);
        }
        if (out.isEmpty()) {
            try {
                out.add(InetAddress.getByName("127.0.0.1"));
            } catch (final Exception ignored) {
                // unreachable
            }
        }
        return Collections.unmodifiableList(out);
    }
}
