package ug.ac.mak.der.security;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.Provider;
import java.security.Security;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** §6 Security hardening — probe status of AppArmor, fail2ban,
 *  Vault reachability, FIPS mode. Pluggable secret provider.
 *
 *  <p>Every probe degrades gracefully: no apparmor_status binary →
 *  "not installed", no NOTIFY_SOCKET on fail2ban check → systemctl
 *  not available, Vault URL blank → "disabled".</p>
 */
@Service
public class SecurityHardeningService {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityHardeningService.class);

    @Value("${der.secrets.vault.url:}")
    private String vaultUrl;
    @Value("${der.secrets.vault.token:}")
    private String vaultToken;
    @Value("${der.secrets.vault.mount:secret}")
    private String vaultMount;
    @Value("${der.secrets.vault.path-prefix:der}")
    private String vaultPathPrefix;
    @Value("${der.security.fips.enabled:false}")
    private boolean fipsEnabled;

    private final ObjectMapper mapper;
    private final HttpClient http;

    public SecurityHardeningService(final ObjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.http = HttpClient.newBuilder()
                              .connectTimeout(Duration.ofSeconds(5))
                              .build();
    }

    /* ─── AppArmor ─────────────────────────────────────────────── */

    public Map<String, Object> apparmorStatus() {
        final Map<String, Object> m = new LinkedHashMap<>();
        final boolean installed = Files.isExecutable(Paths.get("/usr/sbin/apparmor_status"))
            || Files.isExecutable(Paths.get("/sbin/apparmor_status"));
        m.put("installed", installed);
        if (!installed) {
            m.put("reason", "apparmor_status not on PATH");
            return m;
        }
        final String out = run(5, "apparmor_status");
        if (out == null) {
            m.put("reason", "apparmor_status returned nothing");
            return m;
        }
        boolean derEnforced = false;
        boolean derComplain = false;
        for (final String line : out.split("\n")) {
            if (line.contains("der-server")) {
                if (out.contains("profiles are in enforce mode")
                        && out.indexOf("der-server") < out.indexOf("profiles are in complain mode", Math.max(0, out.indexOf("profiles are in enforce mode")))) {
                    derEnforced = true;
                }
                if (out.contains("profiles are in complain mode")) {
                    derComplain = true;
                }
            }
        }
        // Simpler parse: just report whether der-server appears at all.
        m.put("derProfileLoaded", out.contains("der-server"));
        m.put("inEnforceMode",    derEnforced);
        m.put("inComplainMode",   derComplain);
        m.put("summary",          firstLines(out, 6));
        return m;
    }

    /* ─── fail2ban ─────────────────────────────────────────────── */

    public Map<String, Object> fail2banStatus() {
        final Map<String, Object> m = new LinkedHashMap<>();
        final boolean installed = Files.isExecutable(Paths.get("/usr/bin/fail2ban-client"));
        m.put("installed", installed);
        if (!installed) {
            m.put("reason", "fail2ban-client not on PATH");
            return m;
        }
        final String overall = run(5, "fail2ban-client", "status");
        m.put("overall", overall == null ? null : firstLines(overall, 10));
        final String der = run(5, "fail2ban-client", "status", "der-auth");
        if (der != null) {
            final Map<String, Object> jail = new LinkedHashMap<>();
            for (final String line : der.split("\n")) {
                final String t = line.trim();
                if (t.startsWith("Currently failed:")) {
                    jail.put("currentlyFailed", parseIntTail(t));
                } else if (t.startsWith("Total failed:")) {
                    jail.put("totalFailed", parseIntTail(t));
                } else if (t.startsWith("Currently banned:")) {
                    jail.put("currentlyBanned", parseIntTail(t));
                } else if (t.startsWith("Total banned:")) {
                    jail.put("totalBanned", parseIntTail(t));
                } else if (t.startsWith("Banned IP list:")) {
                    jail.put("bannedIps", t.substring("Banned IP list:".length()).trim());
                }
            }
            m.put("derAuthJail", jail);
        }
        return m;
    }

    /* ─── Vault ───────────────────────────────────────────────── */

    public Map<String, Object> vaultStatus() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("configured", vaultUrl != null && !vaultUrl.isBlank());
        if (!(Boolean) m.get("configured")) {
            m.put("reason", "der.secrets.vault.url not set — falling back to env secrets");
            return m;
        }
        m.put("url", vaultUrl);
        m.put("mount", vaultMount);
        m.put("pathPrefix", vaultPathPrefix);
        try {
            final HttpResponse<String> r = http.send(
                HttpRequest.newBuilder(URI.create(vaultUrl + "/v1/sys/health"))
                           .timeout(Duration.ofSeconds(5))
                           .GET().build(),
                HttpResponse.BodyHandlers.ofString());
            @SuppressWarnings("unchecked")
            final Map<String, Object> body = r.statusCode() == 200
                ? mapper.readValue(r.body(), Map.class)
                : Map.of();
            m.put("reachable", r.statusCode() == 200);
            m.put("version", body.get("version"));
            m.put("sealed", body.get("sealed"));
            m.put("initialized", body.get("initialized"));
        } catch (final Exception ex) {
            m.put("reachable", false);
            m.put("reason", ex.getMessage() == null ? ex.getClass().getSimpleName()
                                                     : ex.getMessage());
        }
        return m;
    }

    /** Fetch a secret from Vault (KV v2) or fall back to env var.
     *  Env var name: upper-case path with slashes → underscores +
     *  {@code DER_SECRET_} prefix. Returns empty if neither source
     *  has the value. */
    public Optional<String> secret(final String key) {
        if (vaultUrl != null && !vaultUrl.isBlank()
                && vaultToken != null && !vaultToken.isBlank()) {
            final String url = vaultUrl + "/v1/" + vaultMount
                                + "/data/" + vaultPathPrefix + "/" + key;
            try {
                final HttpResponse<String> r = http.send(
                    HttpRequest.newBuilder(URI.create(url))
                               .timeout(Duration.ofSeconds(5))
                               .header("X-Vault-Token", vaultToken)
                               .GET().build(),
                    HttpResponse.BodyHandlers.ofString());
                if (r.statusCode() == 200) {
                    @SuppressWarnings("unchecked")
                    final Map<String, Object> body = mapper.readValue(r.body(), Map.class);
                    @SuppressWarnings("unchecked")
                    final Map<String, Object> data1 = (Map<String, Object>) body.get("data");
                    if (data1 != null) {
                        @SuppressWarnings("unchecked")
                        final Map<String, Object> data2 = (Map<String, Object>) data1.get("data");
                        if (data2 != null && data2.get("value") != null) {
                            return Optional.of(data2.get("value").toString());
                        }
                    }
                }
            } catch (final Exception ex) {
                LOG.debug("Vault fetch failed for {}", key, ex);
            }
        }
        final String envName = "DER_SECRET_" + key.toUpperCase()
                                                   .replace('/', '_').replace('-', '_');
        final String envVal = System.getenv(envName);
        return envVal == null || envVal.isBlank()
            ? Optional.empty() : Optional.of(envVal);
    }

    /* ─── FIPS mode ────────────────────────────────────────────── */

    public Map<String, Object> fipsStatus() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("fipsRequested", fipsEnabled);
        final List<Map<String, Object>> providers = new java.util.ArrayList<>();
        boolean anyFips = false;
        for (final Provider p : Security.getProviders()) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", p.getName());
            row.put("version", p.getVersionStr());
            final String info = p.getInfo() == null ? "" : p.getInfo();
            row.put("info", info.length() > 120 ? info.substring(0, 120) + "…" : info);
            final boolean fips = p.getName().toLowerCase().contains("fips")
                || info.toLowerCase().contains("fips");
            row.put("fips", fips);
            if (fips) {
                anyFips = true;
            }
            providers.add(row);
        }
        m.put("fipsProviderPresent", anyFips);
        m.put("providers", providers);
        // Weak algorithms we actively refuse when FIPS is on.
        if (fipsEnabled) {
            m.put("rejected", List.of("MD5", "SHA-1", "RSA/1024"));
        }
        return m;
    }

    public void assertFipsCompliant(final String algorithm) {
        if (!fipsEnabled) {
            return;
        }
        final String a = algorithm.toUpperCase().replace("-", "");
        if (a.equals("MD5") || a.equals("SHA1")
                || a.equals("RSA/1024") || a.equals("RSA1024")) {
            throw new IllegalStateException(
                "algorithm " + algorithm + " is not FIPS-compliant and der.security.fips.enabled=true");
        }
    }

    /* ─── Summary for admin UI ─────────────────────────────────── */

    public Map<String, Object> summary() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("apparmor", apparmorStatus());
        m.put("fail2ban", fail2banStatus());
        m.put("vault",    vaultStatus());
        m.put("fips",     fipsStatus());
        return m;
    }

    /* ─── Helpers ──────────────────────────────────────────────── */

    private static String run(final long timeoutSec, final String... argv) {
        try {
            final ProcessBuilder pb = new ProcessBuilder(argv).redirectErrorStream(true);
            final Process p = pb.start();
            if (!p.waitFor(timeoutSec, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return null;
            }
            return new String(p.getInputStream().readAllBytes(),
                               java.nio.charset.StandardCharsets.UTF_8);
        } catch (final IOException | InterruptedException ex) {
            return null;
        }
    }

    private static String firstLines(final String s, final int n) {
        final String[] lines = s.split("\n");
        final StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(lines.length, n); i++) {
            if (i > 0) {
                sb.append('\n');
            }
            sb.append(lines[i]);
        }
        return sb.toString();
    }

    private static Integer parseIntTail(final String s) {
        final String tail = s.substring(s.lastIndexOf(':') + 1).trim();
        try {
            return Integer.parseInt(tail);
        } catch (final NumberFormatException ex) {
            return null;
        }
    }
}
