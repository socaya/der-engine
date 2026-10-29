package ug.ac.mak.der.network;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.apache.tomcat.util.net.SSLHostConfig;
import org.apache.tomcat.util.net.SSLHostConfigCertificate;
import org.apache.tomcat.util.net.SSLHostConfigCertificate.Type;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Adds an HTTPS connector on {@code der.https.port} alongside the
 *  default HTTP listener. On first boot generates a self-signed
 *  PKCS12 keystore via {@code keytool} (ships with every JDK) so
 *  <code>https://localhost:8443/admin/</code> works out of the box.
 *
 *  <p>Pilot Ubuntu deploys replace the auto-generated keystore with a
 *  properly-provisioned cert (Let's Encrypt via the Linux agent, or
 *  the facility CA). Toggle off with {@code der.https.enabled=false}
 *  to run HTTP-only.</p>
 */
@Configuration
@ConditionalOnProperty(prefix = "der.https", name = "enabled",
                       havingValue = "true", matchIfMissing = true)
public class HttpsBootstrap {

    private static final Logger LOG = LoggerFactory.getLogger(HttpsBootstrap.class);

    @Value("${der.https.port:8443}")
    private int httpsPort;

    @Value("${der.https.keystore:}")
    private String keystorePath;

    @Value("${der.https.password:changeit}")
    private String keystorePassword;

    @Value("${der.https.alias:der-local}")
    private String keyAlias;

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> httpsCustomizer() {
        final Path ks = resolveKeystorePath();
        return factory -> {
            try {
                ensureKeystore(ks);
            } catch (final Exception ex) {
                LOG.warn("could not provision HTTPS keystore — skipping listener", ex);
                return;
            }
            factory.addAdditionalTomcatConnectors(buildConnector(ks));
            LOG.info("HTTPS listener bound at https://localhost:{} (keystore {})",
                     httpsPort, ks);
        };
    }

    private Path resolveKeystorePath() {
        if (keystorePath != null && !keystorePath.isBlank()) {
            return Paths.get(keystorePath);
        }
        return Paths.get(System.getProperty("user.home"), ".der", "der-local.p12");
    }

    private void ensureKeystore(final Path ks) throws IOException, InterruptedException {
        if (Files.exists(ks)) {
            return;
        }
        Files.createDirectories(ks.getParent());
        final String keytool = System.getProperty("java.home") + "/bin/keytool";
        final ProcessBuilder pb = new ProcessBuilder(
            keytool,
            "-genkeypair",
            "-alias", keyAlias,
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "3650",
            "-storetype", "PKCS12",
            "-keystore", ks.toString(),
            "-storepass", keystorePassword,
            "-keypass",   keystorePassword,
            "-dname", "CN=der.local, O=DER Edge, L=Dev",
            "-ext", "SAN=dns:der.local,dns:localhost,ip:127.0.0.1,ip:10.88.0.1");
        pb.redirectErrorStream(true);
        final Process p = pb.start();
        if (!p.waitFor(30, TimeUnit.SECONDS)) {
            p.destroyForcibly();
            throw new IOException("keytool timed out");
        }
        if (p.exitValue() != 0) {
            final String out = new String(p.getInputStream().readAllBytes());
            throw new IOException("keytool exit " + p.exitValue() + ": " + out);
        }
        LOG.info("Generated self-signed HTTPS keystore at {}", ks);
    }

    private Connector buildConnector(final Path ks) {
        final Connector c = new Connector("org.apache.coyote.http11.Http11NioProtocol");
        c.setPort(httpsPort);
        c.setSecure(true);
        c.setScheme("https");
        final Http11NioProtocol proto = (Http11NioProtocol) c.getProtocolHandler();
        proto.setSSLEnabled(true);
        final SSLHostConfig ssl = new SSLHostConfig();
        ssl.setProtocols("TLSv1.2+TLSv1.3");
        final SSLHostConfigCertificate cert = new SSLHostConfigCertificate(ssl, Type.UNDEFINED);
        cert.setCertificateKeystoreFile(ks.toString());
        cert.setCertificateKeystorePassword(keystorePassword);
        cert.setCertificateKeystoreType("PKCS12");
        cert.setCertificateKeyAlias(keyAlias);
        ssl.addCertificate(cert);
        proto.addSslHostConfig(ssl);
        return c;
    }
}
