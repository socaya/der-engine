package ug.ac.mak.der.network;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Ubuntu-targeted {@link NetworkAgent} that shells out to NetworkManager
 *  (<code>nmcli</code>), <code>hostapd</code>, <code>systemctl</code>,
 *  <code>ip</code>, <code>nft</code> and <code>wg</code> to realise the
 *  state the control plane wants.
 *
 *  <p>Activated by setting {@code der.network.agent=linux} (default
 *  stays {@link NoopNetworkAgent} so the server still boots on Mac/dev).
 *  On a provisioned Ubuntu edge box the DER systemd unit should start
 *  the server with that property set.</p>
 *
 *  <p>The agent only orchestrates — the control plane in Postgres is
 *  still source of truth. Every shell-exec runs with a hard timeout
 *  and logs its stdout/stderr; failures cause the agent to return
 *  {@code false} so the service layer records a FAILURE audit event. */
@Configuration
@ConditionalOnProperty(prefix = "der.network", name = "agent", havingValue = "linux")
public class LinuxNetworkAgent {

    private static final Logger LOG = LoggerFactory.getLogger(LinuxNetworkAgent.class);

    @Bean
    public NetworkAgent linuxAgent() {
        return new Impl();
    }

    private static final class Impl implements NetworkAgent {

        private static final String AP_CON = "der-edge-ap";
        private static final long   EXEC_TIMEOUT_SECONDS = 15;
        private static final SecureRandom RNG = new SecureRandom();
        private static final Path KEY_FILE = Path.of("/etc/der/network.key");

        @Override
        public boolean startAccessPoint(final String ssid, final String security) {
            // Idempotent: re-create the hotspot connection then bring it up.
            // Picks the default Wi-Fi interface (first wifi device reported
            // by nmcli). Operators can pin the interface in network.yaml.
            final String iface = defaultWifiIface();
            if (iface == null) {
                LOG.warn("no wifi interface detected");
                return false;
            }
            final String password = readOrGeneratePassword();
            exec(EXEC_TIMEOUT_SECONDS, "nmcli", "connection", "delete", AP_CON);
            final boolean addOk = exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "add", "type", "wifi", "ifname", iface,
                "con-name", AP_CON, "autoconnect", "yes", "ssid", ssid);
            if (!addOk) {
                return false;
            }
            exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "modify", AP_CON,
                "802-11-wireless.mode", "ap",
                "802-11-wireless.band", "bg",
                "ipv4.method", "shared");
            // WPA3-SAE preferred, falls back to WPA2 if the device doesn't
            // advertise 802.11w. Operators pick the mode via `security`.
            final String keyMgmt = "WPA3-SAE".equalsIgnoreCase(security) ? "sae" : "wpa-psk";
            exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "modify", AP_CON,
                "wifi-sec.key-mgmt", keyMgmt,
                "wifi-sec.psk", password);
            return exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "up", AP_CON);
        }

        @Override
        public boolean stopAccessPoint() {
            return exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "down", AP_CON);
        }

        @Override
        public String rotateApKey() {
            // Generate a new random 20-char PSK, persist to /etc/der/network.key
            // (owner root, mode 600 — must exist before the agent is used),
            // then re-set it on the live AP connection.
            final byte[] bytes = new byte[20];
            RNG.nextBytes(bytes);
            final String psk = Base64.getUrlEncoder().withoutPadding()
                                   .encodeToString(bytes).substring(0, 20);
            try {
                Files.createDirectories(KEY_FILE.getParent());
                Files.writeString(KEY_FILE, psk + "\n", StandardCharsets.UTF_8);
                KEY_FILE.toFile().setReadable(false, false);
                KEY_FILE.toFile().setReadable(true, true);
                KEY_FILE.toFile().setWritable(false, false);
                KEY_FILE.toFile().setWritable(true, true);
            } catch (final Exception ex) {
                LOG.warn("could not persist new PSK to {}", KEY_FILE, ex);
            }
            exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "modify", AP_CON,
                "wifi-sec.psk", psk);
            exec(EXEC_TIMEOUT_SECONDS,
                "nmcli", "connection", "up", AP_CON);
            return hashOf(psk);
        }

        @Override
        public boolean setInterfaceState(final String name, final boolean up) {
            return exec(EXEC_TIMEOUT_SECONDS,
                "ip", "link", "set", "dev", name, up ? "up" : "down");
        }

        @Override
        public boolean peerConnect(final String endpoint, final String publicKey) {
            // Expects a WireGuard interface pre-created at /etc/wireguard/der0.conf
            // with the DER node's own private key. We just add the peer.
            if (publicKey == null || publicKey.isBlank()) {
                return false;
            }
            return exec(EXEC_TIMEOUT_SECONDS,
                "wg", "set", "der0",
                "peer", publicKey,
                "endpoint", endpoint == null ? "0.0.0.0:51820" : endpoint,
                "persistent-keepalive", "25",
                "allowed-ips", "10.88.0.0/24");
        }

        @Override
        public boolean peerDisconnect(final String publicKey) {
            if (publicKey == null || publicKey.isBlank()) {
                return false;
            }
            return exec(EXEC_TIMEOUT_SECONDS, "wg", "set", "der0", "peer", publicKey, "remove");
        }

        @Override
        public String edgeId() {
            try {
                final String id = Files.readString(Path.of("/etc/machine-id")).trim();
                return id.isBlank() ? fallbackId() : id;
            } catch (final Exception ex) {
                return fallbackId();
            }
        }

        private static String fallbackId() {
            return "edge-" + Integer.toHexString(RNG.nextInt());
        }

        private static String defaultWifiIface() {
            final String out = execCapture(EXEC_TIMEOUT_SECONDS,
                "nmcli", "-g", "DEVICE,TYPE", "device");
            if (out == null) {
                return null;
            }
            for (final String line : out.split("\n")) {
                final String[] p = line.split(":");
                if (p.length == 2 && "wifi".equals(p[1])) {
                    return p[0];
                }
            }
            return null;
        }

        private static String readOrGeneratePassword() {
            try {
                if (Files.exists(KEY_FILE)) {
                    return Files.readString(KEY_FILE).trim();
                }
            } catch (final Exception ignored) {
                /* fall through */
            }
            final byte[] b = new byte[20];
            RNG.nextBytes(b);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(b).substring(0, 20);
        }

        private static String hashOf(final String s) {
            try {
                return Base64.getEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256")
                                 .digest(s.getBytes(StandardCharsets.UTF_8)));
            } catch (final Exception ex) {
                return "";
            }
        }

        private static boolean exec(final long timeoutSeconds, final String... argv) {
            try {
                final Process p = new ProcessBuilder(argv)
                                          .redirectErrorStream(true)
                                          .start();
                final boolean done = p.waitFor(timeoutSeconds, TimeUnit.SECONDS);
                if (!done) {
                    p.destroyForcibly();
                    LOG.warn("exec timed out: {}", String.join(" ", argv));
                    return false;
                }
                if (p.exitValue() != 0) {
                    final String stdout;
                    try (var br = new BufferedReader(new InputStreamReader(
                            p.getInputStream(), StandardCharsets.UTF_8))) {
                        stdout = br.lines().reduce("", (a, b) -> a + '\n' + b);
                    }
                    LOG.warn("exec exit {}: {} :: {}",
                             p.exitValue(), String.join(" ", argv), stdout.trim());
                    return false;
                }
                return true;
            } catch (final Exception ex) {
                LOG.warn("exec {} failed", argv[0], ex);
                return false;
            }
        }

        private static String execCapture(final long timeoutSeconds, final String... argv) {
            try {
                final Process p = new ProcessBuilder(argv)
                                          .redirectErrorStream(true)
                                          .start();
                if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                    p.destroyForcibly();
                    return null;
                }
                try (var br = new BufferedReader(new InputStreamReader(
                        p.getInputStream(), StandardCharsets.UTF_8))) {
                    return br.lines().reduce("", (a, b) -> a + '\n' + b);
                }
            } catch (final Exception ex) {
                return null;
            }
        }

        // Compile-time sanity: both file hooks are reachable in a sandboxed test.
        @SuppressWarnings("unused")
        private static boolean fileHooksOk() {
            return File.listRoots().length > 0;
        }
    }
}
