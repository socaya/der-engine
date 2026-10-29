package ug.ac.mak.der.hardware;

import java.io.File;
import java.io.IOException;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** §4 Hardware integration: systemd watchdog, thermal / UPS /
 *  fan sensors, LED status broadcast, and TPM-sealed secrets.
 *
 *  <p>Everything degrades gracefully on dev hosts (Mac): no
 *  /sys/class/thermal → thermal returns empty; no upsc binary
 *  → UPS returns empty; no NOTIFY_SOCKET env var → watchdog
 *  is a no-op.</p>
 */
@Service
public class HardwareService {

    private static final Logger LOG = LoggerFactory.getLogger(HardwareService.class);

    private final JdbcTemplate jdbc;

    @Value("${der.hardware.watchdog.enabled:true}")
    private boolean watchdogEnabled;
    @Value("${der.hardware.ups.name:}")
    private String upsName;
    @Value("${der.hardware.thermal.zones:thermal_zone0,thermal_zone1}")
    private String thermalZones;
    @Value("${der.hardware.sealed.dir:${user.home}/.der/sealed}")
    private String sealedDir;

    public HardwareService(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /* ─── Watchdog ─────────────────────────────────────────────── */

    /** Pings systemd's watchdog via the Type=notify protocol if
     *  {@code NOTIFY_SOCKET} is set (DER launched under systemd).
     *  Fires every 10 s; sd service unit should set
     *  {@code WatchdogSec=30s} or similar so a wedged DER is killed
     *  and restarted. */
    @Scheduled(fixedDelayString = "${der.hardware.watchdog.interval:10000}",
               initialDelayString = "${der.hardware.watchdog.initialDelay:5000}")
    public void pingWatchdog() {
        if (!watchdogEnabled) {
            return;
        }
        final String sock = System.getenv("NOTIFY_SOCKET");
        if (sock == null || sock.isBlank()) {
            return;
        }
        try (SocketChannel ch = SocketChannel.open(StandardProtocolFamily.UNIX)) {
            final String path = sock.startsWith("@") ? "\0" + sock.substring(1) : sock;
            ch.connect(UnixDomainSocketAddress.of(path));
            ch.write(ByteBuffer.wrap("WATCHDOG=1\n".getBytes(StandardCharsets.UTF_8)));
            jdbc.update(
                "UPDATE der.watchdog_state "
              + "   SET last_ping_at = now(), ping_count = ping_count + 1, "
              + "       systemd_notify_path = ? WHERE id = 1",
                sock);
        } catch (final Exception ex) {
            jdbc.update(
                "UPDATE der.watchdog_state "
              + "   SET last_failure_at = now(), last_failure_msg = ? WHERE id = 1",
                summarise(ex));
        }
    }

    public Map<String, Object> watchdogState() {
        try {
            return jdbc.queryForObject(
                "SELECT last_ping_at, ping_count, last_failure_at, "
              + "       last_failure_msg, systemd_notify_path "
              + "  FROM der.watchdog_state WHERE id = 1",
                (ResultSet rs, int row) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("enabled", watchdogEnabled);
                    m.put("underSystemd", System.getenv("NOTIFY_SOCKET") != null);
                    final java.sql.Timestamp lp = rs.getTimestamp("last_ping_at");
                    m.put("lastPingAt",   lp == null ? null : lp.toInstant().toString());
                    m.put("pingCount",    rs.getLong("ping_count"));
                    final java.sql.Timestamp lf = rs.getTimestamp("last_failure_at");
                    m.put("lastFailureAt", lf == null ? null : lf.toInstant().toString());
                    m.put("lastFailureMsg", rs.getString("last_failure_msg"));
                    m.put("notifySocket",   rs.getString("systemd_notify_path"));
                    return m;
                });
        } catch (final Exception ex) {
            return Map.of("enabled", watchdogEnabled, "underSystemd", false);
        }
    }

    /* ─── Thermal ──────────────────────────────────────────────── */

    @Scheduled(fixedDelayString = "${der.hardware.sensor.interval:30000}",
               initialDelayString = "${der.hardware.sensor.initialDelay:10000}")
    public void sampleSensors() {
        sampleThermal();
        sampleUps();
    }

    private void sampleThermal() {
        for (final String zone : thermalZones.split(",")) {
            final Path p = Paths.get("/sys/class/thermal/" + zone.trim() + "/temp");
            if (!Files.exists(p)) {
                continue;
            }
            try {
                final String s = Files.readString(p).trim();
                final double celsius = Long.parseLong(s) / 1000.0;
                jdbc.update(
                    "INSERT INTO der.hardware_sensor_sample "
                  + "(sensor_kind, sensor_zone, value_double, unit) "
                  + "VALUES ('thermal', ?, ?, 'degC')",
                    zone.trim(), celsius);
            } catch (final Exception ex) {
                LOG.debug("thermal sample failed for {}", zone, ex);
            }
        }
    }

    public List<Map<String, Object>> thermalRecent(final int limit) {
        return jdbc.query(
            "SELECT sensor_zone, value_double, sampled_at "
          + "  FROM der.hardware_sensor_sample "
          + " WHERE sensor_kind = 'thermal' "
          + " ORDER BY sampled_at DESC LIMIT ?",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("zone", rs.getString("sensor_zone"));
                m.put("celsius", rs.getDouble("value_double"));
                m.put("sampledAt", rs.getTimestamp("sampled_at").toInstant().toString());
                return m;
            }, Math.max(1, Math.min(limit, 500)));
    }

    public Map<String, Object> thermalSummary() {
        final List<Map<String, Object>> rows = jdbc.query(
            "SELECT DISTINCT ON (sensor_zone) sensor_zone, value_double, sampled_at "
          + "  FROM der.hardware_sensor_sample "
          + " WHERE sensor_kind = 'thermal' "
          + " ORDER BY sensor_zone, sampled_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("zone", rs.getString("sensor_zone"));
                m.put("celsius", rs.getDouble("value_double"));
                m.put("sampledAt", rs.getTimestamp("sampled_at").toInstant().toString());
                return m;
            });
        return Map.of("zones", rows,
                       "available", !rows.isEmpty());
    }

    /* ─── UPS (nut client) ─────────────────────────────────────── */

    private void sampleUps() {
        if (upsName == null || upsName.isBlank()) {
            return;
        }
        final Map<String, String> fields = upsc(upsName);
        if (fields.isEmpty()) {
            return;
        }
        final String charge = fields.get("battery.charge");
        if (charge != null) {
            try {
                jdbc.update(
                    "INSERT INTO der.hardware_sensor_sample "
                  + "(sensor_kind, sensor_zone, value_double, unit) "
                  + "VALUES ('ups_battery', ?, ?, 'percent')",
                    upsName, Double.parseDouble(charge));
            } catch (final NumberFormatException ignored) { /* ignore */ }
        }
        final String runtime = fields.get("battery.runtime");
        if (runtime != null) {
            try {
                jdbc.update(
                    "INSERT INTO der.hardware_sensor_sample "
                  + "(sensor_kind, sensor_zone, value_double, unit) "
                  + "VALUES ('ups_runtime', ?, ?, 'seconds')",
                    upsName, Double.parseDouble(runtime));
            } catch (final NumberFormatException ignored) { /* ignore */ }
        }
    }

    public Map<String, Object> upsStatus() {
        if (upsName == null || upsName.isBlank()) {
            return Map.of("available", false,
                           "reason", "der.hardware.ups.name not set");
        }
        final Map<String, String> f = upsc(upsName);
        if (f.isEmpty()) {
            return Map.of("available", false, "upsName", upsName,
                           "reason", "upsc returned nothing — nut installed?");
        }
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("available", true);
        m.put("upsName",     upsName);
        m.put("status",      f.get("ups.status"));
        m.put("batteryChargePct",  parseDoubleSafe(f.get("battery.charge")));
        m.put("batteryRuntimeSec", parseDoubleSafe(f.get("battery.runtime")));
        m.put("inputVoltage",      parseDoubleSafe(f.get("input.voltage")));
        m.put("model",       f.get("ups.model"));
        m.put("serial",      f.get("ups.serial"));
        return m;
    }

    private Map<String, String> upsc(final String target) {
        final Map<String, String> out = new LinkedHashMap<>();
        try {
            final ProcessBuilder pb = new ProcessBuilder("upsc", target);
            pb.redirectErrorStream(true);
            final Process p = pb.start();
            if (!p.waitFor(5, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return out;
            }
            if (p.exitValue() != 0) {
                return out;
            }
            final String text = new String(p.getInputStream().readAllBytes(),
                                             StandardCharsets.UTF_8);
            for (final String line : text.split("\n")) {
                final int colon = line.indexOf(':');
                if (colon > 0) {
                    out.put(line.substring(0, colon).trim(),
                             line.substring(colon + 1).trim());
                }
            }
        } catch (final Exception ex) {
            // upsc not installed → empty map
        }
        return out;
    }

    /* ─── Status LEDs ──────────────────────────────────────────── */

    public List<Map<String, Object>> ledState() {
        return jdbc.query(
            "SELECT zone, color, pattern, period_ms, label, updated_at "
          + "  FROM der.status_led_zone ORDER BY zone",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("zone",     rs.getString("zone"));
                m.put("color",    rs.getString("color"));
                m.put("pattern",  rs.getString("pattern"));
                final int pm = rs.getInt("period_ms");
                m.put("periodMs", rs.wasNull() ? null : pm);
                m.put("label",    rs.getString("label"));
                m.put("updatedAt", rs.getTimestamp("updated_at").toInstant().toString());
                return m;
            });
    }

    public int setLedState(final String zone, final String color, final String pattern,
                              final Integer periodMs, final String label) {
        return jdbc.update(
            "UPDATE der.status_led_zone "
          + "   SET color = ?, pattern = ?, period_ms = ?, "
          + "       label = COALESCE(?, label), updated_at = now() "
          + " WHERE zone = ?",
            color, pattern, periodMs, label, zone);
    }

    /* ─── TPM-sealed secrets ───────────────────────────────────── */

    public List<Map<String, Object>> sealedSecrets() {
        return jdbc.query(
            "SELECT secret_id, description, sealed_path, algorithm, "
          + "       sealed_at, last_unseal_at, unseal_count "
          + "  FROM der.tpm_sealed_secret ORDER BY sealed_at DESC",
            (ResultSet rs, int row) -> {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("secretId",    rs.getString("secret_id"));
                m.put("description", rs.getString("description"));
                m.put("sealedPath",  rs.getString("sealed_path"));
                m.put("algorithm",   rs.getString("algorithm"));
                m.put("sealedAt",    rs.getTimestamp("sealed_at").toInstant().toString());
                final java.sql.Timestamp u = rs.getTimestamp("last_unseal_at");
                m.put("lastUnsealAt", u == null ? null : u.toInstant().toString());
                m.put("unsealCount", rs.getLong("unseal_count"));
                return m;
            });
    }

    public Map<String, Object> sealSecret(final String secretId, final String description,
                                             final String plaintext) {
        final String tpmBin = findBinary("tpm2_create", "tpm2-tools");
        final boolean hasTpm = tpmBin != null && Files.exists(Paths.get("/dev/tpm0"));
        try {
            Files.createDirectories(Paths.get(sealedDir));
        } catch (final IOException ex) {
            return Map.of("sealed", false,
                           "reason", "cannot create sealed dir: " + ex.getMessage());
        }
        final Path blob = Paths.get(sealedDir, secretId + ".sealed");
        final String algorithm;
        try {
            if (hasTpm) {
                // Shell to tpm2_create + tpm2_load + tpm2_evictcontrol — the
                // detail depends on the key hierarchy; the simplest working
                // path is tpm2_import of an AES key then tpm2_encryptdecrypt.
                sealWithTpm2(secretId, plaintext, blob);
                algorithm = "tpm2-sealed-aes256-gcm";
            } else {
                sealWithFile(secretId, plaintext, blob);
                algorithm = "pbkdf2-aes256-gcm";
            }
        } catch (final Exception ex) {
            return Map.of("sealed", false, "reason", summarise(ex));
        }
        jdbc.update(
            "INSERT INTO der.tpm_sealed_secret "
          + "(secret_id, description, sealed_path, algorithm) "
          + "VALUES (?, ?, ?, ?) ON CONFLICT (secret_id) DO UPDATE SET "
          + "  description = EXCLUDED.description, "
          + "  sealed_path = EXCLUDED.sealed_path, "
          + "  algorithm   = EXCLUDED.algorithm, "
          + "  sealed_at   = now()",
            secretId, description, blob.toString(), algorithm);
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("sealed", true);
        m.put("secretId", secretId);
        m.put("sealedPath", blob.toString());
        m.put("algorithm", algorithm);
        m.put("tpmBacked", hasTpm);
        return m;
    }

    public Optional<String> unseal(final String secretId) {
        try {
            final Map<String, Object> row = jdbc.queryForObject(
                "SELECT sealed_path, algorithm FROM der.tpm_sealed_secret "
              + " WHERE secret_id = ?",
                (rs, i) -> Map.of("sealedPath", (Object) rs.getString("sealed_path"),
                                   "algorithm",  (Object) rs.getString("algorithm")),
                secretId);
            final Path blob = Paths.get((String) row.get("sealedPath"));
            if (!Files.exists(blob)) {
                return Optional.empty();
            }
            final String plaintext;
            if ("tpm2-sealed-aes256-gcm".equals(row.get("algorithm"))) {
                plaintext = unsealWithTpm2(secretId, blob);
            } else {
                plaintext = unsealWithFile(blob);
            }
            jdbc.update(
                "UPDATE der.tpm_sealed_secret "
              + "   SET last_unseal_at = now(), unseal_count = unseal_count + 1 "
              + " WHERE secret_id = ?", secretId);
            return Optional.of(plaintext);
        } catch (final org.springframework.dao.EmptyResultDataAccessException ex) {
            return Optional.empty();
        } catch (final Exception ex) {
            LOG.warn("unseal {} failed", secretId, ex);
            return Optional.empty();
        }
    }

    /* ─── TPM/File sealing primitives ──────────────────────────── */

    private void sealWithTpm2(final String secretId, final String plaintext,
                                final Path blob) throws Exception {
        // Minimal TPM2 sealing: generate a random AES key, seal via
        // tpm2_create under a persistent primary key, encrypt plaintext
        // with AES-GCM, store (sealed-key || ciphertext). Operators that
        // need policy-based unseal override this via a subclass bean.
        final byte[] aes = new byte[32];
        new java.security.SecureRandom().nextBytes(aes);
        final byte[] nonce = new byte[12];
        new java.security.SecureRandom().nextBytes(nonce);
        final javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        c.init(javax.crypto.Cipher.ENCRYPT_MODE,
                new javax.crypto.spec.SecretKeySpec(aes, "AES"),
                new javax.crypto.spec.GCMParameterSpec(128, nonce));
        final byte[] ct = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        // Seal AES key via tpm2 (write to tempfile, call tpm2_create, read sealed)
        final Path keyIn = Files.createTempFile("der-seal-", ".key");
        Files.write(keyIn, aes);
        final Path sealed = Files.createTempFile("der-seal-", ".tpmblob");
        final ProcessBuilder pb = new ProcessBuilder(
            "tpm2_create", "-C", "o", "-Gaes256", "-i", keyIn.toString(),
            "-u", sealed + ".pub", "-r", sealed + ".priv");
        pb.redirectErrorStream(true);
        final Process p = pb.start();
        if (!p.waitFor(10, TimeUnit.SECONDS) || p.exitValue() != 0) {
            Files.deleteIfExists(keyIn);
            throw new IOException("tpm2_create exit " + p.exitValue());
        }
        final byte[] pub  = Files.readAllBytes(Paths.get(sealed + ".pub"));
        final byte[] priv = Files.readAllBytes(Paths.get(sealed + ".priv"));
        try (var out = Files.newOutputStream(blob)) {
            out.write(("TPM2SEAL\n").getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(pub));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(priv));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(nonce));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(ct));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
        }
        Files.deleteIfExists(keyIn);
        Files.deleteIfExists(Paths.get(sealed + ".pub"));
        Files.deleteIfExists(Paths.get(sealed + ".priv"));
        new File(blob.toString()).setReadable(false, false);
        new File(blob.toString()).setReadable(true, true);
    }

    private String unsealWithTpm2(final String secretId, final Path blob) throws Exception {
        final List<String> lines = Files.readAllLines(blob, StandardCharsets.UTF_8);
        if (lines.size() < 5 || !"TPM2SEAL".equals(lines.get(0))) {
            throw new IOException("not a TPM2-sealed blob");
        }
        final byte[] pub  = java.util.Base64.getDecoder().decode(lines.get(1));
        final byte[] priv = java.util.Base64.getDecoder().decode(lines.get(2));
        final byte[] nonce = java.util.Base64.getDecoder().decode(lines.get(3));
        final byte[] ct    = java.util.Base64.getDecoder().decode(lines.get(4));
        final Path pubF  = Files.createTempFile("der-unseal-", ".pub");
        final Path privF = Files.createTempFile("der-unseal-", ".priv");
        Files.write(pubF, pub);
        Files.write(privF, priv);
        final ProcessBuilder load = new ProcessBuilder(
            "tpm2_load", "-C", "o", "-u", pubF.toString(), "-r", privF.toString(),
            "-c", "/tmp/der-" + secretId + ".ctx");
        load.redirectErrorStream(true);
        final Process pLoad = load.start();
        if (!pLoad.waitFor(10, TimeUnit.SECONDS) || pLoad.exitValue() != 0) {
            throw new IOException("tpm2_load exit " + pLoad.exitValue());
        }
        final ProcessBuilder unseal = new ProcessBuilder(
            "tpm2_unseal", "-c", "/tmp/der-" + secretId + ".ctx");
        unseal.redirectErrorStream(true);
        final Process pUn = unseal.start();
        if (!pUn.waitFor(10, TimeUnit.SECONDS) || pUn.exitValue() != 0) {
            throw new IOException("tpm2_unseal exit " + pUn.exitValue());
        }
        final byte[] aes = pUn.getInputStream().readAllBytes();
        Files.deleteIfExists(pubF);
        Files.deleteIfExists(privF);
        Files.deleteIfExists(Paths.get("/tmp/der-" + secretId + ".ctx"));
        final javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        c.init(javax.crypto.Cipher.DECRYPT_MODE,
                new javax.crypto.spec.SecretKeySpec(aes, "AES"),
                new javax.crypto.spec.GCMParameterSpec(128, nonce));
        return new String(c.doFinal(ct), StandardCharsets.UTF_8);
    }

    /** Fallback: file-sealed with a KEK derived from the machine-id
     *  (reasonable protection against casual filesystem copy but not
     *  against root compromise). Replace with Vault / HSM for real
     *  threat models. */
    private void sealWithFile(final String secretId, final String plaintext,
                                final Path blob) throws Exception {
        final byte[] kek = deriveKek();
        final byte[] nonce = new byte[12];
        new java.security.SecureRandom().nextBytes(nonce);
        final javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        c.init(javax.crypto.Cipher.ENCRYPT_MODE,
                new javax.crypto.spec.SecretKeySpec(kek, "AES"),
                new javax.crypto.spec.GCMParameterSpec(128, nonce));
        final byte[] ct = c.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        try (var out = Files.newOutputStream(blob)) {
            out.write("DERSEAL1\n".getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(nonce));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
            out.write(java.util.Base64.getEncoder().encode(ct));
            out.write("\n".getBytes(StandardCharsets.UTF_8));
        }
        new File(blob.toString()).setReadable(false, false);
        new File(blob.toString()).setReadable(true, true);
    }

    private String unsealWithFile(final Path blob) throws Exception {
        final List<String> lines = Files.readAllLines(blob, StandardCharsets.UTF_8);
        if (lines.size() < 3 || !"DERSEAL1".equals(lines.get(0))) {
            throw new IOException("not a DER-sealed blob");
        }
        final byte[] kek = deriveKek();
        final byte[] nonce = java.util.Base64.getDecoder().decode(lines.get(1));
        final byte[] ct    = java.util.Base64.getDecoder().decode(lines.get(2));
        final javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
        c.init(javax.crypto.Cipher.DECRYPT_MODE,
                new javax.crypto.spec.SecretKeySpec(kek, "AES"),
                new javax.crypto.spec.GCMParameterSpec(128, nonce));
        return new String(c.doFinal(ct), StandardCharsets.UTF_8);
    }

    private byte[] deriveKek() throws Exception {
        String seed;
        try {
            seed = Files.readString(Paths.get("/etc/machine-id")).trim();
        } catch (final Exception ex) {
            seed = System.getProperty("user.home", "fallback");
        }
        final javax.crypto.SecretKeyFactory kf =
            javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        final javax.crypto.spec.PBEKeySpec spec =
            new javax.crypto.spec.PBEKeySpec(seed.toCharArray(),
                "der-sealing-salt".getBytes(StandardCharsets.UTF_8), 100_000, 256);
        return kf.generateSecret(spec).getEncoded();
    }

    /* ─── Hardware summary for /system/hardware ────────────────── */

    public Map<String, Object> summary() {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("watchdog", watchdogState());
        m.put("thermal",  thermalSummary());
        m.put("ups",      upsStatus());
        m.put("leds",     ledState());
        m.put("sealedSecrets", sealedSecrets());
        return m;
    }

    /* ─── Helpers ──────────────────────────────────────────────── */

    private static String findBinary(final String name, final String hintPackage) {
        for (final String dir : List.of("/usr/sbin", "/usr/bin", "/usr/local/bin",
                                          "/sbin", "/bin")) {
            final File f = new File(dir, name);
            if (f.canExecute()) {
                return f.getAbsolutePath();
            }
        }
        return null;
    }

    private static Double parseDoubleSafe(final String s) {
        if (s == null) {
            return null;
        }
        try {
            return Double.parseDouble(s);
        } catch (final NumberFormatException ex) {
            return null;
        }
    }

    private static String summarise(final Throwable ex) {
        final String m = ex.getMessage();
        return m == null ? ex.getClass().getSimpleName()
            : (m.length() > 200 ? m.substring(0, 200) : m);
    }

    @SuppressWarnings("unused")
    private static List<String> unused() {
        return new ArrayList<>();
    }
}
