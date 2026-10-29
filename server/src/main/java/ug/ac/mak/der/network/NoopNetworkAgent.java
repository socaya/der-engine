package ug.ac.mak.der.network;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Default agent for Mac/Windows dev + Docker evaluation. All actions
 *  succeed logically without touching the OS; the DB-backed state in
 *  the control plane is treated as source of truth.
 *
 *  Replace with a real OS adapter at deploy time by exposing a bean
 *  of type {@link NetworkAgent} — this one defers (@ConditionalOnMissingBean). */
@Configuration
public class NoopNetworkAgent {

    @Bean
    @ConditionalOnMissingBean(NetworkAgent.class)
    public NetworkAgent noopAgent() {
        return new Impl();
    }

    private static final class Impl implements NetworkAgent {
        private static final SecureRandom RNG = new SecureRandom();

        @Override public boolean startAccessPoint(final String ssid, final String security) {
            return true;
        }
        @Override public boolean stopAccessPoint() {
            return true;
        }
        @Override public String rotateApKey() {
            final byte[] key = new byte[32];
            RNG.nextBytes(key);
            try {
                final MessageDigest md = MessageDigest.getInstance("SHA-256");
                return HexFormat.of().formatHex(md.digest(key));
            } catch (final Exception ex) {
                return HexFormat.of().formatHex(key);
            }
        }
        @Override public boolean setInterfaceState(final String name, final boolean up) {
            return true;
        }
        @Override public boolean peerConnect(final String endpoint, final String publicKey) {
            return true;
        }
        @Override public boolean peerDisconnect(final String publicKey) {
            return true;
        }
        @Override public String edgeId() {
            return System.getProperty("der.edge.id", "edge-dev-" + Integer.toHexString(RNG.nextInt()));
        }
    }
}
